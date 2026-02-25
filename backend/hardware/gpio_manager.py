"""
BarOS V4 - GPIO Manager (Configurable, Async & Sécurisé)
Chemin : backend/hardware/gpio_manager.py
"""
import asyncio
import logging
import json
import os

# Configuration du logger pour avoir les mêmes logs que FastAPI
logger = logging.getLogger("uvicorn.error")

try:
    import RPi.GPIO as GPIO # type: ignore
    GPIO_AVAILABLE = True
except (ImportError, RuntimeError):
    GPIO_AVAILABLE = False

class GPIOManager:
    # On stockera le mapping ici après chargement
    PUMP_MAPPING = {} 

    @classmethod
    @classmethod
    def _load_config(cls):
        """Charge la configuration depuis backend/config.json"""
        try:
            # On part du dossier de ce fichier (backend/hardware/)
            current_dir = os.path.dirname(os.path.abspath(__file__))
            
            # On remonte d'UN SEUL niveau pour arriver dans 'backend/'
            # Puis on cherche config.json
            config_path = os.path.join(current_dir, "..", "config.json")
            config_path = os.path.normpath(config_path)
            
            logger.info(f"🔍 Tentative de lecture config : {config_path}")
            
            if not os.path.exists(config_path):
                raise FileNotFoundError(f"Fichier introuvable à : {config_path}")

            with open(config_path, 'r') as f:
                data = json.load(f)
                # On récupère "pump_mapping" (doit être un dictionnaire dans le JSON)
                mapping = data.get("pump_mapping", {})
                if not mapping:
                    logger.warning("⚠️ 'pump_mapping' est vide dans config.json")
                
                cls.PUMP_MAPPING = {int(k): v for k, v in mapping.items()}
                logger.info(f"📂 Configuration chargée avec succès : {len(cls.PUMP_MAPPING)} pompes")
                
        except Exception as e:
            logger.error(f"⚠️ Erreur chargement config.json : {e}")
            logger.warning("Utilisation du mapping de secours (Fallback GPIO 18, 23, 24, 25)")
            cls.PUMP_MAPPING = {1: 18, 2: 23, 3: 24, 4: 25}

    @classmethod
    def setup(cls):
        """Initialise les GPIOs"""
        # 1. Charger la config
        cls._load_config()

        # 2. Initialiser le hardware
        if GPIO_AVAILABLE:
            try:
                GPIO.setmode(GPIO.BCM)
                for pin in cls.PUMP_MAPPING.values():
                    GPIO.setup(pin, GPIO.OUT)
                    GPIO.output(pin, GPIO.HIGH) # Relais OFF (souvent inversé)
                logger.info(f"✅ [GPIO] Initialisé sur Raspberry Pi")
            except Exception as e:
                logger.error(f"❌ [GPIO] Erreur init: {e}")
        else:
            logger.warning(f"⚠️ [GPIO] Mode SIMULATION ({len(cls.PUMP_MAPPING)} pompes)")

    @classmethod
    def cleanup(cls):
        if GPIO_AVAILABLE:
            GPIO.cleanup()

    @classmethod
    async def pour(cls, pump_id: int, duration: float):
        """
        Active une pompe de manière asynchrone (Non-Bloquant).
        Inclut une sécurité anti-inondation.
        """
        # Sécurité 1 : Pompe inconnue
        if pump_id not in cls.PUMP_MAPPING:
            logger.error(f"[GPIO] Pompe {pump_id} non configurée")
            return

        # Sécurité 2 : Durée excessive (Anti-Inondation)
        if duration > 30.0:
            logger.warning(f"⚠️ SÉCURITÉ : Durée {duration}s plafonnée à 30s pour pompe {pump_id}")
            duration = 30.0
        
        if duration <= 0:
            return

        pin = cls.PUMP_MAPPING[pump_id]
        
        # --- DÉBUT (ON) ---
        if GPIO_AVAILABLE:
            GPIO.output(pin, GPIO.LOW) # ON
        else:
            # On utilise logger.info pour que ce soit propre dans le terminal
            logger.info(f"💦 [SIMU] Pompe {pump_id} (Pin {pin}) ON pendant {duration:.2f}s")

        # Pause non bloquante
        await asyncio.sleep(duration)

        # --- FIN (OFF) ---
        if GPIO_AVAILABLE:
            GPIO.output(pin, GPIO.HIGH) # OFF
        else:
            logger.info(f"🛑 [SIMU] Pompe {pump_id} OFF")