"""
BarOS V4 - API principale
Système de distribution de cocktails automatisé sur Raspberry Pi
"""

from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from backend.database import Base, engine, get_db, User, Ingredient, Recipe, RecipeIngredient
from backend.routers import cocktails
from fastapi.middleware.cors import CORSMiddleware

# Initialisation de l'application FastAPI
app = FastAPI(
    title="BarOS V4 API",
    description="API pour le système de distribution de cocktails automatisé",
    version="4.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Autorise tout le monde (pour le dév)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routers
app.include_router(cocktails.router, prefix="/cocktails")


@app.on_event("startup")
async def startup_event():
    """
    Création automatique des tables au démarrage de l'application
    """
    # Création du dossier data s'il n'existe pas
    import os
    os.makedirs("data", exist_ok=True)
    
    # Création de toutes les tables
    Base.metadata.create_all(bind=engine)


@app.on_event("shutdown")
async def shutdown_event():
    """
    Nettoyage des ressources GPIO à l'arrêt de l'application
    """
    from backend.hardware.gpio_manager import gpio_manager
    gpio_manager.cleanup()


@app.get("/")
async def root():
    """
    Route racine - Vérification du statut de l'API
    """
    return {
        "status": "online",
        "system": "BarOS V4"
    }


@app.post("/setup_fake_data")
async def setup_fake_data(db: Session = Depends(get_db)):
    """
    Route pour remplir la base de données avec des données de test
    - 1 User "Thomas"
    - 3 Ingrédients "Rhum", "Coca", "Citron"
    - 1 Recette "Cuba Libre"
    """
    # Vérifier si les données existent déjà
    existing_user = db.query(User).filter(User.name == "Thomas").first()
    if existing_user:
        return {"message": "Les données de test existent déjà", "status": "skipped"}
    
    # Vérifier si les colorants existent déjà
    existing_cyan = db.query(Ingredient).filter(Ingredient.name == "Cyan").first()
    if existing_cyan:
        return {"message": "Les données de test existent déjà", "status": "skipped"}
    
    # Création de l'utilisateur Thomas
    user = User(
        nfc_tag="NFC_THOMAS_001",
        name="Thomas",
        credits=50.0,
        is_admin=True
    )
    db.add(user)
    db.flush()  # Pour obtenir l'ID
    
    # Création des ingrédients
    rhum = Ingredient(
        name="Rhum",
        pump_id=1,
        color_hex="#8B4513",
        is_alcoholic=True,
        current_volume_ml=1000.0,
        max_volume_ml=1000.0
    )
    coca = Ingredient(
        name="Coca",
        pump_id=2,
        color_hex="#000000",
        is_alcoholic=False,
        current_volume_ml=1000.0,
        max_volume_ml=1000.0
    )
    citron = Ingredient(
        name="Citron",
        pump_id=3,
        color_hex="#FFFF00",
        is_alcoholic=False,
        current_volume_ml=1000.0,
        max_volume_ml=1000.0
    )
    
    # Création des colorants CMY
    cyan = Ingredient(
        name="Cyan",
        pump_id=4,
        color_hex="#00FFFF",
        is_alcoholic=False,
        current_volume_ml=1000.0,
        max_volume_ml=1000.0
    )
    magenta = Ingredient(
        name="Magenta",
        pump_id=5,
        color_hex="#FF00FF",
        is_alcoholic=False,
        current_volume_ml=1000.0,
        max_volume_ml=1000.0
    )
    yellow = Ingredient(
        name="Yellow",
        pump_id=6,
        color_hex="#FFFF00",
        is_alcoholic=False,
        current_volume_ml=1000.0,
        max_volume_ml=1000.0
    )
    eau = Ingredient(
        name="Eau",
        pump_id=7,
        color_hex="#FFFFFF",
        is_alcoholic=False,
        current_volume_ml=1000.0,
        max_volume_ml=1000.0
    )
    
    db.add_all([rhum, coca, citron, cyan, magenta, yellow, eau])
    db.flush()  # Pour obtenir les IDs
    
    # Création de la recette Cuba Libre
    cuba_libre = Recipe(
        name="Cuba Libre",
        price=5.50,
        image_url="https://example.com/cuba-libre.jpg"
    )
    db.add(cuba_libre)
    db.flush()  # Pour obtenir l'ID
    
    # Création des étapes de la recette
    steps = [
        RecipeIngredient(
            recipe_id=cuba_libre.id,
            ingredient_id=rhum.id,
            volume_ml=50.0,
            order=1
        ),
        RecipeIngredient(
            recipe_id=cuba_libre.id,
            ingredient_id=coca.id,
            volume_ml=150.0,
            order=2
        ),
        RecipeIngredient(
            recipe_id=cuba_libre.id,
            ingredient_id=citron.id,
            volume_ml=10.0,
            order=3
        )
    ]
    
    db.add_all(steps)
    db.commit()
    
    return {
        "message": "Données de test créées avec succès",
        "status": "created",
        "data": {
            "user": {"name": user.name, "credits": user.credits},
            "ingredients": [
                {"name": rhum.name, "pump_id": rhum.pump_id},
                {"name": coca.name, "pump_id": coca.pump_id},
                {"name": citron.name, "pump_id": citron.pump_id},
                {"name": cyan.name, "pump_id": cyan.pump_id},
                {"name": magenta.name, "pump_id": magenta.pump_id},
                {"name": yellow.name, "pump_id": yellow.pump_id},
                {"name": eau.name, "pump_id": eau.pump_id}
            ],
            "recipe": {"name": cuba_libre.name, "price": cuba_libre.price}
        }
    }

