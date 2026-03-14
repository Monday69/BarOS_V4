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
    barcode           = Column(String, nullable=True)
    brand             = Column(String, nullable=True)
    image_url         = Column(String, nullable=True)
    alcohol_degree    = Column(Float,   default=0.0)
    density           = Column(Float,   default=1.0)
    sugar_g_per_100ml = Column(Float,   default=0.0)
    kcal_per_100ml    = Column(Float,   default=0.0)
    purchase_price_per_liter = Column(Float, nullable=True, default=None)
    current_volume_ml = Column(Float,   default=0.0)
    max_volume_ml     = Column(Float,   default=1000.0)
    pump_id           = Column(Integer, nullable=True)
    is_available      = Column(Boolean, default=True)

    recipe_ingredients = relationship("RecipeIngredient", back_populates="ingredient")
    pour_steps         = relationship("PourStep",         back_populates="ingredient")
    reserve            = relationship("StockReserve",     back_populates="ingredient", uselist=False)


# --- 1b. STOCK ARRIÈRE-BOUTIQUE ---

class StockReserve(Base):
    __tablename__ = "stock_reserves"

    id                 = Column(Integer, primary_key=True, index=True)
    ingredient_id      = Column(Integer, ForeignKey("ingredients.id"), unique=True, nullable=False)
    reserve_ml         = Column(Float, default=0.0,    nullable=False)
    bottle_size_ml     = Column(Float, default=750.0,  nullable=False)
    alert_threshold_ml = Column(Float, default=1500.0, nullable=False)
    notes              = Column(Text,  nullable=True)
    updated_at         = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    ingredient = relationship("Ingredient", back_populates="reserve")


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
    mixing_method  = Column(String,  nullable=True)

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
    # [NOUVEAU] back-ref 1:1 vers l'OrderHistory créée pour cette séquence
    order_history = relationship("OrderHistory", back_populates="sequence", uselist=False)


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

    id               = Column(Integer, primary_key=True, index=True)
    card_uid         = Column(String,  unique=True, index=True)
    name             = Column(String)
    gender           = Column(String,  nullable=True)
    weight_kg        = Column(Float,   nullable=True)
    age              = Column(Integer, nullable=True)
    preferences      = Column(JSON,    default={})
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    is_admin         = Column(Boolean,  default=False,  nullable=False)
    balance          = Column(Float,    default=0.0,    nullable=False)
    pin_hash         = Column(String,   nullable=True)
    pin_attempts     = Column(Integer,  default=0,      nullable=False)
    pin_locked_until = Column(DateTime(timezone=True),  nullable=True)

    history           = relationship("OrderHistory",       back_populates="user")
    favorites         = relationship("UserFavorite",       back_populates="user")
    transactions      = relationship("PaymentTransaction", back_populates="user")
    queue_entries     = relationship("QueueEntry",         back_populates="user")
    push_subscription = relationship("PushSubscription",   back_populates="user", uselist=False)


class OrderHistory(Base):
    __tablename__ = "order_history"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"))
    recipe_id  = Column(Integer, ForeignKey("recipes.id"))
    # [NOUVEAU] FK 1:1 vers la séquence qui a produit cette commande.
    # nullable=True → rétrocompatible avec les lignes existantes (pas de migration bloquante).
    # unique=True   → une séquence ne peut être liée qu'à une seule commande.
    sequence_id = Column(Integer, ForeignKey("pour_sequences.id"), nullable=True, unique=True)
    timestamp  = Column(DateTime(timezone=True), server_default=func.now())
    rating     = Column(Integer, nullable=True)
    comment    = Column(Text,    nullable=True)
    cost_price = Column(Float,   nullable=True, default=None)
    sale_price = Column(Float,   nullable=True, default=None)
    # [NOUVEAU] Flag idempotence remboursement.
    # Mis à True dans la même transaction que le crédit solde → impossible de rembourser deux fois.
    refunded   = Column(Boolean, default=False, nullable=False)

    user     = relationship("User",         back_populates="history")
    recipe   = relationship("Recipe",       back_populates="history")
    # [NOUVEAU] back-ref vers PourSequence
    sequence = relationship("PourSequence", back_populates="order_history")


class UserFavorite(Base):
    __tablename__ = "user_favorites"

    id        = Column(Integer, primary_key=True, index=True)
    user_id   = Column(Integer, ForeignKey("users.id"))
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    added_at  = Column(DateTime(timezone=True), server_default=func.now())

    user   = relationship("User",   back_populates="favorites")
    recipe = relationship("Recipe", back_populates="favorites")


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount            = Column(Float,   nullable=False)
    type              = Column(String,  nullable=False)
    status            = Column(String,  default="pending")
    stripe_session_id = Column(String,  nullable=True, unique=True)
    stripe_payment_id = Column(String,  nullable=True)
    description       = Column(String,  nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="transactions")


# --- 7. FILE D'ATTENTE ---

class QueueEntry(Base):
    """
    Une entrée dans la file d'attente.
    Statuts : waiting → ready → confirmed → done | cancelled
      waiting   : en attente, pas encore son tour
      ready     : la machine est libre, c'est son tour → notif PWA envoyée
      confirmed : le user a validé avec le code affiché sur la machine
      done      : cocktail préparé
      cancelled : annulé par le user ou l'admin
    """
    __tablename__ = "queue_entries"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipe_id    = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    status       = Column(String,  default="waiting", nullable=False)
    position     = Column(Integer, nullable=True)
    confirm_code = Column(String,  nullable=True)
    cost_price   = Column(Float,   nullable=True)
    sale_price   = Column(Float,   nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    ready_at     = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    done_at      = Column(DateTime(timezone=True), nullable=True)

    user   = relationship("User",   back_populates="queue_entries")
    recipe = relationship("Recipe")


# --- 8. PUSH SUBSCRIPTIONS (PWA) ---

class PushSubscription(Base):
    """
    Subscription WebPush PWA d'un user.
    Stocke le endpoint + clés VAPID pour envoyer des notifications.
    Un user = une subscription (upsert).
    """
    __tablename__ = "push_subscriptions"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    endpoint   = Column(Text,   nullable=False)
    p256dh     = Column(Text,   nullable=False)
    auth       = Column(Text,   nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    user = relationship("User", back_populates="push_subscription")