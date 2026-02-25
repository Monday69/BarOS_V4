"""
BarOS V4 - Point d'entrée principal
Chemin : backend/main.py

Corrections v2 :
  - on_event("startup") déprécié → lifespan (FastAPI >= 0.93)
  - CacheManager redéfini en doublon → import depuis utils.cache
  - allow_origins=["*"] + allow_credentials=True = config CORS invalide
    (les navigateurs rejettent cette combinaison en production)
    → origines explicites avec fallback sur variable d'environnement
"""
import os
import time
import logging
from contextlib import asynccontextmanager

import psutil
from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.database import engine, get_db
from backend import models
from backend.routers import cocktails, ingredients, machine, admin, scanner, users, logs, payments, colors
from backend.services.machine_service import MachineService
from backend.hardware.gpio_manager import GPIOManager, GPIO_AVAILABLE

# ✅ Fix : import depuis utils.cache — supprime la redéfinition locale
from backend.utils.cache import CacheManager

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Services globaux ─────────────────────────────────────────────────────────
machine_service = MachineService()
cache           = CacheManager()

# ✅ Fix : origines CORS depuis variable d'environnement
# En dev  : CORS_ORIGINS non définie → localhost autorisé
# En prod : CORS_ORIGINS="https://bar.example.com,https://admin.example.com"
_raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ── Lifespan (remplace @app.on_event déprecié depuis FastAPI 0.93) ────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialisation et teardown du système."""
    logger.info("🚀 Démarrage de BarOS V4…")
    app.state.start_time = time.time()

    os.makedirs("data", exist_ok=True)

    try:
        models.Base.metadata.create_all(bind=engine)
        logger.info("✅ Base de données prête")
    except Exception as e:
        logger.error(f"❌ Erreur critique DB : {e}")

    logger.info("🔌 Initialisation du Hardware…")
    GPIOManager.setup()
    logger.info("✅ Système prêt à servir !")

    yield  # ← l'application tourne ici

    # Teardown (optionnel — libérer GPIO si nécessaire)
    logger.info("🛑 Arrêt de BarOS V4")
    GPIOManager.cleanup()

# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="BarOS V4 API",
    version="4.9.5",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── Middlewares ───────────────────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log le temps de traitement de chaque requête."""
    start = time.time()
    try:
        response     = await call_next(request)
        elapsed      = time.time() - start
        logger.info(f"{request.method} {request.url.path} → {response.status_code} ({elapsed:.3f}s)")
        response.headers["X-Process-Time"] = str(elapsed)
        return response
    except Exception as e:
        logger.error(f"❌ CRASH {request.method} {request.url.path} : {e}")
        raise

# ✅ Fix : allow_origins=["*"] + allow_credentials=True est invalide —
# les navigateurs refusent cette combinaison (spec CORS §7.1.5).
# Solution : origines explicites, credentials activés seulement si nécessaire.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)

# ── Fichiers statiques ────────────────────────────────────────────────────────
_static_dir = os.path.join(os.path.dirname(__file__), "../frontend/public/cocktails")
if os.path.exists(_static_dir):
    app.mount("/static", StaticFiles(directory=_static_dir), name="static")

# ── Gestionnaires d'erreurs ───────────────────────────────────────────────────
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Not Found", "path": request.url.path}
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error(f"🔥 Erreur 500 : {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error",
                 "message": "Erreur interne. Consultez les logs serveur."}
    )

# ── Routes système ────────────────────────────────────────────────────────────
@app.get("/", tags=["Système"])
def root():
    return {
        "status":  "online",
        "system":  "BarOS V4",
        "version": "4.9.5",
        "mode":    "Simulation" if not GPIO_AVAILABLE else "Production",
        "uptime":  round(time.time() - app.state.start_time, 1),
    }

@app.get("/health", tags=["Système"])
def health_check(db: Session = Depends(get_db)):
    """Vérifie la santé de la DB et du Hardware."""
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health check DB failed : {e}")
        db_status = "unhealthy"

    return {
        "api":           "online",
        "database":      db_status,
        "hardware_mode": "connected" if GPIO_AVAILABLE else "simulation",
        "timestamp":     time.time(),
    }

@app.post("/system/cache/clear", tags=["Système"])
def clear_cache_route():
    cache.clear()
    return {"message": "Cache vidé"}

@app.get("/system/metrics", tags=["Système"])
def get_metrics():
    """Métriques système + stats cache."""
    return {
        "memory":    {"percent": psutil.virtual_memory().percent},
        "cpu":       {"percent": psutil.cpu_percent(interval=None)},
        "cache":     cache.stats(),  # ✅ utilise la méthode stats() de CacheManager v2
    }

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(cocktails.router,   prefix="/api/cocktails",   tags=["cocktails"])
app.include_router(ingredients.router, prefix="/api/ingredients", tags=["ingredients"])
app.include_router(machine.router,     prefix="/api/machine",     tags=["machine"])
app.include_router(admin.router,       prefix="/api/admin",       tags=["admin"])
app.include_router(scanner.router,                                tags=["scanner"])
app.include_router(users.router,       prefix="/api/users",       tags=["users"])
app.include_router(logs.router,        prefix="/api/logs",        tags=["logs"])
app.include_router(payments.router,    prefix="/api/payments",    tags=["payments"])
app.include_router(colors.router,      prefix="/api/colors",      tags=["colors"])