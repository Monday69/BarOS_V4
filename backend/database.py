"""
BarOS V4 - Configuration Database
Chemin : backend/database.py

Correction v2 :
  - declarative_base() importé depuis sqlalchemy.ext.declarative
    est déprécié depuis SQLAlchemy 2.0 → génère MovedIn20Warning.
    Remplacement par l'API native 2.0 : DeclarativeBase.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# ── Configuration SQLite ──────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DB_PATH      = os.path.join(BASE_DIR, "baros.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ✅ Fix : DeclarativeBase (SQLAlchemy 2.0) remplace declarative_base()
# L'ancienne forme génère MovedIn20Warning et sera supprimée en 2.x.
# Tous les modèles héritent de Base exactement comme avant — aucun impact.
class Base(DeclarativeBase):
    pass

# ── Dépendance FastAPI ────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()