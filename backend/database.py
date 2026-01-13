"""
BarOS V4 - Configuration de la base de données SQLAlchemy (VERSION FUSIONNÉE)
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# On simplifie le chemin pour éviter les erreurs de dossier "data" manquant
# La DB sera créée à la racine du projet
DATABASE_URL = "sqlite:///./baros.db"

# Création du moteur
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} # Nécessaire pour SQLite avec FastAPI
)

# Session locale
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base pour les modèles
Base = declarative_base()

# --- 1. MODÈLE UTILISATEUR (On garde ton code NFC !) ---
class User(Base):
    """Modèle utilisateur avec NFC tag"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    nfc_tag = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    credits = Column(Float, default=0.0)
    is_admin = Column(Boolean, default=False)

# --- 2. MODÈLE INGRÉDIENT (On garde tes couleurs + ma gestion de pompe) ---
class Ingredient(Base):
    """Modèle ingrédient avec pompe associée"""
    __tablename__ = "ingredients"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    # Gestion Hardware
    pump_id = Column(Integer, nullable=True)  # ID de la pompe (1-12) ou None
    
    # Gestion UI & Physique
    color_hex = Column(String, default="#FFFFFF")  # Pour l'UI
    is_alcoholic = Column(Boolean, default=False)
    current_volume_ml = Column(Float, default=1000.0)
    max_volume_ml = Column(Float, default=1000.0)
    is_available = Column(Boolean, default=True)

    # Relation inverse
    ingredient_recipes = relationship("RecipeIngredient", back_populates="ingredient")

# --- 3. MODÈLE RECETTE ---
class Recipe(Base):
    """Modèle recette de cocktail"""
    __tablename__ = "recipes"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    price = Column(Float, nullable=False)
    image_url = Column(String, nullable=True)
    category = Column(String, default="Classique")
    
    # Relation vers la table de liaison
    # Attention : j'ai renommé 'steps' en 'recipe_ingredients' pour coller au script
    recipe_ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan")

# --- 4. TABLE DE LIAISON (Le cœur du problème) ---
# J'ai renommé 'RecipeStep' en 'RecipeIngredient' pour que le script seed_cocktails.py fonctionne.
class RecipeIngredient(Base):
    """Table de liaison (Ingrédient <-> Recette)"""
    __tablename__ = "recipe_ingredients"
    
    id = Column(Integer, primary_key=True, index=True) # ID unique pour la ligne
    
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=False)
    
    volume_ml = Column(Float, nullable=False)
    order = Column(Integer, default=1) # J'ai mis une valeur par défaut pour ne pas bloquer le script !
    
    # Relations
    recipe = relationship("Recipe", back_populates="recipe_ingredients")
    ingredient = relationship("Ingredient", back_populates="ingredient_recipes")

# --- 5. UTILITAIRES ---
def get_db():
    """Générateur de session pour FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()