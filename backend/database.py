"""
BarOS V4 - Configuration de la base de données SQLAlchemy OPTIMISÉE
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey, CheckConstraint, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship, validates
from sqlalchemy.exc import SQLAlchemyError
import os
import time

# --- CHEMIN ABSOLU ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "baros.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

print(f"📂 BASE DE DONNÉES UTILISÉE : {DB_PATH}")

# Création du moteur avec pool de connexions optimisé
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_size=10,  # Optimisation pour les requêtes concurrentes
    max_overflow=20,
    pool_pre_ping=True  # Vérifie les connexions avant utilisation
)

# Session avec timeout optimisé
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False  # Meilleures performances
)

Base = declarative_base()

# ============================================================================
# MODÈLES OPTIMISÉS
# ============================================================================

class User(Base):
    """Modèle utilisateur optimisé"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    nfc_tag = Column(String, unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)  # Longueur fixe pour optimisation
    credits = Column(Float, default=0.0)
    is_admin = Column(Boolean, default=False)
    created_at = Column(Float, default=lambda: time.time())  # Ajout timestamp
    
    # Index composé pour recherches fréquentes
    __table_args__ = (
        Index('idx_user_nfc_name', 'nfc_tag', 'name'),
    )
    
    @validates('credits')
    def validate_credits(self, key, value):
        """Validation des crédits"""
        if value < 0:
            raise ValueError("Les crédits ne peuvent pas être négatifs")
        return round(value, 2)  # Arrondi pour éviter les problèmes de float


class Ingredient(Base):
    """Modèle ingrédient optimisé avec contraintes"""
    __tablename__ = "ingredients"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)  # Longueur limitée
    pump_id = Column(Integer, nullable=True, unique=True)  # Unique pour éviter les conflits
    color_hex = Column(String(7), default="#FFFFFF", nullable=False)  # Format HEX fixe
    is_alcoholic = Column(Boolean, default=False)
    current_volume_ml = Column(Float, default=1000.0)
    max_volume_ml = Column(Float, default=1000.0)
    
    # Relations avec eager loading configuré
    ingredient_recipes = relationship(
        "RecipeIngredient", 
        back_populates="ingredient",
        cascade="all, delete-orphan",
        lazy="selectin"  # Meilleur que lazy="joined" pour SQLite
    )
    
    # Contraintes de validation
    __table_args__ = (
        CheckConstraint('current_volume_ml >= 0', name='check_volume_positive'),
        CheckConstraint('max_volume_ml >= 0', name='check_max_volume_positive'),
        CheckConstraint('current_volume_ml <= max_volume_ml', name='check_volume_limit'),
        CheckConstraint('color_hex LIKE "#______"', name='check_color_format'),
        Index('idx_ingredient_pump', 'pump_id', unique=True, postgresql_where='pump_id IS NOT NULL'),
    )
    
    @validates('color_hex')
    def validate_color(self, key, value):
        """Validation du format couleur HEX"""
        import re
        if not re.match(r'^#[0-9A-Fa-f]{6}$', value):
            raise ValueError("Format couleur invalide. Utilisez #RRGGBB")
        return value.upper()  # Standardisation
    
    @property
    def fill_percentage(self):
        """Pourcentage de remplissage calculé"""
        if self.max_volume_ml == 0:
            return 0
        return (self.current_volume_ml / self.max_volume_ml) * 100


class Recipe(Base):
    """Modèle recette optimisé"""
    __tablename__ = "recipes"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)  # Index pour recherches
    price = Column(Float, nullable=False)
    image_url = Column(String(500), nullable=True)  # Longueur raisonnable pour URLs
    is_available = Column(Boolean, default=True)  # Pour désactiver temporairement
    difficulty = Column(Integer, default=1)  # Niveau de difficulté (1-3)
    
    # Relation optimisée
    recipe_ingredients = relationship(
        "RecipeIngredient", 
        back_populates="recipe", 
        cascade="all, delete-orphan",
        order_by="RecipeIngredient.order",
        lazy="selectin"  # Chargement efficace
    )
    
    __table_args__ = (
        CheckConstraint('price >= 0', name='check_price_positive'),
        CheckConstraint('difficulty >= 1 AND difficulty <= 3', name='check_difficulty_range'),
        Index('idx_recipe_name_available', 'name', 'is_available'),
    )
    
    @property
    def total_volume_ml(self):
        """Volume total de la recette calculé"""
        return sum(ri.volume_ml for ri in self.recipe_ingredients)


class RecipeIngredient(Base):
    """Modèle étape de recette optimisé"""
    __tablename__ = "recipe_ingredients"
    
    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False)
    volume_ml = Column(Float, nullable=False)
    order = Column(Integer, nullable=False, default=1)
    
    # Relations avec index
    recipe = relationship("Recipe", back_populates="recipe_ingredients")
    ingredient = relationship("Ingredient", back_populates="ingredient_recipes")
    
    # Index composé pour performances
    __table_args__ = (
        Index('idx_recipe_ingredient', 'recipe_id', 'ingredient_id', unique=True),
        Index('idx_recipe_order', 'recipe_id', 'order'),
        CheckConstraint('volume_ml > 0', name='check_volume_positive'),
    )


# ============================================================================
# FONCTIONS UTILITAIRES OPTIMISÉES
# ============================================================================

def get_db():
    """
    Générateur de session de base de données avec gestion d'erreurs améliorée
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()  # Commit automatique si pas d'erreur
    except SQLAlchemyError as e:
        db.rollback()
        print(f"❌ Erreur base de données: {e}")
        raise
    finally:
        db.close()


def init_db():
    """Initialisation de la base avec données par défaut"""
    db = SessionLocal()
    try:
        # Création des tables
        Base.metadata.create_all(bind=engine)
        
        # Données par défaut si base vide
        if db.query(Ingredient).count() == 0:
            default_ingredients = [
                Ingredient(name="Rhum Blanc", color_hex="#F5DEB3", is_alcoholic=True),
                Ingredient(name="Jus de Citron", color_hex="#FFFACD", is_alcoholic=False),
                Ingredient(name="Sirop de Canne", color_hex="#D2B48C", is_alcoholic=False),
                Ingredient(name="Eau Gazeuse", color_hex="#ADD8E6", is_alcoholic=False),
                Ingredient(name="Colorant Cyan", color_hex="#00FFFF", is_alcoholic=False),
                Ingredient(name="Colorant Magenta", color_hex="#FF00FF", is_alcoholic=False),
                Ingredient(name="Colorant Jaune", color_hex="#FFFF00", is_alcoholic=False),
            ]
            db.add_all(default_ingredients)
            db.commit()
            print("✅ Ingrédients par défaut créés")
            
    except Exception as e:
        print(f"❌ Erreur initialisation DB: {e}")
    finally:
        db.close()