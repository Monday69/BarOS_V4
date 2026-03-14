"""
BarOS V4 - Router Users
Chemin : backend/routers/users.py

CORRECTIFS v2 :
  [SECURITE] Rate limiting IP sur /verify-pin et /set-pin :
             Un attaquant qui connait le user_id peut bruteforcer
             le PIN depuis une IP differente a chaque requete.
             La protection DB (pin_locked_until) ne suffit pas car
             elle ne bloque que par user_id.
             Solution : compteur par IP en memoire (dict + TTL 60s).
             Max 10 tentatives/IP/minute sur les endpoints PIN.
             Complement, pas remplacement, du lockout DB existant.
  [SECURITE] /get_all_users protege par token admin : retournait
             tous les users (noms, UIDs, soldes) sans aucune auth.
"""
import bcrypt
import os
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timedelta, timezone

from backend.database import get_db
from backend.models import User, UserFavorite, OrderHistory, Recipe, RecipeIngredient, Ingredient

router = APIRouter()

PIN_LENGTH      = 6
MAX_ATTEMPTS    = 5
LOCKOUT_SECONDS = 60

# =============================================================================
# RATE LIMITING IP EN MEMOIRE
# =============================================================================
# Structure : { ip: {"count": int, "window_start": float} }
# Fenetres glissantes de 60s, max 10 requetes/IP sur les endpoints PIN.
# Nettoyage automatique des entrees expirées a chaque appel.
_pin_rate: dict = defaultdict(lambda: {"count": 0, "window_start": 0.0})
_RATE_LIMIT_MAX    = 10   # tentatives max par IP par fenetre
_RATE_LIMIT_WINDOW = 60   # fenetre en secondes

def _check_rate_limit(request: Request):
    """
    Leve HTTP 429 si l'IP a depasse la limite sur la fenetre courante.
    Reinitialise le compteur si la fenetre est expiree.
    """
    ip  = request.client.host if request.client else "unknown"
    now = time.monotonic()
    entry = _pin_rate[ip]

    # Fenetre expiree → reset
    if now - entry["window_start"] > _RATE_LIMIT_WINDOW:
        entry["count"]        = 0
        entry["window_start"] = now

    entry["count"] += 1

    if entry["count"] > _RATE_LIMIT_MAX:
        retry_after = int(_RATE_LIMIT_WINDOW - (now - entry["window_start"])) + 1
        raise HTTPException(
            status_code=429,
            detail={
                "code":        "RATE_LIMITED",
                "message":     f"Trop de tentatives depuis cette adresse. Reessayez dans {retry_after}s.",
                "retry_after": retry_after,
            },
            headers={"Retry-After": str(retry_after)},
        )

def _cleanup_rate_table():
    """Supprime les entrees expirees pour eviter une fuite memoire sur long run."""
    now     = time.monotonic()
    expired = [ip for ip, e in _pin_rate.items()
               if now - e["window_start"] > _RATE_LIMIT_WINDOW * 2]
    for ip in expired:
        del _pin_rate[ip]


# ── Modeles Pydantic ──────────────────────────────────────────────────────────

class UserBase(BaseModel):
    card_uid: str

class UserCreate(UserBase):
    name:        str
    gender:      Optional[str]           = None
    weight_kg:   Optional[float]         = None
    age:         Optional[int]           = None
    preferences: Optional[Dict[str,int]] = {}

class UserResponse(UserBase):
    id:          int
    name:        str
    gender:      Optional[str]   = None
    weight_kg:   Optional[float] = None
    age:         Optional[int]   = None
    preferences: Dict
    is_admin:    bool = False
    has_pin:     bool = False
    class Config:
        from_attributes = True

class RecipeSummary(BaseModel):
    id:        int
    name:      str
    image_url: Optional[str] = None
    class Config:
        from_attributes = True

class FavoriteResponse(BaseModel):
    id:       int
    added_at: datetime
    recipe:   RecipeSummary
    class Config:
        from_attributes = True

class OrderHistoryResponse(BaseModel):
    id:        int
    timestamp: datetime
    rating:    Optional[int] = None
    comment:   Optional[str] = None
    recipe:    RecipeSummary
    class Config:
        from_attributes = True

class RatingSubmit(BaseModel):
    rating:  int
    comment: Optional[str] = None

class PinSet(BaseModel):
    user_id: int
    pin:     str

class PinVerify(BaseModel):
    user_id: int
    pin:     str

class PinReset(BaseModel):
    user_id: int


# ── Helpers nutrition ─────────────────────────────────────────────────────────

def _calc_nutrition(orders: list) -> dict:
    total_kcal = total_sugar_g = total_alc_grams = 0.0
    for order in orders:
        if not order.recipe:
            continue
        for ri in order.recipe.recipe_ingredients:
            ing = ri.ingredient
            if not ing:
                continue
            vol = ri.volume_ml
            total_kcal      += (ing.kcal_per_100ml    or 0.0) * vol / 100.0
            total_sugar_g   += (ing.sugar_g_per_100ml or 0.0) * vol / 100.0
            if (ing.alcohol_degree or 0.0) > 0:
                total_alc_grams += vol * (ing.alcohol_degree / 100.0) * 0.789
    return {
        "total_kcal":          round(total_kcal, 1),
        "total_sugar_g":       round(total_sugar_g, 1),
        "total_alcohol_grams": round(total_alc_grams, 1),
        "total_alcohol_units": round(total_alc_grams / 10.0, 1),
    }

def _orders_with_nutrition(db: Session, user_id: int, since: datetime) -> list:
    return (
        db.query(OrderHistory)
        .options(
            joinedload(OrderHistory.recipe)
                .joinedload(Recipe.recipe_ingredients)
                .joinedload(RecipeIngredient.ingredient)
        )
        .filter(
            OrderHistory.user_id   == user_id,
            OrderHistory.timestamp >= since,
            OrderHistory.recipe_id.isnot(None),
        )
        .all()
    )


# ── Auth & Profil ─────────────────────────────────────────────────────────────

@router.post("/scan")
def scan_card(card_data: UserBase, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.card_uid == card_data.card_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur inconnu")
    return {
        "id":           user.id,
        "name":         user.name,
        "card_uid":     user.card_uid,
        "gender":       user.gender,
        "weight_kg":    user.weight_kg,
        "age":          user.age,
        "preferences":  user.preferences or {},
        "is_admin":     user.is_admin,
        "balance":      user.balance,
        "has_pin":      user.pin_hash is not None,
        "requires_pin": True,
    }


@router.post("/register", response_model=UserResponse)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.card_uid == user_data.card_uid).first():
        raise HTTPException(status_code=400, detail="Cette carte est deja enregistree.")
    new_user = User(
        card_uid    = user_data.card_uid,
        name        = user_data.name,
        gender      = user_data.gender,
        weight_kg   = user_data.weight_kg,
        age         = user_data.age,
        preferences = user_data.preferences or {},
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# ── PIN — Definir / Verifier / Reset ─────────────────────────────────────────

@router.post("/set-pin")
def set_pin(payload: PinSet, request: Request, db: Session = Depends(get_db)):
    """
    Definir ou changer son PIN (6 chiffres).
    Rate limité par IP : max 10 appels/min.
    """
    _check_rate_limit(request)
    _cleanup_rate_table()

    if not payload.pin.isdigit() or len(payload.pin) != PIN_LENGTH:
        raise HTTPException(400, f"Le PIN doit etre exactement {PIN_LENGTH} chiffres.")
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    user.pin_hash         = bcrypt.hashpw(payload.pin.encode(), bcrypt.gensalt()).decode()
    user.pin_attempts     = 0
    user.pin_locked_until = None
    db.commit()
    return {"status": "ok", "message": "PIN defini avec succes."}


@router.post("/verify-pin")
def verify_pin(payload: PinVerify, request: Request, db: Session = Depends(get_db)):
    """
    Verifie le PIN apres badge NFC.
    Double protection :
      1. Rate limit IP (10 req/min) → bloque le bruteforce multi-users depuis une IP
      2. Lockout DB par user (5 tentatives → 60s) → bloque le bruteforce mono-user
    """
    # ── Protection niveau 1 : rate limit IP ──────────────────────────────────
    _check_rate_limit(request)
    _cleanup_rate_table()

    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    now = datetime.now(timezone.utc)

    # ── Protection niveau 2 : lockout DB ─────────────────────────────────────
    if user.pin_locked_until:
        locked_until = user.pin_locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if now < locked_until:
            remaining = int((locked_until - now).total_seconds())
            raise HTTPException(423, {
                "code":      "LOCKED",
                "message":   f"Compte bloque. Reessayez dans {remaining}s.",
                "remaining": remaining,
            })

    if not user.pin_hash:
        raise HTTPException(400, {"code": "NO_PIN", "message": "Aucun PIN defini."})

    if not bcrypt.checkpw(payload.pin.encode(), user.pin_hash.encode()):
        user.pin_attempts += 1
        attempts_left = MAX_ATTEMPTS - user.pin_attempts
        if user.pin_attempts >= MAX_ATTEMPTS:
            user.pin_locked_until = now + timedelta(seconds=LOCKOUT_SECONDS)
            user.pin_attempts     = 0
            db.commit()
            raise HTTPException(423, {
                "code":      "LOCKED",
                "message":   f"Trop de tentatives. Compte bloque {LOCKOUT_SECONDS}s.",
                "remaining": LOCKOUT_SECONDS,
            })
        db.commit()
        raise HTTPException(401, {
            "code":          "WRONG_PIN",
            "message":       "PIN incorrect.",
            "attempts_left": attempts_left,
        })

    # PIN correct
    user.pin_attempts     = 0
    user.pin_locked_until = None
    db.commit()
    return {
        "id":          user.id,
        "name":        user.name,
        "card_uid":    user.card_uid,
        "gender":      user.gender,
        "weight_kg":   user.weight_kg,
        "age":         user.age,
        "preferences": user.preferences or {},
        "is_admin":    user.is_admin,
        "balance":     user.balance,
        "has_pin":     True,
    }


@router.post("/reset-pin")
def reset_pin(
    payload:       PinReset,
    db:            Session = Depends(get_db),
    x_admin_token: Optional[str] = Header(default=None),
):
    """Reset du PIN par l'admin."""
    secret = os.getenv("BAROS_ADMIN_SECRET")
    if not secret or x_admin_token != secret:
        raise HTTPException(403, "Acces refuse")
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    user.pin_hash         = None
    user.pin_attempts     = 0
    user.pin_locked_until = None
    db.commit()
    return {"status": "ok", "message": f"PIN de {user.name} reinitialise."}


# ── Favoris ───────────────────────────────────────────────────────────────────

@router.post("/{user_id}/favorites/{recipe_id}")
def add_favorite(user_id: int, recipe_id: int, db: Session = Depends(get_db)):
    exists = db.query(UserFavorite).filter(
        UserFavorite.user_id == user_id, UserFavorite.recipe_id == recipe_id,
    ).first()
    if exists:
        return {"message": "Deja en favori"}
    db.add(UserFavorite(user_id=user_id, recipe_id=recipe_id))
    db.commit()
    return {"message": "Favori ajoute !"}

@router.get("/{user_id}/favorites", response_model=List[FavoriteResponse])
def get_favorites(user_id: int, db: Session = Depends(get_db)):
    return db.query(UserFavorite).filter(UserFavorite.user_id == user_id).all()

@router.delete("/{user_id}/favorites/{recipe_id}")
def remove_favorite(user_id: int, recipe_id: int, db: Session = Depends(get_db)):
    fav = db.query(UserFavorite).filter(
        UserFavorite.user_id == user_id, UserFavorite.recipe_id == recipe_id,
    ).first()
    if fav:
        db.delete(fav)
        db.commit()
    return {"message": "Favori supprime"}


# ── Historique pagine ─────────────────────────────────────────────────────────

@router.get("/{user_id}/history", response_model=List[OrderHistoryResponse])
def get_user_history(
    user_id:   int,
    page:      int           = Query(1,    ge=1),
    page_size: int           = Query(10,   ge=1, le=50),
    days:      Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    if not db.get(User, user_id):
        raise HTTPException(404, "Utilisateur introuvable")
    query = (
        db.query(OrderHistory)
        .options(joinedload(OrderHistory.recipe))
        .filter(OrderHistory.user_id == user_id, OrderHistory.recipe_id.isnot(None))
    )
    if days is not None:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.filter(OrderHistory.timestamp >= since)
    return (
        query.order_by(desc(OrderHistory.timestamp))
             .offset((page - 1) * page_size)
             .limit(page_size)
             .all()
    )


# ── Stats de consommation ─────────────────────────────────────────────────────

@router.get("/{user_id}/stats")
def get_user_stats(
    user_id: int,
    days:    int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    if not db.get(User, user_id):
        raise HTTPException(404, "Utilisateur introuvable")
    since  = datetime.now(timezone.utc) - timedelta(days=days)
    orders = _orders_with_nutrition(db, user_id, since)
    if not orders:
        return {
            "period_days": days, "total_orders": 0,
            "total_kcal": 0.0, "total_sugar_g": 0.0,
            "total_alcohol_units": 0.0, "top_cocktails": [],
            "category_breakdown": {}, "average_rating": None,
        }
    nutrition       = _calc_nutrition(orders)
    cocktail_counts: Dict[str,int] = {}
    category_counts: Dict[str,int] = {}
    ratings = []
    for order in orders:
        if not order.recipe:
            continue
        cocktail_counts[order.recipe.name] = cocktail_counts.get(order.recipe.name, 0) + 1
        cat = order.recipe.category or "Autre"
        category_counts[cat] = category_counts.get(cat, 0) + 1
        if order.rating is not None:
            ratings.append(order.rating)
    return {
        "period_days":         days,
        "total_orders":        len(orders),
        "total_kcal":          nutrition["total_kcal"],
        "total_sugar_g":       nutrition["total_sugar_g"],
        "total_alcohol_units": nutrition["total_alcohol_units"],
        "top_cocktails": [
            {"name": n, "count": c}
            for n, c in sorted(cocktail_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        ],
        "category_breakdown": category_counts,
        "average_rating": round(sum(ratings)/len(ratings), 1) if ratings else None,
    }


# ── Notation ──────────────────────────────────────────────────────────────────

@router.post("/{user_id}/history/{order_id}/rate")
def rate_order(
    user_id:     int,
    order_id:    int,
    rating_data: RatingSubmit,
    db: Session = Depends(get_db),
):
    if not (1 <= rating_data.rating <= 5):
        raise HTTPException(400, "La note doit etre entre 1 et 5")
    order = db.query(OrderHistory).filter(
        OrderHistory.id == order_id, OrderHistory.user_id == user_id,
    ).first()
    if not order:
        raise HTTPException(404, "Commande introuvable ou acces refuse")
    order.rating  = rating_data.rating
    order.comment = rating_data.comment
    db.commit()
    return {"message": "Note enregistree !", "order_id": order_id,
            "rating": order.rating, "comment": order.comment}


# ── Alcoolomie Widmark ────────────────────────────────────────────────────────

@router.get("/{user_id}/alcoolemia")
def get_user_alcoolemia(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or not user.weight_kg:
        return {"current_bac": 0.0, "status": "Profil incomplet", "can_drive": True}
    since  = datetime.now(timezone.utc) - timedelta(hours=12)
    orders = _orders_with_nutrition(db, user_id, since)
    if not orders:
        return {"current_bac": 0.0, "status": "Totalement sobre",
                "drinks_count": 0, "can_drive": True}
    nutrition       = _calc_nutrition(orders)
    total_alc_grams = nutrition["total_alcohol_grams"]
    first_drink     = orders[0].timestamp
    if first_drink.tzinfo is None:
        first_drink = first_drink.replace(tzinfo=timezone.utc)
    r             = 0.55 if user.gender == 'F' else (0.68 if user.gender == 'M' else 0.61)
    hours_elapsed = (datetime.now(timezone.utc) - first_drink).total_seconds() / 3600.0
    current_bac   = max(0.0, round(
        total_alc_grams / (user.weight_kg * r) - (0.15 * hours_elapsed), 2
    ))
    if current_bac > 1.0:   status, can_drive = "DANGER : Laisse tes cles", False
    elif current_bac > 0.5: status, can_drive = "Ne prends pas le volant", False
    elif current_bac > 0.2: status, can_drive = "Legerement alcoolise",    True
    else:                   status, can_drive = "Apte a conduire",          True
    return {
        "current_bac":             current_bac,
        "status":                  status,
        "drinks_count":            len(orders),
        "can_drive":               can_drive,
        "hours_since_first_drink": round(hours_elapsed, 1),
    }


# ── Recommandations personnalisees ────────────────────────────────────────────

@router.get("/{user_id}/recommendations")
def get_recommendations(
    user_id: int,
    limit:   int = Query(5,  ge=1,  le=20),
    days:    int = Query(60, ge=7, le=365),
    db: Session = Depends(get_db),
):
    if not db.get(User, user_id):
        raise HTTPException(404, "Utilisateur introuvable")
    since       = datetime.now(timezone.utc) - timedelta(days=days)
    user_orders = _orders_with_nutrition(db, user_id, since)

    user_categories:     Dict[str,int] = {}
    user_ingredient_ids: Dict[int,int] = {}
    already_ordered_ids: set           = set()

    for order in user_orders:
        if not order.recipe:
            continue
        cat = order.recipe.category or "Autre"
        user_categories[cat] = user_categories.get(cat, 0) + 1
        already_ordered_ids.add(order.recipe_id)
        for ri in order.recipe.recipe_ingredients:
            if ri.ingredient:
                uid = ri.ingredient_id
                user_ingredient_ids[uid] = user_ingredient_ids.get(uid, 0) + 1

    user_fav_ids = {
        f.recipe_id for f in
        db.query(UserFavorite).filter(UserFavorite.user_id == user_id).all()
    }
    global_order_counts: Dict[int,int]  = {}
    global_ratings:      Dict[int,list] = {}
    for o in db.query(OrderHistory).filter(
        OrderHistory.timestamp >= since,
        OrderHistory.recipe_id.isnot(None),
    ).all():
        global_order_counts[o.recipe_id] = global_order_counts.get(o.recipe_id, 0) + 1
        if o.rating is not None:
            global_ratings.setdefault(o.recipe_id, []).append(o.rating)

    max_global_orders = max(global_order_counts.values(), default=1)
    all_recipes = (
        db.query(Recipe)
        .options(joinedload(Recipe.recipe_ingredients).joinedload(RecipeIngredient.ingredient))
        .filter(Recipe.is_available == True)
        .all()
    )
    scored = []
    for recipe in all_recipes:
        if recipe.id in user_fav_ids:
            continue
        score, reasons = 0.0, []
        if recipe.category and user_categories.get(recipe.category, 0) > 0:
            score += 3 * (min(user_categories[recipe.category], 5) / 5)
            reasons.append(f"Categorie '{recipe.category}' que tu aimes")
        common = [
            ri.ingredient.name for ri in recipe.recipe_ingredients
            if ri.ingredient_id in user_ingredient_ids and ri.ingredient
        ]
        if common:
            score += min(len(common) * 2, 6)
            reasons.append(f"Contient {', '.join(common[:2])} que tu commandes souvent")
        if recipe.id in global_ratings:
            avg = sum(global_ratings[recipe.id]) / len(global_ratings[recipe.id])
            score += (avg / 5.0) * 2
            if avg >= 4.0:
                reasons.append(f"Tres bien note ({avg:.1f}/5)")
        if recipe.id in global_order_counts:
            popularity = global_order_counts[recipe.id] / max_global_orders
            score += popularity
            if popularity > 0.5:
                reasons.append("Populaire en ce moment")
        if recipe.id in already_ordered_ids:
            score -= 2
        if recipe.id not in global_order_counts:
            score += 0.5
            reasons.append("A decouvrir")
        scored.append({
            "id": recipe.id, "name": recipe.name, "category": recipe.category,
            "image_url": recipe.image_url, "score": round(score, 2),
            "reasons": reasons or ["Pour varier les plaisirs"],
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    if not user_orders:
        for item in scored:
            item["reasons"] = ["Populaire & bien note"]
        return {"user_id": user_id, "mode": "populaire", "recommendations": scored[:limit]}
    return {"user_id": user_id, "mode": "personnalise",
            "based_on_orders": len(user_orders), "recommendations": scored[:limit]}


# ── Depenses ──────────────────────────────────────────────────────────────────

@router.get("/{user_id}/spending")
def get_user_spending(user_id: int, db: Session = Depends(get_db)):
    if not db.get(User, user_id):
        raise HTTPException(404, "Utilisateur introuvable")
    now   = datetime.now(timezone.utc)
    since = now - timedelta(hours=12)
    tonight_orders = (
        db.query(OrderHistory)
        .options(joinedload(OrderHistory.recipe))
        .filter(OrderHistory.user_id == user_id, OrderHistory.timestamp >= since,
                OrderHistory.recipe_id.isnot(None))
        .order_by(desc(OrderHistory.timestamp))
        .all()
    )
    total_tonight = sum(o.cost_price for o in tonight_orders if o.cost_price is not None)
    count_tonight = len(tonight_orders)
    avg_tonight   = (total_tonight / count_tonight) if count_tonight > 0 else 0.0
    orders_detail = [
        {"recipe_name": o.recipe.name if o.recipe else None,
         "time": o.timestamp.strftime("%H:%M"), "cost_price": o.cost_price}
        for o in tonight_orders
    ]
    prev_end, prev_start = since, since - timedelta(hours=24)
    prev_orders = db.query(OrderHistory).filter(
        OrderHistory.user_id == user_id,
        OrderHistory.timestamp >= prev_start,
        OrderHistory.timestamp <  prev_end,
        OrderHistory.recipe_id.isnot(None),
    ).all()
    prev_costs         = [o.cost_price for o in prev_orders if o.cost_price is not None]
    prev_session_total = round(sum(prev_costs), 3) if prev_costs else None
    return {
        "total_tonight": round(total_tonight, 3), "count_tonight": count_tonight,
        "avg_tonight": round(avg_tonight, 3), "orders": orders_detail,
        "prev_session_total": prev_session_total,
    }


# ── Espace Patron ─────────────────────────────────────────────────────────────

@router.get("/{user_id}/admin-stats")
def get_admin_stats(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or not user.is_admin:
        raise HTTPException(403, "Acces refuse. Mode Patron uniquement.")
    orders        = db.query(OrderHistory).options(joinedload(OrderHistory.recipe)).all()
    total_revenue = sum((o.sale_price or 0.0) for o in orders)
    total_cost    = sum((o.cost_price   or 0.0) for o in orders)
    return {
        "total_orders":  len(orders),
        "total_revenue": round(total_revenue, 2),
        "total_cost":    round(total_cost, 2),
        "total_margin":  round(total_revenue - total_cost, 2),
    }


# ── Liste tous les users (admin seulement) ───────────────────────────────────

@router.get("/", response_model=List[UserResponse])
def get_all_users(
    db:            Session = Depends(get_db),
    x_admin_token: Optional[str] = Header(default=None),
):
    """
    Retourne tous les utilisateurs.
    [CORRECTIF] Protege par token admin — retournait avant noms/UIDs/soldes
                sans aucune authentification.
    """
    secret = os.getenv("BAROS_ADMIN_SECRET")
    if not secret or x_admin_token != secret:
        raise HTTPException(403, "Acces refuse")
    return db.query(User).all()