import sys
import os

# Setup des chemins
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine, Base, Recipe, Ingredient, RecipeIngredient

# --- 1. NETTOYAGE COMPLET ---
print("🧹 Nettoyage de la base de données...")
Base.metadata.create_all(bind=engine)
db = SessionLocal()

# On vide tout pour repartir propre
db.query(RecipeIngredient).delete()
db.query(Recipe).delete()
db.query(Ingredient).delete() 
db.commit()

# --- 2. CONFIGURATION DES 12 POMPES (Config de Démarrage) ---
initial_pumps = {
    1: "Rhum Blanc",
    2: "Rhum Ambré",
    3: "Vodka",
    4: "Jägermeister",
    5: "Whisky",
    6: "Tequila",         
    7: "Coca-Cola",
    8: "Jus de Citron",   
    9: "Sirop de Sucre",
    10: "Jus d'Ananas",
    11: "Eau Gazeuse",    
    12: "Lait de Coco"    # Pompe 12
}

print("⚙️ Configuration des 12 Pompes Actives...")
ingredient_map = {}

for pump_id, name in initial_pumps.items():
    ing = Ingredient(
        name=name,
        pump_id=pump_id,         
        is_available=True,
        max_volume_ml=1000,
        current_volume_ml=1000
    )
    db.add(ing)
    db.commit()
    db.refresh(ing)
    ingredient_map[name] = ing
    print(f"   [{pump_id}] {name}")

# --- 2.5 LIQUIDES EN RÉSERVE (Pour le Drag & Drop futur) ---
# Ajout de TOUS les ingrédients de ta liste qui ne sont pas dans les 12 pompes
reserve_liquids = [
    "Red Bull",
    "Gin",
    "Cranberry",
    "Jus d'Orange",
    "Curacao Bleu",
    "Cointreau",
    "Ginger Beer",
    "Pastis",           # Pour le perroquet
    "Sirop de Menthe",  # Pour le perroquet
    "Limonade",         # Pour certains mix (ou on utilise Eau Gazeuse + Sucre)
    "Sirop de Miel",    # Pour le Honey Panama
    "Vodka Lime"
]

print("📦 Création de la réserve (Drag & Drop)...")
for name in reserve_liquids:
    ing = Ingredient(
        name=name,
        pump_id=None,  # Pas de pompe pour l'instant
        is_available=False,
        max_volume_ml=1000,
        current_volume_ml=1000
    )
    db.add(ing)
    db.commit()
    # On ne print pas tout pour pas polluer, mais ils sont là

# Fonction utilitaire
def get_ing(name):
    if name in ingredient_map:
        return ingredient_map[name]
    existing = db.query(Ingredient).filter(Ingredient.name == name).first()
    if existing:
        return existing
    # Crée un ingrédient manuel (ex: Menthe, Glaçons)
    new_ing = Ingredient(name=name, pump_id=None, is_available=False)
    db.add(new_ing)
    db.commit()
    db.refresh(new_ing)
    return new_ing

# --- 3. LES RECETTES COMPLÈTES (Noms de fichiers standardisés) ---
recipes_data = [
    # === RHUM BLANC ===
    {
        "name": "Canchanchara",
        "category": "Rhum Blanc",
        "image": "/cocktails/Rhum_Blanc/canchanchara.png",
        "price": 8.00,
        "ingredients": [("Rhum Blanc", 60), ("Jus de Citron", 15), ("Eau Gazeuse", 50), ("Miel", 0)]
    },
    {
        "name": "Mojito",
        "category": "Rhum Blanc",
        "image": "/cocktails/Rhum_Blanc/mojito.png",
        "price": 9.00,
        "ingredients": [("Rhum Blanc", 40), ("Sirop de Sucre", 20), ("Eau Gazeuse", 100), ("Menthe Fraîche", 0), ("Citron Vert", 0)]
    },
    {
        "name": "Piña Colada",
        "category": "Rhum Blanc",
        "image": "/cocktails/Rhum_Blanc/pina-colada.png",
        "price": 9.50,
        "ingredients": [("Rhum Blanc", 50), ("Jus d'Ananas", 80), ("Lait de Coco", 40), ("Sirop de Sucre", 10)]
    },
    {
        "name": "Ti Punch",
        "category": "Rhum Blanc",
        "image": "/cocktails/Rhum_Blanc/ti-punch.png",
        "price": 7.00,
        "ingredients": [("Rhum Blanc", 60), ("Sirop de Sucre", 20), ("Citron Vert", 0)]
    },
    {
        "name": "Tropical Kamasutra",
        "category": "Rhum Blanc",
        "image": "/cocktails/Rhum_Blanc/tropical-kamasutra.png",
        "price": 9.00,
        "ingredients": [("Rhum Blanc", 40), ("Sirop de Sucre", 15), ("Jus d'Ananas", 100), ("Gingembre", 0)]
    },
    {
        "name": "Daïquiri",
        "category": "Rhum Blanc",
        "image": "/cocktails/Rhum_Blanc/daiquiri.png",
        "price": 8.50,
        "ingredients": [("Rhum Blanc", 60), ("Jus de Citron", 40), ("Sirop de Sucre", 20)]
    },
    {
        "name": "Navy Grog",
        "category": "Rhum Blanc",
        "image": "/cocktails/Rhum_Blanc/navy-grog.png",
        "price": 10.00,
        "ingredients": [("Rhum Blanc", 20), ("Rhum Ambré", 20), ("Jus de Citron", 15), ("Miel", 0)]
    },
    {
        "name": "Mojito Colada",
        "category": "Rhum Blanc",
        "image": "/cocktails/Rhum_Blanc/mojito-colada.png",
        "price": 10.00,
        "ingredients": [("Rhum Blanc", 40), ("Lait de Coco", 30), ("Jus de Citron", 20), ("Menthe Fraîche", 0)]
    },
    {
        "name": "Amour",
        "category": "Rhum Blanc",
        "image": "/cocktails/Rhum_Blanc/amour.png",
        "price": 8.00,
        "ingredients": [("Rhum Blanc", 40), ("Jus de Citron", 40), ("Miel", 0)]
    },
    {
        "name": "The Kraken Cola",
        "category": "Rhum Blanc",
        "image": "/cocktails/Rhum_Blanc/the-kraken-cola.png",
        "price": 8.00,
        "ingredients": [("Rhum Blanc", 40), ("Coca-Cola", 120), ("Jus de Citron", 20)]
    },

    # === RHUM AMBRÉ ===
    {
        "name": "Santo Libre",
        "category": "Rhum Ambré",
        "image": "/cocktails/Rhum_Ambre/santo-libre.png",
        "price": 8.00,
        "ingredients": [("Rhum Ambré", 60), ("Eau Gazeuse", 150), ("Jus de Citron", 10)]
    },
    {
        "name": "Old Swizzle",
        "category": "Rhum Ambré",
        "image": "/cocktails/Rhum_Ambre/old-swizzle.png",
        "price": 9.00,
        "ingredients": [("Rhum Ambré", 60), ("Jus de Citron", 30), ("Eau Gazeuse", 20), ("Bitter", 0)]
    },
    {
        "name": "Dark Mojito",
        "category": "Rhum Ambré",
        "image": "/cocktails/Rhum_Ambre/dark-mojito.png",
        "price": 9.00,
        "ingredients": [("Rhum Ambré", 40), ("Sirop de Sucre", 20), ("Eau Gazeuse", 100), ("Menthe Fraîche", 0)]
    },
    {
        "name": "Honey Panama",
        "category": "Rhum Ambré",
        "image": "/cocktails/Rhum_Ambre/honey-panama.png",
        "price": 9.00,
        "ingredients": [("Rhum Ambré", 40), ("Sirop de Sucre", 10), ("Jus de Citron", 20), ("Miel", 0), ("Basilic", 0)]
    },
    {
        "name": "Cuba Libre",
        "category": "Rhum Ambré",
        "image": "/cocktails/Rhum_Ambre/cuba-libre.png",
        "price": 8.00,
        "ingredients": [("Rhum Ambré", 40), ("Jus de Citron", 20), ("Coca-Cola", 120)]
    },
    {
        "name": "Perfect Colada",
        "category": "Rhum Ambré",
        "image": "/cocktails/Rhum_Ambre/perfect-colada.png",
        "price": 9.50,
        "ingredients": [("Rhum Ambré", 40), ("Jus d'Ananas", 60), ("Lait de Coco", 40), ("Ananas Morceaux", 0)]
    },

    # === VODKA ===
    {
        "name": "Polia Lime et Cola",
        "category": "Vodka",
        "image": "/cocktails/Vodka/polia-lime-cola.png",
        "price": 7.50,
        "ingredients": [("Vodka", 50), ("Coca-Cola", 120)]
    },
    {
        "name": "Caipiroska",
        "category": "Vodka",
        "image": "/cocktails/Vodka/caipiroska.png",
        "price": 8.50,
        "ingredients": [("Vodka", 50), ("Sirop de Sucre", 20), ("Citron Vert", 0)]
    },
    {
        "name": "Sikko",
        "category": "Vodka",
        "image": "/cocktails/Vodka/sikko.png",
        "price": 9.00,
        "ingredients": [("Vodka", 40), ("Jus de Citron", 60), ("Sirop de Sucre", 15), ("Gingembre", 0)]
    },
    {
        "name": "Vodka Red Bull",
        "category": "Vodka",
        "image": "/cocktails/Vodka/vodka-redbull.png",
        "price": 10.00,
        "ingredients": [("Vodka", 40), ("Red Bull", 0)]
    },
    {
        "name": "Ciroc Mojito Solo",
        "category": "Vodka",
        "image": "/cocktails/Vodka/ciroc-mojito-solo.png",
        "price": 9.50,
        "ingredients": [("Vodka", 40), ("Jus de Citron", 20), ("Sirop de Sucre", 20), ("Jus d'Ananas", 40), ("Eau Gazeuse", 30)]
    },
    {
        "name": "Coconut Cola",
        "category": "Vodka",
        "image": "/cocktails/Vodka/coconut-cola.png",
        "price": 8.00,
        "ingredients": [("Vodka", 40), ("Lait de Coco", 40), ("Coca-Cola", 100)]
    },

    # === JAGERMEISTER ===
    {
        "name": "Jager Bomb",
        "category": "Jager",
        "image": "/cocktails/Jager/jager-bomb.png",
        "price": 6.00,
        "ingredients": [("Jägermeister", 40), ("Red Bull", 0)]
    },
    {
        "name": "Jager Cola",
        "category": "Jager",
        "image": "/cocktails/Jager/jager-cola.png",
        "price": 7.00,
        "ingredients": [("Jägermeister", 40), ("Coca-Cola", 120)]
    },
    {
        "name": "Jäger Ginger",
        "category": "Jager",
        "image": "/cocktails/Jager/jager-ginger.png",
        "price": 8.00,
        "ingredients": [("Jägermeister", 40), ("Ginger Beer", 0), ("Jus de Citron", 0)]
    },
    {
        "name": "Jägermeister Mule",
        "category": "Jager",
        "image": "/cocktails/Jager/jager-mule.png",
        "price": 8.50,
        "ingredients": [("Jägermeister", 50), ("Ginger Beer", 0), ("Jus de Citron", 10)]
    },
    {
        "name": "Jägerinha",
        "category": "Jager",
        "image": "/cocktails/Jager/jagerinha.png",
        "price": 8.00,
        "ingredients": [("Jägermeister", 60), ("Sirop de Sucre", 10), ("Citron Vert", 0)]
    },
    {
        "name": "The Calm Before Storm",
        "category": "Jager",
        "image": "/cocktails/Jager/the-calm-before-the-storm.png",
        "price": 10.00,
        "ingredients": [("Jägermeister", 45), ("Whisky", 45)]
    },

    # === WHISKY ===
    {
        "name": "Whisky Highball",
        "category": "Whisky",
        "image": "/cocktails/Whisky/whisky-highball.png",
        "price": 8.00,
        "ingredients": [("Whisky", 50), ("Eau Gazeuse", 150)]
    },
    {
        "name": "The Bartons Cola",
        "category": "Whisky",
        "image": "/cocktails/Whisky/bartons-cola.png",
        "price": 8.00,
        "ingredients": [("Whisky", 40), ("Jus de Citron", 10), ("Coca-Cola", 100)]
    },
    {
        "name": "Label Sour",
        "category": "Whisky",
        "image": "/cocktails/Whisky/label-sour.png",
        "price": 9.00,
        "ingredients": [("Whisky", 40), ("Jus de Citron", 20), ("Sirop de Sucre", 20)]
    },
    {
        "name": "Jock Collins",
        "category": "Whisky",
        "image": "/cocktails/Whisky/jock-collins.png",
        "price": 8.50,
        "ingredients": [("Whisky", 40), ("Jus de Citron", 20), ("Sirop de Sucre", 10), ("Eau Gazeuse", 50)]
    },
    {
        "name": "London Collins",
        "category": "Whisky",
        "image": "/cocktails/Whisky/london-collins.png",
        "price": 8.50,
        "ingredients": [("Whisky", 50), ("Eau Gazeuse", 50), ("Sirop de Sucre", 20), ("Jus de Citron", 10)]
    },
    {
        "name": "Mellow Five",
        "category": "Whisky",
        "image": "/cocktails/Whisky/mellow-five.png",
        "price": 9.00,
        "ingredients": [("Whisky", 20), ("Jus de Citron", 10), ("Jus d'Ananas", 40), ("Miel", 0)]
    },
    {
        "name": "Whisky Coca",
        "category": "Whisky",
        "image": "/cocktails/Whisky/whisky-coca.png",
        "price": 7.50,
        "ingredients": [("Whisky", 50), ("Coca-Cola", 100)]
    },
    {
        "name": "Whisky Red Bull",
        "category": "Whisky",
        "image": "/cocktails/Whisky/whisky-redbull.png",
        "price": 10.00,
        "ingredients": [("Whisky", 50), ("Red Bull", 0)]
    },

    # === PASTIS ===
    {
        "name": "Pastis",
        "category": "Pastis",
        "image": "/cocktails/Pastis/pastis.png",
        "price": 3.00,
        "ingredients": [("Pastis", 30), ("Eau Gazeuse", 0)] # On mettra de l'eau plate manuelle si besoin
    },
    {
        "name": "Perroquet",
        "category": "Pastis",
        "image": "/cocktails/Pastis/perroquet.png",
        "price": 4.00,
        "ingredients": [("Pastis", 40), ("Sirop de Menthe", 0), ("Eau Gazeuse", 0)]
    }
]

# --- 4. INSERTION ---
print("📥 Remplissage du Bar...")
count = 0
for r_data in recipes_data:
    # Création Recette
    recipe = Recipe(
        name=r_data["name"],
        image_url=r_data["image"],
        price=r_data["price"],
        category=r_data["category"]
    )
    db.add(recipe)
    db.flush()

    # Liaison Ingrédients
    for ing_name, volume in r_data["ingredients"]:
        ing_obj = get_ing(ing_name)
        
        link = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=ing_obj.id,
            volume_ml=volume
        )
        db.add(link)
    
    print(f"   + {r_data['name']}")
    count += 1

db.commit()
print(f"✅ BarOS V4 Initialisé : {count} Cocktails ajoutés, 12 Pompes + Réserve prêtes !")
db.close()