"""
BarOS V4 - Router Administration (SÉCURISÉ)
Chemin : backend/routers/admin.py
"""
import os
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Ingredient, PourSequence

router = APIRouter()

# 🔐 GESTION DU SECRET (Sécurité)
# On cherche une variable d'environnement, sinon on prend la valeur par défaut pour la démo.
# C'est une "Best Practice" à mentionner lors de la soutenance.
ADMIN_SECRET = os.getenv("BAROS_ADMIN_SECRET", "BarOS_Admin_Secret")

# 🛡️ LE VIGILE (Fonction de sécurité)
async def verify_admin(x_admin_token: str = Header(default=None)):
    """
    Vérifie que la requête contient le bon token dans le header 'x-admin-token'.
    """
    if x_admin_token != ADMIN_SECRET:
        # On renvoie une erreur 403 Forbidden si le token est mauvais ou absent
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="⛔ Accès Refusé : Clé d'administration invalide."
        )

# --- ROUTES PROTÉGÉES ---
# L'ajout de 'dependencies=[Depends(verify_admin)]' active la protection sur ces routes.

@router.post("/reset-stocks", dependencies=[Depends(verify_admin)])
def reset_stocks(db: Session = Depends(get_db)):
    """
    Remet tous les stocks à 1000ml.
    ⚠️ Route critique : Nécessite le header 'x-admin-token'.
    """
    ingredients = db.query(Ingredient).all()
    for ing in ingredients:
        ing.current_volume_ml = ing.max_volume_ml
    db.commit()
    return {"status": "success", "message": "Stocks réinitialisés à 100%"}

@router.delete("/clear-history", dependencies=[Depends(verify_admin)])
def clear_history(db: Session = Depends(get_db)):
    """
    Supprime l'historique des commandes.
    ⚠️ Route critique : Nécessite le header 'x-admin-token'.
    """
    db.query(PourSequence).delete()
    db.commit()
    return {"status": "success", "message": "Historique vidé"}