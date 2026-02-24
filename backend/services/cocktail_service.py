"""
BarOS V4 - Service Cocktail (Full Async)
Chemin : backend/services/cocktail_service.py
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
import asyncio
from datetime import datetime, timezone

from backend.models import (
    Ingredient, Recipe, RecipeIngredient,
    PourSequence, PourStep, SequenceLog
)

try:
    from backend.logic.fluid_physics import FluidPhysics
except ImportError:
    FluidPhysics = None

try:
    from backend.hardware.gpio_manager import GPIOManager
except ImportError:
    GPIOManager = None


# ── Helper logging ─────────────────────────────────────────────────────────────
def _log(db: Session, sequence_id: int, level: str, phase: str, message: str, data: dict = None):
    try:
        entry = SequenceLog(
            sequence_id=sequence_id,
            level=level,
            phase=phase,
            message=message,
            data=data or {}
        )
        db.add(entry)
        db.flush()
    except Exception as e:
        print(f"[LOG_ERROR] Impossible d'écrire le log : {e}", flush=True)


class CocktailService:

    async def execute_sequence(self, sequence_id: int, db: Session):
        print(f"\n{'='*60}", flush=True)
        print(f"[Service] 🚀 DÉMARRAGE SÉQUENCE {sequence_id} (ASYNC)", flush=True)

        hardware_steps = []
        sequence_start = datetime.now(timezone.utc)

        # ── PHASE 1 : Préparation & Réservation ───────────────────────────────
        try:
            with db.begin():
                stmt = (
                    select(PourSequence)
                    .options(joinedload(PourSequence.steps).joinedload(PourStep.ingredient))
                    .filter(PourSequence.id == sequence_id)
                )
                sequence = db.execute(stmt).unique().scalar_one()

                _log(db, sequence_id, "INFO", "INIT",
                     f"Démarrage séquence pour recette #{sequence.recipe_id}",
                     {"recipe_id": sequence.recipe_id, "user_nfc": sequence.user_nfc})

                for step in sequence.steps:
                    ing = step.ingredient

                    if not ing.pump_id:
                        _log(db, sequence_id, "ERROR", "STOCK_RESERVATION",
                             f"Ingrédient '{ing.name}' sans pompe assignée",
                             {"ingredient_id": ing.id, "ingredient_name": ing.name})
                        sequence.status = "FAILED_CONFIG"
                        raise ValueError(f"Pas de pompe pour {ing.name}")

                    if ing.current_volume_ml < step.volume_ml:
                        _log(db, sequence_id, "ERROR", "STOCK_RESERVATION",
                             f"Stock insuffisant pour '{ing.name}'",
                             {
                                 "ingredient_name": ing.name,
                                 "required_ml":     step.volume_ml,
                                 "available_ml":    ing.current_volume_ml
                             })
                        sequence.status = "FAILED_STOCK"
                        raise ValueError(f"Stock insuffisant: {ing.name}")

                    ing.current_volume_ml -= step.volume_ml
                    _log(db, sequence_id, "INFO", "STOCK_RESERVATION",
                         f"Stock réservé : {ing.name}",
                         {
                             "ingredient_name": ing.name,
                             "pump_id":         ing.pump_id,
                             "reserved_ml":     step.volume_ml,
                             "remaining_ml":    round(ing.current_volume_ml, 1)
                         })

                    hardware_steps.append({
                        "step_id":         step.id,
                        "ing_name":        ing.name,
                        "pump_id":         ing.pump_id,
                        "volume":          step.volume_ml,
                        "current_vol_sim": ing.current_volume_ml + step.volume_ml,
                        "max_vol":         ing.max_volume_ml
                    })

                sequence.status = "IN_PROGRESS"
                sequence.start_time = datetime.now(timezone.utc)

        except Exception as e:
            print(f"[Phase 1] ❌ Erreur : {e}", flush=True)
            return

        print("[Phase 1] ✅ Stock réservé.", flush=True)

        # ── PHASE 2 : Hardware ────────────────────────────────────────────────
        print("[Phase 2] ⚙️ Hardware Async...", flush=True)

        for i, hw_step in enumerate(hardware_steps, 1):
            print(f"  > Étape {i}: {hw_step['ing_name']}", flush=True)
            step_start = datetime.now(timezone.utc)

            try:
                duration = 0.0
                if FluidPhysics:
                    duration = FluidPhysics.calculate_pour_duration(
                        target_volume_ml=hw_step["volume"],
                        current_volume_ml=hw_step["current_vol_sim"],
                        max_volume_ml=hw_step["max_vol"] or 1000
                    )
                else:
                    duration = hw_step["volume"] * 0.1

                print(f"  💧 [POMPE {hw_step['pump_id']}] ON  -> Verse {hw_step['volume']}ml (Temps: {round(duration, 2)}s)", flush=True)
                
                if GPIOManager:
                    await GPIOManager.pour(hw_step["pump_id"], duration)
                else:
                    await asyncio.sleep(duration)

                real_duration = (datetime.now(timezone.utc) - step_start).total_seconds()

                print(f"  ✅ [POMPE {hw_step['pump_id']}] OFF -> Terminé en {round(real_duration, 2)}s", flush=True)

                with db.begin():
                    # ✅ Fix : db.get() au lieu de db.query().get() (déprécié SQLAlchemy 2.0)
                    step_db = db.get(PourStep, hw_step["step_id"])
                    step_db.status = "COMPLETED"
                    step_db.real_duration = real_duration

                    _log(db, sequence_id, "SUCCESS", "HARDWARE",
                         f"Pompe #{hw_step['pump_id']} OK — {hw_step['ing_name']}",
                         {
                             "pump_id":               hw_step["pump_id"],
                             "ingredient_name":       hw_step["ing_name"],
                             "target_volume_ml":      hw_step["volume"],
                             "calculated_duration_s": round(duration, 3),
                             "real_duration_s":       round(real_duration, 3),
                             "step_order":            i,
                             "simulation_mode":       GPIOManager is None
                         })

            except Exception as e:
                print(f"  ❌ CRASH : {e}", flush=True)
                with db.begin():
                    _log(db, sequence_id, "ERROR", "HARDWARE",
                         f"Crash pompe #{hw_step['pump_id']} — {hw_step['ing_name']} : {e}",
                         {"pump_id": hw_step["pump_id"], "ingredient_name": hw_step["ing_name"], "error": str(e)})
                self._refund_sequence(sequence_id, db)
                return

        # ── PHASE 3 : Clôture ─────────────────────────────────────────────────
        try:
            with db.begin():
                # ✅ Fix : db.get() au lieu de db.query().get()
                seq = db.get(PourSequence, sequence_id)
                seq.status   = "COMPLETED"
                seq.end_time = datetime.now(timezone.utc)
                total_duration = (seq.end_time - sequence_start).total_seconds()

                _log(db, sequence_id, "SUCCESS", "VALIDATION",
                     f"Séquence terminée en {round(total_duration, 1)}s",
                     {
                         "total_duration_s": round(total_duration, 1),
                         "steps_count":      len(hardware_steps),
                         "total_volume_ml":  round(sum(s["volume"] for s in hardware_steps), 1)
                     })

            print(f"✅ Séquence {sequence_id} terminée.\n", flush=True)

        except Exception as e:
            print(f"⚠️ Erreur clôture: {e}", flush=True)

    def _refund_sequence(self, sequence_id: int, db: Session):
        """
        Remboursement en cas d'erreur hardware.
        """
        print(f"[URGENCE] 💸 Remboursement {sequence_id}", flush=True)
        try:
            with db.begin():
                seq = db.execute(
                    select(PourSequence)
                    .options(
                        joinedload(PourSequence.steps)
                        .joinedload(PourStep.ingredient)
                    )
                    .filter(PourSequence.id == sequence_id)
                ).unique().scalar_one_or_none()

                if not seq:
                    return

                seq.status = "FAILED_HARDWARE"
                refunded   = []

                for step in seq.steps:
                    if step.status != "COMPLETED":
                        ing = step.ingredient   # ✅ déjà chargé via joinedload, pas de requête
                        if ing:
                            ing.current_volume_ml += step.volume_ml
                            refunded.append({
                                "ingredient":  ing.name,
                                "refunded_ml": step.volume_ml
                            })
                        step.status = "FAILED"

                _log(db, sequence_id, "WARNING", "REFUND",
                     f"Remboursement effectué pour {len(refunded)} ingrédient(s)",
                     {"refunded_items": refunded})

        except Exception as e:
            print(f"💥 Erreur critique refund: {e}", flush=True)

    # ── validate_recipe ───────────────────────────────────────────────────────

    async def validate_recipe(self, recipe_id: int, db: Session):
        recipe = db.execute(
            select(Recipe)
            .options(
                joinedload(Recipe.recipe_ingredients)
                .joinedload(RecipeIngredient.ingredient)
            )
            .filter(Recipe.id == recipe_id)
        ).unique().scalar_one_or_none()

        if not recipe:
            return {"valid": False, "errors": ["Recette introuvable"]}

        for ri in recipe.recipe_ingredients:
            if not ri.ingredient or not ri.ingredient.pump_id:
                name = ri.ingredient.name if ri.ingredient else f"#{ri.ingredient_id}"
                return {"valid": False, "errors": [f"Ingrédient '{name}' sans pompe"]}

        return {"valid": True, "errors": []}

    # ── create_pour_sequence ──────────────────────────────────────────────────

    async def create_pour_sequence(self, recipe_id: int, priority: int, user_nfc: str, db: Session):
        new_seq = PourSequence(recipe_id=recipe_id, user_nfc=user_nfc, status="PENDING")
        db.add(new_seq)
        db.flush()

        # ✅ FIX : On charge l'ingrédient pour avoir son niveau actuel et faire un calcul précis
        recipe_ingredients = db.execute(
            select(RecipeIngredient)
            .options(joinedload(RecipeIngredient.ingredient))
            .filter(RecipeIngredient.recipe_id == recipe_id)
            .order_by(RecipeIngredient.order)
        ).unique().scalars().all()

        total_est = 0
        for idx, ri in enumerate(recipe_ingredients):
            db.add(PourStep(
                sequence_id=new_seq.id,
                ingredient_id=ri.ingredient_id,
                volume_ml=ri.volume_ml,
                order=idx
            ))
            
            # ✅ LE VRAI CALCUL DE TEMPS EXACTEMENT COMME DANS LE TERMINAL
            if FluidPhysics and ri.ingredient:
                duration = FluidPhysics.calculate_pour_duration(
                    target_volume_ml=ri.volume_ml,
                    current_volume_ml=ri.ingredient.current_volume_ml,
                    max_volume_ml=ri.ingredient.max_volume_ml or 1000
                )
                total_est += duration
            else:
                total_est += (ri.volume_ml * 0.1) # Fallback

        db.commit()
        db.refresh(new_seq)

        cocktail_name = db.get(Recipe, recipe_id).name

        return {
            "id":             new_seq.id,
            "cocktail_name":  cocktail_name,
            "estimated_time": round(total_est, 1),
        }

    # ── check_recipe_stock ────────────────────────────────────────────────────

    async def check_recipe_stock(self, recipe_id: int, db: Session):
        recipe_ingredients = db.execute(
            select(RecipeIngredient)
            .options(joinedload(RecipeIngredient.ingredient))
            .filter(RecipeIngredient.recipe_id == recipe_id)
        ).unique().scalars().all()

        for ri in recipe_ingredients:
            if not ri.ingredient:
                return False
            if ri.ingredient.current_volume_ml < ri.volume_ml:
                return False
        return True