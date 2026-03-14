"""
BarOS V4 - Router Cocktails
Chemin : backend/routers/cocktails.py
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Header
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func
from typing import List, Optional
from pydantic import BaseModel

from backend.database import get_db, SessionLocal
from backend.services.cocktail_service import CocktailService, _machine_lock
from backend.services.recipe_service import RecipeService
from backend.models import Ingredient, OrderHistory, PourSequence, PourStep, Recipe, RecipeIngredient, User as _User, PaymentTransaction
from backend.logic.fluid_physics import FluidPhysics
import os, json as _json

# --- HELPERS ---
def _get_margin() -> float:
    try:
        base_dir    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        config_path = os.path.join(base_dir, "config.json")
        with open(config_path, "r") as f:
            return float(_json.load(f).get("margin_percent", 0.0))
    except Exception:
        return 0.0

router = APIRouter(tags=["cocktails"])
cocktail_service = CocktailService()
recipe_service   = RecipeService()

async def execute_sequence_background(sequence_id: int):
    db = SessionLocal()
    try:
        await cocktail_service.execute_sequence(sequence_id, db)
    except Exception as e:
        print(f"ERREUR CRITIQUE sequence #{sequence_id}: {e}")
    finally:
        db.close()

# --- SCHEMAS ---
class CocktailListResponse(BaseModel):
    id:          int
    name:        str
    price:       float
    image_url:   Optional[str] = None
    ingredients: List[str]
    class Config:
        from_attributes = True

class IngredientInput(BaseModel):
    ingredient_id: int
    volume_ml:     float
    order:         Optional[int] = 0

class RecipeCreateInput(BaseModel):
    name:        str
    description: Optional[str] = None
    category:    Optional[str] = "Custom"
    price:       float = 0.0
    ingredients: List[IngredientInput]

class CustomPourRequest(BaseModel):
    name:        Optional[str] = "Cocktail Lab"
    ingredients: List[IngredientInput]
    user_id:     Optional[int] = None

def _recipe_nutrition(recipe) -> dict:
    total_vol = total_alcohol_vol = total_sugar_g = total_kcal = 0.0
    cost_breakdown = []
    total_cost     = 0.0

    for ri in recipe.recipe_ingredients:
        ing = ri.ingredient
        if not ing: continue
        vol = ri.volume_ml
        total_vol     += vol
        total_kcal    += (ing.kcal_per_100ml    or 0.0) * vol / 100.0
        total_sugar_g += (ing.sugar_g_per_100ml or 0.0) * vol / 100.0
        if (ing.alcohol_degree or 0.0) > 0:
            total_alcohol_vol += (ing.alcohol_degree / 100.0) * vol
        item_cost = None
        if ing.purchase_price_per_liter and ing.purchase_price_per_liter > 0:
            item_cost   = round(ing.purchase_price_per_liter * vol / 1000.0, 4)
            total_cost += item_cost
        cost_breakdown.append({"name": ing.name, "volume_ml": vol, "cost": item_cost})

    final_degree    = (total_alcohol_vol / total_vol * 100) if total_vol else 0.0
    grams_of_alc    = total_alcohol_vol * 0.789
    standard_drinks = grams_of_alc / 10.0

    if final_degree > 20:    warning = "Cocktail tres corse"
    elif total_sugar_g > 35: warning = "Tres sucre"
    elif final_degree == 0:  warning = "100% Sans Alcool"
    else:                    warning = "Cocktail Equilibre"

    margin_percent = _get_margin()
    cost_price     = round(total_cost, 3) if total_cost > 0 else None
    sale_price     = round(total_cost * (1 + margin_percent / 100), 2) if cost_price else None

    return {
        "total_volume_ml":    round(total_vol, 1),
        "alcohol_degree":     round(final_degree, 1),
        "total_sugar_g":      round(total_sugar_g, 1),
        "total_kcal":         round(total_kcal, 0),
        "standard_drinks":    round(standard_drinks, 1),
        "nutriscore_warning": warning,
        "cost_price":          cost_price,
        "cost_breakdown":      cost_breakdown,
        "sale_price":          sale_price,
        "margin_percent":      margin_percent,
    }

# --- ROUTES GET STATIQUES (À placer AVANT les IDs) ---

@router.get("/", response_model=List[CocktailListResponse])
async def get_cocktails(
    available_only: bool          = Query(True),
    category:       Optional[str] = None,
    limit:          int           = 50,
    offset:         int           = 0,
    db: Session = Depends(get_db),
):
    recipes        = await recipe_service.get_recipes(db, available_only, category, None, limit, offset)
    margin_percent = _get_margin()
    result = []
    for r in recipes:
        total_cost = sum(
            (ri.ingredient.purchase_price_per_liter or 0.0) * ri.volume_ml / 1000.0
            for ri in r.recipe_ingredients
            if ri.ingredient and ri.ingredient.purchase_price_per_liter
        )
        sale_price = round(total_cost * (1 + margin_percent / 100), 2) if total_cost > 0 else None
        result.append({
            "id":          r.id, "name": r.name,
            "price":       sale_price if sale_price is not None else 0.0,
            "sale_price": sale_price, "image_url": r.image_url,
            "ingredients": [ri.ingredient.name for ri in r.recipe_ingredients],
        })
    return result

@router.get("/order-counts")
def get_order_counts(db: Session = Depends(get_db)):
    """Récupère le nombre de fois que chaque cocktail a été commandé."""
    results = db.query(
        OrderHistory.recipe_id,
        func.count(OrderHistory.id).label("count"),
    ).filter(OrderHistory.recipe_id.isnot(None)).group_by(OrderHistory.recipe_id).all()
    return {r.recipe_id: r.count for r in results}

@router.get("/ratings/all")
def get_all_ratings(db: Session = Depends(get_db)):
    """Récupère les notes moyennes de tous les cocktails en 1 requête."""
    results = db.query(
        OrderHistory.recipe_id,
        func.avg(OrderHistory.rating).label("avg"),
        func.count(OrderHistory.rating).label("count"),
    ).filter(OrderHistory.rating.isnot(None)).group_by(OrderHistory.recipe_id).all()
    
    return {
        r.recipe_id: {
            "average": round(float(r.avg), 1),
            "count": r.count
        } for r in results
    }

# --- ROUTES GET DYNAMIQUES (Avec des variables dans l'URL) ---

@router.get("/{cocktail_id}")
async def get_cocktail_detail(cocktail_id: int, db: Session = Depends(get_db)):
    r = await recipe_service.get_recipe_detail(cocktail_id, db)
    if not r:
        raise HTTPException(404, "Cocktail introuvable")

    nutrition  = _recipe_nutrition(r)
    compatible = await cocktail_service.check_recipe_stock(cocktail_id, db)

    precise_time = 0.0
    try:
        recipe_ingredients = db.execute(
            select(RecipeIngredient)
            .options(joinedload(RecipeIngredient.ingredient))
            .filter(RecipeIngredient.recipe_id == cocktail_id)
            .order_by(RecipeIngredient.order)
        ).unique().scalars().all()
        for ri in recipe_ingredients:
            if FluidPhysics and ri.ingredient:
                precise_time += FluidPhysics.calculate_pour_duration(
                    target_volume_ml  = ri.volume_ml,
                    current_volume_ml = ri.ingredient.current_volume_ml,
                    max_volume_ml     = ri.ingredient.max_volume_ml or 1000
                )
            else:
                precise_time += ri.volume_ml * 0.1
        precise_time = round(precise_time, 1)
    except Exception as e:
        print(f"Erreur calcul temps : {e}")

    return {
        "id": r.id, "name": r.name, "description": r.description, "price": r.price, "image_url": r.image_url,
        "mixing_method": r.mixing_method,
        "ingredients": [
            {"name": ri.ingredient.name, "volume": ri.volume_ml,
             "image_url": ri.ingredient.image_url if ri.ingredient else None}
            for ri in r.recipe_ingredients if ri.ingredient
        ],
        "compatible_with_stock": compatible,
        **nutrition,
        "estimated_time": precise_time,
    }

@router.get("/{recipe_id}/ratings")
def get_recipe_ratings(recipe_id: int, db: Session = Depends(get_db)):
    """Note moyenne et nombre de votes pour un cocktail spécifique."""
    result = db.query(
        func.avg(OrderHistory.rating).label("avg"),
        func.count(OrderHistory.rating).label("count"),
    ).filter(
        OrderHistory.recipe_id == recipe_id,
        OrderHistory.rating.isnot(None),
    ).first()
    
    return {
        "recipe_id":    recipe_id,
        "average":      round(float(result.avg), 1) if result.avg else None,
        "count":        result.count or 0,
    }

# --- ROUTES POST ---

@router.post("/")
async def create_recipe(payload: RecipeCreateInput, db: Session = Depends(get_db)):
    ids_needed = {step.ingredient_id for step in payload.ingredients}
    found_ids  = {row.id for row in db.query(Ingredient.id).filter(Ingredient.id.in_(ids_needed)).all()}
    missing    = ids_needed - found_ids
    if missing:
        raise HTTPException(404, f"Ingredients introuvables : {sorted(missing)}")

    recipe = Recipe(name=payload.name, description=payload.description,
                    category=payload.category, price=payload.price, is_available=True)
    db.add(recipe)
    db.flush()

    for idx, step in enumerate(payload.ingredients):
        db.add(RecipeIngredient(
            recipe_id=recipe.id, ingredient_id=step.ingredient_id,
            volume_ml=step.volume_ml,
            order=step.order if step.order is not None else idx,
        ))

    db.commit()
    db.refresh(recipe)
    return {"id": recipe.id, "name": recipe.name, "category": recipe.category}

@router.post("/custom")
async def pour_custom_cocktail(
    request:           CustomPourRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if request.user_id is None:
        raise HTTPException(401, "Identification par badge requise")

    ids_needed  = [step.ingredient_id for step in request.ingredients]
    ingredients = {
        ing.id: ing for ing in
        db.query(Ingredient).filter(Ingredient.id.in_(ids_needed)).all()
    }

    for step in request.ingredients:
        ing = ingredients.get(step.ingredient_id)
        if not ing:
            raise HTTPException(404, f"Ingredient #{step.ingredient_id} introuvable")
        if not ing.pump_id:
            raise HTTPException(400, f"'{ing.name}' n'est pas assigne a une pompe")
        if ing.current_volume_ml < step.volume_ml:
            raise HTTPException(400,
                f"Stock insuffisant pour '{ing.name}' "
                f"({ing.current_volume_ml:.0f}ml dispo, {step.volume_ml:.0f}ml demandes)"
            )

    sequence = PourSequence(recipe_id=None, user_nfc=None, status="PENDING")
    db.add(sequence)
    db.flush()

    for idx, step in enumerate(request.ingredients):
        db.add(PourStep(
            sequence_id=sequence.id, ingredient_id=step.ingredient_id,
            volume_ml=step.volume_ml, order=idx,
        ))

    db.add(OrderHistory(user_id=request.user_id, recipe_id=None))
    db.commit()
    db.refresh(sequence)

    background_tasks.add_task(execute_sequence_background, sequence.id)

    return {
        "message":      f"Preparation de '{request.name}' lancee",
        "sequence_id": sequence.id,
        "steps_count": len(request.ingredients),
    }

@router.post("/{cocktail_id}/pour")
async def pour_cocktail(
    cocktail_id:      int,
    background_tasks: BackgroundTasks,
    user_id:           Optional[int]   = Query(None),
    cost_price:       Optional[float] = Query(None),
    sale_price:       Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    if user_id is None:
        raise HTTPException(401, "Identification par badge requise")

    user = db.get(_User, user_id)
    if not user:
        raise HTTPException(404, "Utilisateur inconnu")

    val = await cocktail_service.validate_recipe(cocktail_id, db)
    if not val["valid"]:
        raise HTTPException(400, val["errors"][0])

    # 1. Vérifier la machine d'abord
    if _machine_lock.locked():
        raise HTTPException(503, {
            "code":    "MACHINE_BUSY",
            "message": "La machine est occupée, réessayez dans quelques instants."
        })

    # 2. Charger la configuration
    try:
        _base    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        _cfg     = _json.load(open(os.path.join(_base, "config.json")))
        _require = _cfg.get("require_payment", _cfg.get("payment", {}).get("require_payment", False))
    except Exception:
        _require = False

    # 3. Maintenant on peut calculer le prix final
    final_sale_price = sale_price if _require else None

    # 4. Logique de débit
    if _require and sale_price is not None:
        db.refresh(user)
        if user.balance < sale_price:
            raise HTTPException(402, {
                "code":     "INSUFFICIENT_BALANCE",
                "balance":  round(user.balance, 2),
                "required": sale_price,
                "message":  f"Solde insuffisant ({user.balance:.2f}€ dispo, {sale_price:.2f}€ requis)"
            })

        user.balance = round(user.balance - sale_price, 2)
        db.add(PaymentTransaction(
            user_id=user.id, amount=-sale_price,
            type="debit", status="completed",
            description=f"Cocktail #{cocktail_id}",
        ))

    # 5. Création de la séquence et enregistrement historique
    seq = await cocktail_service.create_pour_sequence(cocktail_id, 1, None, db)

    db.add(OrderHistory(
        user_id=user.id, 
        recipe_id=cocktail_id,
        sequence_id=seq["id"],
        cost_price=cost_price, 
        sale_price=final_sale_price,
    ))
    
    db.commit()
    background_tasks.add_task(execute_sequence_background, seq["id"])

    return {
        "status":         "started",
        "sequence_id":    seq["id"],
        "estimated_time": seq.get("estimated_time"),
        "cocktail_name":  seq.get("cocktail_name"),
        "new_balance":    round(user.balance, 2),
    }