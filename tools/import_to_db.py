import json
import sqlite3
import html
import os
import re
import sys

# --- CONFIGURATION DES CHEMINS ---
# On récupère le chemin absolu du dossier racine BarOS_V4
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "baros.db")
JSON_FILE = os.path.join(BASE_DIR, "tools", "cocktails_import.json")

def import_to_baros():
    if not os.path.exists(JSON_FILE):
        print(f"❌ Fichier JSON introuvable à : {JSON_FILE}")
        return

    if not os.path.exists(DB_PATH):
        print(f"❌ Base de données introuvable à : {DB_PATH}")
        print("💡 Lancez le serveur ou le seed_data d'abord pour créer la base.")
        return

    print(f"📂 Base de données : {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Récupérer les ingrédients pour le mapping
    cursor.execute("SELECT id, name FROM ingredients")
    db_ingredients = {name.lower(): idx for idx, name in cursor.fetchall()}
    
    # Tri par longueur décroissante pour le matching regex ("ginger beer" avant "gin")
    sorted_ingredients = sorted(db_ingredients.items(), key=lambda x: len(x[0]), reverse=True)

    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"📖 Traitement de {len(data)} cocktails...\n")

    for item in data:
        name = html.unescape(item['name'])
        desc = html.unescape(item.get('description', ''))
        instr = item.get('instruction', None)
        
        img = item.get('image_url')
        if isinstance(img, dict): img = img.get('@id')

        # --- LOGIQUE DE MISE À JOUR OU INSERTION ---
        cursor.execute("SELECT id FROM recipes WHERE name = ?", (name,))
        existing_recipe = cursor.fetchone()

        if existing_recipe:
            recipe_id = existing_recipe[0]
            print(f"♻️  Mise à jour : {name} (ID: {recipe_id})")
            
            # Update des infos de base
            cursor.execute("""
                UPDATE recipes 
                SET description = ?, image_url = ?, mixing_method = ? 
                WHERE id = ?
            """, (desc, img, instr, recipe_id))
            
            # On vide les anciens ingrédients pour ce cocktail
            cursor.execute("DELETE FROM recipe_ingredients WHERE recipe_id = ?", (recipe_id,))
        else:
            print(f"✨ Nouveau : {name}")
            cursor.execute("""
                INSERT INTO recipes (name, description, image_url, price, is_available, mixing_method, category)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (name, desc, img, 0.0, 1, instr, "Rhum")) # "Rhum" par défaut
            recipe_id = cursor.lastrowid

        # --- MAPPING ET INSERTION DES INGRÉDIENTS ---
        for ing in item['ingredients']:
            raw_text = ing['raw_text'].lower()
            volume = ing['volume_ml']

            if volume <= 0:
                print(f"   🚫 Ignoré (Garniture) : {raw_text}")
                continue

            mapped_id = None
            for db_name, db_id in sorted_ingredients:
                # \b garantit qu'on cherche le mot exact (pas une partie d'un autre mot)
                pattern = r'\b' + re.escape(db_name) + r'\b'
                if re.search(pattern, raw_text):
                    mapped_id = db_id
                    break

            if not mapped_id:
                print(f"   ❓ Ingrédient inconnu : '{ing['raw_text']}'")
                print("      Bouteilles dispo : " + ", ".join([n for n, i in db_ingredients.items()]))
                choice = input(f"   👉 Entre l'ID pour '{ing['raw_text']}' (ou 's' pour passer) : ")
                if choice.isdigit():
                    mapped_id = int(choice)
                else:
                    continue

            # Lier l'ingrédient
            cursor.execute("""
                INSERT INTO recipe_ingredients (recipe_id, ingredient_id, volume_ml)
                VALUES (?, ?, ?)
            """, (recipe_id, mapped_id, volume))
            
        print(f"   ✅ Structure enregistrée.")

    conn.commit()
    conn.close()
    print("\n🚀 BarOS est à jour ! Les modifications ont été appliquées.")

if __name__ == "__main__":
    import_to_baros()