"""
BarOS V4 - Gestionnaire GPIO pour le contrôle des pompes
Gère les interactions avec les GPIO du Raspberry Pi ou simule en mode mock
"""

import asyncio

# Tentative d'import de RPi.GPIO
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    print("[GPIO] RPi.GPIO non disponible, utilisation du mode mock")


class MockGPIO:
    """
    Classe mock pour simuler RPi.GPIO lors du développement sur Windows/Mac
    """
    BCM = "BCM"
    BOARD = "BOARD"
    OUT = "OUT"
    IN = "IN"
    HIGH = 1
    LOW = 0
    
    @staticmethod
    def setmode(mode):
        print(f"[MockGPIO] setmode({mode})")
    
    @staticmethod
    def setup(pin, mode):
        print(f"[MockGPIO] setup(pin={pin}, mode={mode})")
    
    @staticmethod
    def output(pin, state):
        state_str = "HIGH" if state == 1 else "LOW"
        print(f"[MockGPIO] output(pin={pin}, state={state_str})")
    
    @staticmethod
    def cleanup():
        print("[MockGPIO] cleanup()")


class GPIOManager:
    """
    Gestionnaire GPIO pour contrôler les pompes de distribution
    """
    
    # Mapping des pump_id vers les numéros de GPIO (à adapter selon votre configuration)
    # Exemple : pump_id 1 -> GPIO 18, pump_id 2 -> GPIO 23, etc.
    PUMP_GPIO_MAPPING = {
        1: 18,
        2: 23,
        3: 24,
        4: 25,
        5: 12,
        6: 16,
        7: 20,
        8: 21,
    }
    
    def __init__(self):
        """
        Initialise le gestionnaire GPIO
        """
        if GPIO_AVAILABLE:
            self.gpio = GPIO
            self.gpio.setmode(GPIO.BCM)
            print("[GPIOManager] Mode GPIO réel activé")
        else:
            self.gpio = MockGPIO()
            self.gpio.setmode(MockGPIO.BCM)
            print("[GPIOManager] Mode GPIO mock activé")
        
        # Configuration initiale des pins
        self._setup_pumps()
    
    def _setup_pumps(self):
        """
        Configure tous les pins des pompes en mode OUTPUT
        """
        for pump_id, gpio_pin in self.PUMP_GPIO_MAPPING.items():
            self.gpio.setup(gpio_pin, self.gpio.OUT)
            self.gpio.output(gpio_pin, self.gpio.LOW)
            print(f"[GPIOManager] Pompe {pump_id} configurée sur GPIO {gpio_pin}")
    
    async def pour_ingredient(self, pump_id: int, duration: float):
        """
        Active une pompe pendant une durée donnée
        
        Args:
            pump_id: ID de la pompe (1-8)
            duration: Durée en secondes pendant laquelle la pompe doit fonctionner
        """
        if pump_id not in self.PUMP_GPIO_MAPPING:
            raise ValueError(f"Pump ID {pump_id} non configuré. Pumps disponibles: {list(self.PUMP_GPIO_MAPPING.keys())}")
        
        gpio_pin = self.PUMP_GPIO_MAPPING[pump_id]
        
        print(f"[GPIOManager] Démarrage pompe {pump_id} (GPIO {gpio_pin}) pour {duration}s")
        
        # Mettre le pin à HIGH
        self.gpio.output(gpio_pin, self.gpio.HIGH)
        
        try:
            # Attendre la durée spécifiée
            await asyncio.sleep(duration)
        finally:
            # Remettre le pin à LOW
            self.gpio.output(gpio_pin, self.gpio.LOW)
            print(f"[GPIOManager] Arrêt pompe {pump_id} (GPIO {gpio_pin})")
    
    def cleanup(self):
        """
        Nettoie les ressources GPIO
        """
        self.gpio.cleanup()
        print("[GPIOManager] GPIO cleanup effectué")


# Instance globale du gestionnaire GPIO
gpio_manager = GPIOManager()
