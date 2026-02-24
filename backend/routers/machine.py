"""
BarOS V4 - Router Machine
Chemin : backend/routers/machine.py
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from backend.database import get_db
from backend.services.machine_service import MachineService

router = APIRouter()
machine_service = MachineService()


@router.get("/status")
async def get_machine_status(db: Session = Depends(get_db)):
    """
    État complet de la machine.
    Inclut désormais stock_alerts avec critical/warning/ok et un health_score.
    """
    return await machine_service.get_full_status(db)


@router.get("/alerts")
async def get_stock_alerts(db: Session = Depends(get_db)):
    """
    Endpoint dédié aux alertes stocks — plus léger que /status complet.
    Utilisé par le Dashboard pour un polling fréquent sans surcharger.
    Retourne : critical[], warning[], summary { health_score, has_alerts, ... }
    """
    return machine_service.get_stock_alerts(db)


@router.post("/config")
async def update_machine_config(config: Dict[str, Any], db: Session = Depends(get_db)):
    if "slots" not in config:
        raise HTTPException(status_code=400, detail="Format invalide, 'slots' requis")

    await machine_service.apply_config(config["slots"], db)
    return {"status": "success", "message": "Configuration mise à jour"}