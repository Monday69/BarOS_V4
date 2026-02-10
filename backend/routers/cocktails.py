"""
BarOS V4 - Router Cocktails (Full Async + Nutrition V5)
Chemin : backend/routers/cocktails.py
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from backend.database import get_db, SessionLocal
from backend.services.cocktail_service import CocktailService
from backend.services.recipe_service import RecipeService

router = APIRouter(tags=["cocktails"])

cocktail_service = CocktailService()
recipe_service = RecipeService()

# --- WRAPPER ASYNC ---
async def execute_sequence_background(sequence_id: int):
    """Crée une session DB et lance l'exécution async."""
    db = SessionLocal()
    try:
        await cocktail_service.execute_sequence(sequence_id, db)
    except Exception as e:
        print(f"🔥 ERREUR CRITIQUE Tâche de fond: {e}")
    finally:
        db.close()

# --- MODÈLES ---
class CocktailListResponse(BaseModel):
    id: int
    name: str
    price: float
    image_url: Optional[str] = None
    ingredients: List[str] 
    
    class Config:
        from_attributes = True

# --- ROUTES ---

@router.get("/", response_model=List[CocktailListResponse])
async def get_cocktails(
    available_only: bool = Query(True), 
    category: Optional[str] = None,
    limit: int = 50, offset: int = 0,
    db: Session = Depends(get_db)
):
    recipes = await recipe_service.get_recipes(db, available_only, category, None, limit, offset)
    response = []
    for r in recipes:
        ing_names = [ri.ingredient.name for ri in r.recipe_ingredients]
        response.append({
            "id": r.id,
            "name": r.name,
            "price": r.price,
            "image_url": r.image_url,
            "ingredients": ing_names
        })
    return response

@router.get("/{cocktail_id}")
async def get_cocktail_detail(cocktail_id: int, db: Session = Depends(get_db)):
    """Retourne le détail complet + INFOS NUTRITIONNELLES (Calculées)"""
    r = await recipe_service.get_recipe_detail(cocktail_id, db)
    if not r: raise HTTPException(404, "Cocktail introuvable")
    
    ing_details = []
    
    # --- CALCUL NUTRITIONNEL ---
    total_vol = 0
    total_alcohol_vol = 0
    total_sugar_g = 0
    total_kcal = 0
    
    print(f"\n🧪 Calcul Nutrition pour : {r.name}") # LOG DEBUG

    for ri in r.recipe_ingredients:
        vol = ri.volume_ml
        ing = ri.ingredient
        
        # Données de base pour le frontend
        ing_details.append({
            "name": ing.name,
            "volume": vol,
            "image_url": ing.image_url
        })
        
        # Calculs pondérés
        total_vol += vol
        
        # Alcool pur (ml) : Degré * Volume / 100
        alc_vol = (ing.alcohol_degree * vol / 100)
        total_alcohol_vol += alc_vol
        
        # Sucre (g) : g/100ml * Volume / 100
        sugar = (ing.sugar_g_per_100ml * vol / 100)
        total_sugar_g += sugar
        
        # Calories (kcal) : kcal/100ml * Volume / 100
        kcal = (ing.kcal_per_100ml * vol / 100)
        total_kcal += kcal
        
        # Affichage détail dans la console (Pour vérifier)
        print(f"  - {ing.name} ({vol}ml) : {alc_vol:.1f}ml Alc | {sugar:.1f}g Sucre | {kcal:.0f} Kcal")

    # Résultats finaux (Sécurisés contre div/0)
    if total_vol > 0:
        final_degree = (total_alcohol_vol / total_vol) * 100
    else:
        final_degree = 0

    nutrition_info = {
        "alcohol_degree": round(final_degree, 1),
        "sugar_g": round(total_sugar_g, 1),
        "kcal": round(total_kcal, 0)
    }
    
    print(f"📊 TOTAL : {nutrition_info['alcohol_degree']}% Alc | {nutrition_info['sugar_g']}g Sucre | {nutrition_info['kcal']} Kcal\n")

    # Vérification stock
    compatible = await cocktail_service.check_recipe_stock(cocktail_id, db)

    return {
        "id": r.id,
        "name": r.name,
        "price": r.price,
        "image_url": r.image_url,
        "ingredients": ing_details,
        "total_volume_ml": total_vol,
        "compatible_with_stock": compatible,
        "estimated_time": len(ing_details) * 2 + total_vol * 0.1,
        
        # ✅ DATA NUTRITION ENVOYÉE AU FRONT
        "nutrition": nutrition_info 
    }

@router.post("/{cocktail_id}/pour")
async def pour_cocktail(
    cocktail_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    val = await cocktail_service.validate_recipe(cocktail_id, db)
    if not val["valid"]: raise HTTPException(400, detail=val["errors"][0])

    seq = await cocktail_service.create_pour_sequence(cocktail_id, 1, None, db)

    background_tasks.add_task(execute_sequence_background, seq["id"])

    return {
        "status": "started", 
        "sequence_id": seq["id"],
        "estimated_time": seq.get("estimated_time"),
        "cocktail_name": seq.get("cocktail_name")
    }