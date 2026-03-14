"""
BarOS V4 — Router Push Notifications (PWA)
Chemin : backend/routers/push.py

Gère les subscriptions WebPush des clients.
Flow :
  1. Client demande la permission notif dans le navigateur
  2. Navigateur génère une subscription (endpoint + clés)
  3. Frontend → POST /api/push/subscribe avec la subscription
  4. Backend stocke en DB (1 par user, upsert)
  5. Quand c'est le tour du user → queue.py appelle _send_push()

Setup VAPID (une seule fois) :
  pip install pywebpush
  vapid --gen
  → génère private_key.pem et public_key.pem
  Exporter les clés dans .env :
  VAPID_PRIVATE_KEY=<contenu private_key.pem>
  VAPID_PUBLIC_KEY=<clé publique base64url>
  VAPID_EMAIL=admin@tondomaine.com
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
from backend.models import PushSubscription, User

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────
class SubscribePayload(BaseModel):
    user_id:  int
    endpoint: str
    p256dh:   str
    auth:     str

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/vapid-public-key")
def get_vapid_public_key():
    """
    Retourne la clé publique VAPID au frontend.
    Le frontend en a besoin pour créer la subscription PWA.
    """
    key = os.getenv("VAPID_PUBLIC_KEY")
    if not key:
        raise HTTPException(503, "VAPID non configuré sur ce serveur")
    return {"public_key": key}

@router.post("/subscribe")
def subscribe(payload: SubscribePayload, db: Session = Depends(get_db)):
    """
    Enregistre ou met à jour la subscription PWA d'un user.
    Upsert : si le user a déjà une subscription, on la remplace.
    """
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    sub = db.query(PushSubscription)\
            .filter(PushSubscription.user_id == payload.user_id).first()

    if sub:
        # Mise à jour si le navigateur a changé de subscription
        sub.endpoint = payload.endpoint
        sub.p256dh   = payload.p256dh
        sub.auth     = payload.auth
    else:
        sub = PushSubscription(
            user_id  = payload.user_id,
            endpoint = payload.endpoint,
            p256dh   = payload.p256dh,
            auth     = payload.auth,
        )
        db.add(sub)

    db.commit()
    return {"status": "ok", "message": "Subscription enregistrée"}

@router.delete("/unsubscribe/{user_id}")
def unsubscribe(user_id: int, db: Session = Depends(get_db)):
    """Supprime la subscription d'un user (désactivation notifs)."""
    sub = db.query(PushSubscription)\
            .filter(PushSubscription.user_id == user_id).first()
    if sub:
        db.delete(sub)
        db.commit()
    return {"status": "ok"}

@router.get("/status/{user_id}")
def push_status(user_id: int, db: Session = Depends(get_db)):
    """Indique si le user a une subscription active."""
    sub = db.query(PushSubscription)\
            .filter(PushSubscription.user_id == user_id).first()
    return {"subscribed": sub is not None}