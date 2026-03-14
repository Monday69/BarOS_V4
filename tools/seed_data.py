"""
BarOS V4 - Seed Data Minimaliste
Chemin : toolsd_data.py
Lancer avec : python -m backend.seed_data

Rôle : fondation uniquement.
  - Ingrédients génériques (coquilles vides) → valeurs réelles au scan bouteille
  - Utilisateurs de test avec solde prêt à l'emploi
  - Zéro recette hardcodée → tout vient du scraper
"""
from backend.database import SessionLocal
from backend.models   import Ingredient, User

INGREDIENTS = [
    # --- ALCOOLS ---
    {"name": "Vodka",               "type": "alcool"},
    {"name": "Rhum Blanc",          "type": "alcool"},
    {"name": "Rhum Ambré",          "type": "alcool"},
    {"name": "Gin",                 "type": "alcool"},
    {"name": "Tequila",             "type": "alcool"},
    {"name": "Amer Italien",        "type": "alcool"}, 
    {"name": "Liqueur d'Abricot",   "type": "alcool"},
    {"name": "Curaçao Orange",      "type": "alcool"},
    {"name": "Prosecco",            "type": "alcool"},
    {"name": "Jägermeister",        "type": "alcool"},
    {"name": "Cidre brut",          "type": "alcool"},

    
    # --- DILUANTS / JUS ---
    {"name": "Coca-Cola",           "type": "diluant"},
    {"name": "Limonade",            "type": "diluant"},
    {"name": "Ginger Beer",         "type": "diluant"},
    {"name": "Eau Gazeuse",         "type": "diluant"},
    {"name": "Jus d'Orange",        "type": "diluant"},
    {"name": "Jus de Citron Vert",  "type": "diluant"},
    {"name": "Jus de Citron Jaune", "type": "diluant"},
    {"name": "Jus d'Ananas",        "type": "diluant"},
    {"name": "Jus de framboise",    "type": "diluant"},

    {"name": "Nectar de Goyave",    "type": "diluant"},
    {"name": "Nectar de Mangue",    "type": "diluant"},
    {"name": "Nectar de Maracujà",  "type": "diluant"}, 
    {"name": "Nectar de Fraise",    "type": "diluant"},
    {"name": "Crème de Coco",       "type": "diluant"},
    {"name": "Pétillant sans alcool", "type": "diluant"},
    {"name": "Caraïbos Mojito",     "type": "diluant"},
    {"name": "Caraïbos Planteur des îles", "type": "diluant"},
    
    # --- SIROPS / BITTERS ---
    {"name": "Sirop de Grenadine",   "type": "sirop"},
    {"name": "Sirop de Canne",      "type": "sirop"},
    {"name": "Sirop d'Orgeat",      "type": "sirop"},
    {"name": "Sirop de Falernum",   "type": "sirop"},
    {"name": "Bitter Angostura",    "type": "sirop"}, 
    {"name": "Bitter sans alcool",  "type": "sirop"}, 
    {"name": "Sucre de canne",      "type": "sirop"}, 

]

TEST_USERS = [
    {"card_uid": "A1B2C3D4", "name": "Alex Martin",  "is_admin": False, "balance": 25.0, "gender": "M", "weight_kg": 78.0, "age": 22},
    {"card_uid": "F4E3D2C1", "name": "Léa Dubois",   "is_admin": False, "balance": 15.0, "gender": "F", "weight_kg": 58.0, "age": 20},
    {"card_uid": "99887766", "name": "Tom Girard",    "is_admin": False, "balance": 30.0, "gender": "M", "weight_kg": 90.0, "age": 25},
    {"card_uid": "BAROS2024","name": "Admin BarOS",   "is_admin": True,  "balance": 50.0, "gender": "O", "weight_kg": 75.0, "age": 30},
]


def seed():
    db = SessionLocal()
    print("\n🌱 BarOS V4 — Initialisation minimale...")
    print("=" * 60)
    try:
        print("\n📦 Ingrédients...")
        created = 0
        for item in INGREDIENTS:
            if not db.query(Ingredient).filter(Ingredient.name == item["name"]).first():
                db.add(Ingredient(
                    name              = item["name"],
                    type              = item["type"],
                    current_volume_ml = 0.0,
                    max_volume_ml     = 1000.0,
                    is_available      = False,  # activé au scan physique
                ))
                created += 1
                print(f"  + {item['name']}")
        print(f"  ✅ {created} créés")

        print("\n👤 Utilisateurs...")
        for u in TEST_USERS:
            if not db.query(User).filter(User.card_uid == u["card_uid"]).first():
                db.add(User(
                    card_uid  = u["card_uid"],
                    name      = u["name"],
                    gender    = u["gender"],
                    weight_kg = u["weight_kg"],
                    age       = u["age"],
                    is_admin  = u["is_admin"],
                    balance   = u["balance"],
                ))
                role = " 👑" if u["is_admin"] else ""
                print(f"  + {u['name']}{role}  {u['balance']}€  NFC: {u['card_uid']}")

        db.commit()
        print("\n✅ Base prête !")
        print("\n📌 Suite :")
        print("   python tools/scraper.py")
        print("   python -m backend.scripts.import_cocktails --real")
        print("   → Scanne tes bouteilles dans l'UI pour renseigner alc/kcal/prix")

    except Exception as e:
        print(f"\n❌ Erreur : {e}")
        import traceback; traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()