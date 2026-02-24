"""
BarOS V4 - Gestionnaire d'état centralisé
Chemin : backend/services/state_manager.py

Correction v2 :
  - asyncio.Lock() créé en lazy (dans set_state) pour éviter
    "no current event loop" sur Python < 3.10 si l'instance
    est construite hors d'une coroutine.
  - current_job et start_time exposés via property pour les
    endpoints de status (évite d'accéder à _current_job directement).
  - Listeners appelés hors du lock pour éviter deadlock si un
    listener appelle set_state à son tour.
"""
from enum import Enum
from typing import Optional, Callable
import asyncio
import time


class MachineState(Enum):
    IDLE        = "idle"
    BUSY        = "busy"
    ERROR       = "error"
    MAINTENANCE = "maintenance"


class StateManager:
    """Gestionnaire d'état centralisé avec lock asyncio."""

    def __init__(self):
        self._state: MachineState      = MachineState.IDLE
        self._current_job: Optional[str] = None
        self._job_start_time: Optional[float] = None
        self._state_listeners: list[Callable] = []

        # ✅ Fix : Lock créé en lazy dans set_state (propriété) pour éviter
        # "DeprecationWarning: There is no current event loop" sur Python < 3.10
        # quand StateManager est instancié au niveau module (avant uvicorn).
        self._lock: Optional[asyncio.Lock] = None

    def _get_lock(self) -> asyncio.Lock:
        """Retourne le lock, le créant si nécessaire dans la boucle courante."""
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def set_state(
        self,
        new_state: MachineState,
        job_id: Optional[str] = None
    ) -> None:
        lock = self._get_lock()
        async with lock:
            old_state        = self._state
            self._state      = new_state
            self._current_job = job_id
            self._job_start_time = time.time() if job_id else None

        # ✅ Fix : listeners appelés HORS du lock pour éviter deadlock
        # si un listener rappelle set_state (ex : callback de fin de séquence).
        for listener in self._state_listeners:
            try:
                await listener(old_state, new_state, job_id)
            except Exception as e:
                print(f"[StateManager] Erreur listener : {e}")

    def add_state_listener(self, callback: Callable) -> None:
        """Enregistre un callback appelé à chaque changement d'état."""
        self._state_listeners.append(callback)

    def remove_state_listener(self, callback: Callable) -> None:
        """Supprime un callback."""
        self._state_listeners.remove(callback)

    # ── Propriétés publiques ─────────────────────────────────────────────────
    @property
    def state(self) -> MachineState:
        return self._state

    @property
    def is_available(self) -> bool:
        return self._state == MachineState.IDLE

    @property
    def current_job(self) -> Optional[str]:
        return self._current_job

    @property
    def job_elapsed_seconds(self) -> Optional[float]:
        """Durée écoulée depuis le début du job en cours, ou None."""
        if self._job_start_time is None:
            return None
        return round(time.time() - self._job_start_time, 1)

    def to_dict(self) -> dict:
        """Sérialisation pour les endpoints /status."""
        return {
            "state":           self._state.value,
            "is_available":    self.is_available,
            "current_job":     self._current_job,
            "elapsed_seconds": self.job_elapsed_seconds,
        }