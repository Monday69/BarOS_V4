"""
BarOS V4 - Service Cocktail (Full Async)
Chemin : backend/services/cocktail_service.py
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
import asyncio
from datetime import datetime

# Imports locaux
from backend.models import Ingredient, Recipe, RecipeIngredient, PourSequence, PourStep

try:
    from backend.logic.fluid_physics import FluidPhysics
except ImportError:
    FluidPhysics = None

try:
    from backend.hardware.gpio_manager import GPIOManager
except ImportError:
    GPIOManager = None

class CocktailService:

    # ✅ On passe en ASYNC DEF
    async def execute_sequence(self, sequence_id: int, db: Session):
        """
        Exécute la séquence en mode 100% asynchrone.
        """
        print(f"\n{'='*60}")
        print(f"[Service] 🚀 DÉMARRAGE SÉQUENCE {sequence_id} (ASYNC)")
        
        hardware_steps = []
        
        # --- PHASE 1 : Préparation & Réservation (DB Synchrone rapide) ---
        try:
            with db.begin():
                stmt = (
                    select(PourSequence)
                    .options(joinedload(PourSequence.steps).joinedload(PourStep.ingredient))
                    .filter(PourSequence.id == sequence_id)
                )
                sequence = db.execute(stmt).unique().scalar_one()

                for step in sequence.steps:
                    ing = step.ingredient
                    if not ing.pump_id:
                        sequence.status = "FAILED_CONFIG"
                        raise ValueError(f"Pas de pompe pour {ing.name}")

                    if ing.current_volume_ml < step.volume_ml:
                        sequence.status = "FAILED_STOCK"
                        raise ValueError(f"Stock insuffisant: {ing.name}")
                    
                    # Réservation
                    ing.current_volume_ml -= step.volume_ml
                    
                    hardware_steps.append({
                        "step_id": step.id,
                        "ing_name": ing.name,
                        "pump_id": ing.pump_id,
                        "volume": step.volume_ml,
                        "current_vol_sim": ing.current_volume_ml + step.volume_ml,
                        "max_vol": ing.max_volume_ml
                    })

                sequence.status = "IN_PROGRESS"
                sequence.start_time = datetime.utcnow()
        
        except Exception as e:
            print(f"[Phase 1] ❌ Erreur : {e}")
            return 

        print("[Phase 1] ✅ Stock réservé.")

        # --- PHASE 2 : Hardware (Long & Async) ---
        print("[Phase 2] ⚙️ Hardware Async...")
        
        for i, hw_step in enumerate(hardware_steps, 1):
            print(f"  > Étape {i}: {hw_step['ing_name']}")
            
            try:
                # Calcul Physique
                duration = 0.0
                if FluidPhysics:
                    duration = FluidPhysics.calculate_pour_duration(
                        target_volume_ml=hw_step["volume"],
                        current_volume_ml=hw_step["current_vol_sim"],
                        max_volume_ml=hw_step["max_vol"] or 1000
                    )
                else:
                    duration = hw_step["volume"] * 0.1

                # ✅ APPEL HARDWARE ASYNCHRONE
                # On attend que la pompe finisse, mais le CPU est libre pour autre chose
                if GPIOManager:
                    await GPIOManager.pour(hw_step["pump_id"], duration)
                else:
                    # Mock pur si pas de manager
                    await asyncio.sleep(duration)

                # Validation étape (DB rapide)
                with db.begin():
                    step_db = db.query(PourStep).get(hw_step["step_id"])
                    step_db.status = "COMPLETED"
                    step_db.real_duration = duration

            except Exception as e:
                print(f"  ❌ CRASH : {e}")
                self._refund_sequence(sequence_id, db)
                return

        # --- PHASE 3 : Fin ---
        try:
            with db.begin():
                seq = db.query(PourSequence).get(sequence_id)
                seq.status = "COMPLETED"
                seq.end_time = datetime.utcnow()
            print(f"✅ Séquence {sequence_id} terminée.\n")
        except Exception as e:
            print(f"⚠️ Erreur clôture: {e}")

    def _refund_sequence(self, sequence_id: int, db: Session):
        """Remboursement en cas d'erreur (Code synchrone gardé pour sécurité DB)"""
        print(f"[URGENCE] 💸 Remboursement {sequence_id}")
        try:
            with db.begin():
                seq = db.query(PourSequence).options(joinedload(PourSequence.steps)).get(sequence_id)
                if not seq: return
                
                seq.status = "FAILED_HARDWARE"
                for step in seq.steps:
                    if step.status != "COMPLETED":
                        ing = db.query(Ingredient).get(step.ingredient_id)
                        if ing: ing.current_volume_ml += step.volume_ml
                        step.status = "FAILED"
        except Exception as e:
            print(f"💥 Erreur critique refund: {e}")

    # --- AUTRES MÉTHODES ASYNC ---
    async def validate_recipe(self, recipe_id: int, db: Session):
        recipe = db.query(Recipe).get(recipe_id)
        if not recipe: return {"valid": False, "errors": ["Recette introuvable"]}
        for ri in recipe.recipe_ingredients:
             if not ri.ingredient.pump_id:
                 return {"valid": False, "errors": [f"Ingrédient '{ri.ingredient.name}' sans pompe"]}
        return {"valid": True, "errors": []}

    async def create_pour_sequence(self, recipe_id: int, priority: int, user_nfc: str, db: Session):
        new_seq = PourSequence(recipe_id=recipe_id, user_nfc=user_nfc, status="PENDING")
        db.add(new_seq)
        db.flush()
        
        recipe_ingredients = db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).all()
        steps_data = []
        total_est = 0
        
        for idx, ri in enumerate(recipe_ingredients):
            step = PourStep(sequence_id=new_seq.id, ingredient_id=ri.ingredient_id, volume_ml=ri.volume_ml, order=idx)
            db.add(step)
            steps_data.append(step)
            total_est += (ri.volume_ml * 0.1) + 1

        db.commit()
        db.refresh(new_seq)
        cocktail_name = db.query(Recipe).get(recipe_id).name
        
        return {
            "id": new_seq.id,
            "cocktail_name": cocktail_name,
            "estimated_time": total_est,
            "steps": steps_data
        }
    
    async def check_recipe_stock(self, recipe_id: int, db: Session):
        ingr = db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).all()
        for ri in ingr:
            if ri.ingredient.current_volume_ml < ri.volume_ml:
                return False
        return True