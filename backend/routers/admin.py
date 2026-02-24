"""
BarOS V4 - Router Administration (SÉCURISÉ)
Chemin : backend/routers/admin.py

Ajout v3 :
  - GET  /margin → retourne la marge actuelle depuis config.json
  - PUT  /margin → met à jour la marge dans config.json (protégé admin)
  - Marge en % : Prix de vente = coût × (1 + margin_percent / 100)
"""
import os
import io
import csv
import json

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from datetime import datetime, timezone
from fastapi.responses import StreamingResponse

from backend.database import get_db
from backend.models import Ingredient, PourSequence, OrderHistory, PourStep

router = APIRouter()

# ── Sécurité ──────────────────────────────────────────────────────────────────
_ADMIN_SECRET = os.getenv("BAROS_ADMIN_SECRET")
if not _ADMIN_SECRET:
    raise RuntimeError(
        "Variable d'environnement BAROS_ADMIN_SECRET non définie. "
        "Ajoutez-la dans votre fichier .env ou votre config système."
    )

async def verify_admin(x_admin_token: str = Header(default=None)):
    if x_admin_token != _ADMIN_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : clé d'administration invalide."
        )

# ── Helpers config.json ───────────────────────────────────────────────────────
def _config_path() -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, "config.json")

def _read_config() -> dict:
    try:
        with open(_config_path(), "r") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(500, f"Impossible de lire config.json : {e}")

def _write_config(data: dict):
    try:
        with open(_config_path(), "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        raise HTTPException(500, f"Impossible d'écrire config.json : {e}")

# ── Modèles Pydantic ──────────────────────────────────────────────────────────
class MarginUpdate(BaseModel):
    margin_percent: float

# ── GET /margin ───────────────────────────────────────────────────────────────
@router.get("/margin")
def get_margin():
    """Retourne la marge actuelle. Non protégé — le frontend en a besoin."""
    config = _read_config()
    return {"margin_percent": config.get("margin_percent", 0.0)}

# ── PUT /margin ───────────────────────────────────────────────────────────────
@router.put("/margin", dependencies=[Depends(verify_admin)])
def update_margin(payload: MarginUpdate):
    """Met à jour la marge dans config.json. Protégé admin."""
    if payload.margin_percent < 0 or payload.margin_percent > 500:
        raise HTTPException(400, "Marge invalide (0–500%)")
    config = _read_config()
    config["margin_percent"] = round(payload.margin_percent, 2)
    _write_config(config)
    return {"margin_percent": config["margin_percent"], "status": "updated"}

# ── POST /reset-stocks ────────────────────────────────────────────────────────
@router.post("/reset-stocks", dependencies=[Depends(verify_admin)])
def reset_stocks(db: Session = Depends(get_db)):
    ingredients = db.query(Ingredient).all()
    for ing in ingredients:
        ing.current_volume_ml = ing.max_volume_ml
    db.commit()
    return {"status": "success", "message": f"Stocks réinitialisés ({len(ingredients)} ingrédients)"}

# ── DELETE /clear-history ─────────────────────────────────────────────────────
@router.delete("/clear-history", dependencies=[Depends(verify_admin)])
def clear_history(db: Session = Depends(get_db)):
    try:
        deleted_steps  = db.query(PourStep).delete()
        deleted_seq    = db.query(PourSequence).delete()
        deleted_orders = db.query(OrderHistory).delete()
        db.commit()
        return {
            "status":  "success",
            "message": f"Historique purgé ({deleted_orders} cmds, {deleted_seq} seqs, {deleted_steps} étapes)"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ── GET /export/csv ───────────────────────────────────────────────────────────
@router.get("/export/csv", dependencies=[Depends(verify_admin)])
def export_orders_csv(db: Session = Depends(get_db)):
    orders = db.query(OrderHistory).options(
        joinedload(OrderHistory.recipe),
        joinedload(OrderHistory.user)
    ).order_by(OrderHistory.timestamp.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["ID", "Date", "Heure", "Client", "Cocktail", "Catégorie",
                     "Coût de Revient (€)", "Prix de Vente (€)", "Marge (€)", "Note (/5)"])

    for o in orders:
        utc_dt   = o.timestamp.replace(tzinfo=timezone.utc)
        local_dt = utc_dt.astimezone()
        date_str = local_dt.strftime("%d/%m/%Y")
        time_str = local_dt.strftime("%H:%M:%S")
        client   = o.user.name if o.user else "Anonyme/Labo"
        cocktail = o.recipe.name if o.recipe else "Mix Custom"
        category = o.recipe.category if o.recipe else "-"
        cost     = round(o.cost_price, 2) if o.cost_price is not None else 0.0
        price    = round(o.recipe.price, 2) if o.recipe and o.recipe.price else 0.0
        marge    = round(price - cost, 2)
        rating   = o.rating if o.rating else "-"
        writer.writerow([o.id, date_str, time_str, client, cocktail, category,
                         cost, price, marge, rating])

    output.seek(0)
    filename = f"BarOS_Export_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(output, media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})