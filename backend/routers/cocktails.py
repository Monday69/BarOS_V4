"""
BarOS V4 - Router Cocktails (CORRIGÉ POUR FRONTEND)
Chemin : backend/routers/cocktails.py
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from pydantic import BaseModel

from backend.database import get_db, SessionLocal
from backend.services.cocktail_service import CocktailService
from backend.services.recipe_service import RecipeService

router = APIRouter(tags=["cocktails"])

cocktail_service = CocktailService()
recipe_service = RecipeService()

# --- WRAPPER TÂCHE DE FOND ---
def execute_sequence_background(sequence_id: int):
    """Crée une session DB indépendante pour la tâche."""
    db = SessionLocal()
    try:
        cocktail_service.execute_sequence_sync(sequence_id, db)
    except Exception as e:
        print(f"🔥 ERREUR CRITIQUE Tâche de fond: {e}")
    finally:
        db.close()

# --- MODÈLES (API RESPONSE) ---
# On redéfinit ici pour être sûr du format
class CocktailListResponse(BaseModel):
    id: int
    name: str
    price: float
    image_url: Optional[str] = None
    # 👇 CRUCIAL : Une liste de strings simple pour que le .includes() du JS marche
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
    
    # Transformation manuelle pour garantir que les ingrédients sont des strings
    response = []
    for r in recipes:
        # On extrait juste le nom de chaque ingrédient lié
        ing_names = [ri.ingredient.name for ri in r.recipe_ingredients]
        
        response.append({
            "id": r.id,
            "name": r.name,
            "price": r.price,
            "image_url": r.image_url,
            "ingredients": ing_names # ✅ Liste de strings ["Rhum", "Cola"]
        })
    
    return response

@router.get("/{cocktail_id}")
async def get_cocktail_detail(cocktail_id: int, db: Session = Depends(get_db)):
    """Retourne le détail complet pour la page CocktailPage"""
    r = await recipe_service.get_recipe_detail(cocktail_id, db)
    if not r: raise HTTPException(404, "Cocktail introuvable")
    
    # On construit une réponse détaillée
    ing_details = []
    for ri in r.recipe_ingredients:
        ing_details.append({
            "name": ri.ingredient.name,
            "volume": ri.volume_ml
        })
        
    # Vérification stock
    compatible = await cocktail_service.check_recipe_stock(cocktail_id, db)

    return {
        "id": r.id,
        "name": r.name,
        "price": r.price,
        "image_url": r.image_url,
        "ingredients": ing_details, # Ici on veut le détail (nom + volume)
        "total_volume_ml": sum(i["volume"] for i in ing_details),
        "compatible_with_stock": compatible,
        "estimated_time": len(ing_details) * 2 + sum(i["volume"] for i in ing_details) * 0.1
    }

@router.post("/{cocktail_id}/pour")
async def pour_cocktail(
    cocktail_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # 1. Validation
    val = await cocktail_service.validate_recipe(cocktail_id, db)
    if not val["valid"]: raise HTTPException(400, detail=val["errors"][0])

    # 2. Création (Pending)
    seq = await cocktail_service.create_pour_sequence(cocktail_id, 1, None, db)

    # 3. Lancement
    background_tasks.add_task(execute_sequence_background, seq["id"])

    return {
        "status": "started", 
        "sequence_id": seq["id"],
        "estimated_time": seq.get("estimated_time"),
        "cocktail_name": seq.get("cocktail_name")
    }