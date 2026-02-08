"""
BarOS V4 - API Principale OPTIMISÉE (Version Finale)
Architecture : Cache + Logs + Routers Modulaires
"""

import os
import time
import logging
import psutil
import gc
from typing import Dict, Any

from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

# --- IMPORTS INTERNES ---
from backend.database import Base, engine, get_db
from backend import models
from backend.routers import cocktails, ingredients, machine, admin, scanner
from backend.services.machine_service import MachineService

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
# MIDDLEWARES (On garde tes super middlewares !)
# ============================================================================

@app.middleware("http")
async def log_requests(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s")
    response.headers["X-Process-Time"] = str(process_time)
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)

# ============================================================================
# FICHIERS STATIQUES & DEMARRAGE
# ============================================================================

static_dir = os.path.join(os.path.dirname(__file__), "../frontend/public/cocktails")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Démarrage de BarOS V4...")
    os.makedirs("data", exist_ok=True)
    
    # Création des tables DB
    try:
        models.Base.metadata.create_all(bind=engine)
        logger.info("✅ Base de données prête")
    except Exception as e:
        logger.error(f"❌ Erreur DB: {e}")
    
    # Pré-chargement cache (Optionnel, simplifié ici)
    logger.info("✅ Cache initialisé")

# ============================================================================
# GESTION DU CACHE (Ton système)
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
# ROUTES SYSTEME & MONITORING
# ============================================================================

@app.get("/", tags=["Système"])
def root():
    return {
        "status": "online",
        "system": "BarOS V4",
        "version": "4.9.5",
        "uptime": time.time() - app.state.start_time if hasattr(app.state, 'start_time') else 0
    }

@app.get("/health", tags=["Système"])
def health_check(db: Session = Depends(get_db)):
    status_db = "healthy"
    try:
        db.execute("SELECT 1")
    except:
        status_db = "unhealthy"
    
    return {
        "api": "healthy",
        "database": status_db,
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
# INCLUSION DES ROUTERS (C'est ici qu'on branche tout !)
# ============================================================================

app.include_router(cocktails.router, prefix="/api/cocktails")
app.include_router(ingredients.router, prefix="/api/ingredients")
app.include_router(machine.router, prefix="/api/machine")
app.include_router(admin.router, prefix="/api/admin")
app.include_router(scanner.router) # Déjà préfixé dans le fichier

# Gestionnaire d'erreur 404 propre
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Not Found", "message": f"Chemin introuvable: {request.url.path}"}
    )