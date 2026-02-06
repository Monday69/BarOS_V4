"""
BarOS V4 - Routes cocktails optimisées
Séparation claire route/service/database
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import asyncio
import time

from backend.database import get_db
from backend.services.cocktail_service import CocktailService
from backend.services.recipe_service import RecipeService
from backend.middleware.auth import require_auth

router = APIRouter(tags=["cocktails"])

# Services instanciés
cocktail_service = CocktailService()
recipe_service = RecipeService()

# ============================================================================
# MODÈLES DE RÉPONSE OPTIMISÉS
# ============================================================================

class CocktailResponse(BaseModel):
    id: int
    name: str
    price: float
    image_url: Optional[str]
    ingredients: List[str]
    total_volume_ml: float
    difficulty: int
    estimated_time: float
    is_available: bool

class CocktailDetailResponse(CocktailResponse):
    ingredient_details: List[dict]
    preparation_steps: List[str]
    compatible_with_stock: bool

# ============================================================================
# ENDPOINTS OPTIMISÉS
# ============================================================================

@router.get("/", response_model=List[CocktailResponse])
async def get_cocktails(
    db: Session = Depends(get_db),
    available_only: bool = Query(True, description="Filtrer les recettes disponibles"),
    category: Optional[str] = Query(None, description="Filtrer par catégorie"),
    max_price: Optional[float] = Query(None, gt=0),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Liste des cocktails avec pagination et filtres
    """
    try:
        cocktails = await recipe_service.get_recipes(
            db=db,
            available_only=available_only,
            category=category,
            max_price=max_price,
            limit=limit,
            offset=offset
        )
        
        # Ajout métadonnées dans les headers
        total_count = await recipe_service.get_total_count(db, available_only)
        
        return cocktails
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")

@router.get("/{cocktail_id}", response_model=CocktailDetailResponse)
async def get_cocktail_detail(
    cocktail_id: int,
    check_stock: bool = Query(False, description="Vérifier compatibilité avec stocks"),
    db: Session = Depends(get_db)
):
    """
    Détails d'un cocktail spécifique
    """
    try:
        cocktail = await recipe_service.get_recipe_detail(cocktail_id, db)
        
        if not cocktail:
            raise HTTPException(status_code=404, detail="Cocktail non trouvé")
        
        # Vérification stocks si demandée
        if check_stock:
            stock_compatible = await cocktail_service.check_recipe_stock(cocktail_id, db)
            cocktail["compatible_with_stock"] = stock_compatible
        
        return cocktail
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")

@router.post("/{cocktail_id}/pour")
@require_auth(roles=["user", "admin"])
async def pour_cocktail(
    cocktail_id: int,
    background_tasks: BackgroundTasks,
    priority: int = Query(1, ge=1, le=3),
    user_nfc: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Préparer un cocktail spécifique
    """
    try:
        # Vérification préalable
        validation = await cocktail_service.validate_recipe(cocktail_id, db)
        
        if not validation["valid"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Recette non valide",
                    "errors": validation["errors"]
                }
            )
        
        # Création de la séquence
        sequence = await cocktail_service.create_pour_sequence(
            recipe_id=cocktail_id,
            priority=priority,
            user_nfc=user_nfc,
            db=db
        )
        
        # Lancement en arrière-plan
        background_tasks.add_task(
            cocktail_service.execute_sequence,
            sequence["id"],
            db
        )
        
        return {
            "status": "started",
            "sequence_id": sequence["id"],
            "estimated_time": sequence["estimated_time"],
            "cocktail_name": sequence["cocktail_name"],
            "steps": len(sequence["steps"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")

@router.get("/{cocktail_id}/status")
async def get_cocktail_status(
    cocktail_id: int,
    db: Session = Depends(get_db)
):
    """
    État de préparation d'un cocktail
    """
    try:
        status = await cocktail_service.get_preparation_status(cocktail_id, db)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")

@router.post("/{cocktail_id}/cancel")
@require_auth(roles=["admin"])
async def cancel_cocktail(
    cocktail_id: int,
    db: Session = Depends(get_db)
):
    """
    Annuler la préparation d'un cocktail (admin seulement)
    """
    try:
        result = await cocktail_service.cancel_preparation(cocktail_id, db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")

# ============================================================================
# ENDPOINTS BATCH/ADMIN
# ============================================================================

@router.post("/batch/import")
@require_auth(roles=["admin"])
async def import_cocktails_batch(
    url: Optional[str] = None,
    file_content: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Importation batch de cocktails (admin)
    """
    try:
        result = await recipe_service.import_batch(url, file_content, db)
        return {
            "status": "success",
            "imported": result["imported"],
            "updated": result["updated"],
            "failed": result["failed"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur import: {str(e)}")

@router.get("/stats/popular")
async def get_popular_cocktails(
    days: int = Query(7, le=365),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db)
):
    """
    Statistiques des cocktails populaires
    """
    try:
        stats = await recipe_service.get_popularity_stats(days, limit, db)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur statistiques: {str(e)}")