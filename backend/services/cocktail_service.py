import time
import asyncio
from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import Dict, Any, List

from backend.models.recipe import Recipe, RecipeIngredient
from backend.models.ingredient import Ingredient
from backend.logic.fluid_physics import FluidPhysics
from backend.hardware.gpio_manager import gpio_manager

class CocktailService:
    def __init__(self):
        self.current_sequence = None

    async def validate_recipe(self, recipe_id: int, db: Session) -> Dict[str, Any]:
        """Vérifie si une recette est faisable (stocks, pompes connectées)"""
        recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
        if not recipe:
            return {"valid": False, "errors": ["Recette introuvable"]}

        errors = []
        for step in recipe.recipe_ingredients:
            ing = step.ingredient
            if not ing.pump_id:
                errors.append(f"Ingrédient '{ing.name}' non connecté")
            elif ing.current_volume_ml < step.volume_ml:
                errors.append(f"Stock insuffisant pour '{ing.name}'")
        
        return {"valid": len(errors) == 0, "errors": errors}

    async def prepare_cocktail(self, recipe_id: int, db: Session, priority: int = 1) -> Dict[str, Any]:
        """Prépare la séquence de versement"""
        
        # 1. Validation ultime avant lancement
        validation = await self.validate_recipe(recipe_id, db)
        if not validation["valid"]:
            raise HTTPException(400, detail=validation["errors"])

        recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
        
        # 2. Création de l'ID de séquence unique
        sequence_id = f"SEQ_{int(time.time())}_{recipe_id}"
        
        # 3. Calcul des temps (Physique)
        estimated_time = 0
        steps_plan = []
        
        for step in recipe.recipe_ingredients:
            ing = step.ingredient
            duration = FluidPhysics.calculate_pour_duration(
                target_volume_ml=step.volume_ml,
                current_volume_ml=ing.current_volume_ml,
                max_volume_ml=ing.max_volume_ml
            )
            estimated_time += duration
            steps_plan.append({
                "pump_id": ing.pump_id,
                "duration": duration,
                "ingredient_name": ing.name,
                "volume_ml": step.volume_ml,
                "ingredient_obj": ing  # Garder la ref pour la mise à jour DB
            })

        # On stocke le plan en mémoire (ou Redis dans le futur)
        self.current_sequence = {
            "id": sequence_id,
            "recipe_name": recipe.name,
            "steps": steps_plan,
            "total_time": estimated_time
        }

        return {
            "status": "ready",
            "sequence_id": sequence_id,
            "recipe_name": recipe.name,
            "estimated_time": round(estimated_time, 2)
        }

    async def execute_pour_sequence(self, sequence_id: str, db: Session):
        """Exécute physiquement la séquence (Tâche de fond)"""
        if not self.current_sequence or self.current_sequence["id"] != sequence_id:
            print(f"❌ Erreur séquence: {sequence_id} introuvable ou expirée")
            return

        print(f"🚀 DÉBUT SEQUENCE: {self.current_sequence['recipe_name']}")
        
        steps = self.current_sequence["steps"]
        
        # VERROUILLAGE MACHINE (via MachineService idéalement, ici simplifié)
        # machine_service.set_busy(True)

        try:
            for step in steps:
                print(f"   💧 Versement {step['ingredient_name']} ({step['duration']:.2f}s)")
                
                # 1. Action Hardware
                await gpio_manager.pour_ingredient(step['pump_id'], step['duration'])
                
                # 2. Mise à jour Database (Atomique par étape)
                ing = step['ingredient_obj']
                ing.current_volume_ml -= step['volume_ml']
                if ing.current_volume_ml < 0: ing.current_volume_ml = 0
                db.add(ing)
                db.commit() # Commit à chaque étape pour sauvegarder l'état réel

            print(f"✅ FIN SEQUENCE: {self.current_sequence['recipe_name']}")

        except Exception as e:
            print(f"💥 CRASH HARDWARE: {e}")
            db.rollback()
        finally:
            self.current_sequence = None
            # machine_service.set_busy(False)