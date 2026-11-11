"""
BarOS V4 - Router Machine
Chemin : backend/routers/machine.py

AJOUTS v2 :
  [PERF] Cache TTL sur /status et /alerts : evite de frapper la DB
         a chaque polling frontend (Dashboard toutes les 30s, N users).
         TTL status = 3s (quasi temps-reel), TTL alerts = 10s.
  [PERF] /busy reste sans cache — il est critique pour l'auto-caller
         et tres leger (une seule query COUNT sur PourSequence).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
import time

from backend.database import get_db
from backend.services.machine_service import MachineService
from backend.routers.admin import verify_admin

router = APIRouter()
machine_service = MachineService()

# ── Cache simple en memoire ────────────────────────────────────────────────────
# Structure : { key: {"data": ..., "expires_at": float} }
# Pas de dependance externe (redis, memcached) — suffisant pour un seul process.
_cache: dict = {}

def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and entry["expires_at"] > time.monotonic():
        return entry["data"]
    return None

def _cache_set(key: str, data, ttl_seconds: float):
    _cache[key] = {"data": data, "expires_at": time.monotonic() + ttl_seconds}

def _cache_invalidate(key: str):
    _cache.pop(key, None)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_machine_status(db: Session = Depends(get_db)):
    """
    Etat complet de la machine (slots, alertes, busy).
    Cache TTL 3s : quasi temps-reel mais evite N requetes/seconde
    quand plusieurs clients sont connectes simultanement.
    """
    cached = _cache_get("machine_status")
    if cached is not None:
        return cached

    data = await machine_service.get_full_status(db)
    _cache_set("machine_status", data, ttl_seconds=3)
    return data


@router.get("/alerts")
async def get_stock_alerts(db: Session = Depends(get_db)):
    """
    Alertes stock (critical / warning / ok).
    Cache TTL 10s : les alertes changent lentement (remplissage bouteilles).
    """
    cached = _cache_get("machine_alerts")
    if cached is not None:
        return cached

    data = machine_service.get_stock_alerts(db)
    _cache_set("machine_alerts", data, ttl_seconds=10)
    return data


@router.get("/busy")
def get_machine_busy(db: Session = Depends(get_db)):
    """
    Endpoint leger — indique si une sequence est en cours.
    PAS de cache : critique pour l'auto-caller et la file d'attente.
    """
    busy = machine_service.is_machine_busy(db)
    return {"busy": busy}


@router.post("/config", dependencies=[Depends(verify_admin)])
async def update_machine_config(config: Dict[str, Any], db: Session = Depends(get_db)):
    if "slots" not in config:
        raise HTTPException(status_code=400, detail="Format invalide, 'slots' requis")
    await machine_service.apply_config(config["slots"], db)

    # Invalider le cache apres une modification de config
    _cache_invalidate("machine_status")
    _cache_invalidate("machine_alerts")

    return {"status": "success", "message": "Configuration mise a jour"}