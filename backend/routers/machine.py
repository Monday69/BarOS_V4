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
    return await machine_service.get_full_status(db)

@router.post("/config")
async def update_machine_config(config: Dict[str, Any], db: Session = Depends(get_db)):
    if "slots" not in config:
        raise HTTPException(status_code=400, detail="Format invalide, 'slots' requis")
    
    await machine_service.apply_config(config["slots"], db)
    return {"status": "success", "message": "Configuration mise à jour"}