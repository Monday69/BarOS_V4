"""
BarOS V4 - Modèles de base de données (Update Nutrition)
Chemin : backend/models.py
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

# --- MODÈLES CŒUR ---

class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    type = Column(String)
    
    # --- DATA NUTRITIONNELLE & IDENTIFICATION (Le Yuka) ---
    barcode = Column(String, nullable=True)       # Code EAN (ex: 5449000000996)
    brand = Column(String, nullable=True)         # Marque (ex: Coca-Cola)
    image_url = Column(String, nullable=True)     # Photo bouteille réelle
    
    alcohol_degree = Column(Float, default=0.0)   # % Alcool
    density = Column(Float, default=1.0)          # Densité (g/ml)
    sugar_g_per_100ml = Column(Float, default=0.0)# Sucre (g/100ml)
    kcal_per_100ml = Column(Float, default=0.0)   # Calories (kcal/100ml)
    
    # Gestion Stock & Hardware
    current_volume_ml = Column(Float, default=0.0)
    max_volume_ml = Column(Float, default=1000.0)
    pump_id = Column(Integer, nullable=True)
    is_available = Column(Boolean, default=True)

    recipe_ingredients = relationship("RecipeIngredient", back_populates="ingredient")
    pour_steps = relationship("PourStep", back_populates="ingredient")

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    category = Column(String, default="Classique")
    image_url = Column(String, nullable=True)
    price = Column(Float, default=0.0)
    is_available = Column(Boolean, default=True)

    recipe_ingredients = relationship("RecipeIngredient", back_populates="recipe")
    pour_sequences = relationship("PourSequence", back_populates="recipe")

class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"))
    volume_ml = Column(Float)
    order = Column(Integer, default=0)

    recipe = relationship("Recipe", back_populates="recipe_ingredients")
    ingredient = relationship("Ingredient", back_populates="recipe_ingredients")

# --- HISTORIQUE & SÉCURITÉ ---

class PourSequence(Base):
    __tablename__ = "pour_sequences"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    user_nfc = Column(String, nullable=True)
    status = Column(String, default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)

    recipe = relationship("Recipe", back_populates="pour_sequences")
    steps = relationship("PourStep", back_populates="sequence", cascade="all, delete-orphan")

class PourStep(Base):
    __tablename__ = "pour_steps"

    id = Column(Integer, primary_key=True, index=True)
    sequence_id = Column(Integer, ForeignKey("pour_sequences.id"))
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"))
    volume_ml = Column(Float)
    order = Column(Integer)
    status = Column(String, default="PENDING")
    real_duration = Column(Float, default=0.0)

    sequence = relationship("PourSequence", back_populates="steps")
    ingredient = relationship("Ingredient", back_populates="pour_steps")

# --- SCANNER CACHE ---

class ScannedProduct(Base):
    __tablename__ = "scanned_products"

    barcode = Column(String, primary_key=True, index=True)
    name = Column(String)
    brand = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    
    # Nutrition & Infos
    alcohol_degree = Column(Float, default=0.0)
    sugar_g_per_100ml = Column(Float, default=0.0)
    kcal_per_100ml = Column(Float, default=0.0)
    
    # Cache
    last_scanned_at = Column(DateTime, default=datetime.utcnow)