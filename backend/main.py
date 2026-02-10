"""
BarOS V4 - API Principale (Version Finale & Optimisée)
Architecture : Cache + Logs + Routers Modulaires + Gestion Hardware
"""

import os
import time
import logging
import psutil
from typing import Dict, Any

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

# --- IMPORTS INTERNES ---
from backend.database import Base, engine, get_db
from backend import models
from backend.routers import cocktails, ingredients, machine, admin, scanner
from backend.services.machine_service import MachineService

# 👇 Import du Hardware Manager et de la variable d'état
from backend.hardware.gpio_manager import GPIOManager, GPIO_AVAILABLE

# Configuration logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Instanciation Service
machine_service = MachineService()

app = FastAPI(
    title="BarOS V4 API", 
    version="4.9.5",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# ============================================================================
# 1. MIDDLEWARES
# ============================================================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log le temps de traitement de chaque requête"""
    start_time = time.time()
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s")
        response.headers["X-Process-Time"] = str(process_time)
        return response
    except Exception as e:
        # En cas de crash brutal avant le handler
        process_time = time.time() - start_time
        logger.error(f"❌ CRASH REQUEST {request.method} {request.url.path} - {e}")
        raise e

app.add_middleware(
    CORSMiddleware,
    # ⚠️ Gardé ouvert ("*") pour la démo/soutenance afin d'éviter les problèmes réseaux
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)

# ============================================================================
# 2. FICHIERS STATIQUES & STARTUP
# ============================================================================

# Dossier des images de cocktails
static_dir = os.path.join(os.path.dirname(__file__), "../frontend/public/cocktails")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.on_event("startup")
async def startup_event():
    """Initialisation complète du système au démarrage"""
    logger.info("🚀 Démarrage de BarOS V4...")
    
    # Création dossier data si inexistant
    os.makedirs("data", exist_ok=True)
    
    # A. Création des tables SQL (Indispensable pour SQLite)
    try:
        models.Base.metadata.create_all(bind=engine)
        logger.info("✅ Base de données prête et connectée")
    except Exception as e:
        logger.error(f"❌ Erreur critique DB: {e}")

    # B. Initialisation du Hardware (Charge config.json)
    logger.info("🔌 Initialisation du Hardware...")
    GPIOManager.setup() 

    logger.info("✅ Système prêt à servir !")

# ============================================================================
# 3. GESTION DU CACHE (Simple In-Memory)
# ============================================================================

class CacheManager:
    def __init__(self):
        self.cache = {}
        self.ttl = {}
    
    def get(self, key):
        if key in self.cache and time.time() < self.ttl.get(key, 0):
            return self.cache[key]
        return None
    
    def set(self, key, value, ttl_seconds=60):
        self.cache[key] = value
        self.ttl[key] = time.time() + ttl_seconds
    
    def clear(self):
        self.cache = {}
        self.ttl = {}

cache = CacheManager()

# ============================================================================
# 4. GESTIONNAIRES D'ERREURS (Exception Handlers)
# ============================================================================

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Not Found", "message": f"Chemin introuvable: {request.url.path}"}
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Capture les crashs serveur pour renvoyer un JSON propre au lieu de rien"""
    logger.error(f"🔥 Erreur Serveur 500: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error", 
            "message": "Une erreur interne est survenue. Consultez les logs serveur."
        }
    )

# ============================================================================
# 5. ROUTES SYSTÈME & MONITORING
# ============================================================================

@app.get("/", tags=["Système"])
def root():
    return {
        "status": "online",
        "system": "BarOS V4",
        "version": "4.9.5",
        "mode": "Simulation" if not GPIO_AVAILABLE else "Production",
        "uptime": time.time() - app.state.start_time if hasattr(app.state, 'start_time') else 0
    }

@app.get("/health", tags=["Système"])
def health_check(db: Session = Depends(get_db)):
    """Vérifie la santé de la DB et du Hardware"""
    
    # 1. Vérification Base de Données
    status_db = "healthy"
    try:
        # Requête légère pour tester la connexion
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health Check DB Failed: {e}")
        status_db = "unhealthy"
    
    # 2. Vérification Hardware (Affiche si on est sur RPi ou PC)
    hw_status = "connected" if GPIO_AVAILABLE else "simulation"
    
    return {
        "api": "online",
        "database": status_db,
        "hardware_mode": hw_status,
        "timestamp": time.time()
    }

@app.post("/system/cache/clear", tags=["Système"])
def clear_cache_route():
    cache.clear()
    return {"message": "Cache vidé"}

@app.get("/system/metrics", tags=["Système"])
def get_metrics():
    return {
        "memory": {"percent": psutil.virtual_memory().percent},
        "cpu": {"percent": psutil.cpu_percent(interval=None)},
        "cache_size": len(cache.cache)
    }

# ============================================================================
# 6. INCLUSION DES ROUTERS
# ============================================================================

app.include_router(cocktails.router, prefix="/api/cocktails")
app.include_router(ingredients.router, prefix="/api/ingredients")
app.include_router(machine.router, prefix="/api/machine")
app.include_router(admin.router, prefix="/api/admin")
app.include_router(scanner.router) # Le préfixe est déjà défini dans scanner.py