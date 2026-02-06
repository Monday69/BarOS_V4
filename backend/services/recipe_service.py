from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from backend.models.recipe import Recipe

class RecipeService:
    async def get_recipes(self, db: Session, available_only: bool = False, limit: int = 50, offset: int = 0):
        query = db.query(Recipe)
        
        if available_only:
            # Filtre complexe : on le fera en Python pour l'instant ou via une requête SQL optimisée plus tard
            # Pour l'instant on retourne tout et on filtre après (MVP)
            pass

        return query.limit(limit).offset(offset).all()

    async def get_recipe_detail(self, recipe_id: int, db: Session):
        return db.query(Recipe).filter(Recipe.id == recipe_id).first()

    async def get_total_count(self, db: Session, available_only: bool = False):
        return db.query(Recipe).count()