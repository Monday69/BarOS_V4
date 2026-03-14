"""
BarOS V4 - Import cocktails scrappés
Chemin : backend/scripts/import_cocktails.py

Dry-run (test) : python -m backend.scripts.import_cocktails
Mode réel      : python -m backend.scripts.import_cocktails --real

Workflow :
  1. Lance le scraper  → génère tools/cocktails_import.json
  2. Dry-run           → liste les ingrédients inconnus
  3. Complète INGREDIENT_MAPPING ci-dessous jusqu'à 0 ignorés
  4. Mode réel         → insère en base
"""
import json, html, sys, os
from sqlalchemy import func
from backend.database import SessionLocal
from backend.models   import Recipe, RecipeIngredient, Ingredient

# ── Mapping texte scraper → nom exact en base ─────────────────────────────────
# Clé   = texte brut du scraper (lowercase, partiel OK)
# Valeur = nom exact de l'Ingredient en base, ou None pour ignorer (solides)
# ── Mapping texte scraper → nom exact en base ─────────────────────────────────
INGREDIENT_MAPPING = {
    # --- ALCOOLS (Vers tes 8 alcools de base) ---
    "vodka": "Vodka",
    "rhum blanc": "Rhum Blanc",
    "rhum ambré": "Rhum Ambré",
    "rhum ambre": "Rhum Ambré",
    "rhum de jamaïque": "Rhum Ambré",
    "gin": "Gin",
    "tequila": "Tequila",
    "whisky": "Whisky",
    "whiskey": "Whisky",
    "bourbon": "Whisky",
    "jägermeister": "Jägermeister",
    "pastis": "Pastis",
    "cognac": "Whisky",          # Secours : Cognac -> Whisky
    "porto": "Whisky",           # Secours
    "amaretto": "Whisky",        # Secours
    "advocaat": "Lait de Coco",  # Secours
    "liqueur de café": "Vodka",  # Secours
    "liqueur d&rsquo;abricot": "Jus d'Orange",
    "liqueur ananas coco": "Lait de Coco",
    "liqueur de gentiane": "Pastis",
    "shrubb": "Rhum Blanc",
    "champagne": "Eau Gazeuse",
    "clairette": "Eau Gazeuse",
    "prosecco": "Eau Gazeuse",
    "aperitivo": "Pastis",
    "amer italien": "Pastis",

    # --- DILUANTS ---
    "coca": "Coca-Cola",
    "cola": "Coca-Cola",
    "jus d'orange": "Jus d'Orange",
    "jus d orange": "Jus d'Orange",
    "jus de citron": "Jus de Citron",
    "caraïbos mojito": "Jus de Citron",
    "citron pressé": "Jus de Citron",
    "jus d'ananas": "Jus d'Ananas",
    "jus d ananas": "Jus d'Ananas",
    "nectar de mangue": "Jus d'Ananas", # Secours (Tropical)
    "nectar de goyave": "Jus d'Ananas",  # Secours
    "nectar de maracujà": "Jus d'Ananas", # Secours
    "planteur des îles": "Jus d'Ananas",
    "ginger beer": "Ginger Beer",
    "eau gazeuse": "Eau Gazeuse",
    "eau pétillante": "Eau Gazeuse",
    "eau": "Eau",
    "café": "Eau", # Si tu n'as pas de café en pompe
    "expresso": "Eau",
    "lait": "Eau",
    "limonade": "Limonade",
    "sprite": "Limonade",
    "cidre": "Limonade",
    "pétillant sans alcool": "Limonade",
    "bitter sans alcool": "Limonade",
    "red bull": "Red Bull",
    "lait de coco": "Lait de Coco",
    "crème de coco": "Lait de Coco",
    "crème fraiche": "Lait de Coco",

    # --- SIROPS ---
    "sirop de grenadine": "Sirop de Grenadine",
    "grenadine": "Sirop de Grenadine",
    "sirop de canne": "Sirop de Canne",
    "sucre de canne": "Sirop de Canne",
    "sirop de vanille": "Sirop de Canne",
    "sirop de miel": "Sirop de Canne",
    "sirop de café": "Sirop de Canne",
    "sirop de falernum": "Sirop de Canne",
    "sirop de menthe": "Sirop de Menthe",
    "sirop d'orgeat": "Sirop d'Orgeat",
    "orgeat": "Sirop d'Orgeat",

    # --- SOLIDES & ÉPICES (Ignorés pour la machine) ---
    "menthe": None,
    "citron vert": None,
    "orange": None,
    "ananas": None,
    "oeuf": None,
    "œuf": None,
    "blanc d&rsquo;œuf": None,
    "glaçons": None,
    "glace": None,
    "sel": None,
    "sucre": None,
    "cannelle": None,
    "noix de muscade": None,
    "clou de girofle": None,
    "gingembre": None,
    "anis étoilé": None,
    "vanille": None,
    "curcuma": None,
    "bitter angostura": None,
    "zeste": None,
    "rondelle": None,
    "chantilly": None,
    "cacao": None,
}

def resolve_ingredient(raw_text: str):
    """
    Résout un texte brut du scraper en nom d'ingrédient base.
    Retourne None si c'est un solide à ignorer.
    Lève ValueError si inconnu → à ajouter dans INGREDIENT_MAPPING.
    """
    text = raw_text.lower().strip()
    # Recherche exacte
    if text in INGREDIENT_MAPPING:
        return INGREDIENT_MAPPING[text]
    # Recherche partielle (ex: "4 cl de vodka" contient "vodka")
    for key, value in INGREDIENT_MAPPING.items():
        if key in text:
            return value
    raise ValueError(text)


def upsert_recipe(db, name: str, raw_data: dict, steps: list):
    """Insère ou met à jour une recette (upsert par nom)."""
    img = raw_data.get("image_url")
    if isinstance(img, dict):
        img = img.get("@id")

    recipe = db.query(Recipe).filter(
        func.lower(Recipe.name) == name.strip().lower()
    ).first()

    is_new = not recipe
    if is_new:
        recipe = Recipe(name=name.strip())
        db.add(recipe)

    recipe.description  = html.unescape(raw_data.get("description", "")) if raw_data.get("description") else None
    recipe.image_url    = img
    recipe.category     = "Import Scraper"
    recipe.is_available = True
    # Prix non écrasé si la recette existe déjà (prix saisi manuellement préservé)
    if is_new:
        recipe.price = 0.0  # sera calculé automatiquement par le backend via coût ingrédients

    db.flush()

    # Nettoyage des ingrédients existants avant réinsertion
    db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe.id).delete()

    for i, step in enumerate(steps):
        ing = db.query(Ingredient).filter(Ingredient.name == step["name"]).first()
        if ing:
            db.add(RecipeIngredient(
                recipe_id     = recipe.id,
                ingredient_id = ing.id,
                volume_ml     = step["volume_ml"],
                order         = i,
            ))

    return is_new


def run_import(json_path: str, dry_run: bool = True):
    if not os.path.exists(json_path):
        print(f"❌ Fichier introuvable : {json_path}")
        print("   Lance d'abord : python tools/scraper.py")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        cocktails = json.load(f)

    print(f"\n🚀 IMPORTATION {'(DRY-RUN — rien ne sera écrit)' if dry_run else '(MODE RÉEL)'}")
    print("=" * 60)
    print(f"   {len(cocktails)} cocktails dans le fichier\n")

    db = SessionLocal()
    stats = {"new": 0, "updated": 0, "skipped": 0, "unknowns": set()}

    for item in cocktails:
        clean_name = html.unescape(item.get("name", "")).strip()
        if not clean_name:
            continue

        steps    = []
        is_valid = True

        for ing in item.get("ingredients", []):
            raw = ing.get("raw_text", "")
            try:
                resolved = resolve_ingredient(raw)
                if resolved is not None and ing.get("volume_ml", 0) > 0:
                    steps.append({"name": resolved, "volume_ml": ing["volume_ml"]})
            except ValueError as e:
                stats["unknowns"].add(str(e))
                is_valid = False

        if not steps:
            # Aucun ingrédient liquide reconnu → on ignore
            stats["skipped"] += 1
            print(f"  ⚠️  Ignoré (aucun ingrédient liquide) : {clean_name}")
            continue

        if is_valid:
            if not dry_run:
                is_new = upsert_recipe(db, clean_name, item, steps)
                if is_new:
                    stats["new"] += 1
                else:
                    stats["updated"] += 1
            else:
                stats["new"] += 1
            print(f"  ✅ {clean_name}  ({len(steps)} ingrédients)")
        else:
            stats["skipped"] += 1
            print(f"  ❌ Sauté (inconnus) : {clean_name}")

    if not dry_run:
        db.commit()
    db.close()

    print("\n" + "=" * 60)
    print("📊 RÉSULTAT :")
    if dry_run:
        print(f"   ✅ Seraient importés : {stats['new']}")
    else:
        print(f"   ✅ Nouveaux          : {stats['new']}")
        print(f"   🔄 Mis à jour        : {stats['updated']}")
    print(f"   ❌ Ignorés           : {stats['skipped']}")

    if stats["unknowns"]:
        print("\n⚠️  INGRÉDIENTS INCONNUS à ajouter dans INGREDIENT_MAPPING :")
        for u in sorted(stats["unknowns"]):
            print(f'    "{u}": "???",')
        print("\n   Corrige le mapping puis relance le dry-run.")
    elif dry_run:
        print("\n✅ 0 inconnu — lance le mode réel :")
        print("   python -m backend.scripts.import_cocktails --real")


if __name__ == "__main__":
    json_file_path = "tools/cocktails_import.json"
    run_import(json_file_path, dry_run="--real" not in sys.argv)