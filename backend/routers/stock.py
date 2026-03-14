"""
BarOS V4 — Router Stock Arrière-Boutique
Chemin : backend/routers/stock.py

Endpoints :
  GET  /api/stock                    → Vue complète : machine + réserve pour chaque ingrédient
  GET  /api/stock/{ingredient_id}    → Détail d'un ingrédient
  PUT  /api/stock/{ingredient_id}    → Mettre à jour la réserve (volume, format, seuil, notes)
  POST /api/stock/{ingredient_id}/add   → Ajouter du stock en réserve (ex: livraison)
  POST /api/stock/{ingredient_id}/transfer → Transférer réserve → machine
"""
import os
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional, List

from backend.database import get_db
from backend.models import Ingredient, StockReserve

router = APIRouter()

# ── Auth ──────────────────────────────────────────────────────────────────────
_ADMIN_SECRET = os.getenv("BAROS_ADMIN_SECRET")

async def verify_admin(x_admin_token: str = Header(default=None)):
    if not _ADMIN_SECRET or x_admin_token != _ADMIN_SECRET:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

# ── Schemas ───────────────────────────────────────────────────────────────────

class ReserveUpdate(BaseModel):
    reserve_ml:         Optional[float] = None
    bottle_size_ml:     Optional[float] = None
    alert_threshold_ml: Optional[float] = None
    notes:              Optional[str]   = None

class AddStockPayload(BaseModel):
    bottles:    Optional[int]   = None   # nombre de bouteilles ajoutées
    volume_ml:  Optional[float] = None   # OU volume précis en ml
    notes:      Optional[str]   = None

class TransferPayload(BaseModel):
    volume_ml: float   # combien transférer vers la machine

# ── Helper : garantir qu'une réserve existe pour l'ingrédient ────────────────
def _get_or_create_reserve(ingredient_id: int, db: Session) -> StockReserve:
    reserve = db.query(StockReserve).filter(
        StockReserve.ingredient_id == ingredient_id
    ).first()
    if not reserve:
        reserve = StockReserve(ingredient_id=ingredient_id)
        db.add(reserve)
        db.flush()
    return reserve

# ── Helper : sérialiser un ingrédient + sa réserve ───────────────────────────
def _serialize(ing: Ingredient) -> dict:
    r = ing.reserve
    reserve_ml         = r.reserve_ml         if r else 0.0
    bottle_size_ml     = r.bottle_size_ml     if r else 750.0
    alert_threshold_ml = r.alert_threshold_ml if r else 1500.0
    notes              = r.notes              if r else None

    machine_pct = round((ing.current_volume_ml / ing.max_volume_ml) * 100, 1) \
                  if ing.max_volume_ml else 0.0

    bottles_approx = round(reserve_ml / bottle_size_ml, 1) \
                     if bottle_size_ml else 0

    # Niveau d'alerte global
    machine_low   = machine_pct < 25
    reserve_empty = reserve_ml <= 0
    reserve_low   = 0 < reserve_ml < alert_threshold_ml

    if machine_low and reserve_empty:
        alert = "critical"
    elif machine_low or reserve_low:
        alert = "warning"
    else:
        alert = "ok"

    return {
        "id":                   ing.id,
        "name":                 ing.name,
        "type":                 ing.type,
        "brand":                ing.brand,
        "image_url":            ing.image_url,
        "pump_id":              ing.pump_id,
        "alcohol_degree":       ing.alcohol_degree,
        "purchase_price_per_liter": ing.purchase_price_per_liter,
        # Machine
        "machine_volume_ml":    ing.current_volume_ml,
        "machine_max_ml":       ing.max_volume_ml,
        "machine_pct":          machine_pct,
        # Réserve
        "reserve_ml":           reserve_ml,
        "bottle_size_ml":       bottle_size_ml,
        "bottles_approx":       bottles_approx,
        "alert_threshold_ml":   alert_threshold_ml,
        "notes":                notes,
        # Statut
        "alert":                alert,
        "machine_low":          machine_low,
        "reserve_empty":        reserve_empty,
        "reserve_low":          reserve_low,
    }

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", dependencies=[Depends(verify_admin)])
def get_full_stock(db: Session = Depends(get_db)):
    """
    Vue complète arrière-boutique : tous les ingrédients avec
    leur niveau machine et leur stock réserve.
    Triés : critiques → warnings → ok, puis par pump_id.
    """
    ingredients = (
        db.query(Ingredient)
        .outerjoin(StockReserve)
        .options(joinedload(Ingredient.reserve))
        .all()
    )
    items = [_serialize(ing) for ing in ingredients]

    # Tri : critiques en premier, puis warnings, puis ok
    order = {"critical": 0, "warning": 1, "ok": 2}
    items.sort(key=lambda x: (order[x["alert"]], x["pump_id"] or 999))

    # Résumé stats
    total         = len(items)
    critical_count = sum(1 for i in items if i["alert"] == "critical")
    warning_count  = sum(1 for i in items if i["alert"] == "warning")
    ok_count       = total - critical_count - warning_count
    total_reserve  = sum(i["reserve_ml"] for i in items)

    return {
        "items": items,
        "summary": {
            "total":          total,
            "critical":       critical_count,
            "warning":        warning_count,
            "ok":             ok_count,
            "total_reserve_l": round(total_reserve / 1000, 2),
        }
    }


@router.get("/{ingredient_id}", dependencies=[Depends(verify_admin)])
def get_ingredient_stock(ingredient_id: int, db: Session = Depends(get_db)):
    ing = db.query(Ingredient).options(joinedload(Ingredient.reserve))\
            .filter(Ingredient.id == ingredient_id).first()
    if not ing:
        raise HTTPException(404, "Ingrédient introuvable")
    return _serialize(ing)


@router.put("/{ingredient_id}", dependencies=[Depends(verify_admin)])
def update_reserve(
    ingredient_id: int,
    payload: ReserveUpdate,
    db: Session = Depends(get_db),
):
    """Met à jour les paramètres de la réserve (format bouteille, seuil, notes)."""
    ing = db.get(Ingredient, ingredient_id)
    if not ing:
        raise HTTPException(404, "Ingrédient introuvable")
    reserve = _get_or_create_reserve(ingredient_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(reserve, field, value)
    db.commit()
    db.refresh(ing)
    return _serialize(ing)


@router.post("/{ingredient_id}/add", dependencies=[Depends(verify_admin)])
def add_to_reserve(
    ingredient_id: int,
    payload: AddStockPayload,
    db: Session = Depends(get_db),
):
    """
    Ajoute du stock en réserve (livraison, réassort).
    Accepte soit un nombre de bouteilles, soit un volume précis en ml.
    """
    ing = db.query(Ingredient).options(joinedload(Ingredient.reserve))\
            .filter(Ingredient.id == ingredient_id).first()
    if not ing:
        raise HTTPException(404, "Ingrédient introuvable")

    reserve = _get_or_create_reserve(ingredient_id, db)

    if payload.bottles is not None:
        added_ml = payload.bottles * reserve.bottle_size_ml
    elif payload.volume_ml is not None:
        added_ml = payload.volume_ml
    else:
        raise HTTPException(400, "Précisez 'bottles' ou 'volume_ml'")

    if added_ml <= 0:
        raise HTTPException(400, "Le volume ajouté doit être positif")

    reserve.reserve_ml += added_ml
    if payload.notes:
        reserve.notes = payload.notes

    db.commit()
    db.refresh(ing)
    return {
        **_serialize(ing),
        "added_ml": added_ml,
        "message":  f"+{added_ml:.0f} ml ajoutés en réserve",
    }


@router.post("/{ingredient_id}/transfer", dependencies=[Depends(verify_admin)])
def transfer_to_machine(
    ingredient_id: int,
    payload: TransferPayload,
    db: Session = Depends(get_db),
):
    """
    Transfère du stock réserve → machine (current_volume_ml).
    Sécurité : on ne peut pas transférer plus que ce qui est en réserve,
    ni dépasser max_volume_ml de la machine.
    """
    ing = db.query(Ingredient).options(joinedload(Ingredient.reserve))\
            .filter(Ingredient.id == ingredient_id).first()
    if not ing:
        raise HTTPException(404, "Ingrédient introuvable")

    reserve = _get_or_create_reserve(ingredient_id, db)

    if payload.volume_ml <= 0:
        raise HTTPException(400, "Le volume transféré doit être positif")

    if payload.volume_ml > reserve.reserve_ml:
        raise HTTPException(400, {
            "code":    "NOT_ENOUGH_RESERVE",
            "message": f"Réserve insuffisante ({reserve.reserve_ml:.0f} ml disponibles)",
            "available": reserve.reserve_ml,
        })

    space_in_machine = ing.max_volume_ml - ing.current_volume_ml
    actual_transfer  = min(payload.volume_ml, space_in_machine)

    if actual_transfer <= 0:
        raise HTTPException(400, {
            "code":    "MACHINE_FULL",
            "message": "La machine est déjà pleine",
        })

    reserve.reserve_ml     -= actual_transfer
    ing.current_volume_ml  += actual_transfer

    db.commit()
    db.refresh(ing)
    return {
        **_serialize(ing),
        "transferred_ml": actual_transfer,
        "message":        f"{actual_transfer:.0f} ml transférés vers la machine",
    }