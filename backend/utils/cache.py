"""
BarOS V4 - Gestionnaire de cache mémoire
Chemin : backend/utils/cache.py

Correction v2 :
  - threading.Lock ajouté sur toutes les opérations de lecture/écriture.
    FastAPI peut exécuter des handlers synchrones dans un threadpool :
    sans lock, deux workers simultanés peuvent corrompre le dict.
  - Nettoyage des clés expirées regroupé (purge) pour éviter la croissance
    illimitée du cache sur les longues sessions.
  - Méthode stats() ajoutée pour exposer hit rate dans /status ou logs.
"""
import time
import threading
from typing import Any, Optional


class CacheManager:
    """Cache mémoire simple, thread-safe, avec TTL par clé."""

    def __init__(self):
        self._cache: dict[str, Any]   = {}
        self._ttl:   dict[str, float] = {}
        self._hits:   int = 0
        self._misses: int = 0

        # ✅ Fix : Lock partagé pour toutes les opérations
        # FastAPI exécute les handlers sync dans un threadpool (anyio),
        # donc les accès concurrents aux dicts Python ne sont pas sûrs.
        self._lock = threading.Lock()

    # ── Lecture ──────────────────────────────────────────────────────────────
    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            if key in self._cache:
                if time.time() < self._ttl.get(key, 0):
                    self._hits += 1
                    return self._cache[key]
                else:
                    # Clé expirée — nettoyage inline
                    self._cache.pop(key, None)
                    self._ttl.pop(key, None)

            self._misses += 1
            return default

    # ── Écriture ─────────────────────────────────────────────────────────────
    def set(self, key: str, value: Any, ttl_seconds: int = 60) -> None:
        with self._lock:
            self._cache[key] = value
            self._ttl[key]   = time.time() + ttl_seconds

    # ── Invalidation ─────────────────────────────────────────────────────────
    def invalidate(self, key: str) -> None:
        with self._lock:
            self._cache.pop(key, None)
            self._ttl.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> int:
        """Invalide toutes les clés commençant par `prefix`. Retourne le nombre supprimé."""
        with self._lock:
            keys = [k for k in self._cache if k.startswith(prefix)]
            for k in keys:
                self._cache.pop(k, None)
                self._ttl.pop(k, None)
            return len(keys)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
            self._ttl.clear()

    # ── Nettoyage des clés expirées ──────────────────────────────────────────
    def purge_expired(self) -> int:
        """
        Supprime toutes les clés expirées.
        À appeler périodiquement (ex: dans un background task FastAPI)
        pour éviter la croissance illimitée du cache sur longue session.
        Retourne le nombre de clés supprimées.
        """
        now = time.time()
        with self._lock:
            expired = [k for k, exp in self._ttl.items() if now >= exp]
            for k in expired:
                self._cache.pop(k, None)
                self._ttl.pop(k, None)
            return len(expired)

    # ── Stats ─────────────────────────────────────────────────────────────────
    def stats(self) -> dict:
        """Retourne les métriques du cache — utile pour /status ou logs."""
        with self._lock:
            total    = self._hits + self._misses
            hit_rate = round(self._hits / total * 100, 1) if total > 0 else 0.0
            return {
                "keys":      len(self._cache),
                "hits":      self._hits,
                "misses":    self._misses,
                "hit_rate":  hit_rate,
            }