"""
Script d'initialisation : Ingrédients + Recettes (Version Nutrition)
Lancer avec : python -m backend.seed_data
"""
import json
import os
from backend.database import SessionLocal
from backend.models import Ingredient, Recipe, RecipeIngredient

# Liste enrichie avec DATA NUTRITIONNELLE (Moyennes approximatives)
INITIAL_INGREDIENTS = [
    # ALCOOLS
    {"name": "Vodka", "type": "alcool", "alc": 40.0, "sugar": 0.0, "kcal": 231.0, "brand": "Absolut"},
    {"name": "Rhum Blanc", "type": "alcool", "alc": 37.5, "sugar": 0.0, "kcal": 220.0, "brand": "Havana Club"},
    {"name": "Rhum Ambré", "type": "alcool", "alc": 40.0, "sugar": 0.5, "kcal": 230.0, "brand": "Captain Morgan"},
    {"name": "Gin", "type": "alcool", "alc": 40.0, "sugar": 0.0, "kcal": 260.0, "brand": "Bombay Sapphire"},
    {"name": "Tequila", "type": "alcool", "alc": 38.0, "sugar": 0.0, "kcal": 210.0, "brand": "Jose Cuervo"},
    {"name": "Whisky", "type": "alcool", "alc": 40.0, "sugar": 0.0, "kcal": 250.0, "brand": "Jack Daniels"},
    {"name": "Jägermeister", "type": "alcool", "alc": 35.0, "sugar": 11.0, "kcal": 250.0, "brand": "Jägermeister"},
    {"name": "Pastis", "type": "alcool", "alc": 45.0, "sugar": 3.0, "kcal": 275.0, "brand": "Ricard"},
    
    # DILUANTS (SOFT)
    {"name": "Coca-Cola", "type": "diluant", "alc": 0.0, "sugar": 10.6, "kcal": 42.0, "brand": "Coca-Cola"},
    {"name": "Jus d'Orange", "type": "diluant", "alc": 0.0, "sugar": 9.0, "kcal": 45.0, "brand": "Tropicana"},
    {"name": "Jus de Citron", "type": "diluant", "alc": 0.0, "sugar": 2.5, "kcal": 29.0, "brand": "Pulco"},
    {"name": "Jus d'Ananas", "type": "diluant", "alc": 0.0, "sugar": 13.0, "kcal": 53.0, "brand": "Joker"},
    {"name": "Eau", "type": "diluant", "alc": 0.0, "sugar": 0.0, "kcal": 0.0, "brand": "Cristaline"},
    {"name": "Eau Gazeuse", "type": "diluant", "alc": 0.0, "sugar": 0.0, "kcal": 0.0, "brand": "Perrier"},
    {"name": "Limonade", "type": "diluant", "alc": 0.0, "sugar": 8.0, "kcal": 35.0, "brand": "Sprite"},
    {"name": "Ginger Beer", "type": "diluant", "alc": 0.0, "sugar": 13.0, "kcal": 55.0, "brand": "Fever Tree"},
    {"name": "Red Bull", "type": "diluant", "alc": 0.0, "sugar": 11.0, "kcal": 46.0, "brand": "Red Bull"},
    {"name": "Lait de Coco", "type": "diluant", "alc": 0.0, "sugar": 3.0, "kcal": 180.0, "brand": "Suzy Wan"},
    
    # SIROPS
    {"name": "Sirop de Grenadine", "type": "sirop", "alc": 0.0, "sugar": 78.0, "kcal": 320.0, "brand": "Monin"},
    {"name": "Sirop de Canne", "type": "sirop", "alc": 0.0, "sugar": 85.0, "kcal": 340.0, "brand": "Canadou"},
    {"name": "Sirop de Menthe", "type": "sirop", "alc": 0.0, "sugar": 75.0, "kcal": 300.0, "brand": "Teisseire"},
    {"name": "Sirop d'Orgeat", "type": "sirop", "alc": 0.0, "sugar": 80.0, "kcal": 330.0, "brand": "Monin"},
    
    # COLORANTS
    {"name": "Colorant Cyan", "type": "colorant", "alc": 0.0, "sugar": 0.0, "kcal": 0.0},
    {"name": "Colorant Magenta", "type": "colorant", "alc": 0.0, "sugar": 0.0, "kcal": 0.0},
    {"name": "Colorant Jaune", "type": "colorant", "alc": 0.0, "sugar": 0.0, "kcal": 0.0},
]

def load_recipes_from_json():
    json_path = os.path.join(os.path.dirname(__file__), "recipes.json")
    if not os.path.exists(json_path):
        print("⚠️ Fichier recipes.json introuvable.")
        return []
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)

def seed():
    db = SessionLocal()
    print("🌱 Démarrage du peuplement Nutritionnel...")
    
    try:
        # 1. CRÉATION DES INGRÉDIENTS
        print("--- Ingrédients ---")
        for item in INITIAL_INGREDIENTS:
            ing = db.query(Ingredient).filter(Ingredient.name == item["name"]).first()
            if not ing:
                new_ing = Ingredient(
                    name=item["name"], 
                    type=item["type"],
                    current_volume_ml=1000.0,
                    is_available=True,
                    # NOUVEAUX CHAMPS
                    brand=item.get("brand"),
                    alcohol_degree=item.get("alc", 0.0),
                    sugar_g_per_100ml=item.get("sugar", 0.0),
                    kcal_per_100ml=item.get("kcal", 0.0)
                )
                db.add(new_ing)
                print(f"  + Créé : {item['name']} ({item.get('kcal',0)} kcal/100ml)")
        db.commit()

        # 2. CRÉATION DES RECETTES
        print("\n--- Recettes ---")
        recipes_data = load_recipes_from_json()
        
        for r_data in recipes_data:
            recipe = db.query(Recipe).filter(Recipe.name == r_data["name"]).first()
            if not recipe:
                recipe = Recipe(
                    name=r_data["name"],
                    image_url=r_data.get("image_url"),
                    price=r_data.get("price", 0.0),
                    is_available=True
                )
                db.add(recipe)
                db.flush()
                
                for ing_link in r_data["ingredients"]:
                    ing_name = ing_link["name"]
                    if ing_name == "Sirop de Sucre de Canne": ing_name = "Sirop de Canne"

                    ing_db = db.query(Ingredient).filter(Ingredient.name == ing_name).first()
                    if ing_db:
                        ri = RecipeIngredient(
                            recipe_id=recipe.id,
                            ingredient_id=ing_db.id,
                            volume_ml=ing_link["volume"]
                        )
                        db.add(ri)
                    else:
                        print(f"  ⚠️ Ingrédient inconnu '{ing_name}'")
                
                print(f"  + Recette : {recipe.name}")
            else:
                print(f"  = Existe : {r_data['name']}")

        db.commit()
        print("\n✅ Base de données V5 (Nutrition) prête !")

    except Exception as e:
        print(f"❌ Erreur : {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()