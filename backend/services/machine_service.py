from sqlalchemy.orm import Session
from typing import Dict, Any
from backend.models.ingredient import Ingredient

class MachineService:
    async def get_config(self, db: Session) -> Dict[str, Any]:
        """Récupère la configuration actuelle des slots"""
        ingredients = db.query(Ingredient).filter(Ingredient.pump_id != None).all()
        slots = {}
        for ing in ingredients:
            slots[str(ing.pump_id)] = {
                "name": ing.name,
                "volume": ing.current_volume_ml,
                "color": ing.color_hex,
                "available": ing.is_available
            }
        return slots

    async def get_full_status(self, db: Session) -> Dict[str, Any]:
        """État complet pour le dashboard"""
        config = await self.get_config(db)
        # Ici tu pourras ajouter la température CPU, l'état du Wifi, etc.
        return {
            "status": "online",
            "mode": "kiosk",
            "slots": config,
            "maintenance_needed": False 
        }

    async def validate_config(self, new_slots: Dict[str, Any]) -> Dict[str, Any]:
        """Vérifie qu'on n'assigne pas deux fois la même pompe"""
        pumps_used = []
        errors = []
        
        for pump_id, data in new_slots.items():
            if int(pump_id) in pumps_used:
                errors.append(f"Pompe {pump_id} assignée en double")
            pumps_used.append(int(pump_id))
            
        return {"valid": len(errors) == 0, "errors": errors}

    async def apply_config(self, new_slots: Dict[str, Any], db: Session):
        """Applique la configuration (Drag & Drop admin)"""
        # 1. Reset tout
        db.query(Ingredient).update({Ingredient.pump_id: None})
        
        # 2. Assigne les nouveaux
        for pump_id, data in new_slots.items():
            ing = db.query(Ingredient).filter(Ingredient.name == data["name"]).first()
            if ing:
                ing.pump_id = int(pump_id)
                ing.is_available = True
        
        db.commit()