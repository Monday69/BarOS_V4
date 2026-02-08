"""
BarOS V4 - Service Cocktail (Logique Indestructible & Corrigée)
Chemin : backend/services/cocktail_service.py
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
import time
from datetime import datetime
import asyncio

# Imports locaux
from backend.models import Ingredient, Recipe, RecipeIngredient, PourSequence, PourStep

# Imports conditionnels pour éviter les crashs si fichiers manquants
try:
    from backend.logic.fluid_physics import FluidPhysics
except ImportError:
    FluidPhysics = None

try:
    from backend.hardware.gpio_manager import GPIOManager
except ImportError:
    GPIOManager = None

class CocktailService:

    def execute_sequence_sync(self, sequence_id: int, db: Session):
        """
        CŒUR DU SYSTÈME : Exécute la séquence avec réservation de stock optimiste.
        Ne bloque PAS la base de données pendant le versement physique.
        """
        print(f"\n{'='*60}")
        print(f"[Service] 🚀 DÉMARRAGE SÉQUENCE {sequence_id}")
        
        # --- PHASE 1 : VÉRIFICATION & RÉSERVATION (Transaction rapide) ---
        print("[Phase 1] 🔐 Réservation du stock...")
        hardware_steps = []
        
        try:
            with db.begin():
                # Chargement de la séquence et des ingrédients
                stmt = (
                    select(PourSequence)
                    .options(joinedload(PourSequence.steps).joinedload(PourStep.ingredient))
                    .filter(PourSequence.id == sequence_id)
                )
                sequence = db.execute(stmt).unique().scalar_one()

                # Vérification de tous les ingrédients AVANT de commencer quoi que ce soit
                for step in sequence.steps:
                    ing = step.ingredient
                    
                    # 1. Vérification Pompe (CRITIQUE : déplacé ici)
                    if not ing.pump_id:
                        print(f"  ❌ Erreur config: Aucune pompe pour {ing.name}")
                        sequence.status = "FAILED_CONFIG"
                        raise ValueError(f"Configuration manquante: {ing.name} n'a pas de pompe.")

                    # 2. Vérification Stock
                    if ing.current_volume_ml < step.volume_ml:
                        print(f"  ❌ Stock insuffisant: {ing.name}")
                        sequence.status = "FAILED_STOCK"
                        raise ValueError(f"Stock insuffisant: {ing.name}")
                    
                    # 3. RÉSERVATION : On déduit tout de suite
                    ing.current_volume_ml -= step.volume_ml
                    print(f"  ✅ {ing.name}: Stock réservé (-{step.volume_ml}ml)")

                    # Préparation des données pour la phase hardware (objets dict simples)
                    hardware_steps.append({
                        "step_id": step.id,
                        "ing_name": ing.name,
                        "pump_id": ing.pump_id,
                        "volume": step.volume_ml,
                        # Pour Torricelli : on calcule le volume qu'il y avait AVANT la déduction
                        "current_vol_sim": ing.current_volume_ml + step.volume_ml, 
                        "max_vol": ing.max_volume_ml
                    })

                sequence.status = "IN_PROGRESS"
                sequence.start_time = datetime.utcnow()
        
        except Exception as e:
            print(f"[Phase 1] ❌ Échec réservation : {e}")
            # Pas besoin de refund ici car la transaction db.begin() fait un rollback automatique
            return 

        print("[Phase 1] ✅ Stock réservé & DB libérée.")

        # --- PHASE 2 : EXÉCUTION PHYSIQUE (Longue durée - DB libre) ---
        print("[Phase 2] ⚙️ Démarrage Hardware...")
        
        for i, hw_step in enumerate(hardware_steps, 1):
            print(f"  > Étape {i}: {hw_step['ing_name']} (Pompe {hw_step['pump_id']} - {hw_step['volume']}ml)")
            
            try:
                # 1. Calcul Physique (Torricelli)
                duration = 0.0
                if FluidPhysics:
                    try:
                        duration = FluidPhysics.calculate_pour_duration(
                            target_volume_ml=hw_step["volume"],
                            current_volume_ml=hw_step["current_vol_sim"],
                            max_volume_ml=hw_step["max_vol"] or 1000
                        )
                    except Exception as phys_err:
                        print(f"  ⚠️ Erreur Physique (Fallback): {phys_err}")
                        duration = hw_step["volume"] * 0.1 
                else:
                    duration = hw_step["volume"] * 0.1 # Fallback 10ml/sec

                # 2. Action Hardware (Temps réel)
                try:
                    if GPIOManager and hw_step["pump_id"]:
                        # Gestion Synchrone/Asynchrone du GPIO
                        # Si ta méthode GPIO est async, on utilise le run loop, sinon appel direct
                        if asyncio.iscoroutinefunction(GPIOManager.pour):
                             asyncio.run(GPIOManager.pour(hw_step["pump_id"], duration))
                        else:
                             # Appel synchrone standard (ex: RPi.GPIO)
                             # Note: Si GPIOManager n'a pas de méthode 'pour', adapter ici
                             if hasattr(GPIOManager, 'pour'):
                                 GPIOManager.pour(hw_step["pump_id"], duration)
                             else:
                                 # Simulation si pas de méthode
                                 time.sleep(min(duration, 3.0)) 
                    else:
                        # MOCK (Pas de GPIO manager)
                        print(f"    [MOCK] Bzzzt Pompe {hw_step['pump_id']} pendant {duration:.2f}s")
                        time.sleep(1.0) # Simulation visuelle
                        
                except Exception as e:
                    print(f"  ⏱️ ERREUR Hardware : {e}")
                    self._refund_sequence(sequence_id, db)
                    return

                # 3. Validation de l'étape (Petite transaction isolée)
                with db.begin():
                    step_db = db.query(PourStep).get(hw_step["step_id"])
                    step_db.status = "COMPLETED"
                    step_db.real_duration = duration

            except Exception as e:
                print(f"  ❌ CRASH SYSTEME sur {hw_step['ing_name']}: {e}")
                self._refund_sequence(sequence_id, db) # Remboursement d'urgence
                return

        # --- PHASE 3 : FINALISATION ---
        print("[Phase 3] 🎉 Finalisation...")
        try:
            with db.begin():
                seq = db.query(PourSequence).get(sequence_id)
                seq.status = "COMPLETED"
                seq.end_time = datetime.utcnow()
                print(f"✅ Séquence {sequence_id} terminée avec succès.\n")
        except Exception as e:
            print(f"⚠️ Erreur lors de la clôture de séquence: {e}")

    def _refund_sequence(self, sequence_id: int, db: Session):
        """
        Rembourse les ingrédients si le hardware plante au milieu.
        Utilise un verrou (with_for_update) pour la sécurité.
        """
        print(f"\n[URGENCE] 💸 Début remboursement séquence {sequence_id}")
        try:
            with db.begin():
                # Charger AVEC verrou pour éviter les conflits
                seq = db.query(PourSequence).options(
                    joinedload(PourSequence.steps).joinedload(PourStep.ingredient)
                ).filter(PourSequence.id == sequence_id).with_for_update().first()
                
                if not seq:
                    print("  ⚠️ Séquence introuvable pour remboursement")
                    return
                
                seq.status = "FAILED_HARDWARE"
                refunded_total = 0
                
                for step in seq.steps:
                    # On ne rembourse que ce qui n'a pas été versé (Status != COMPLETED)
                    if step.status != "COMPLETED":
                        # Recharger l'ingrédient frais
                        fresh_ing = db.query(Ingredient).get(step.ingredient_id)
                        if fresh_ing:
                            fresh_ing.current_volume_ml += step.volume_ml
                            refunded_total += step.volume_ml
                        step.status = "FAILED"
                
                print(f"  ✅ Remboursé {refunded_total}ml au total")
                
        except Exception as e:
            print(f"💥 ERREUR CRITIQUE remboursement: {e}")
            # Log fichier d'urgence
            try:
                with open("emergency_refund.log", "a") as f:
                    f.write(f"{datetime.utcnow()}: Failed to refund sequence {sequence_id}: {e}\n")
            except:
                pass

    # --- MÉTHODES AUXILIAIRES (ASYNC pour l'API) ---

    async def validate_recipe(self, recipe_id: int, db: Session):
        recipe = db.query(Recipe).get(recipe_id)
        if not recipe: return {"valid": False, "errors": ["Recette introuvable"]}
        
        # Vérification supplémentaire : est-ce que tous les ingrédients ont une pompe ?
        for ri in recipe.recipe_ingredients:
             if not ri.ingredient.pump_id:
                 return {"valid": False, "errors": [f"Ingrédient '{ri.ingredient.name}' non assigné à une pompe"]}
                 
        return {"valid": True, "errors": []}

    async def create_pour_sequence(self, recipe_id: int, priority: int, user_nfc: str, db: Session):
        # Création Séquence
        new_seq = PourSequence(recipe_id=recipe_id, user_nfc=user_nfc, status="PENDING")
        db.add(new_seq)
        db.flush()
        
        # Création Étapes
        recipe_ingredients = db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).all()
        steps_data = []
        total_est = 0
        
        for idx, ri in enumerate(recipe_ingredients):
            step = PourStep(sequence_id=new_seq.id, ingredient_id=ri.ingredient_id, volume_ml=ri.volume_ml, order=idx)
            db.add(step)
            steps_data.append(step)
            total_est += (ri.volume_ml * 0.1) + 1 # Estimation grossière

        db.commit()
        db.refresh(new_seq)
        
        # Récupérer le nom pour l'affichage
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
        
    async def get_preparation_status(self, cocktail_id: int, db: Session):
        # Récupère la dernière séquence pour ce cocktail
        seq = db.query(PourSequence).filter(PourSequence.recipe_id == cocktail_id).order_by(PourSequence.created_at.desc()).first()
        if not seq: return {"status": "idle", "progress": 0}
        
        total = len(seq.steps)
        done = len([s for s in seq.steps if s.status == "COMPLETED"])
        progress = (done / total * 100) if total > 0 else 0
        
        return {"status": seq.status, "progress": progress, "sequence_id": seq.id}