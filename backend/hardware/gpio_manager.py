"""
BarOS V4 - Gestionnaire GPIO pour le contrôle des pompes (VERSION 12 POMPES)
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
    """Simulation RPi.GPIO pour Windows/Mac"""
    BCM = "BCM"
    OUT = "OUT"
    HIGH = 1
    LOW = 0
    
    @staticmethod
    def setmode(mode): pass
    
    @staticmethod
    def setup(pin, mode): pass
    
    @staticmethod
    def output(pin, state):
        state_str = "HIGH (OFF)" if state == 1 else "LOW (ON)"
        print(f"[MockGPIO] PIN {pin} -> {state_str}")
    
    @staticmethod
    def cleanup():
        print("[MockGPIO] cleanup()")


class GPIOManager:
    """
    Gestionnaire GPIO pour contrôler les 12 pompes
    """
    
    # --- CONFIGURATION DES 12 POMPES ---
    # Clé = ID Pompe | Valeur = PIN GPIO (BCM)
    PUMP_GPIO_MAPPING = {
        1: 18,
        2: 23,
        3: 24,
        4: 25,
        5: 12,
        6: 16,
        7: 20,
        8: 21,
        # Les nouvelles pompes :
        9: 26,
        10: 19,
        11: 13,
        12: 6
    }
    
    def __init__(self):
        if GPIO_AVAILABLE:
            self.gpio = GPIO
            self.gpio.setmode(GPIO.BCM)
            # Désactive les warnings si les pins sont déjà occupés
            self.gpio.setwarnings(False) 
        else:
            self.gpio = MockGPIO()
            self.gpio.setmode(MockGPIO.BCM)
        
        self._setup_pumps()
    
    def _setup_pumps(self):
        """Configure les pins en mode OUTPUT et les met à l'arrêt"""
        for pump_id, gpio_pin in self.PUMP_GPIO_MAPPING.items():
            self.gpio.setup(gpio_pin, self.gpio.OUT)
            # IMPORTANT : La plupart des relais sont "Active LOW".
            # Cela veut dire : HIGH = ÉTEINT, LOW = ALLUMÉ.
            # On initialise à HIGH pour être sûr que tout est éteint au démarrage.
            self.gpio.output(gpio_pin, self.gpio.HIGH)
            
        print(f"[GPIOManager] 12 Pompes configurées sur les GPIOs : {list(self.PUMP_GPIO_MAPPING.values())}")
    
    async def pour_ingredient(self, pump_id: int, duration: float):
        """
        Active une pompe de manière asynchrone (ne bloque pas le serveur)
        """
        if pump_id not in self.PUMP_GPIO_MAPPING:
            # Si on demande une pompe qui n'existe pas, on log l'erreur mais on ne crash pas
            print(f"[GPIOManager] ERREUR CRITIQUE : Pompe {pump_id} non connectée physiquement !")
            return

        gpio_pin = self.PUMP_GPIO_MAPPING[pump_id]
        print(f"[GPIOManager] Démarrage pompe {pump_id} (GPIO {gpio_pin}) pour {duration:.2f}s")
        
        # ALLUMAGE (LOW pour relais standard)
        self.gpio.output(gpio_pin, self.gpio.LOW)
        
        try:
            # On attend sans bloquer le reste du site
            await asyncio.sleep(duration)
        finally:
            # EXTINCTION (HIGH pour relais standard)
            self.gpio.output(gpio_pin, self.gpio.HIGH)
            print(f"[GPIOManager] Arrêt pompe {pump_id}")
    
    def cleanup(self):
        """Nettoyage propre à la fin"""
        self.gpio.cleanup()
        print("[GPIOManager] GPIO cleanup effectué")


# Instance globale
gpio_manager = GPIOManager()