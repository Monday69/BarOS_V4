"""
BarOS V4 — Router File d'Attente
Chemin : backend/routers/queue.py

CORRECTIFS v4.1 :
  [BUG]     asyncio.create_task() appelé depuis des fonctions sync → crash
            en production. Tous les endpoints qui broadcastent sont passés
            en async def.
"""
import os
import asyncio
import random
import string
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Set

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from backend.database import get_db, SessionLocal
from backend.models import QueueEntry, Recipe, User, OrderHistory, PushSubscription
from backend.services.cocktail_service import CocktailService
from backend.services.machine_service import MachineService

router           = APIRouter()
cocktail_service = CocktailService()
machine_service  = MachineService()

_ADMIN_SECRET = os.getenv("BAROS_ADMIN_SECRET")


async def verify_admin(x_admin_token: str = Header(default=None)):
    if not _ADMIN_SECRET or x_admin_token != _ADMIN_SECRET:
        raise HTTPException(403, "Acces refuse")


# =============================================================================
# WEBSOCKET — BROADCAST
# =============================================================================

_ws_clients: Set[WebSocket] = set()

async def _broadcast(event: str, data: dict = None):
    if not _ws_clients:
        return
    message = json.dumps({"event": event, "data": data or {}})
    dead = set()
    for ws in _ws_clients:
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)
    _ws_clients -= dead


@router.websocket("/ws")
async def queue_websocket(websocket: WebSocket):
    await websocket.accept()
    _ws_clients.add(websocket)
    print(f"[WS] Client connecte — {len(_ws_clients)} total", flush=True)

    try:
        db = SessionLocal()
        try:
            entries = _active_queue(db)
            is_busy = machine_service.is_machine_busy(db)
            ready   = next((e for e in entries if e.status == "ready"), None)
            payload = {
                "queue":   [_serialize(e, i + 1) for i, e in enumerate(entries)],
                "count":   len(entries),
                "is_busy": is_busy,
                "ready":   _serialize(ready, 1, show_code=True) if ready else None,
            }
            await websocket.send_text(json.dumps({"event": "queue_snapshot", "data": payload}))
        finally:
            db.close()
    except Exception as e:
        print(f"[WS] Erreur snapshot initial: {e}", flush=True)

    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] Erreur: {e}", flush=True)
    finally:
        _ws_clients.discard(websocket)
        print(f"[WS] Client deconnecte — {len(_ws_clients)} restants", flush=True)


# =============================================================================
# BACKGROUND — EXECUTION SEQUENCE
# =============================================================================

async def _execute_and_done(sequence_id: int, queue_id: int):
    db = SessionLocal()
    try:
        await cocktail_service.execute_sequence(sequence_id, db)
        entry = db.get(QueueEntry, queue_id)
        if entry:
            entry.status  = "done"
            entry.done_at = datetime.now(timezone.utc)
            db.commit()
        await _broadcast("queue_updated", {"reason": "sequence_done", "queue_id": queue_id})
    except Exception as e:
        print(f"Queue sequence #{sequence_id} erreur: {e}")
    finally:
        db.close()


# =============================================================================
# AUTO-CALLER
# =============================================================================

_auto_caller_running  = False
_CALLER_INTERVAL_BASE = 8
_CALLER_INTERVAL_MAX  = 60

async def auto_caller_loop():
    global _auto_caller_running
    _auto_caller_running = True
    interval = _CALLER_INTERVAL_BASE
    print(f"Auto-caller demarre (base {interval}s, max {_CALLER_INTERVAL_MAX}s)")

    while True:
        await asyncio.sleep(interval)
        db = SessionLocal()
        try:
            # ── Rappels push pour les "ready" depuis > 2 min ──────────────
            reminder_cutoff = datetime.now(timezone.utc) - timedelta(minutes=2)
            stale_ready = (
                db.query(QueueEntry)
                .options(joinedload(QueueEntry.user), joinedload(QueueEntry.recipe))
                .filter(
                    QueueEntry.status   == "ready",
                    QueueEntry.ready_at <= reminder_cutoff,
                )
                .all()
            )
            for entry in stale_ready:
                sub = db.query(PushSubscription).filter(
                    PushSubscription.user_id == entry.user_id
                ).first()
                if sub:
                    try:
                        _send_push(sub, {
                            "title": "⏰ Rappel — Votre cocktail vous attend !",
                            "body":  f"Le code pour votre {entry.recipe.name if entry.recipe else 'cocktail'} "
                                     f"expire bientot. Saisissez-le maintenant.",
                            "data":  {"entry_id": entry.id, "type": "reminder"},
                        })
                    except Exception as e:
                        print(f"[Rappel] Push echoue: {e}")

            # ── Vérifier si on peut appeler le suivant ────────────────────
            if machine_service.is_machine_busy(db):
                interval = min(interval * 2, _CALLER_INTERVAL_MAX)
                continue

            already_ready = db.query(QueueEntry).filter(QueueEntry.status == "ready").first()
            if already_ready:
                interval = min(interval + 4, _CALLER_INTERVAL_MAX)
                continue

            next_entry = (
                db.query(QueueEntry)
                .options(joinedload(QueueEntry.user), joinedload(QueueEntry.recipe))
                .filter(QueueEntry.status == "waiting")
                .order_by(QueueEntry.created_at)
                .first()
            )
            if not next_entry:
                interval = min(interval * 2, _CALLER_INTERVAL_MAX)
                continue

            # ── Appel → reset interval ────────────────────────────────────
            interval = _CALLER_INTERVAL_BASE

            next_entry.status       = "ready"
            next_entry.confirm_code = _make_code()
            next_entry.ready_at     = datetime.now(timezone.utc)
            db.commit()
            db.refresh(next_entry)

            print(f"Auto-caller → {next_entry.user.name} ({next_entry.recipe.name}) code {next_entry.confirm_code}")

            await _broadcast("queue_updated", {
                "reason":    "auto_called",
                "user_name": next_entry.user.name,
                "entry_id":  next_entry.id,
            })

            sub = db.query(PushSubscription).filter(
                PushSubscription.user_id == next_entry.user_id
            ).first()
            if sub:
                try:
                    _send_push(sub, {
                        "title": "🍹 C'est votre tour !",
                        "body":  f"Votre {next_entry.recipe.name} est pret. Saisissez le code.",
                        "data":  {"entry_id": next_entry.id},
                    })
                except Exception as e:
                    print(f"Push echoue: {e}")

        except Exception as e:
            print(f"Auto-caller erreur: {e}")
            interval = min(interval * 2, _CALLER_INTERVAL_MAX)
        finally:
            db.close()


def start_auto_caller():
    if not _auto_caller_running:
        asyncio.create_task(auto_caller_loop())


# =============================================================================
# HELPERS
# =============================================================================

def _make_code() -> str:
    return ''.join(random.choices(string.digits, k=6))

def _wait_minutes(position: int) -> float:
    return max(0, (position - 1) * 2)

def _serialize(entry: QueueEntry, position: int, show_code: bool = False) -> dict:
    return {
        "id":           entry.id,
        "user_id":      entry.user_id,
        "user_name":    entry.user.name       if entry.user   else None,
        "recipe_id":    entry.recipe_id,
        "recipe_name":  entry.recipe.name     if entry.recipe else None,
        "recipe_image": entry.recipe.image_url if entry.recipe else None,
        "status":       entry.status,
        "position":     position,
        "wait_minutes": _wait_minutes(position),
        "confirm_code": entry.confirm_code if show_code else None,
        "created_at":   entry.created_at.isoformat() if entry.created_at else None,
        "ready_at":     entry.ready_at.isoformat()   if entry.ready_at   else None,
    }

def _active_queue(db: Session) -> List[QueueEntry]:
    return (
        db.query(QueueEntry)
        .options(joinedload(QueueEntry.user), joinedload(QueueEntry.recipe))
        .filter(QueueEntry.status.in_(["waiting", "ready", "confirmed"]))
        .order_by(QueueEntry.created_at)
        .all()
    )


# =============================================================================
# SCHEMAS
# =============================================================================

class QueueCreate(BaseModel):
    user_id:    int
    recipe_id:  int
    cost_price: Optional[float] = None
    sale_price: Optional[float] = None

class ConfirmPayload(BaseModel):
    code:    str
    user_id: int


# =============================================================================
# ENDPOINTS REST — tous en async def pour pouvoir appeler _broadcast()
# =============================================================================

@router.get("")
async def get_queue(db: Session = Depends(get_db)):
    entries = _active_queue(db)
    is_busy = machine_service.is_machine_busy(db)
    ready   = next((e for e in entries if e.status == "ready"), None)
    return {
        "queue":   [_serialize(e, i + 1) for i, e in enumerate(entries)],
        "count":   len(entries),
        "is_busy": is_busy,
        "ready":   _serialize(ready, 1, show_code=True) if ready else None,
    }


@router.get("/my/{user_id}")
async def get_my_queue(user_id: int, db: Session = Depends(get_db)):
    entries = _active_queue(db)
    for i, e in enumerate(entries):
        if e.user_id == user_id:
            return _serialize(e, i + 1, show_code=(e.status == "ready"))
    return {"status": "not_in_queue"}


@router.post("")
async def join_queue(
    payload:          QueueCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    recipe = db.query(Recipe).filter(
        Recipe.id == payload.recipe_id, Recipe.is_available == True
    ).first()
    if not recipe:
        raise HTTPException(404, "Cocktail introuvable ou indisponible")

    existing = db.query(QueueEntry).filter(
        QueueEntry.user_id == payload.user_id,
        QueueEntry.status.in_(["waiting", "ready"]),
    ).first()
    if existing:
        raise HTTPException(409, {
            "code":     "ALREADY_IN_QUEUE",
            "message":  "Vous avez deja un cocktail en file d'attente",
            "entry_id": existing.id,
        })

    current_count = db.query(QueueEntry).filter(
        QueueEntry.status.in_(["waiting", "ready"])
    ).count()

    entry = QueueEntry(
        user_id    = payload.user_id,
        recipe_id  = payload.recipe_id,
        status     = "waiting",
        position   = current_count + 1,
        cost_price = payload.cost_price,
        sale_price = payload.sale_price,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    entry = (
        db.query(QueueEntry)
        .options(joinedload(QueueEntry.user), joinedload(QueueEntry.recipe))
        .filter(QueueEntry.id == entry.id)
        .first()
    )

    await _broadcast("queue_updated", {
        "reason":      "joined",
        "user_name":   user.name,
        "recipe_name": recipe.name,
    })

    return {
        **_serialize(entry, current_count + 1),
        "message": f"Ajoute en file — position {current_count + 1}",
    }


@router.post("/{entry_id}/ready", dependencies=[Depends(verify_admin)])
async def mark_ready(entry_id: int, db: Session = Depends(get_db)):
    entry = (
        db.query(QueueEntry)
        .options(joinedload(QueueEntry.user), joinedload(QueueEntry.recipe))
        .filter(QueueEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(404, "Entree introuvable")
    if entry.status != "waiting":
        raise HTTPException(400, f"Statut inattendu : {entry.status}")

    prev_ready = db.query(QueueEntry).filter(
        QueueEntry.status == "ready", QueueEntry.id != entry_id,
    ).first()
    if prev_ready:
        prev_ready.status       = "waiting"
        prev_ready.confirm_code = None

    entry.status       = "ready"
    entry.confirm_code = _make_code()
    entry.ready_at     = datetime.now(timezone.utc)
    db.commit()

    await _broadcast("queue_updated", {"reason": "admin_called", "entry_id": entry.id})

    sub = db.query(PushSubscription).filter(PushSubscription.user_id == entry.user_id).first()
    if sub:
        try:
            _send_push(sub, {
                "title": "C'est votre tour !",
                "body":  f"Votre {entry.recipe.name} est pret. Saisissez le code.",
                "data":  {"entry_id": entry.id},
            })
        except Exception as e:
            print(f"Push echoue: {e}")

    return {**_serialize(entry, 1, show_code=True), "message": "Code genere"}


@router.post("/{entry_id}/confirm")
async def confirm_queue(
    entry_id:         int,
    payload:          ConfirmPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    entry = (
        db.query(QueueEntry)
        .options(joinedload(QueueEntry.user), joinedload(QueueEntry.recipe))
        .filter(QueueEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(404, "Entree introuvable")
    if entry.user_id != payload.user_id:
        raise HTTPException(403, {"code": "FORBIDDEN", "message": "Commande non autorisee"})
    if entry.status != "ready":
        raise HTTPException(400, "Ce cocktail n'est pas encore pret")
    if entry.confirm_code != payload.code.strip():
        raise HTTPException(401, {"code": "WRONG_CODE", "message": "Code incorrect"})

    entry.status       = "confirmed"
    entry.confirmed_at = datetime.now(timezone.utc)

    db.add(OrderHistory(
        user_id    = entry.user_id,
        recipe_id  = entry.recipe_id,
        cost_price = entry.cost_price,
        sale_price = entry.sale_price,
    ))
    db.commit()

    recipe_id = entry.recipe_id
    entry_id_ = entry.id

    async def _launch():
        db2 = SessionLocal()
        try:
            seq = await cocktail_service.create_pour_sequence(recipe_id, 1, None, db2)
            db2.commit()
            await _execute_and_done(seq["id"], entry_id_)
        except Exception as e:
            print(f"Erreur lancement sequence: {e}")
        finally:
            db2.close()

    background_tasks.add_task(_launch)

    await _broadcast("queue_updated", {"reason": "confirmed", "entry_id": entry_id_})

    return {
        "status":      "confirmed",
        "message":     "C'est parti ! Preparation en cours...",
        "recipe_name": entry.recipe.name if entry.recipe else None,
    }


@router.delete("/{entry_id}")
async def cancel_queue(
    entry_id: int,
    user_id:  int = Query(...),
    db: Session = Depends(get_db),
):
    entry = db.get(QueueEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Entree introuvable")
    if entry.user_id != user_id:
        raise HTTPException(403, "Vous ne pouvez annuler que votre propre entree")
    if entry.status in ("confirmed", "done"):
        raise HTTPException(400, "Trop tard pour annuler")

    entry.status = "cancelled"
    db.commit()

    await _broadcast("queue_updated", {"reason": "cancelled", "entry_id": entry_id})

    return {"message": "Annule"}


@router.delete("/{entry_id}/admin", dependencies=[Depends(verify_admin)])
async def admin_cancel_queue(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(QueueEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Entree introuvable")

    entry.status = "cancelled"
    db.commit()

    await _broadcast("queue_updated", {"reason": "admin_cancelled", "entry_id": entry_id})

    return {"message": "Annule par admin"}


# =============================================================================
# PUSH HELPER
# =============================================================================

def _send_push(sub: PushSubscription, payload: dict):
    try:
        from pywebpush import webpush
        vapid_private = os.getenv("VAPID_PRIVATE_KEY")
        vapid_email   = os.getenv("VAPID_EMAIL", "admin@baros.local")
        if not vapid_private:
            return
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=vapid_private,
            vapid_claims={"sub": f"mailto:{vapid_email}"},
        )
    except ImportError:
        print("pywebpush non installe")
    except Exception as e:
        print(f"Push erreur: {e}")