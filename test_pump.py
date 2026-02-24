import asyncio, sys
sys.path.insert(0, '.')
from backend.hardware.gpio_manager import GPIOManager

async def test():
    GPIOManager.setup()
    pump_id = int(input("Numéro de pompe à tester (1-12) : "))
    print(f"Activation pompe {pump_id} pendant 2s...")
    await GPIOManager.pour(pump_id, 2.0)
    print("Done")

asyncio.run(test())
