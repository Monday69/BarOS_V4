"""
BarOS V4 - Router Cocktails
Chemin : backend/routers/cocktails.py

Corrections v2 :
  - Race condition sur POST /{id}/pour : OrderHistory ajouté AVANT
    que la séquence background ne démarre → si le background crash,
    l'historique est quand même enregistré (cohérent).
    Inversement, on commitait l'historique dans le même bloc que
    la séquence, ce qui pouvait laisser un OrderHistory orphelin.
    Solution : commit de l'historique uniquement après add_task.
  - Vérification des ingrédients dans /custom en batch (SELECT IN)
    plutôt qu'une requête par ingrédient.
  - db.query().filter().first() sur PK → db.get() (SQLAlchemy 2.0).
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel

from backend.database import get_db, SessionLocal
from backend.services.cocktail_service import CocktailService
from backend.services.recipe_service import RecipeService
from backend.models import Ingredient, OrderHistory, PourSequence, PourStep, Recipe, RecipeIngredient
from backend.logic.fluid_physics import FluidPhysics
import os, json as _json

# ── Helper : lit la marge depuis config.json ──────────────────────────────────
def _get_margin() -> float:
    """Retourne margin_percent depuis config.json. Fallback 0 si fichier absent."""
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


# ── Background task wrapper ───────────────────────────────────────────────────

async def execute_sequence_background(sequence_id: int):
    db = SessionLocal()
    try:
        await cocktail_service.execute_sequence(sequence_id, db)
    except Exception as e:
        print(f"🔥 ERREUR CRITIQUE séquence #{sequence_id}: {e}")
    finally:
        db.close()


# ── Modèles Pydantic ──────────────────────────────────────────────────────────

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
    name:        Optional[str]      = "Cocktail Lab"
    ingredients: List[IngredientInput]
    user_id:     Optional[int]      = None


# ── Helper : calcul nutrition d'une recette ───────────────────────────────────

def _recipe_nutrition(recipe) -> dict:
    total_vol = total_alcohol_vol = total_sugar_g = total_kcal = 0.0
    cost_breakdown = []
    total_cost     = 0.0

    for ri in recipe.recipe_ingredients:
        ing = ri.ingredient
        if not ing:
            continue
        vol = ri.volume_ml
        total_vol     += vol
        total_kcal    += (ing.kcal_per_100ml    or 0.0) * vol / 100.0
        total_sugar_g += (ing.sugar_g_per_100ml or 0.0) * vol / 100.0
        if (ing.alcohol_degree or 0.0) > 0:
            total_alcohol_vol += (ing.alcohol_degree / 100.0) * vol

        # ── Coût de revient ──────────────────────────────────────────────────
        # Règle de trois : prix_achat (€/L) × volume_utilisé (ml) / 1000
        # purchase_price_per_liter est stocké en €/L pour être indépendant
        # du format de bouteille (75cl, 1L, 1.5L…).
        item_cost = None
        if ing.purchase_price_per_liter and ing.purchase_price_per_liter > 0:
            item_cost   = round(ing.purchase_price_per_liter * vol / 1000.0, 4)
            total_cost += item_cost
        cost_breakdown.append({
            "name":      ing.name,
            "volume_ml": vol,
            "cost":      item_cost,
        })

    final_degree    = (total_alcohol_vol / total_vol * 100) if total_vol else 0.0
    grams_of_alc    = total_alcohol_vol * 0.789
    standard_drinks = grams_of_alc / 10.0

    if final_degree > 20:    warning = "Cocktail très corsé 🔥"
    elif total_sugar_g > 35: warning = "Très sucré 🍬"
    elif final_degree == 0:  warning = "100% Sans Alcool 😇"
    else:                    warning = "Cocktail Équilibré 🍹"

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
        "cost_price":         cost_price,
        "cost_breakdown":     cost_breakdown,
        "sale_price":         sale_price,      # coût × (1 + marge%) — prix affiché au client
        "margin_percent":     margin_percent,  # marge actuelle pour affichage détail
    }


# ── GET / — Liste des cocktails ───────────────────────────────────────────────

@router.get("/", response_model=List[CocktailListResponse])
async def get_cocktails(
    available_only: bool           = Query(True),
    category:       Optional[str]  = None,
    limit:          int            = 50,
    offset:         int            = 0,
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
            "id":          r.id,
            "name":        r.name,
            "price":       sale_price if sale_price is not None else r.price,
            "sale_price":  sale_price,
            "image_url":   r.image_url,
            "ingredients": [ri.ingredient.name for ri in r.recipe_ingredients],
        })
    return result


# ── POST / — Créer une recette (Lab → catalogue) ──────────────────────────────

@router.post("/")
async def create_recipe(payload: RecipeCreateInput, db: Session = Depends(get_db)):
    """Crée une nouvelle recette dans le catalogue depuis le Lab."""
    # ✅ Fix : vérification en batch — une requête au lieu de N
    ids_needed = {step.ingredient_id for step in payload.ingredients}
    found_ids  = {
        row.id for row in
        db.query(Ingredient.id).filter(Ingredient.id.in_(ids_needed)).all()
    }
    missing = ids_needed - found_ids
    if missing:
        raise HTTPException(404, f"Ingrédients introuvables : {sorted(missing)}")

    recipe = Recipe(
        name=payload.name, description=payload.description,
        category=payload.category, price=payload.price, is_available=True,
    )
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


# ── GET /{id} — Détail d'un cocktail ─────────────────────────────────────────

@router.get("/{cocktail_id}")
async def get_cocktail_detail(cocktail_id: int, db: Session = Depends(get_db)):
    r = await recipe_service.get_recipe_detail(cocktail_id, db)
    if not r:
        raise HTTPException(404, "Cocktail introuvable")

    nutrition = _recipe_nutrition(r)
    compatible = await cocktail_service.check_recipe_stock(cocktail_id, db)

    # ✅ CALCUL DU TEMPS PRÉCIS (identique à create_pour_sequence)
    precise_time = 0.0
    try:
        # Charger les ingrédients avec leurs niveaux de stock actuels
        recipe_ingredients = db.execute(
            select(RecipeIngredient)
            .options(joinedload(RecipeIngredient.ingredient))
            .filter(RecipeIngredient.recipe_id == cocktail_id)
            .order_by(RecipeIngredient.order)
        ).unique().scalars().all()
        
        for ri in recipe_ingredients:
            if FluidPhysics and ri.ingredient:
                duration = FluidPhysics.calculate_pour_duration(
                    target_volume_ml=ri.volume_ml,
                    current_volume_ml=ri.ingredient.current_volume_ml,
                    max_volume_ml=ri.ingredient.max_volume_ml or 1000
                )
                precise_time += duration
            else:
                precise_time += ri.volume_ml * 0.1  # Fallback
                
        precise_time = round(precise_time, 1)
    except Exception as e:
        print(f"⚠️ Erreur calcul temps précis: {e}")
        precise_time = nutrition.get("estimated_time", 0)

    return {
        "id": r.id, "name": r.name, "price": r.price,
        "image_url": r.image_url,
        "ingredients": [
            {
                "name":      ri.ingredient.name,
                "volume":    ri.volume_ml,
                "image_url": ri.ingredient.image_url if ri.ingredient else None,
            }
            for ri in r.recipe_ingredients if ri.ingredient
        ],
        "compatible_with_stock": compatible,
        **nutrition,
        "estimated_time": precise_time,  # ✅ On écrase avec le temps précis
    }

# ── POST /{id}/pour — Commander un cocktail ───────────────────────────────────

@router.post("/{cocktail_id}/pour")
async def pour_cocktail(
    cocktail_id:      int,
    background_tasks: BackgroundTasks,
    user_id:          Optional[int]   = Query(None),
    cost_price:       Optional[float] = Query(None),
    sale_price:       Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    # 🔒 VERROU 1 : Interdire formellement les requêtes anonymes (Anti-Triche)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Identification par badge requise")

    val = await cocktail_service.validate_recipe(cocktail_id, db)
    if not val["valid"]:
        raise HTTPException(400, detail=val["errors"][0])

    # 1. Récupération de l'utilisateur
    from backend.models import User as _User, PaymentTransaction
    user = db.get(_User, user_id)
    if not user:
        raise HTTPException(404, detail="Utilisateur inconnu")

    # 2. Lecture globale de la configuration de paiement
    import json as _json
    try:
        _base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        _cfg  = _json.load(open(os.path.join(_base, "config.json")))
        # Supporte les deux formats de config possibles
        _require = _cfg.get("require_payment", _cfg.get("payment", {}).get("require_payment", False))
    except Exception:
        _require = False

    # 🔒 VERROU 2 : Vérification du solde et débit avant d'activer les pompes
    if _require and sale_price is not None:
        if user.balance < sale_price:
            raise HTTPException(402, detail={
                "code":     "INSUFFICIENT_BALANCE",
                "balance":  round(user.balance, 2),
                "required": sale_price,
                "message":  f"Solde insuffisant ({user.balance:.2f}€ dispo, {sale_price:.2f}€ requis)"
            })
        
        # Le solde est suffisant, on débite
        user.balance = round(user.balance - sale_price, 2)
        
        # On trace le débit
        db.add(PaymentTransaction(
            user_id     = user.id,
            amount      = -sale_price,
            type        = "debit",
            status      = "completed",
            description = f"Cocktail #{cocktail_id}",
        ))

    # 3. Lancement de la séquence (Pompes)
    seq = await cocktail_service.create_pour_sequence(cocktail_id, 1, None, db)

    # 4. Historique de commande
    db.add(OrderHistory(
        user_id=user.id,
        recipe_id=cocktail_id,
        cost_price=cost_price,
        sale_price=sale_price,
    ))
    
    # 💾 On sauvegarde tout d'un coup (Solde + Transaction + Historique)
    db.commit()

    background_tasks.add_task(execute_sequence_background, seq["id"])

    return {
        "status":         "started",
        "sequence_id":    seq["id"],
        "estimated_time": seq.get("estimated_time"),
        "cocktail_name":  seq.get("cocktail_name"),
        "new_balance":    round(user.balance, 2),
    }


# ── POST /custom — Recette custom depuis le Lab ───────────────────────────────

@router.post("/custom")
async def pour_custom_cocktail(
    request:          CustomPourRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Prépare un cocktail custom sans le sauvegarder dans le catalogue.
    Vérifie stocks + pompes, crée une PourSequence temporaire, lance en background.
    """
    # 🔒 VERROU : Appliquer la même règle d'identification pour le Lab Custom
    if request.user_id is None:
        raise HTTPException(status_code=401, detail="Identification par badge requise")

    ids_needed   = [step.ingredient_id for step in request.ingredients]
    ingredients  = {
        ing.id: ing for ing in
        db.query(Ingredient).filter(Ingredient.id.in_(ids_needed)).all()
    }

    # ... Vérifications des ingrédients ...
    for step in request.ingredients:
        ing = ingredients.get(step.ingredient_id)
        if not ing:
            raise HTTPException(404, f"Ingrédient #{step.ingredient_id} introuvable")
        if not ing.pump_id:
            raise HTTPException(400, f"'{ing.name}' n'est pas assigné à une pompe")
        if ing.current_volume_ml < step.volume_ml:
            raise HTTPException(400,
                f"Stock insuffisant pour '{ing.name}' "
                f"({ing.current_volume_ml:.0f}ml dispo, {step.volume_ml:.0f}ml demandés)"
            )

    sequence = PourSequence(recipe_id=None, user_nfc=None, status="PENDING")
    db.add(sequence)
    db.flush()

    for idx, step in enumerate(request.ingredients):
        db.add(PourStep(
            sequence_id=sequence.id,
            ingredient_id=step.ingredient_id,
            volume_ml=step.volume_ml,
            order=idx,
        ))

    db.add(OrderHistory(user_id=request.user_id, recipe_id=None))
    db.commit()
    db.refresh(sequence)

    background_tasks.add_task(execute_sequence_background, sequence.id)

    return {
        "message":     f"Préparation de '{request.name}' lancée",
        "sequence_id": sequence.id,
        "steps_count": len(request.ingredients),
    }