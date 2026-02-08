"""
BarOS V4 - GPIO Manager (Mode Simulation/Mock)
Chemin : backend/hardware/gpio_manager.py
Gère les pompes. Si pas de Raspberry Pi détecté, simule les actions.
"""
import time
import asyncio
import logging

logger = logging.getLogger(__name__)

# Tente d'importer RPi.GPIO, sinon passe en mode MOCK
try:
    import RPi.GPIO as GPIO # type: ignore
    GPIO_AVAILABLE = True
except (ImportError, RuntimeError):
    GPIO_AVAILABLE = False

# Mapping des Pins (BCM) -> Numéro Pompe
# J'ai ajouté 9, 10, 11, 12 avec des pins BCM standards (26, 19, 13, 6)
PUMP_MAPPING = {
    1: 18, 2: 23, 3: 24, 4: 25,
    5: 12, 6: 16, 7: 20, 8: 21,
    9: 26, 10: 19, 11: 13, 12: 6
}

class GPIOManager:
    
    @staticmethod
    def setup():
        """Initialise les GPIOs"""
        if GPIO_AVAILABLE:
            try:
                GPIO.setmode(GPIO.BCM)
                for pin in PUMP_MAPPING.values():
                    GPIO.setup(pin, GPIO.OUT)
                    GPIO.output(pin, GPIO.HIGH) # Relais souvent inversés (HIGH = OFF)
                logger.info(f"✅ [GPIO] Initialisé sur Raspberry Pi ({len(PUMP_MAPPING)} pompes)")
            except Exception as e:
                logger.error(f"❌ [GPIO] Erreur init: {e}")
        else:
            logger.warning(f"⚠️ [GPIO] Mode SIMULATION ({len(PUMP_MAPPING)} pompes configurées)")

    @staticmethod
    def cleanup():
        if GPIO_AVAILABLE:
            GPIO.cleanup()

    @staticmethod
    async def pour(pump_id: int, duration: float):
        """
        Active une pompe pendant une durée précise.
        Fonction Asynchrone (ne bloque pas le serveur).
        """
        if pump_id not in PUMP_MAPPING:
            logger.error(f"[GPIO] Pompe {pump_id} inconnue (Vérifiez PUMP_MAPPING)")
            return

        pin = PUMP_MAPPING[pump_id]
        
        # --- DÉBUT DU VERSEMENT ---
        if GPIO_AVAILABLE:
            GPIO.output(pin, GPIO.LOW) # LOW = ON (Souvent)
        else:
            print(f"💦 [SIMULATION] Pompe {pump_id} (Pin {pin}) DÉMARRÉE pour {duration:.2f}s")

        # Attente non bloquante
        await asyncio.sleep(duration)

        # --- FIN DU VERSEMENT ---
        if GPIO_AVAILABLE:
            GPIO.output(pin, GPIO.HIGH) # HIGH = OFF
        else:
            print(f"🛑 [SIMULATION] Pompe {pump_id} ARRÊTÉE.")