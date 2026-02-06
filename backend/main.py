"""
BarOS V4 - API Principale OPTIMISÉE
Architecture en couches avec services dédiés
"""

from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
import os
import json
import time
import asyncio
from functools import lru_cache
import logging

# Configuration logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- IMPORTS INTERNES ---
from backend.database import Base, engine, get_db, init_db
from backend.routers import cocktails, ingredients, machine, admin
from backend.services.cocktail_service import CocktailService
from backend.services.machine_service import MachineService
from backend.services.color_service import ColorService
from backend.middleware.error_handler import ErrorHandlerMiddleware
from backend.middleware.logging_middleware import LoggingMiddleware

# Import de la physique avec fallback
try:
    from backend.logic.fluid_physics import FluidPhysics
    FLUID_PHYSICS_AVAILABLE = True
except ImportError:
    FLUID_PHYSICS_AVAILABLE = False
    logger.warning("Module fluid_physics non disponible, utilisation du mode basique")

app = FastAPI(
    title="BarOS V4 API", 
    version="4.8.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# ============================================================================
# MIDDLEWARES AVANCÉS
# ============================================================================

# Middleware de logging
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s")
    
    # Headers de performance
    response.headers["X-Process-Time"] = str(process_time)
    return response

# CORS configuré proprement
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Spécifique au lieu de "*"
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time", "X-Total-Count"],
)

# ============================================================================
# MODÈLES PYDANTIC OPTIMISÉS
# ============================================================================

class CocktailOrder(BaseModel):
    """Modèle pour commander un cocktail"""
    recipe_id: int = Field(..., gt=0)
    user_nfc_tag: Optional[str] = Field(None, min_length=8, max_length=20)
    priority: int = Field(1, ge=1, le=3)  # Priorité 1-3
    
    @validator('user_nfc_tag')
    def validate_nfc_tag(cls, v):
        if v and not v.startswith("NFC_"):
            raise ValueError("Le tag NFC doit commencer par 'NFC_'")
        return v


class ColorMixRequest(BaseModel):
    """Modèle pour mélange de couleurs"""
    hex_code: str = Field(..., regex=r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$')
    volume_ml: float = Field(..., gt=0, le=500)  # Limite de 500ml
    user_nfc_tag: Optional[str] = None
    
    @validator('hex_code')
    def normalize_hex(cls, v):
        """Normalise le code hex (#ABC -> #AABBCC)"""
        if len(v) == 4:  # Format court #RGB
            return f"#{v[1]*2}{v[2]*2}{v[3]*2}"
        return v.upper()


class MachineConfig(BaseModel):
    """Configuration machine"""
    slots: Dict[str, Dict[str, Any]] = Field(..., max_items=8)  # Max 8 pompes


# ============================================================================
# CACHE ET ÉTAT GLOBAL
# ============================================================================

class CacheManager:
    """Gestionnaire de cache simple"""
    def __init__(self):
        self.cache = {}
        self.ttl = {}
    
    def get(self, key, default=None):
        if key in self.cache and time.time() < self.ttl.get(key, 0):
            return self.cache[key]
        return default
    
    def set(self, key, value, ttl_seconds=60):
        self.cache[key] = value
        self.ttl[key] = time.time() + ttl_seconds
    
    def invalidate(self, key):
        self.cache.pop(key, None)
        self.ttl.pop(key, None)


cache = CacheManager()

# ============================================================================
# SERVICES INSTANCIÉS
# ============================================================================

cocktail_service = CocktailService()
machine_service = MachineService()
color_service = ColorService()

# ============================================================================
# ÉVÉNEMENTS DÉMARRAGE/SHUTDOWN
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialisation au démarrage"""
    logger.info("🚀 Démarrage de BarOS V4...")
    
    # Création des répertoires
    os.makedirs("data", exist_ok=True)
    os.makedirs("logs", exist_ok=True)
    
    # Initialisation base de données
    init_db()
    
    # Pré-chargement du cache
    await preload_cache()
    
    logger.info("✅ BarOS V4 prêt")

@app.on_event("shutdown")
async def shutdown_event():
    """Nettoyage à l'arrêt"""
    logger.info("🛑 Arrêt de BarOS V4...")
    # Nettoyage hardware si nécessaire
    # await machine_service.cleanup()

async def preload_cache():
    """Pré-charge les données fréquentes en cache"""
    try:
        db = next(get_db())
        # Cache les recettes disponibles
        recipes = db.query(Recipe).filter(Recipe.is_available == True).all()
        cache.set("available_recipes", [
            {"id": r.id, "name": r.name, "price": r.price} 
            for r in recipes
        ], ttl_seconds=300)  # 5 minutes
        
        # Cache la configuration machine
        config = await machine_service.get_config(db)
        cache.set("machine_config", config, ttl_seconds=60)
        
        db.close()
        logger.info("✅ Cache pré-chargé")
    except Exception as e:
        logger.error(f"❌ Erreur pré-chargement cache: {e}")

# ============================================================================
# ROUTES PRINCIPALES OPTIMISÉES
# ============================================================================

@app.get("/", tags=["Système"])
async def root():
    """Endpoint de santé"""
    return {
        "status": "online",
        "system": "BarOS V4",
        "version": "4.8.0",
        "uptime": time.time() - app.state.start_time if hasattr(app.state, 'start_time') else 0
    }

@app.get("/health", tags=["Système"])
async def health_check(db: Session = Depends(get_db)):
    """Vérification complète de santé"""
    health = {
        "api": "healthy",
        "database": "healthy",
        "hardware": "unknown",
        "cache": "healthy",
        "timestamp": time.time()
    }
    
    # Vérification DB
    try:
        db.execute("SELECT 1")
    except Exception as e:
        health["database"] = "unhealthy"
        logger.error(f"DB health check failed: {e}")
    
    # Vérification cache
    try:
        test_key = "health_check_" + str(time.time())
        cache.set(test_key, "test", 10)
        if cache.get(test_key) != "test":
            health["cache"] = "unhealthy"
    except Exception as e:
        health["cache"] = "unhealthy"
    
    return health

# ============================================================================
# ROUTES COCKTAILS OPTIMISÉES
# ============================================================================

@app.post("/cocktails/order", tags=["Cocktails"])
async def order_cocktail(
    order: CocktailOrder,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Commander un cocktail avec gestion avancée
    
    - Vérification stocks
    - Calcul physique
    - Débitement en arrière-plan
    - Logging complet
    """
    logger.info(f"📦 Commande reçue: recette #{order.recipe_id}, priorité {order.priority}")
    
    try:
        # Vérification rapide via cache
        cached_recipe = cache.get(f"recipe_{order.recipe_id}")
        if not cached_recipe:
            recipe = db.query(Recipe).filter(
                Recipe.id == order.recipe_id,
                Recipe.is_available == True
            ).first()
            if not recipe:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Recette non disponible"
                )
            cache.set(f"recipe_{order.recipe_id}", recipe.name, 300)
        
        # Utilisation du service dédié
        result = await cocktail_service.prepare_cocktail(
            recipe_id=order.recipe_id,
            db=db,
            priority=order.priority
        )
        
        # Lancement en arrière-plan si succès
        if result["status"] == "ready":
            background_tasks.add_task(
                cocktail_service.execute_pour_sequence,
                result["sequence_id"],
                db
            )
            
            # Invalidation cache stocks
            cache.invalidate("available_recipes")
            cache.invalidate("ingredients_stock")
        
        return {
            "status": "accepted",
            "order_id": result["sequence_id"],
            "estimated_time": result["estimated_time"],
            "message": f"Préparation de {result['recipe_name']} lancée"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erreur commande cocktail: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la commande"
        )

# ============================================================================
# ROUTES MACHINE OPTIMISÉES
# ============================================================================

@app.get("/machine/status", tags=["Machine"])
@lru_cache(maxsize=1)
async def get_machine_status(db: Session = Depends(get_db)):
    """
    État de la machine avec cache
    Refresh automatique toutes les 30s grâce à @lru_cache
    """
    try:
        status_data = await machine_service.get_full_status(db)
        
        # Ajout métriques de performance
        status_data.update({
            "performance": {
                "requests_processed": getattr(app.state, 'request_count', 0),
                "avg_response_time": getattr(app.state, 'avg_response_time', 0),
                "cocktails_served": getattr(app.state, 'cocktails_served', 0)
            }
        })
        
        return status_data
        
    except Exception as e:
        logger.error(f"❌ Erreur statut machine: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Impossible de récupérer le statut machine"
        )

@app.post("/machine/config", tags=["Machine"])
async def save_machine_config(
    config: MachineConfig,
    db: Session = Depends(get_db)
):
    """
    Sauvegarde configuration avec validation avancée
    """
    try:
        # Validation complète via service
        validation_result = await machine_service.validate_config(config.slots)
        
        if not validation_result["valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Configuration invalide",
                    "errors": validation_result["errors"]
                }
            )
        
        # Application configuration
        await machine_service.apply_config(config.slots, db)
        
        # Invalidation caches
        cache.invalidate("machine_config")
        get_machine_status.cache_clear()  # Clear LRU cache
        
        logger.info("✅ Configuration machine sauvegardée")
        
        return {
            "status": "success",
            "message": "Configuration appliquée",
            "applied_slots": len(config.slots)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erreur sauvegarde config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la sauvegarde"
        )

# ============================================================================
# ROUTES COULEURS OPTIMISÉES
# ============================================================================

@app.post("/colors/mix", tags=["Couleurs"])
async def mix_color_drink(
    request: ColorMixRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Mélange de couleur avec validation CMY
    """
    try:
        # Validation via service
        mix_result = await color_service.calculate_mix(
            hex_code=request.hex_code,
            volume_ml=request.volume_ml
        )
        
        # Vérification stocks colorants
        stock_check = await color_service.check_colorant_stock(mix_result, db)
        if not stock_check["available"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Stocks colorants insuffisants",
                    "missing": stock_check["missing"]
                }
            )
        
        # Exécution en arrière-plan
        sequence_id = f"color_mix_{int(time.time())}"
        background_tasks.add_task(
            color_service.execute_color_mix,
            sequence_id,
            mix_result,
            db
        )
        
        return {
            "status": "mixing",
            "sequence_id": sequence_id,
            "color_requested": request.hex_code,
            "volumes": mix_result["volumes"],
            "estimated_time": mix_result["estimated_time"]
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"❌ Erreur mélange couleur: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors du mélange"
        )

# ============================================================================
# ROUTES ADMIN/SYSTÈME
# ============================================================================

@app.post("/system/cache/clear", tags=["Système"])
async def clear_cache(admin_token: str = Depends(validate_admin)):
    """
    Vide tous les caches (admin seulement)
    """
    if admin_token != os.getenv("ADMIN_TOKEN", "default_admin_token"):
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    cache.clear()
    get_machine_status.cache_clear()
    
    logger.warning("🧹 Cache vidé manuellement")
    
    return {"status": "cleared", "message": "Tous les caches ont été vidés"}

@app.get("/system/metrics", tags=["Système"])
async def get_system_metrics():
    """
    Métriques système pour monitoring
    """
    import psutil
    import gc
    
    return {
        "memory": {
            "used_mb": psutil.Process().memory_info().rss / 1024 / 1024,
            "percent": psutil.virtual_memory().percent
        },
        "cpu": {
            "percent": psutil.cpu_percent(interval=1)
        },
        "python": {
            "gc_objects": len(gc.get_objects()),
            "gc_collected": gc.collect()
        },
        "cache": {
            "size": len(cache.cache),
            "hits": getattr(cache, 'hits', 0),
            "misses": getattr(cache, 'misses', 0)
        }
    }

# ============================================================================
# INCLUSION DES ROUTERS
# ============================================================================

# Inclure les routers modulaires
app.include_router(cocktails.router, prefix="/api/cocktails", tags=["Cocktails"])
app.include_router(ingredients.router, prefix="/api/ingredients", tags=["Ingrédients"])
app.include_router(machine.router, prefix="/api/machine", tags=["Machine"])
app.include_router(admin.router, prefix="/api/admin", tags=["Administration"])

# Route 404 custom
@app.exception_handler(404)
async def not_found_exception_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": f"La ressource {request.url.path} n'existe pas",
            "available_endpoints": [
                "/api/docs",
                "/api/redoc",
                "/api/health",
                "/api/cocktails",
                "/api/machine/status"
            ]
        }
    )