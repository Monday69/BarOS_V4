# backend/services/state_manager.py
from enum import Enum
from typing import Dict, Any
import asyncio

class MachineState(Enum):
    IDLE = "idle"
    BUSY = "busy"
    ERROR = "error"
    MAINTENANCE = "maintenance"

class StateManager:
    """Gestionnaire d'état centralisé avec lock"""
    
    def __init__(self):
        self._state = MachineState.IDLE
        self._current_job = None
        self._lock = asyncio.Lock()
        self._state_listeners = []
    
    async def set_state(self, new_state: MachineState, job_id: str = None):
        async with self._lock:
            old_state = self._state
            self._state = new_state
            self._current_job = job_id
            
            # Notifier les listeners
            for listener in self._state_listeners:
                await listener(old_state, new_state, job_id)
    
    def add_state_listener(self, callback):
        self._state_listeners.append(callback)
    
    @property
    def state(self) -> MachineState:
        return self._state
    
    @property
    def is_available(self) -> bool:
        return self._state == MachineState.IDLE