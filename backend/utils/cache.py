import time

class CacheManager:
    """Gestionnaire de cache mémoire simple"""
    def __init__(self):
        self.cache = {}
        self.ttl = {}
        self.hits = 0
        self.misses = 0

    def get(self, key, default=None):
        if key in self.cache:
            if time.time() < self.ttl.get(key, 0):
                self.hits += 1
                return self.cache[key]
            else:
                # Expired
                self.invalidate(key)
        
        self.misses += 1
        return default

    def set(self, key, value, ttl_seconds=60):
        self.cache[key] = value
        self.ttl[key] = time.time() + ttl_seconds

    def invalidate(self, key):
        self.cache.pop(key, None)
        self.ttl.pop(key, None)

    def clear(self):
        self.cache.clear()
        self.ttl.clear()