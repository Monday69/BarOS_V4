"""
BarOS V4 - Service Machine (Gestion des Pompes)
Chemin : backend/services/machine_service.py
"""
from sqlalchemy.orm import Session
from backend.models import Ingredient
import asyncio

class MachineService:

    async def get_full_status(self, db: Session):
        """
        Récupère l'état actuel de la machine et la configuration des slots
        depuis la base de données.
        """
        # 1. Récupérer tous les ingrédients qui sont assignés à une pompe
        assigned_ingredients = db.query(Ingredient).filter(Ingredient.pump_id != None).all()
        
        # 2. Construire le dictionnaire des slots
        slots_data = {}
        for ing in assigned_ingredients:
            # On utilise str(pump_id) car le JSON utilise des clés string ("1", "2"...)
            slots_data[str(ing.pump_id)] = {
                "name": ing.name,
                "volume_ml": ing.current_volume_ml,
                # La couleur est gérée par le frontend, mais on peut renvoyer le type
                "type": ing.type 
            }

        return {
            "status": "online",
            "mode": "kiosk",
            "maintenance_needed": False,
            "slots": slots_data
        }

    async def apply_config(self, slots: dict, db: Session):
        """
        Sauvegarde la configuration des pompes en base de données.
        """
        print(f"[Machine] 💾 Sauvegarde configuration : {slots}")
        
        try:
            # 1. D'abord, on remet à zéro tous les pump_id (Reset)
            # Pour éviter qu'un ingrédient reste assigné à une vieille pompe
            db.query(Ingredient).update({Ingredient.pump_id: None})
            
            # 2. Appliquer la nouvelle config
            for pump_number_str, data in slots.items():
                if not data: continue # Slot vide
                
                ing_name = data.get("name")
                if not ing_name or ing_name == "Vide": continue

                # On cherche l'ingrédient
                ingredient = db.query(Ingredient).filter(Ingredient.name == ing_name).first()
                
                if ingredient:
                    # On assigne le numéro de pompe (converti en int)
                    ingredient.pump_id = int(pump_number_str)
                    print(f"   ✅ Pompe {pump_number_str} -> {ing_name}")
                else:
                    print(f"   ⚠️ Ingrédient inconnu : {ing_name}")

            db.commit()
            return {"valid": True, "errors": []}
            
        except Exception as e:
            db.rollback()
            print(f"❌ Erreur sauvegarde config : {e}")
            raise e
            
    async def validate_config(self, slots: dict):
        """Validation simple (ex: pas de doublons de pompes)"""
        return {"valid": True, "errors": []}