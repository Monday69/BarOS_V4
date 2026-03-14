"""
BarOS V5.1 - Service Cocktail (Full Async & Transactional & Detailed Logs)
Chemin : backend/services/cocktail_service.py

CORRECTIFS V5.1 (L'Ultime) :
  [SECURITÉ] SELECT ... WITH FOR UPDATE sur le stock pour éviter les conflits si 2 smartphones commandent.
  [SECURITÉ] Remboursement via sequence_id (FK 1:1) : précis, infaillible et idempotent.
  [UX DEV]   Restauration complète des logs détaillés dans le terminal pour les tests hardware
             (volumes affichés, compteurs de pompes, temps estimé vs temps réel).
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
import asyncio
from datetime import datetime, timezone, timedelta

from backend.models import (
    Ingredient, Recipe, RecipeIngredient,
    PourSequence, PourStep, SequenceLog,
    OrderHistory, PaymentTransaction, User,
)

try:
    from backend.logic.fluid_physics import FluidPhysics
except ImportError:
    FluidPhysics = None

try:
    from backend.hardware.gpio_manager import GPIOManager
except ImportError:
    GPIOManager = None


# ── Mutex global machine ───────────────────────────────────────────────────────
_machine_lock = asyncio.Lock()


def _log(db, sequence_id, level, phase, message, data=None):
    try:
        db.add(SequenceLog(
            sequence_id=sequence_id, level=level,
            phase=phase, message=message, data=data or {}
        ))
        db.flush()
    except Exception as e:
        print(f"[LOG_ERROR] {e}", flush=True)


async def _emergency_stop(active_pump_ids: list, reason: str = ""):
    """Eteint toutes les pompes actives. Best-effort, ne leve jamais."""
    if not active_pump_ids:
        return
    print(f"[EMERGENCY STOP] {len(active_pump_ids)} pompe(s) — {reason}", flush=True)
    for pump_id in active_pump_ids:
        try:
            if GPIOManager:
                await GPIOManager.off(pump_id)
            print(f"  [PUMP {pump_id}] OFF (urgence)", flush=True)
        except Exception as e:
            print(f"  [PUMP {pump_id}] ECHEC OFF : {e}", flush=True)


class CocktailService:

    async def execute_sequence(self, sequence_id: int, db: Session):
        try:
            await asyncio.wait_for(_machine_lock.acquire(), timeout=300)
        except asyncio.TimeoutError:
            print(f"[Service] Timeout verrou — seq #{sequence_id} abandonnee", flush=True)
            try:
                with db.begin():
                    seq = db.get(PourSequence, sequence_id)
                    if seq:
                        seq.status = "FAILED_CONFIG"
            except Exception:
                pass
            return

        hardware_steps  = []
        active_pump_ids = []
        sequence_start  = datetime.now(timezone.utc)
        recipe_name     = "Cocktail custom"

        try:
            # ── PHASE 1 : Reservation stock (SÉCURISÉE AVEC LOGS) ────────────
            try:
                with db.begin():
                    # 1. Charger la séquence (sans pré-charger les ingrédients pour gérer le verrou après)
                    stmt = select(PourSequence).options(joinedload(PourSequence.steps)).filter(PourSequence.id == sequence_id)
                    sequence = db.execute(stmt).unique().scalar_one_or_none()

                    if not sequence:
                        return

                    if sequence.recipe_id:
                        recipe = db.get(Recipe, sequence.recipe_id)
                        recipe_name = recipe.name if recipe else "Custom"

                    _log(db, sequence_id, "INFO", "INIT", f"Demarrage recette #{sequence.recipe_id}", {"user_nfc": sequence.user_nfc})

                    # 2. Boucle sur les ingrédients AVEC VERROU DE LIGNE (with_for_update)
                    for step in sequence.steps:
                        ing = db.query(Ingredient).filter(
                            Ingredient.id == step.ingredient_id
                        ).with_for_update().first() # 🔒 VERROU ANTI-DOUBLE COMMANDE SMARTPHONE

                        if not ing or not ing.pump_id:
                            _log(db, sequence_id, "ERROR", "STOCK_RESERVATION", f"'{ing.name if ing else step.ingredient_id}' sans pompe")
                            sequence.status = "FAILED_CONFIG"
                            raise ValueError(f"Pas de pompe pour {ing.name if ing else 'ID '+str(step.ingredient_id)}")

                        if ing.current_volume_ml < step.volume_ml:
                            _log(db, sequence_id, "ERROR", "STOCK_RESERVATION", f"Stock insuffisant '{ing.name}'", {"required": step.volume_ml, "available": ing.current_volume_ml})
                            sequence.status = "FAILED_STOCK"
                            raise ValueError(f"Stock insuffisant: {ing.name}")

                        # Décrémentation protégée
                        ing.current_volume_ml -= step.volume_ml
                        
                        _log(db, sequence_id, "INFO", "STOCK_RESERVATION", f"Stock reserve : {ing.name}", {"pump_id": ing.pump_id, "reserved_ml": step.volume_ml, "remaining_ml": round(ing.current_volume_ml, 1)})

                        hardware_steps.append({
                            "step_id":         step.id,
                            "ing_name":        ing.name,
                            "pump_id":         ing.pump_id,
                            "volume":          step.volume_ml,
                            "current_vol_sim": ing.current_volume_ml + step.volume_ml, # Pour Torricelli
                            "max_vol":         ing.max_volume_ml
                        })

                    sequence.status     = "IN_PROGRESS"
                    sequence.start_time = datetime.now(timezone.utc)

            except Exception as e:
                print(f"[Phase 1] Erreur : {e}", flush=True)
                return

            # 👉 RESTAURATION DES LOGS DÉTAILLÉS (HEADER)
            total_volume = round(sum(s["volume"] for s in hardware_steps), 1)
            print(f"\n{'='*60}", flush=True)
            print(f"🍹 [{recipe_name.upper()}] — Sequence #{sequence_id}", flush=True)
            print(f"   {len(hardware_steps)} ingrédient(s) · {total_volume} ml au total", flush=True)
            print(f"[Phase 1] Stock réservé sous verrou ✓", flush=True)
            print(f"[Phase 2] Versement en cours…\n", flush=True)

            # ── PHASE 2 : Hardware (AVEC VOLUMES ET TEMPS AFFICHÉS) ───────
            for i, hw_step in enumerate(hardware_steps, 1):
                step_start = datetime.now(timezone.utc)
                try:
                    if FluidPhysics:
                        duration = FluidPhysics.calculate_pour_duration(
                            target_volume_ml  = hw_step["volume"],
                            current_volume_ml = hw_step["current_vol_sim"],
                            max_volume_ml     = hw_step["max_vol"] or 1000
                        )
                    else:
                        duration = hw_step["volume"] * 0.1

                    active_pump_ids.append(hw_step["pump_id"])

                    # 👉 RESTAURATION DU LOG DÉTAILLÉ DE LA POMPE (V4)
                    print(f"  💧 [{hw_step['ing_name']}] Pompe {hw_step['pump_id']} — {hw_step['volume']}ml ({round(duration, 1)}s)", flush=True)
                    
                    if GPIOManager:
                        await GPIOManager.pour(hw_step["pump_id"], duration)
                    else:
                        await asyncio.sleep(duration)
                        
                    # 👉 RESTAURATION DU CHECK VERT (V4)
                    print(f"  ✅ [{hw_step['ing_name']}] Versé", flush=True)

                    active_pump_ids.remove(hw_step["pump_id"])

                    real_duration = (datetime.now(timezone.utc) - step_start).total_seconds()

                    with db.begin():
                        step_db = db.get(PourStep, hw_step["step_id"])
                        step_db.status = "COMPLETED"
                        step_db.real_duration = real_duration
                        _log(db, sequence_id, "SUCCESS", "HARDWARE", f"Pompe #{hw_step['pump_id']} OK — {hw_step['ing_name']}", {"real_duration_s": round(real_duration, 3)})

                except Exception as e:
                    print(f"  CRASH pompe #{hw_step['pump_id']} : {e}", flush=True)
                    with db.begin():
                        _log(db, sequence_id, "ERROR", "HARDWARE", f"Crash — {hw_step['ing_name']} : {e}", {"error": str(e)})

                    await _emergency_stop(list(active_pump_ids), reason=str(e))
                    active_pump_ids.clear()
                    
                    # Déclenche le remboursement atomique
                    self._refund_sequence(sequence_id, db)
                    return

            # ── PHASE 3 : Cloture ──────────────────────────────────────────
            try:
                with db.begin():
                    seq          = db.get(PourSequence, sequence_id)
                    seq.status   = "COMPLETED"
                    seq.end_time = datetime.now(timezone.utc)
                    total_s      = (seq.end_time - sequence_start).total_seconds()
                    _log(db, sequence_id, "SUCCESS", "VALIDATION", f"Sequence terminee en {round(total_s, 1)}s")
                
                # 👉 RESTAURATION DU FOOTER PRO (V4)
                print(f"\n{'─'*40}", flush=True)
                print(f"✨ {recipe_name} prêt en {round(total_s, 1)}s — {total_volume}ml versés", flush=True)
                print(f"{'─'*40}\n", flush=True)

            except Exception as e:
                print(f"Erreur cloture: {e}", flush=True)

        finally:
            if active_pump_ids:
                await _emergency_stop(list(active_pump_ids), reason="finally-cleanup")
            _machine_lock.release()
            print(f"[Service] Verrou libere (seq #{sequence_id})", flush=True)

    def _refund_sequence(self, sequence_id: int, db: Session):
        """
        Remboursement atomique (V5) basé sur l'ID de la séquence.
        Idempotent : ne peut pas rembourser la même commande deux fois.
        """
        print(f"[URGENCE] Remboursement automatique seq #{sequence_id} initié...", flush=True)
        try:
            with db.begin():
                # 1. Remboursement du STOCK
                seq = db.execute(
                    select(PourSequence)
                    .options(joinedload(PourSequence.steps).joinedload(PourStep.ingredient))
                    .filter(PourSequence.id == sequence_id)
                ).unique().scalar_one_or_none()

                if not seq: return
                seq.status = "FAILED_HARDWARE"
                
                refunded_stock = []
                for step in seq.steps:
                    if step.status != "COMPLETED" and step.ingredient:
                        step.ingredient.current_volume_ml += step.volume_ml
                        refunded_stock.append(f"{step.volume_ml}ml {step.ingredient.name}")
                        step.status = "FAILED"
                
                print(f"  📦 Stock annulé : {', '.join(refunded_stock) if refunded_stock else 'Rien à recréditer'}", flush=True)

                # 2. Remboursement du SOLDE (Logic Transactionnelle)
                order = db.execute(
                    select(OrderHistory).filter(OrderHistory.sequence_id == sequence_id)
                ).scalars().first()

                if not order:
                    print(f"  ⚠️ Pas de ticket de caisse (OrderHistory) lié à seq #{sequence_id} — pas de crédit solde.", flush=True)
                    return

                if order.refunded:
                    print(f"  ℹ️ Ticket #{order.id} DEJA REMBOURSÉ. Fin de l'opération.", flush=True)
                    return

                if not order.sale_price or order.sale_price <= 0:
                    print(f"  ℹ️ Ticket #{order.id} à 0€. Pas de crédit nécessaire.", flush=True)
                    order.refunded = True # On le marque quand même comme traité
                    return

                user = db.get(User, order.user_id)
                if user:
                    amount = round(order.sale_price, 2)
                    user.balance = round(user.balance + amount, 2)
                    order.refunded = True # 🔒 SÉCURITÉ : Marqué comme remboursé dans la même transaction

                    db.add(PaymentTransaction(
                        user_id=user.id, amount=amount, type="refund",
                        status="completed", description=f"Remboursement automatique (seq #{sequence_id})"
                    ))
                    print(f"  💰 Solde NFC recrédité : +{amount}€ (Nouveau solde de {user.name} : {user.balance}€)", flush=True)

        except Exception as e:
            print(f"  ❌ Erreur critique refund : {e}", flush=True)

    async def validate_recipe(self, recipe_id: int, db: Session):
        recipe = db.execute(
            select(Recipe)
            .options(joinedload(Recipe.recipe_ingredients).joinedload(RecipeIngredient.ingredient))
            .filter(Recipe.id == recipe_id)
        ).unique().scalar_one_or_none()
        if not recipe:
            return {"valid": False, "errors": ["Recette introuvable"]}
        for ri in recipe.recipe_ingredients:
            if not ri.ingredient or not ri.ingredient.pump_id:
                name = ri.ingredient.name if ri.ingredient else f"#{ri.ingredient_id}"
                return {"valid": False, "errors": [f"Ingredient '{name}' sans pompe"]}
        return {"valid": True, "errors": []}

    async def create_pour_sequence(self, recipe_id: int, priority: int, user_nfc: str, db: Session):
        new_seq = PourSequence(recipe_id=recipe_id, user_nfc=user_nfc, status="PENDING")
        db.add(new_seq)
        db.flush()

        recipe_ingredients = db.execute(
            select(RecipeIngredient)
            .options(joinedload(RecipeIngredient.ingredient))
            .filter(RecipeIngredient.recipe_id == recipe_id)
            .order_by(RecipeIngredient.order)
        ).unique().scalars().all()

        total_est = 0
        for idx, ri in enumerate(recipe_ingredients):
            db.add(PourStep(
                sequence_id=new_seq.id, ingredient_id=ri.ingredient_id,
                volume_ml=ri.volume_ml, order=idx
            ))
            if FluidPhysics and ri.ingredient:
                total_est += FluidPhysics.calculate_pour_duration(
                    target_volume_ml  = ri.volume_ml,
                    current_volume_ml = ri.ingredient.current_volume_ml,
                    max_volume_ml     = ri.ingredient.max_volume_ml or 1000
                )
            else:
                total_est += ri.volume_ml * 0.1

        db.commit()
        db.refresh(new_seq)
        return {
            "id":             new_seq.id,
            "cocktail_name":  db.get(Recipe, recipe_id).name,
            "estimated_time": round(total_est, 1),
        }

    async def check_recipe_stock(self, recipe_id: int, db: Session):
        recipe_ingredients = db.execute(
            select(RecipeIngredient)
            .options(joinedload(RecipeIngredient.ingredient))
            .filter(RecipeIngredient.recipe_id == recipe_id)
        ).unique().scalars().all()
        for ri in recipe_ingredients:
            if not ri.ingredient or ri.ingredient.current_volume_ml < ri.volume_ml:
                return False
        return True