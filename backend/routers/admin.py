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
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from fastapi.responses import StreamingResponse

from backend.database import get_db
from backend.models import Ingredient, PourSequence, OrderHistory, PourStep, User, Recipe

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

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

# ── PUT /payment-config ──────────────────────────────────────────────────────
class PaymentConfigUpdate(BaseModel):
    require_payment: bool

@router.put("/payment-config", dependencies=[Depends(verify_admin)])
def update_payment_config(payload: PaymentConfigUpdate):
    """Active/désactive le paiement obligatoire."""
    config = _read_config()
    if "payment" not in config:
        config["payment"] = {}
    config["payment"]["require_payment"] = payload.require_payment
    _write_config(config)
    return {"require_payment": payload.require_payment, "status": "updated"}

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


# =============================================================================
# ENDPOINTS DASHBOARD PATRON — v2
# =============================================================================

@router.get("/revenue-by-day")
def revenue_by_day(
    days: int = 30,
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin),
):
    """Revenus agrégés par jour sur les N derniers jours."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(
            func.date(OrderHistory.timestamp).label("date"),
            func.count(OrderHistory.id).label("orders"),
            func.coalesce(func.sum(OrderHistory.sale_price), 0).label("revenue"),
            func.coalesce(func.sum(OrderHistory.cost_price),  0).label("cost"),
        )
        .filter(
            OrderHistory.timestamp >= since,
            OrderHistory.recipe_id.isnot(None),
        )
        .group_by(func.date(OrderHistory.timestamp))
        .order_by(func.date(OrderHistory.timestamp))
        .all()
    )
    return [
        {
            "date":    str(r.date),
            "orders":  r.orders,
            "revenue": round(float(r.revenue), 2),
            "cost":    round(float(r.cost), 2),
            "margin":  round(float(r.revenue) - float(r.cost), 2),
        }
        for r in rows
    ]


@router.get("/top-cocktails")
def top_cocktails(
    days:  int = 30,
    limit: int = 8,
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin),
):
    """Top cocktails par nombre de commandes + revenu généré."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(
            OrderHistory.recipe_id,
            func.count(OrderHistory.id).label("count"),
            func.coalesce(func.sum(OrderHistory.sale_price), 0).label("revenue"),
            func.avg(OrderHistory.rating).label("avg_rating"),
        )
        .filter(
            OrderHistory.timestamp >= since,
            OrderHistory.recipe_id.isnot(None),
        )
        .group_by(OrderHistory.recipe_id)
        .order_by(func.count(OrderHistory.id).desc())
        .limit(limit)
        .all()
    )
    result = []
    for r in rows:
        recipe = db.get(Recipe, r.recipe_id)
        result.append({
            "recipe_id":  r.recipe_id,
            "name":       recipe.name if recipe else f"Recette #{r.recipe_id}",
            "count":      r.count,
            "revenue":    round(float(r.revenue), 2),
            "avg_rating": round(float(r.avg_rating), 1) if r.avg_rating else None,
        })
    return result


@router.get("/top-users")
def top_users(
    days:  int = 30,
    limit: int = 8,
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin),
):
    """Top clients par dépenses totales sur la période."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(
            OrderHistory.user_id,
            func.count(OrderHistory.id).label("orders"),
            func.coalesce(func.sum(OrderHistory.sale_price), 0).label("total_spent"),
            func.avg(OrderHistory.rating).label("avg_rating"),
        )
        .filter(
            OrderHistory.timestamp >= since,
            OrderHistory.user_id.isnot(None),
            OrderHistory.recipe_id.isnot(None),
        )
        .group_by(OrderHistory.user_id)
        .order_by(func.sum(OrderHistory.sale_price).desc())
        .limit(limit)
        .all()
    )
    result = []
    for r in rows:
        user = db.get(User, r.user_id)
        result.append({
            "user_id":     r.user_id,
            "name":        user.name if user else f"User #{r.user_id}",
            "orders":      r.orders,
            "total_spent": round(float(r.total_spent), 2),
            "avg_rating":  round(float(r.avg_rating), 1) if r.avg_rating else None,
        })
    return result

@router.get("/export/users", dependencies=[Depends(verify_admin)])
def export_users_xlsx(db: Session = Depends(get_db)):
    """Export Excel de tous les utilisateurs avec leurs soldes."""
    users = db.query(User).order_by(User.name).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Utilisateurs BarOS"

    # En-têtes
    headers = ["ID", "Nom", "Carte NFC (UID)", "Solde (€)", "Genre", "Poids (kg)", "Âge", "Admin", "Créé le"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font      = Font(bold=True, color="FFFFFF")
        cell.fill      = PatternFill("solid", fgColor="1a1a2e")
        cell.alignment = Alignment(horizontal="center")

    # Données
    for row, u in enumerate(users, 2):
        ws.cell(row=row, column=1, value=u.id)
        ws.cell(row=row, column=2, value=u.name)
        ws.cell(row=row, column=3, value=u.card_uid)
        ws.cell(row=row, column=4, value=round(u.balance or 0.0, 2))
        ws.cell(row=row, column=5, value=u.gender or "—")
        ws.cell(row=row, column=6, value=u.weight_kg)
        ws.cell(row=row, column=7, value=u.age)
        ws.cell(row=row, column=8, value="Oui" if u.is_admin else "Non")
        ws.cell(row=row, column=9, value=u.created_at.strftime("%d/%m/%Y %H:%M") if u.created_at else "—")

        # Ligne alternée
        if row % 2 == 0:
            for col in range(1, 10):
                ws.cell(row=row, column=col).fill = PatternFill("solid", fgColor="f5f5f5")

    # Largeurs colonnes
    for col, width in zip("ABCDEFGHI", [6, 20, 16, 12, 8, 12, 6, 8, 18]):
        ws.column_dimensions[col].width = width

    # Ligne total solde
    ws.append([])
    total_row = len(users) + 3
    ws.cell(row=total_row, column=3, value="TOTAL SOLDES")
    ws.cell(row=total_row, column=3).font = Font(bold=True)
    ws.cell(row=total_row, column=4, value=round(sum(u.balance or 0 for u in users), 2))
    ws.cell(row=total_row, column=4).font = Font(bold=True, color="10b981")

    # Stream
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"BarOS_Users_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )