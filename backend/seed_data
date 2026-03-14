"""

seed_data.py - Script de peuplement de la base de données avec des données réalistes pour les tests et la démonstration.
BarOS V4 - Seed Data Complet & Autonome
Lancer avec : python -m backend.seed_data

"""
from backend.database import SessionLocal
from backend.models import Ingredient, Recipe, RecipeIngredient, User, OrderHistory
from datetime import datetime, timedelta, timezone
import random

# ── Ingrédients ───────────────────────────────────────────────────────────────
INGREDIENTS = [
    # ALCOOLS
    {"name": "Vodka",         "type": "alcool",   "alc": 40.0, "sugar": 0.0,  "kcal": 231.0, "brand": "Absolut"},
    {"name": "Rhum Blanc",    "type": "alcool",   "alc": 37.5, "sugar": 0.0,  "kcal": 220.0, "brand": "Havana Club"},
    {"name": "Rhum Ambré",    "type": "alcool",   "alc": 40.0, "sugar": 0.5,  "kcal": 230.0, "brand": "Captain Morgan"},
    {"name": "Gin",           "type": "alcool",   "alc": 40.0, "sugar": 0.0,  "kcal": 260.0, "brand": "Bombay Sapphire"},
    {"name": "Tequila",       "type": "alcool",   "alc": 38.0, "sugar": 0.0,  "kcal": 210.0, "brand": "Jose Cuervo"},
    {"name": "Whisky",        "type": "alcool",   "alc": 40.0, "sugar": 0.0,  "kcal": 250.0, "brand": "Jack Daniels"},
    {"name": "Jägermeister",  "type": "alcool",   "alc": 35.0, "sugar": 11.0, "kcal": 250.0, "brand": "Jägermeister"},
    {"name": "Pastis",        "type": "alcool",   "alc": 45.0, "sugar": 3.0,  "kcal": 275.0, "brand": "Ricard"},
    # DILUANTS
    {"name": "Coca-Cola",     "type": "diluant",  "alc": 0.0,  "sugar": 10.6, "kcal": 42.0,  "brand": "Coca-Cola"},
    {"name": "Jus d'Orange",  "type": "diluant",  "alc": 0.0,  "sugar": 9.0,  "kcal": 45.0,  "brand": "Tropicana"},
    {"name": "Jus de Citron", "type": "diluant",  "alc": 0.0,  "sugar": 2.5,  "kcal": 29.0,  "brand": "Pulco"},
    {"name": "Jus d'Ananas",  "type": "diluant",  "alc": 0.0,  "sugar": 13.0, "kcal": 53.0,  "brand": "Joker"},
    {"name": "Eau",           "type": "diluant",  "alc": 0.0,  "sugar": 0.0,  "kcal": 0.0,   "brand": "Cristaline"},
    {"name": "Eau Gazeuse",   "type": "diluant",  "alc": 0.0,  "sugar": 0.0,  "kcal": 0.0,   "brand": "Perrier"},
    {"name": "Limonade",      "type": "diluant",  "alc": 0.0,  "sugar": 8.0,  "kcal": 35.0,  "brand": "Sprite"},
    {"name": "Ginger Beer",   "type": "diluant",  "alc": 0.0,  "sugar": 13.0, "kcal": 55.0,  "brand": "Fever Tree"},
    {"name": "Red Bull",      "type": "diluant",  "alc": 0.0,  "sugar": 11.0, "kcal": 46.0,  "brand": "Red Bull"},
    {"name": "Lait de Coco",  "type": "diluant",  "alc": 0.0,  "sugar": 3.0,  "kcal": 180.0, "brand": "Suzy Wan"},
    # SIROPS
    {"name": "Sirop de Grenadine", "type": "sirop", "alc": 0.0, "sugar": 78.0, "kcal": 320.0, "brand": "Monin"},
    {"name": "Sirop de Canne",     "type": "sirop", "alc": 0.0, "sugar": 85.0, "kcal": 340.0, "brand": "Canadou"},
    {"name": "Sirop de Menthe",    "type": "sirop", "alc": 0.0, "sugar": 75.0, "kcal": 300.0, "brand": "Teisseire"},
    {"name": "Sirop d'Orgeat",     "type": "sirop", "alc": 0.0, "sugar": 80.0, "kcal": 330.0, "brand": "Monin"},
    # COLORANTS
    {"name": "Colorant Cyan",    "type": "colorant", "alc": 0.0, "sugar": 0.0, "kcal": 0.0},
    {"name": "Colorant Magenta", "type": "colorant", "alc": 0.0, "sugar": 0.0, "kcal": 0.0},
    {"name": "Colorant Jaune",   "type": "colorant", "alc": 0.0, "sugar": 0.0, "kcal": 0.0},
]

# ── Recettes ──────────────────────────────────────────────────────────────────
RECIPES = [
    # --- Rhum Blanc ---
    {"name": "Canchanchara", "category": "Rhum", "price": 8.00,
     "image_url": "/cocktails/Rhum_Blanc/canchanchara.png",
     "ingredients": [("Rhum Blanc", 60), ("Jus de Citron", 15), ("Eau", 50)]},
    {"name": "Mojito", "category": "Rhum", "price": 8.50,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2018/04/mojito-2.jpg",
     "ingredients": [("Rhum Blanc", 40), ("Jus de Citron", 20), ("Sirop de Canne", 20), ("Eau Gazeuse", 100)]},
    {"name": "Piña Colada", "category": "Rhum", "price": 9.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2019/11/cocktail-pina-colada.jpg",
     "ingredients": [("Rhum Blanc", 40), ("Jus d'Ananas", 60), ("Lait de Coco", 60), ("Sirop de Canne", 20)]},
    {"name": "Ti Punch", "category": "Rhum", "price": 7.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2021/01/Ti-punch.jpg",
     "ingredients": [("Rhum Blanc", 60), ("Sirop de Canne", 20), ("Jus de Citron", 10)]},
    {"name": "Tropical Kamasutra", "category": "Rhum", "price": 9.50,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2019/11/cocktail-tropical-kamasutra.jpg",
     "ingredients": [("Rhum Blanc", 40), ("Sirop de Canne", 15), ("Jus d'Ananas", 100)]},
    {"name": "Daïquiri", "category": "Rhum", "price": 8.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2018/04/136_daiquiri.jpg",
     "ingredients": [("Rhum Blanc", 60), ("Jus de Citron", 40), ("Sirop de Canne", 20)]},
    {"name": "Navy Grog", "category": "Rhum", "price": 10.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2018/04/cocktail-navy-grog.jpg",
     "ingredients": [("Rhum Blanc", 30), ("Rhum Ambré", 30), ("Jus de Citron", 15)]},
    {"name": "Mojito Colada", "category": "Rhum", "price": 9.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2023/02/mojito-colada.jpg",
     "ingredients": [("Rhum Blanc", 40), ("Jus de Citron", 20), ("Lait de Coco", 60)]},
    {"name": "Amour", "category": "Rhum", "price": 8.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2019/11/cocktail-amour.jpg",
     "ingredients": [("Rhum Blanc", 40), ("Jus de Citron", 40)]},
    # --- Rhum Ambré ---
    {"name": "Kraken Cola", "category": "Rhum", "price": 8.50,
     "image_url": "https://m.media-amazon.com/images/S/aplus-media/vc/0b7696c2-498c-443e-a77c-6556f8f553f1.__CR0,0,300,300_PT0_SX300_V1___.jpg",
     "ingredients": [("Rhum Ambré", 40), ("Coca-Cola", 120), ("Jus de Citron", 20)]},
    {"name": "Santo Libre", "category": "Rhum", "price": 8.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2018/04/cocktail-santo-libre.jpg",
     "ingredients": [("Rhum Ambré", 60), ("Limonade", 150), ("Jus de Citron", 10)]},
    {"name": "Old Swizzle", "category": "Rhum", "price": 9.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2018/04/cocktail-old-swizzle.jpg",
     "ingredients": [("Rhum Ambré", 60), ("Jus de Citron", 30), ("Eau Gazeuse", 60)]},
    {"name": "Dark Mojito", "category": "Rhum", "price": 9.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2021/01/Dark-mojito.jpg",
     "ingredients": [("Rhum Ambré", 40), ("Sirop de Canne", 20), ("Jus de Citron", 20), ("Eau Gazeuse", 100)]},
    {"name": "Honey Panama", "category": "Rhum", "price": 8.50,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2019/11/cocktail-honey-panama.jpg",
     "ingredients": [("Rhum Ambré", 40), ("Sirop de Canne", 10), ("Jus de Citron", 20)]},
    {"name": "Cuba Libre", "category": "Rhum", "price": 8.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2019/05/cocktail-cuba-libre.jpg",
     "ingredients": [("Rhum Ambré", 40), ("Jus de Citron", 20), ("Coca-Cola", 120)]},
    {"name": "Perfect Colada", "category": "Rhum", "price": 9.50,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2019/11/cocktail-perfect-colada.jpg",
     "ingredients": [("Rhum Ambré", 40), ("Jus d'Ananas", 60), ("Lait de Coco", 40)]},
    # --- Vodka ---
    {"name": "Polia Lime et Cola", "category": "Vodka", "price": 8.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2023/04/AdobeStock_308678250-scaled.jpeg",
     "ingredients": [("Vodka", 50), ("Coca-Cola", 120), ("Jus de Citron", 10)]},
    {"name": "Caipiroska", "category": "Vodka", "price": 8.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2022/04/Recette-cocktail-Caipiroska.jpg",
     "ingredients": [("Vodka", 50), ("Sirop de Canne", 20), ("Jus de Citron", 20)]},
    {"name": "Sikko", "category": "Vodka", "price": 9.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2019/11/cocktail-sikko.jpg",
     "ingredients": [("Vodka", 40), ("Jus de Citron", 60), ("Sirop de Canne", 15)]},
    {"name": "Santorini Sunrise", "category": "Vodka", "price": 8.50,
     "image_url": "https://www.colruyt.be/content/dam/colruyt/recettes/1000/1000-1100/1002/santorini-sunrise-1002-kw19-12-link.jpg",
     "ingredients": [("Vodka", 50), ("Jus d'Ananas", 100)]},
    {"name": "Vodka Red Bull", "category": "Vodka", "price": 9.00,
     "image_url": "https://www.1001cocktails.com/images/cocktails/1001cocktails/vodka-red-bull.jpg",
     "ingredients": [("Vodka", 50), ("Red Bull", 150)]},
    {"name": "Cîroc Mojito Solo", "category": "Vodka", "price": 10.00,
     "image_url": "https://www.1001cocktails.com/images/cocktails/1001cocktails/ciroc-mojito-solo.jpg",
     "ingredients": [("Vodka", 40), ("Jus de Citron", 20), ("Sirop de Canne", 20), ("Jus d'Ananas", 40), ("Eau Gazeuse", 50)]},
    {"name": "Coconut Cola", "category": "Vodka", "price": 8.00,
     "image_url": "https://www.drinkdirect.ch/media/image/5f/8b/4c/coconut-cola.jpg",
     "ingredients": [("Vodka", 40), ("Lait de Coco", 40), ("Coca-Cola", 120)]},
    # --- Jägermeister ---
    {"name": "Jager Bomb", "category": "Jäger", "price": 9.00,
     "image_url": "https://www.1001cocktails.com/images/cocktails/1001cocktails/jager-bomb.jpg",
     "ingredients": [("Jägermeister", 40), ("Red Bull", 150)]},
    {"name": "Jager Cola", "category": "Jäger", "price": 8.00,
     "image_url": "https://images.unsplash.com/photo-1629247657037-77af3c457d5e?auto=format&fit=crop&q=80",
     "ingredients": [("Jägermeister", 40), ("Coca-Cola", 120)]},
    {"name": "Jäger Ginger", "category": "Jäger", "price": 9.50,
     "image_url": "https://kissmychef.com/wp-content/uploads/2020/09/JAGER-GINGER-1-1.jpg",
     "ingredients": [("Jägermeister", 40), ("Ginger Beer", 120), ("Jus de Citron", 10)]},
    {"name": "Jägermeister Mule", "category": "Jäger", "price": 9.50,
     "image_url": "https://www.jagermeister.com/media/5807/jager-mule-stage.png",
     "ingredients": [("Jägermeister", 50), ("Ginger Beer", 120), ("Jus de Citron", 20)]},
    {"name": "Jägerinha", "category": "Jäger", "price": 8.50,
     "image_url": "https://tendercrate.com/wp-content/uploads/2021/04/jagerinha.jpg",
     "ingredients": [("Jägermeister", 60), ("Sirop de Canne", 10), ("Jus de Citron", 30)]},
    {"name": "Calm Before Storm", "category": "Jäger", "price": 10.00,
     "image_url": "https://sweegen.com/wp-content/uploads/2021/01/calm-before-storm-cocktail.jpg",
     "ingredients": [("Jägermeister", 45), ("Whisky", 45)]},
    {"name": "Shot de Jägermeister", "category": "Jäger", "price": 4.00,
     "image_url": "https://images.unsplash.com/photo-1572116469696-9587215f2faa?auto=format&fit=crop&q=80",
     "ingredients": [("Jägermeister", 40)]},
    # --- Whisky ---
    {"name": "Whisky Highball", "category": "Whisky", "price": 8.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2018/04/cocktail-whisky-highball.jpg",
     "ingredients": [("Whisky", 50), ("Limonade", 150)]},
    {"name": "Barton's Cola", "category": "Whisky", "price": 8.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2018/04/cocktail-the-bartons-cola.jpg",
     "ingredients": [("Whisky", 40), ("Coca-Cola", 100), ("Jus de Citron", 10)]},
    {"name": "Label Sour", "category": "Whisky", "price": 8.50,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2018/04/cocktail-label-sour.jpg",
     "ingredients": [("Whisky", 40), ("Jus de Citron", 20), ("Sirop de Canne", 20)]},
    {"name": "Jock Collins", "category": "Whisky", "price": 8.50,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2018/04/cocktail-jock-collins.jpg",
     "ingredients": [("Whisky", 40), ("Jus de Citron", 20), ("Sirop de Canne", 10)]},
    {"name": "London Collins", "category": "Whisky", "price": 9.00,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2019/11/cocktail-london-collins.jpg",
     "ingredients": [("Whisky", 50), ("Eau Gazeuse", 50), ("Sirop de Canne", 20), ("Jus de Citron", 10)]},
    {"name": "Mellow Five", "category": "Whisky", "price": 9.50,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2018/04/cocktail-mellow-five.jpg",
     "ingredients": [("Whisky", 20), ("Jus d'Ananas", 40), ("Jus de Citron", 10)]},
    {"name": "Whisky Coca", "category": "Whisky", "price": 8.00,
     "image_url": "https://images.unsplash.com/photo-1570605658667-8898124233e7?auto=format&fit=crop&q=80",
     "ingredients": [("Whisky", 50), ("Coca-Cola", 100)]},
    {"name": "Whisky Red Bull", "category": "Whisky", "price": 9.00,
     "image_url": "https://images.unsplash.com/photo-1541544181051-447a1758c345?auto=format&fit=crop&q=80",
     "ingredients": [("Whisky", 50), ("Red Bull", 120)]},
    # --- Pastis ---
    {"name": "Pastis", "category": "Pastis", "price": 3.00,
     "image_url": "https://images.unsplash.com/photo-1596466983050-c6517a264a02?auto=format&fit=crop&q=80",
     "ingredients": [("Pastis", 30), ("Eau", 150)]},
    {"name": "Perroquet", "category": "Pastis", "price": 3.50,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2019/05/cocktail-perroquet.jpg",
     "ingredients": [("Pastis", 40), ("Sirop de Menthe", 10), ("Eau", 150)]},
    {"name": "Tomate", "category": "Pastis", "price": 3.50,
     "image_url": "https://www.1001cocktails.com/images/cocktails/1001cocktails/tomate.jpg",
     "ingredients": [("Pastis", 40), ("Sirop de Grenadine", 10), ("Eau", 150)]},
    {"name": "Mauresque", "category": "Pastis", "price": 3.50,
     "image_url": "https://www.destinationcocktails.fr/wp-content/uploads/2019/05/cocktail-mauresque.jpg",
     "ingredients": [("Pastis", 40), ("Sirop d'Orgeat", 10), ("Eau", 150)]},
    # --- Colorants ---
    {"name": "Colorant Cyan (Base)", "category": "Colorant", "price": 5.00,
     "image_url": "https://upload.wikimedia.org/wikipedia/commons/2/25/Cyan_color_swatch.png",
     "ingredients": [("Colorant Cyan", 100)]},
    {"name": "Colorant Magenta (Base)", "category": "Colorant", "price": 5.00,
     "image_url": "https://upload.wikimedia.org/wikipedia/commons/7/71/Magenta_color_swatch.png",
     "ingredients": [("Colorant Magenta", 100)]},
    {"name": "Colorant Jaune (Base)", "category": "Colorant", "price": 5.00,
     "image_url": "https://upload.wikimedia.org/wikipedia/commons/9/9e/Yellow_color_swatch.png",
     "ingredients": [("Colorant Jaune", 100)]},
]

# ── Utilisateurs de test ──────────────────────────────────────────────────────
# ✅ Fix : is_admin explicite dans les données — plus de comparaison "DEADBEEF"
# L'UID admin peut être n'importe quelle valeur sans impact sur la logique.
TEST_USERS = [
    {
        "card_uid":    "A1B2C3D4",
        "name":        "Alex Martin",
        "is_admin":    False,
        "gender":      "M",
        "weight_kg":   78.0,
        "age":         22,
        "preferences": {"Rhum": 5, "Vodka": 3},
        "fav_recipes": ["Mojito", "Cuba Libre", "Daïquiri"],
        "history": [
            ("Mojito",         1, 5), ("Cuba Libre",      1, 4), ("Daïquiri",        2, 5),
            ("Ti Punch",       3, 4), ("Mojito",          5, 5), ("Kraken Cola",     7, 3),
            ("Dark Mojito",   10, 4), ("Piña Colada",    12, 5), ("Mojito",         14, 5),
            ("Navy Grog",     15, 4),
        ]
    },
    {
        "card_uid":    "F4E3D2C1",
        "name":        "Léa Dubois",
        "is_admin":    False,
        "gender":      "F",
        "weight_kg":   58.0,
        "age":         20,
        "preferences": {"Vodka": 5, "Jäger": 2},
        "fav_recipes": ["Vodka Red Bull", "Caipiroska"],
        "history": [
            ("Vodka Red Bull",    1, 4), ("Caipiroska",        1, 5), ("Vodka Red Bull",    3, 4),
            ("Jager Bomb",        4, 3), ("Santorini Sunrise",  6, 5), ("Caipiroska",        8, 5),
            ("Cîroc Mojito Solo",10, 4), ("Vodka Red Bull",   12, 4), ("Sikko",            15, 3),
        ]
    },
    {
        "card_uid":    "99887766",
        "name":        "Tom Girard",
        "is_admin":    False,
        "gender":      "M",
        "weight_kg":   90.0,
        "age":         25,
        "preferences": {"Whisky": 5, "Jäger": 4},
        "fav_recipes": ["Jager Bomb", "Whisky Coca", "Calm Before Storm"],
        "history": [
            ("Jager Bomb",         1, 5), ("Whisky Coca",        1, 4), ("Calm Before Storm",  2, 5),
            ("Jager Bomb",         3, 5), ("Whisky Red Bull",    4, 4), ("Barton's Cola",      6, 3),
            ("Jager Cola",         8, 4), ("Whisky Highball",   10, 3), ("Jäger Ginger",      12, 4),
            ("Calm Before Storm", 14, 5), ("Jager Bomb",        15, 5),
        ]
    },
    {
        # ✅ Fix : is_admin=True explicite — l'UID n'a plus de signification spéciale
        "card_uid":    "BAROS2024",
        "name":        "Admin BarOS",
        "is_admin":    True,
        "gender":      "O",
        "weight_kg":   75.0,
        "age":         30,
        "preferences": {},
        "fav_recipes": [],
        "history": [
            ("Pastis", 2, 5), ("Perroquet", 3, 4),
        ]
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_or_create_ingredient(db, item):
    ing = db.query(Ingredient).filter(Ingredient.name == item["name"]).first()
    if not ing:
        ing = Ingredient(
            name=item["name"],
            type=item["type"],
            brand=item.get("brand"),
            alcohol_degree=item.get("alc", 0.0),
            sugar_g_per_100ml=item.get("sugar", 0.0),
            kcal_per_100ml=item.get("kcal", 0.0),
            current_volume_ml=1000.0,
            max_volume_ml=1000.0,
            is_available=True,
        )
        db.add(ing)
        print(f"  + Ingrédient : {item['name']}")
    return ing


def get_or_create_recipe(db, r_data, ingredient_map):
    recipe = db.query(Recipe).filter(Recipe.name == r_data["name"]).first()
    if recipe:
        return recipe

    recipe = Recipe(
        name=r_data["name"],
        category=r_data.get("category", "Classique"),
        image_url=r_data.get("image_url"),
        price=r_data.get("price", 0.0),
        is_available=True,
    )
    db.add(recipe)
    db.flush()

    for idx, (ing_name, volume) in enumerate(r_data["ingredients"]):
        ing = ingredient_map.get(ing_name)
        if ing:
            db.add(RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ing.id,
                volume_ml=volume,
                order=idx
            ))
        else:
            print(f"  ⚠️  Ingrédient inconnu '{ing_name}' dans '{r_data['name']}'")

    print(f"  + Recette : {recipe.name} ({recipe.category})")
    return recipe


def seed_user(db, u_data, recipe_map):
    from backend.models import UserFavorite

    user = db.query(User).filter(User.card_uid == u_data["card_uid"]).first()
    if not user:
        user = User(
            card_uid=u_data["card_uid"],
            name=u_data["name"],
            gender=u_data["gender"],
            weight_kg=u_data["weight_kg"],
            age=u_data["age"],
            preferences=u_data.get("preferences", {}),
            # ✅ Fix : is_admin lu depuis les données, plus de comparaison UID
            is_admin=u_data.get("is_admin", False),
        )
        db.add(user)
        db.flush()
        print(f"  + User : {user.name} (NFC: {user.card_uid})")
    else:
        print(f"  = User existe : {u_data['name']}")

    # Favoris
    for recipe_name in u_data.get("fav_recipes", []):
        recipe = recipe_map.get(recipe_name)
        if not recipe:
            continue
        exists = db.query(UserFavorite).filter(
            UserFavorite.user_id == user.id,
            UserFavorite.recipe_id == recipe.id
        ).first()
        if not exists:
            db.add(UserFavorite(user_id=user.id, recipe_id=recipe.id))

    # Historique simulé
    existing_count = db.query(OrderHistory).filter(OrderHistory.user_id == user.id).count()
    if existing_count == 0:
        for recipe_name, days_ago, rating in u_data.get("history", []):
            recipe = recipe_map.get(recipe_name)
            if not recipe:
                continue
            ts = datetime.now(timezone.utc) - timedelta(
                days=days_ago,
                hours=random.randint(18, 23),
                minutes=random.randint(0, 59)
            )
            db.add(OrderHistory(
                user_id=user.id,
                recipe_id=recipe.id,
                timestamp=ts,
                rating=rating,
                comment=None
            ))

    return user


# ── Seed principal ────────────────────────────────────────────────────────────

def seed():
    db = SessionLocal()
    random.seed(42)

    print("\n🌱 BarOS V4 — Démarrage du seed complet...")
    print("=" * 55)

    try:
        print("\n📦 Ingrédients")
        ingredient_map = {}
        for item in INGREDIENTS:
            ing = get_or_create_ingredient(db, item)
            ingredient_map[ing.name] = ing
        db.commit()
        print(f"  ✅ {len(ingredient_map)} ingrédients prêts")

        print("\n🍹 Recettes")
        recipe_map = {}
        for r_data in RECIPES:
            recipe = get_or_create_recipe(db, r_data, ingredient_map)
            recipe_map[recipe.name] = recipe
        db.commit()
        print(f"  ✅ {len(recipe_map)} recettes prêtes")

        print("\n👤 Utilisateurs de test")
        for u_data in TEST_USERS:
            seed_user(db, u_data, recipe_map)
        db.commit()
        print(f"  ✅ {len(TEST_USERS)} utilisateurs prêts")

        print("\n" + "=" * 55)
        print("✅ Seed terminé ! Base de données prête.")
        print("\n📋 Cartes NFC de test :")
        for u in TEST_USERS:
            # ✅ Fix : rôle depuis is_admin, pas depuis l'UID
            role = " 👑 ADMIN" if u.get("is_admin") else ""
            print(f"   {u['card_uid']} → {u['name']}{role}")
        print()

    except Exception as e:
        print(f"\n❌ Erreur seed : {e}")
        import traceback; traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed()