"""
BarOS V4 - Service Mélangeur de Couleurs (CMY)
Chemin : backend/services/color_service.py
"""
from sqlalchemy.orm import Session
from sqlalchemy import select
import time
import asyncio

# On importe ta logique existante
from backend.logic.color_mixer import ColorMixer
from backend.models import Ingredient, PourSequence, PourStep

# Si tu as le hardware manager
try:
    from backend.hardware.gpio_manager import GPIOManager
except ImportError:
    GPIOManager = None

class ColorService:
    
    def _hex_to_rgb(self, hex_code: str):
        """Convertit #FF0000 en (255, 0, 0)"""
        hex_code = hex_code.lstrip('#')
        return tuple(int(hex_code[i:i+2], 16) for i in (0, 2, 4))

    async def calculate_mix(self, hex_code: str, volume_ml: float):
        """
        Utilise TA logique ColorMixer pour déterminer les volumes.
        """
        # 1. Conversion Hex -> RGB
        try:
            r, g, b = self._hex_to_rgb(hex_code)
        except ValueError:
            raise ValueError(f"Code couleur invalide: {hex_code}")

        # 2. Appel de TA logique mathématique
        volumes = ColorMixer.rgb_to_pump_volumes(r, g, b, volume_ml)
        
        # 3. Estimation du temps (basée sur un débit moyen de 10ml/s)
        # On prend le max des volumes car les pompes peuvent tourner en parallèle
        max_vol = max(volumes.values())
        estimated_time = max_vol * 0.1  # 10ml/sec environ
        
        return {
            "hex_code": hex_code,
            "rgb": (r, g, b),
            "total_volume": volume_ml,
            "volumes": volumes, # Contient cyan_ml, magenta_ml, yellow_ml
            "estimated_time": max(estimated_time, 2.0) # Min 2 secondes
        }

    async def check_colorant_stock(self, mix_result: dict, db: Session):
        """Vérifie si les ingrédients 'Cyan', 'Magenta', 'Jaune' ont assez de stock."""
        missing = []
        
        # Mapping des clés de ta fonction vers les noms en Base de Données
        # Assure-toi que tes ingrédients s'appellent bien comme ça en DB !
        mapping = {
            "cyan_ml": "Cyan",
            "magenta_ml": "Magenta",
            "yellow_ml": "Jaune" # ou "Yellow" selon ta DB
        }
        
        for key, vol in mix_result["volumes"].items():
            if vol <= 0: continue # Pas besoin de ce colorant
            
            ing_name = mapping.get(key)
            ingredient = db.query(Ingredient).filter(Ingredient.name == ing_name).first()
            
            if not ingredient:
                # Si l'ingrédient n'existe pas en base, on le signale
                missing.append(f"{ing_name} (Introuvable)")
                continue
                
            if ingredient.current_volume_ml < vol:
                missing.append(f"{ing_name} (Manque {vol - ingredient.current_volume_ml:.1f}ml)")
                
        return {
            "available": len(missing) == 0,
            "missing": missing
        }

    async def execute_color_mix(self, sequence_id: str, mix_result: dict, db: Session):
        """
        Exécute le mélange avec la méthode 'Indestructible' (Réservation -> Hardware).
        """
        print(f"[ColorService] 🎨 Démarrage mélange {sequence_id}")
        
        # Mapping noms techniques -> Noms DB
        mapping = {
            "cyan_ml": "Cyan",
            "magenta_ml": "Magenta",
            "yellow_ml": "Jaune"
        }
        
        hardware_tasks = []

        # --- PHASE 1 : RÉSERVATION STOCK ---
        try:
            with db.begin():
                for key, vol in mix_result["volumes"].items():
                    if vol <= 0: continue
                    
                    ing_name = mapping.get(key)
                    ing = db.query(Ingredient).filter(Ingredient.name == ing_name).first()
                    
                    if ing and ing.current_volume_ml >= vol:
                        ing.current_volume_ml -= vol
                        print(f"  ✅ Réservé {vol:.1f}ml de {ing_name}")
                        
                        hardware_tasks.append({
                            "name": ing_name,
                            "pump_id": ing.pump_id,
                            "volume": vol
                        })
                    else:
                        print(f"  ❌ Erreur stock critique sur {ing_name}")
                        return # Annulation
        except Exception as e:
            print(f"❌ Erreur réservation couleur: {e}")
            return

        # --- PHASE 2 : HARDWARE (Non bloquant) ---
        print("[ColorService] ⚙️ Activation pompes...")
        for task in hardware_tasks:
            duration = task["volume"] * 0.1 # Fallback débit
            
            if GPIOManager and task["pump_id"]:
                # GPIOManager.pour(task["pump_id"], duration)
                time.sleep(min(duration, 3.0)) # Simu
            else:
                print(f"  [MOCK] Pompe {task.get('pump_id')} ({task['name']}) : {duration:.1f}s")
                time.sleep(1.0)
                
        print(f"[ColorService] ✨ Mélange terminé")