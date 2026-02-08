"""
BarOS V4 - Service Recettes
Chemin : backend/services/recipe_service.py
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.models import Recipe

class RecipeService:
    
    async def get_recipes(
        self, 
        db: Session, 
        available_only: bool = False, 
        category: Optional[str] = None, # <--- Ajouté
        search: Optional[str] = None,   # <--- Ajouté
        limit: int = 50, 
        offset: int = 0
    ):
        """Récupère les recettes avec filtres optionnels"""
        query = db.query(Recipe)
        
        # 1. Filtre Disponibilité
        if available_only:
            query = query.filter(Recipe.is_available == True)

        # 2. Filtre Catégorie (Ex: "Sans Alcool")
        if category:
            query = query.filter(Recipe.category == category)

        # 3. Recherche par nom (Ex: "Mojito")
        if search:
            # ilike = insensibles à la casse (Majuscule/minuscule)
            query = query.filter(Recipe.name.ilike(f"%{search}%"))

        return query.limit(limit).offset(offset).all()

    async def get_recipe_detail(self, recipe_id: int, db: Session):
        """Récupère une recette précise par son ID"""
        return db.query(Recipe).filter(Recipe.id == recipe_id).first()

    async def get_total_count(self, db: Session, available_only: bool = False):
        """Compte total pour la pagination"""
        query = db.query(Recipe)
        if available_only:
            query = query.filter(Recipe.is_available == True)
        return query.count()