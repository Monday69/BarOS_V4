"""
BarOS V4 - Service Recettes
Chemin : backend/services/recipe_service.py

Corrections v2 :
  - get_recipes : joinedload sur recipe_ingredients + ingredient ajouté.
    Sans ça, chaque accès à r.recipe_ingredients dans cocktails.py
    déclenche un SELECT séparé → N+1 sur la liste des cocktails.
  - get_recipe_detail : db.query().filter().first() sur PK → db.get()
    avec joinedload explicite (SQLAlchemy 2.0 + cohérence projet).
"""
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from backend.models import Recipe, RecipeIngredient, Ingredient


class RecipeService:

    async def get_recipes(
        self,
        db:             Session,
        available_only: bool           = False,
        category:       Optional[str]  = None,
        search:         Optional[str]  = None,
        limit:          int            = 50,
        offset:         int            = 0,
    ) -> list[Recipe]:
        """Récupère les recettes avec filtres optionnels."""
        query = db.query(Recipe).options(
            # ✅ Fix : joinedload — sans ça, le serializer dans cocktails.py
            # accède à r.recipe_ingredients en lazy load → 1 SELECT par recette.
            # Avec limit=50, ça fait jusqu'à 51 requêtes pour une seule liste.
            joinedload(Recipe.recipe_ingredients)
                .joinedload(RecipeIngredient.ingredient)
        )

        if available_only:
            query = query.filter(Recipe.is_available == True)
        if category:
            query = query.filter(Recipe.category == category)
        if search:
            query = query.filter(Recipe.name.ilike(f"%{search}%"))

        return query.limit(limit).offset(offset).all()

    async def get_recipe_detail(self, recipe_id: int, db: Session) -> Recipe | None:
        """Récupère une recette avec tous ses ingrédients (joinedload)."""
        # ✅ Fix : db.get() avec options() pour le joinedload — SQLAlchemy 2.0
        return (
            db.query(Recipe)
            .options(
                joinedload(Recipe.recipe_ingredients)
                    .joinedload(RecipeIngredient.ingredient)
            )
            .filter(Recipe.id == recipe_id)
            .first()
        )

    async def get_total_count(
        self,
        db:             Session,
        available_only: bool = False,
    ) -> int:
        """Compte total pour la pagination."""
        query = db.query(Recipe)
        if available_only:
            query = query.filter(Recipe.is_available == True)
        return query.count()