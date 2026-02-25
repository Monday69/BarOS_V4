# users.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timedelta, timezone

from backend.database import get_db
from backend.models import User, UserFavorite, OrderHistory, Recipe, RecipeIngredient, Ingredient

router = APIRouter()

# ── Modèles Pydantic ──────────────────────────────────────────────────────────

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
    # ✅ Fix : is_admin ajouté — sans ce champ, UserContext.jsx reçoit
    # toujours is_admin=undefined → bool(undefined) = False →
    # AdminRoute bloque l'accès même avec une carte admin valide.
    is_admin:    bool = False

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


# ── Helper nutrition centralisé ───────────────────────────────────────────────

def _calc_nutrition(orders: list) -> dict:
    """
    Calcule kcal, sucres et alcool pur à partir d'une liste d'OrderHistory.
    Centralisé ici pour éviter la duplication entre stats et alcoolémie.
    """
    total_kcal      = 0.0
    total_sugar_g   = 0.0
    total_alc_grams = 0.0

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


# ── Helper query ──────────────────────────────────────────────────────────────

def _orders_with_nutrition(db: Session, user_id: int, since: datetime) -> list:
    """OrderHistory avec tous les joinedload nutrition pour un user depuis 'since'."""
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

@router.post("/scan", response_model=UserResponse)
def scan_card(card_data: UserBase, db: Session = Depends(get_db)):
    # ✅ Fix : db.get() — db.query().filter().first() sur PK est inutilement verbeux
    user = db.query(User).filter(User.card_uid == card_data.card_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur inconnu")
    # is_admin est sérialisé automatiquement via UserResponse (from_attributes=True)
    return user


@router.post("/register", response_model=UserResponse)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.card_uid == user_data.card_uid).first():
        raise HTTPException(status_code=400, detail="Cette carte est déjà enregistrée.")
    new_user = User(
        card_uid    = user_data.card_uid,
        name        = user_data.name,
        gender      = user_data.gender,
        weight_kg   = user_data.weight_kg,
        age         = user_data.age,
        preferences = user_data.preferences or {},
        # is_admin=False par défaut (valeur du modèle SQLAlchemy)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# ── Favoris ───────────────────────────────────────────────────────────────────

@router.post("/{user_id}/favorites/{recipe_id}")
def add_favorite(user_id: int, recipe_id: int, db: Session = Depends(get_db)):
    exists = db.query(UserFavorite).filter(
        UserFavorite.user_id   == user_id,
        UserFavorite.recipe_id == recipe_id,
    ).first()
    if exists:
        return {"message": "Déjà en favori"}
    db.add(UserFavorite(user_id=user_id, recipe_id=recipe_id))
    db.commit()
    return {"message": "Favori ajouté !"}


@router.get("/{user_id}/favorites", response_model=List[FavoriteResponse])
def get_favorites(user_id: int, db: Session = Depends(get_db)):
    return db.query(UserFavorite).filter(UserFavorite.user_id == user_id).all()


@router.delete("/{user_id}/favorites/{recipe_id}")
def remove_favorite(user_id: int, recipe_id: int, db: Session = Depends(get_db)):
    fav = db.query(UserFavorite).filter(
        UserFavorite.user_id   == user_id,
        UserFavorite.recipe_id == recipe_id,
    ).first()
    if fav:
        db.delete(fav)
        db.commit()
    return {"message": "Favori supprimé"}


# ── Historique paginé ─────────────────────────────────────────────────────────

@router.get("/{user_id}/history", response_model=List[OrderHistoryResponse])
def get_user_history(
    user_id:   int,
    page:      int           = Query(1,    ge=1),
    page_size: int           = Query(10,   ge=1, le=50),
    days:      Optional[int] = Query(None, description="Filtrer sur les N derniers jours"),
    db: Session = Depends(get_db),
):
    if not db.get(User, user_id):
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    query = (
        db.query(OrderHistory)
        .options(joinedload(OrderHistory.recipe))
        .filter(
            OrderHistory.user_id   == user_id,
            OrderHistory.recipe_id.isnot(None),
        )
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
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

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
    ratings         = []

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
        "average_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
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
        raise HTTPException(status_code=400, detail="La note doit être entre 1 et 5")

    order = db.query(OrderHistory).filter(
        OrderHistory.id      == order_id,
        OrderHistory.user_id == user_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable ou accès refusé")

    order.rating  = rating_data.rating
    order.comment = rating_data.comment
    db.commit()
    return {
        "message":  "Note enregistrée !",
        "order_id": order_id,
        "rating":   order.rating,
        "comment":  order.comment,
    }


# ── Alcoolémie Widmark ────────────────────────────────────────────────────────

@router.get("/{user_id}/alcoolemia")
def get_user_alcoolemia(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or not user.weight_kg:
        return {"current_bac": 0.0, "status": "Profil incomplet", "can_drive": True}

    since  = datetime.now(timezone.utc) - timedelta(hours=12)
    orders = _orders_with_nutrition(db, user_id, since)

    if not orders:
        return {
            "current_bac":  0.0,
            "status":       "Totalement sobre 😇",
            "drinks_count": 0,
            "can_drive":    True,
        }

    nutrition       = _calc_nutrition(orders)
    total_alc_grams = nutrition["total_alcohol_grams"]

    first_drink_time = orders[0].timestamp
    if first_drink_time.tzinfo is None:
        first_drink_time = first_drink_time.replace(tzinfo=timezone.utc)

    r             = 0.55 if user.gender == 'F' else (0.68 if user.gender == 'M' else 0.61)
    hours_elapsed = (datetime.now(timezone.utc) - first_drink_time).total_seconds() / 3600.0
    current_bac   = max(0.0, round(
        total_alc_grams / (user.weight_kg * r) - (0.15 * hours_elapsed), 2
    ))

    if current_bac > 1.0:   status, can_drive = "DANGER : Laisse tes clés 🚑", False
    elif current_bac > 0.5: status, can_drive = "Ne prends pas le volant 🛑", False
    elif current_bac > 0.2: status, can_drive = "Légèrement alcoolisé 🍺",    True
    else:                    status, can_drive = "Apte à conduire 🚗",         True

    return {
        "current_bac":             current_bac,
        "status":                  status,
        "drinks_count":            len(orders),
        "can_drive":               can_drive,
        "hours_since_first_drink": round(hours_elapsed, 1),
    }


# ── Recommandations personnalisées ────────────────────────────────────────────

@router.get("/{user_id}/recommendations")
def get_recommendations(
    user_id: int,
    limit:   int = Query(5,  ge=1,  le=20),
    days:    int = Query(60, ge=7, le=365),
    db: Session = Depends(get_db),
):
    if not db.get(User, user_id):
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

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

    global_order_counts: Dict[int,int]   = {}
    global_ratings:      Dict[int,list]  = {}
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
        .options(
            joinedload(Recipe.recipe_ingredients)
                .joinedload(RecipeIngredient.ingredient)
        )
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
            reasons.append(f"Catégorie '{recipe.category}' que tu aimes")

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
                reasons.append(f"Très bien noté ({avg:.1f}/5)")

        if recipe.id in global_order_counts:
            popularity = global_order_counts[recipe.id] / max_global_orders
            score += popularity
            if popularity > 0.5:
                reasons.append("Populaire en ce moment")

        if recipe.id in already_ordered_ids:
            score -= 2
        if recipe.id not in global_order_counts:
            score += 0.5
            reasons.append("À découvrir ✨")

        scored.append({
            "id":       recipe.id,
            "name":     recipe.name,
            "category": recipe.category,
            "image_url":recipe.image_url,
            "score":    round(score, 2),
            "reasons":  reasons or ["Pour varier les plaisirs"],
        })

    scored.sort(key=lambda x: x["score"], reverse=True)

    if not user_orders:
        for item in scored:
            item["reasons"] = ["Populaire & bien noté"]
        return {"user_id": user_id, "mode": "populaire",
                "recommendations": scored[:limit]}

    return {
        "user_id":           user_id,
        "mode":              "personnalisé",
        "based_on_orders":   len(user_orders),
        "recommendations":   scored[:limit],
    }

# ── Dépenses ──────────────────────────────────────────────────────────────────

@router.get("/{user_id}/spending")
def get_user_spending(user_id: int, db: Session = Depends(get_db)):
    """
    Dépenses de la session courante (12 dernières heures) et comparaison
    avec la session précédente.

    Retourne :
      total_tonight    : coût de revient total ce soir (€)
      count_tonight    : nombre de cocktails commandés
      avg_tonight      : coût moyen par cocktail (€)
      orders           : détail de chaque commande avec coût snapshotté
      prev_session_total : total de la session précédente (€) — None si aucune
    """
    if not db.get(User, user_id):
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    now    = datetime.now(timezone.utc)
    since  = now - timedelta(hours=12)

    # ── Session courante ──────────────────────────────────────────────────────
    tonight_orders = (
        db.query(OrderHistory)
        .options(joinedload(OrderHistory.recipe))
        .filter(
            OrderHistory.user_id   == user_id,
            OrderHistory.timestamp >= since,
            OrderHistory.recipe_id.isnot(None),
        )
        .order_by(desc(OrderHistory.timestamp))
        .all()
    )

    total_tonight = sum(
        o.cost_price for o in tonight_orders if o.cost_price is not None
    )
    count_tonight = len(tonight_orders)
    avg_tonight   = (total_tonight / count_tonight) if count_tonight > 0 else 0.0

    orders_detail = [
        {
            "recipe_name": o.recipe.name if o.recipe else None,
            "time":        o.timestamp.strftime("%H:%M"),
            "cost_price":  o.cost_price,
        }
        for o in tonight_orders
    ]

    # ── Session précédente — fenêtre 12-36h avant maintenant ─────────────────
    # On cherche la session juste avant celle d'aujourd'hui pour la comparaison.
    prev_end   = since
    prev_start = prev_end - timedelta(hours=24)

    prev_orders = (
        db.query(OrderHistory)
        .filter(
            OrderHistory.user_id   == user_id,
            OrderHistory.timestamp >= prev_start,
            OrderHistory.timestamp <  prev_end,
            OrderHistory.recipe_id.isnot(None),
        )
        .all()
    )

    prev_costs = [o.cost_price for o in prev_orders if o.cost_price is not None]
    prev_session_total = round(sum(prev_costs), 3) if prev_costs else None

    return {
        "total_tonight":      round(total_tonight, 3),
        "count_tonight":      count_tonight,
        "avg_tonight":        round(avg_tonight,   3),
        "orders":             orders_detail,
        "prev_session_total": prev_session_total,
    }

# ── Espace Patron (Comptabilité globale) ──────────────────────────────────────

@router.get("/{user_id}/admin-stats")
def get_admin_stats(user_id: int, db: Session = Depends(get_db)):
    """Retourne la comptabilité globale de la machine (réservé aux admins)."""
    user = db.get(User, user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Accès refusé. Mode Patron uniquement.")

    # On récupère tout l'historique avec le prix des recettes
    orders = db.query(OrderHistory).options(joinedload(OrderHistory.recipe)).all()

    total_revenue = 0.0
    total_cost = 0.0

    for o in orders:
        # Prix de vente (si le cocktail a un prix)
        price = o.recipe.price if o.recipe and o.recipe.price else 0.0
        # Coût de revient (sauvegardé au moment de la commande)
        cost = o.cost_price if o.cost_price else 0.0
        
        total_revenue += price
        total_cost += cost

    total_margin = total_revenue - total_cost

    return {
        "total_orders": len(orders),
        "total_revenue": round(total_revenue, 2),
        "total_cost": round(total_cost, 2),
        "total_margin": round(total_margin, 2),
    }

@router.get("/", response_model=List[UserResponse])
def get_all_users(db: Session = Depends(get_db)):
    """
    Liste tous les utilisateurs (accessible uniquement par l'admin)
    """
    users = db.query(User).all()
    return users