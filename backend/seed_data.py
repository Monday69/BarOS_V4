"""
Script d'initialisation : Ingrédients + Recettes (depuis JSON)
Lancer avec : python -m backend.seed_data
"""
import json
import os
from backend.database import SessionLocal
from backend.models import Ingredient, Recipe, RecipeIngredient

# Liste des ingrédients de base (Sauvegarde au cas où)
INITIAL_INGREDIENTS = [
    {"name": "Vodka", "type": "alcool"},
    {"name": "Rhum Blanc", "type": "alcool"},
    {"name": "Rhum Ambré", "type": "alcool"}, # Ajouté car présent dans tes recettes
    {"name": "Gin", "type": "alcool"},
    {"name": "Tequila", "type": "alcool"},
    {"name": "Whisky", "type": "alcool"},
    {"name": "Jägermeister", "type": "alcool"},
    {"name": "Pastis", "type": "alcool"},
    
    {"name": "Coca-Cola", "type": "diluant"},
    {"name": "Jus d'Orange", "type": "diluant"},
    {"name": "Jus de Citron", "type": "diluant"},
    {"name": "Jus d'Ananas", "type": "diluant"},
    {"name": "Eau", "type": "diluant"},
    {"name": "Eau Gazeuse", "type": "diluant"},
    {"name": "Limonade", "type": "diluant"},
    {"name": "Ginger Beer", "type": "diluant"},
    {"name": "Red Bull", "type": "diluant"},
    {"name": "Lait de Coco", "type": "diluant"},
    
    {"name": "Sirop de Grenadine", "type": "sirop"},
    {"name": "Sirop de Canne", "type": "sirop"},
    {"name": "Sirop de Menthe", "type": "sirop"},
    {"name": "Sirop d'Orgeat", "type": "sirop"},
    
    {"name": "Colorant Cyan", "type": "colorant"},
    {"name": "Colorant Magenta", "type": "colorant"},
    {"name": "Colorant Jaune", "type": "colorant"},
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
    print("🌱 Démarrage du peuplement de la base...")
    
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
                    is_available=True
                )
                db.add(new_ing)
                print(f"  + Créé : {item['name']}")
        db.commit()

        # 2. CRÉATION DES RECETTES (Depuis JSON)
        print("\n--- Recettes ---")
        recipes_data = load_recipes_from_json()
        
        for r_data in recipes_data:
            # Vérifier si la recette existe
            recipe = db.query(Recipe).filter(Recipe.name == r_data["name"]).first()
            if not recipe:
                # Création recette
                recipe = Recipe(
                    name=r_data["name"],
                    image_url=r_data.get("image_url"),
                    price=r_data.get("price", 0.0),
                    is_available=True
                )
                db.add(recipe)
                db.flush() # Pour avoir l'ID tout de suite
                
                # Ajout des liens ingrédients
                for ing_link in r_data["ingredients"]:
                    ing_name = ing_link["name"]
                    # Petits correctifs de noms si nécessaire (ex: "Sirop de sucre de canne" -> "Sirop de Canne")
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
                        print(f"  ⚠️ Ingrédient inconnu '{ing_name}' pour la recette '{recipe.name}'")
                
                print(f"  + Recette ajoutée : {recipe.name}")
            else:
                print(f"  = Existe déjà : {r_data['name']}")

        db.commit()
        print("\n✅ Base de données initialisée avec succès !")

    except Exception as e:
        print(f"❌ Erreur : {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()