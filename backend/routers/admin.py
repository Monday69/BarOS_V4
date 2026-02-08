"""
BarOS V4 - Router Administration
Chemin : backend/routers/admin.py
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Ingredient, PourSequence

router = APIRouter()

@router.post("/reset-stocks")
def reset_stocks(db: Session = Depends(get_db)):
    """Remet tous les stocks à 1000ml (Pour dev)"""
    ingredients = db.query(Ingredient).all()
    for ing in ingredients:
        ing.current_volume_ml = ing.max_volume_ml
    db.commit()
    return {"status": "success", "message": "Stocks réinitialisés"}

@router.delete("/clear-history")
def clear_history(db: Session = Depends(get_db)):
    """Supprime l'historique des commandes"""
    db.query(PourSequence).delete()
    db.commit()
    return {"status": "success", "message": "Historique vidé"}