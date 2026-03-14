"""
BarOS V4 - Configuration Database
Chemin : backend/database.py

Correction v2 :
  - declarative_base() importé depuis sqlalchemy.ext.declarative
    est déprécié depuis SQLAlchemy 2.0 → génère MovedIn20Warning.
    Remplacement par l'API native 2.0 : DeclarativeBase.
Correction v3 (Path) :
  - Le DB_PATH pointe maintenant de manière absolue vers la RACINE du projet,
    évitant la création de bases de données fantômes dans le dossier backend/.
Correction v4 (Docker) :
  - DATABASE_URL est lue depuis la variable d'environnement en priorité.
    En local   → non définie → fallback sur BarOS_V4/baros.db (comportement v3 inchangé).
    En Docker  → DATABASE_URL=sqlite:////data/baros.db (volume persistant /data).
    En prod PG → DATABASE_URL=postgresql://user:pass@host/db (migration future facile).
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# ── Résolution DATABASE_URL ───────────────────────────────────────────────────

# Priorité 1 : variable d'environnement (Docker, prod, CI)
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    # Priorité 2 : fallback local — même logique que v3
    # 1. __file__ = backend/database.py
    # 2. abspath  = chemin absolu vers database.py
    # 3. 1er dirname = dossier backend/
    # 4. 2ème dirname = dossier racine (BarOS_V4/)
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_PATH      = os.path.join(PROJECT_ROOT, "baros.db")
    DATABASE_URL = f"sqlite:///{DB_PATH}"

# ── Moteur SQLAlchemy ─────────────────────────────────────────────────────────

# check_same_thread=False requis pour SQLite + FastAPI (threads multiples).
# Ignoré automatiquement si DATABASE_URL pointe vers PostgreSQL.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

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