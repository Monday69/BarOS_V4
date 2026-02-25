# models.py

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base

# --- 1. INGRÉDIENTS & STOCKS ---

class Ingredient(Base):
    __tablename__ = "ingredients"

    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String, unique=True, index=True)
    type              = Column(String)

    # Scanner & Nutrition
    barcode           = Column(String, nullable=True)
    brand             = Column(String, nullable=True)
    image_url         = Column(String, nullable=True)
    alcohol_degree    = Column(Float,   default=0.0)
    density           = Column(Float,   default=1.0)
    sugar_g_per_100ml = Column(Float,   default=0.0)
    kcal_per_100ml    = Column(Float,   default=0.0)

    # Prix d'achat de la bouteille — utilisé pour calculer le coût de revient
    # Stocké en €/L pour être indépendant du format de bouteille (75cl, 1L…).
    # Règle de trois dans _recipe_nutrition : cost = price_per_liter * volume_ml / 1000
    purchase_price_per_liter = Column(Float, nullable=True, default=None)

    # Hardware
    current_volume_ml = Column(Float,   default=0.0)
    max_volume_ml     = Column(Float,   default=1000.0)
    pump_id           = Column(Integer, nullable=True)
    is_available      = Column(Boolean, default=True)

    recipe_ingredients = relationship("RecipeIngredient", back_populates="ingredient")
    pour_steps         = relationship("PourStep",         back_populates="ingredient")


# --- 2. RECETTES (COCKTAILS) ---

class Recipe(Base):
    __tablename__ = "recipes"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, index=True)
    description  = Column(String,  nullable=True)
    category     = Column(String,  default="Classique")
    image_url    = Column(String,  nullable=True)
    price        = Column(Float,   default=0.0)
    is_available = Column(Boolean, default=True)

    recipe_ingredients = relationship("RecipeIngredient", back_populates="recipe",   cascade="all, delete-orphan")
    pour_sequences     = relationship("PourSequence",     back_populates="recipe")
    favorites          = relationship("UserFavorite",     back_populates="recipe")
    history            = relationship("OrderHistory",     back_populates="recipe")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id            = Column(Integer, primary_key=True, index=True)
    recipe_id     = Column(Integer, ForeignKey("recipes.id"))
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"))
    volume_ml     = Column(Float)
    order         = Column(Integer, default=0)

    recipe     = relationship("Recipe",     back_populates="recipe_ingredients")
    ingredient = relationship("Ingredient", back_populates="recipe_ingredients")


# --- 3. MACHINE & SÉQUENCES ---

class PourSequence(Base):
    __tablename__ = "pour_sequences"

    id         = Column(Integer, primary_key=True, index=True)
    recipe_id  = Column(Integer, ForeignKey("recipes.id"))
    user_nfc   = Column(String,  nullable=True)
    status     = Column(String,  default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time   = Column(DateTime(timezone=True), nullable=True)

    recipe = relationship("Recipe",      back_populates="pour_sequences")
    steps  = relationship("PourStep",    back_populates="sequence", cascade="all, delete-orphan")
    logs   = relationship("SequenceLog", back_populates="sequence", cascade="all, delete-orphan")


class PourStep(Base):
    __tablename__ = "pour_steps"

    id            = Column(Integer, primary_key=True, index=True)
    sequence_id   = Column(Integer, ForeignKey("pour_sequences.id"))
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"))
    volume_ml     = Column(Float)
    order         = Column(Integer)
    status        = Column(String, default="PENDING")
    real_duration = Column(Float, nullable=True)

    sequence   = relationship("PourSequence", back_populates="steps")
    ingredient = relationship("Ingredient",   back_populates="pour_steps")


# --- 4. LOGS STRUCTURÉS ---

class SequenceLog(Base):
    __tablename__ = "sequence_logs"

    id          = Column(Integer, primary_key=True, index=True)
    sequence_id = Column(Integer, ForeignKey("pour_sequences.id"), index=True)
    timestamp   = Column(DateTime(timezone=True), server_default=func.now())
    level       = Column(String, default="INFO")
    phase       = Column(String)
    message     = Column(Text)
    data        = Column(JSON, nullable=True)

    sequence = relationship("PourSequence", back_populates="logs")


# --- 5. SCANNER CACHE ---

class ScannedProduct(Base):
    __tablename__ = "scanned_products"

    barcode           = Column(String, primary_key=True, index=True)
    name              = Column(String)
    brand             = Column(String, nullable=True)
    image_url         = Column(String, nullable=True)
    alcohol_degree    = Column(Float,  default=0.0)
    sugar_g_per_100ml = Column(Float,  default=0.0)
    kcal_per_100ml    = Column(Float,  default=0.0)
    last_scanned_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# --- 6. UTILISATEURS & PROFIL ---

class User(Base):
    __tablename__ = "users"

    id          = Column(Integer, primary_key=True, index=True)
    card_uid    = Column(String,  unique=True, index=True)
    name        = Column(String)
    gender      = Column(String,  nullable=True)
    weight_kg   = Column(Float,   nullable=True)
    age         = Column(Integer, nullable=True)
    preferences = Column(JSON,    default={})
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    is_admin    = Column(Boolean, default=False, nullable=False)
    balance     = Column(Float,   default=0.0,   nullable=False)  # solde en €

    history      = relationship("OrderHistory",      back_populates="user")
    favorites    = relationship("UserFavorite",      back_populates="user")
    transactions = relationship("PaymentTransaction", back_populates="user")


class OrderHistory(Base):
    __tablename__ = "order_history"

    id        = Column(Integer, primary_key=True, index=True)
    user_id   = Column(Integer, ForeignKey("users.id"))
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    rating    = Column(Integer, nullable=True)
    comment   = Column(Text,    nullable=True)

    # Snapshot du coût de revient au moment de la commande.
    # Stocké ici pour que l'historique reste cohérent même si le prix
    # de la bouteille change plus tard (ex: promo, nouvelle marque).
    cost_price = Column(Float, nullable=True, default=None)
    sale_price = Column(Float, nullable=True, default=None)  # prix débité au moment de la commande

    user   = relationship("User",   back_populates="history")
    recipe = relationship("Recipe", back_populates="history")


class UserFavorite(Base):
    __tablename__ = "user_favorites"

    id        = Column(Integer, primary_key=True, index=True)
    user_id   = Column(Integer, ForeignKey("users.id"))
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    added_at  = Column(DateTime(timezone=True), server_default=func.now())

    user   = relationship("User",   back_populates="favorites")
    recipe = relationship("Recipe", back_populates="favorites")


class PaymentTransaction(Base):
    """
    Historique de toutes les transactions Stripe et recharges manuelles.
    Permet l'audit complet et la réconciliation comptable.
    """
    __tablename__ = "payment_transactions"

    id                 = Column(Integer, primary_key=True, index=True)
    user_id            = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount             = Column(Float,   nullable=False)               # montant en €
    type               = Column(String,  nullable=False)               # "stripe" | "manual" | "debit"
    status             = Column(String,  default="pending")            # "pending" | "completed" | "failed"
    stripe_session_id  = Column(String,  nullable=True, unique=True)   # Checkout Session ID
    stripe_payment_id  = Column(String,  nullable=True)                # PaymentIntent ID
    description        = Column(String,  nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="transactions")