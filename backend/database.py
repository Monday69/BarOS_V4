"""
BarOS V4 - Configuration de la base de données SQLAlchemy
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
import os

# Chemin vers la base de données SQLite
DATABASE_URL = os.path.join("data", "baros.db")

# Création du moteur SQLAlchemy
engine = create_engine(
    f"sqlite:///{DATABASE_URL}",
    connect_args={"check_same_thread": False}  # Nécessaire pour SQLite avec FastAPI
)

# Session locale
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base pour les modèles
Base = declarative_base()


# Modèles de données
class User(Base):
    """Modèle utilisateur avec NFC tag"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    nfc_tag = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    credits = Column(Float, default=0.0)
    is_admin = Column(Boolean, default=False)


class Ingredient(Base):
    """Modèle ingrédient avec pompe associée"""
    __tablename__ = "ingredients"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    pump_id = Column(Integer, nullable=True)  # ID de la pompe GPIO (nullable)
    color_hex = Column(String, default="#FFFFFF")  # Couleur pour l'UI
    is_alcoholic = Column(Boolean, default=False)
    current_volume_ml = Column(Float, default=1000.0)  # Volume actuel en ml
    max_volume_ml = Column(Float, default=1000.0)  # Volume maximum en ml


class Recipe(Base):
    """Modèle recette de cocktail"""
    __tablename__ = "recipes"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    image_url = Column(String, nullable=True)
    
    # Relation avec RecipeStep
    steps = relationship("RecipeStep", back_populates="recipe", cascade="all, delete-orphan")


class RecipeStep(Base):
    """Modèle étape de recette (ingrédient + volume)"""
    __tablename__ = "recipe_steps"
    
    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=False)
    volume_ml = Column(Float, nullable=False)  # Volume en millilitres
    order = Column(Integer, nullable=False)  # Ordre d'exécution
    
    # Relations
    recipe = relationship("Recipe", back_populates="steps")
    ingredient = relationship("Ingredient")


# Fonction pour obtenir la session de base de données (Dependency Injection)
def get_db():
    """
    Générateur de session de base de données pour FastAPI
    Usage: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
