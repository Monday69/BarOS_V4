"""
BarOS V4 - Router Ingrédients
Chemin : backend/routers/ingredients.py

Corrections v2 :
  - ADMIN_SECRET : fallback hardcodé supprimé — si BAROS_ADMIN_SECRET
    n'est pas définie en prod, le serveur refuse de démarrer (fail-fast)
    plutôt que de silencieusement utiliser la clé par défaut du repo.
  - ingredient.dict() déprécié Pydantic v2 → model_dump()
  - SMART_MAPPING et BRAND_MAPPING fusionnés en une seule structure
    INGREDIENT_MAPPING — logique identique, zéro duplication.

Ajout v3 :
  - purchase_price_per_liter dans IngredientUpdate et IngredientResponse.
    Utilisé pour calculer le coût de revient des cocktails (règle de trois).
"""
import os
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, select
from typing import List, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.models import Ingredient, ScannedProduct
from backend.services.barcode_service import BarcodeService

router = APIRouter()

# ── Sécurité ──────────────────────────────────────────────────────────────────
# ✅ Fix : plus de fallback hardcodé.
# Si BAROS_ADMIN_SECRET n'est pas définie, le serveur lève une erreur
# au démarrage plutôt que d'utiliser silencieusement "BarOS_Admin_Secret".
_ADMIN_SECRET = os.getenv("BAROS_ADMIN_SECRET")
if not _ADMIN_SECRET:
    raise RuntimeError(
        "Variable d'environnement BAROS_ADMIN_SECRET non définie. "
        "Ajoutez-la dans votre fichier .env ou votre config système."
    )

async def verify_admin(x_admin_token: str = Header(default=None)):
    if x_admin_token != _ADMIN_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : clé d'administration invalide."
        )

# ── Modèles Pydantic ──────────────────────────────────────────────────────────
class IngredientBase(BaseModel):
    name:           str
    type:           str
    alcohol_degree: float = 0.0
    pump_id:        Optional[int] = None

class IngredientCreate(IngredientBase):
    current_volume_ml: float = 1000.0
    max_volume_ml:     float = 1000.0

class IngredientUpdate(BaseModel):
    name:              Optional[str]   = None
    type:              Optional[str]   = None
    alcohol_degree:    Optional[float] = None
    pump_id:           Optional[int]   = None
    current_volume_ml: Optional[float] = None
    max_volume_ml:     Optional[float] = None
    # ✅ Nouveau : prix d'achat en €/L — stocké indépendamment du format
    # de bouteille (75cl, 1L…). Règle de trois dans _recipe_nutrition :
    # cost = purchase_price_per_liter × volume_ml / 1000
    purchase_price_per_liter: Optional[float] = None
    # Valeurs nutritionnelles saisissables à la main (sans scan de code-barres)
    kcal_per_100ml:    Optional[float] = None
    sugar_g_per_100ml: Optional[float] = None

class IngredientResponse(IngredientBase):
    id:                int
    current_volume_ml: float
    max_volume_ml:     float
    barcode:           Optional[str]   = None
    brand:             Optional[str]   = None
    image_url:         Optional[str]   = None
    kcal_per_100ml:    Optional[float] = None
    sugar_g_per_100ml: Optional[float] = None
    # ✅ Nouveau : retourné dans la réponse pour que Settings.jsx
    # puisse pré-remplir le champ prix dans le modal edit.
    purchase_price_per_liter: Optional[float] = None
    is_available:      bool

    class Config:
        from_attributes = True

# ── CRUD basique ──────────────────────────────────────────────────────────────
@router.get("", response_model=List[IngredientResponse])
def read_ingredients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Ingredient).offset(skip).limit(limit).all()

@router.post("", response_model=IngredientResponse, dependencies=[Depends(verify_admin)])
def create_ingredient(ingredient: IngredientCreate, db: Session = Depends(get_db)):
    # ✅ Fix : model_dump() — ingredient.dict() déprécié Pydantic v2
    db_ing = Ingredient(**ingredient.model_dump())
    db.add(db_ing)
    db.commit()
    db.refresh(db_ing)
    return db_ing

@router.put("/{ingredient_id}", response_model=IngredientResponse, dependencies=[Depends(verify_admin)])
def update_ingredient(
    ingredient_id: int,
    ingredient: IngredientUpdate,
    db: Session = Depends(get_db)
):
    db_ing = db.get(Ingredient, ingredient_id)
    if not db_ing:
        raise HTTPException(status_code=404, detail="Ingrédient introuvable")
    for key, value in ingredient.model_dump(exclude_unset=True).items():
        setattr(db_ing, key, value)
    db.commit()
    db.refresh(db_ing)
    return db_ing

# ── Scanner ───────────────────────────────────────────────────────────────────
@router.post("/{ingredient_id}/scan", dependencies=[Depends(verify_admin)])
async def scan_and_update_ingredient(
    ingredient_id: int,
    barcode: str,
    db: Session = Depends(get_db)
):
    """Associe un ingrédient à un produit réel via son code-barres."""
    db_ing = db.get(Ingredient, ingredient_id)
    if not db_ing:
        raise HTTPException(404, "Ingrédient introuvable")

    scanned = await BarcodeService().scan_product(barcode, db)
    if not scanned:
        raise HTTPException(404, "Code-barres inconnu (OFF & cache local)")

    print(f"🔄 Fusion : {db_ing.name} ← {scanned.brand} ({scanned.name})")

    db_ing.barcode = scanned.barcode

    # Brand : préférer product_name, fallback sur brand, fallback "Inconnu"
    if scanned.name and scanned.name != "Inconnu":
        db_ing.brand = scanned.name
    elif scanned.brand and scanned.brand != "Inconnu":
        db_ing.brand = scanned.brand.split(",")[0].strip()
    else:
        db_ing.brand = "Inconnu"

    db_ing.sugar_g_per_100ml = scanned.sugar_g_per_100ml
    db_ing.kcal_per_100ml    = scanned.kcal_per_100ml

    if scanned.image_url:
        db_ing.image_url = scanned.image_url

    # N'écrase le degré d'alcool que si OFF en a un
    if scanned.alcohol_degree > 0:
        db_ing.alcohol_degree = scanned.alcohol_degree

    # Note : purchase_price_per_liter n'est jamais touché par le scan OFF —
    # OpenFoodFacts ne connaît pas le prix d'achat. Il est saisi manuellement
    # via le champ prix du modal scan (confirmScan appelle un PUT séparé).

    db.commit()
    db.refresh(db_ing)
    return db_ing

# ── Historique intelligent ────────────────────────────────────────────────────
# ✅ Fix : SMART_MAPPING et BRAND_MAPPING fusionnés en une seule structure.
# Les deux faisaient exactement la même chose (keywords + exclude)
# mais étaient définis séparément → logique dupliquée, maintenance double.

INGREDIENT_MAPPING: dict[str, dict] = {
    # ── Alcools ──────────────────────────────────────────────────────────────
    "Rhum": {
        "keywords": ["rhum", "rum", "bacardi", "havana", "charrette", "saint james"],
        "exclude":  ["tequila", "téquila", "vodka", "whisky", "gin", "citron", "pulco"],
    },
    "Rhum Blanc": {
        "keywords": ["rhum blanc", "white rum", "rum blanc", "rhum agricole blanc",
                     "bacardi blanc", "bacardi superior", "charrette blanc",
                     "saint james blanc", "neisson blanc", "clément blanc"],
        "exclude":  ["ambré", "ambre", "vieux", "dark", "gold", "aged",
                     "tequila", "téquila", "citron", "pulco", "cola", "coca"],
    },
    "Rhum Ambré": {
        "keywords": ["rhum ambré", "rhum vieux", "amber rum", "gold rum", "dark rum",
                     "añejo", "captain morgan", "saint james ambré",
                     "havana club", "diplomatico", "zacapa"],
        "exclude":  ["blanc", "white", "blanco", "tequila", "téquila", "citron", "pulco"],
    },
    "Tequila": {
        "keywords": ["tequila", "téquila", "jose cuervo", "patron", "san jose",
                     "camino", "zapata"],
        "exclude":  ["rhum", "whisky", "vodka"],
    },
    "Whisky": {
        "keywords": ["whisky", "whiskey", "bourbon", "scotch", "jack daniel",
                     "label 5", "william peel", "ballantine", "jameson", "glen"],
        "exclude":  ["rhum", "tequila", "vodka"],
    },
    "Vodka": {
        "keywords": ["vodka", "absolut", "smirnoff", "belvedere", "grey goose"],
        "exclude":  ["rhum", "whisky", "tequila", "gin"],
    },
    "Gin": {
        "keywords": ["gin", "tanqueray", "gordon", "bombay", "beefeater", "hendrick"],
        "exclude":  ["rhum", "whisky", "tequila", "vodka", "ginger", "orgeat",
                     "coca", "cola", "sirop", "original", "origine", "virgin"],
    },
    # ── Softs & eaux ─────────────────────────────────────────────────────────
    "Eau": {
        "keywords": ["eau", "cristaline", "evian", "volvic", "vittel",
                     "hepar", "contrex", "water", "aqua"],
        "exclude":  ["gazeuse", "pétillante", "sparkling", "tonic",
                     "cola", "sirop", "aromatisée", "citron", "orange", "jus"],
    },
    "Eau Gazeuse": {
        "keywords": ["perrier", "pellegrino", "badoit", "quezac", "salvetat",
                     "vichy", "gazeuse", "sparkling", "pétillante"],
        "exclude":  ["cola", "sirop", "tonic", "jus", "plate"],
    },
    "Tonic": {
        "keywords": ["tonic", "schweppes", "fever", "tree"],
        "exclude":  ["cola", "eau"],
    },
    "Cola":      {"keywords": ["cola", "coca", "pepsi", "breizh"], "exclude": ["eau", "jus"]},
    "Coca-Cola": {"keywords": ["cola", "coca", "pepsi"],           "exclude": ["eau", "jus"]},
}

_IGNORED_WORDS = frozenset([
    "le", "la", "les", "de", "du", "des", "d", "l", "un", "une",
    "jus", "sirop", "crème", "liqueur", "a", "au", "aux",
    "gout", "saveur", "boisson", "soda", "soft",
    "bio", "pur", "naturel", "artisanal",
])


def _get_mapping(ingredient_name: str) -> dict | None:
    clean = ingredient_name.strip().lower()
    return next(
        (v for k, v in INGREDIENT_MAPPING.items() if k.lower() == clean),
        None
    )


@router.get("/{ingredient_id}/history", dependencies=[Depends(verify_admin)])
def get_ingredient_history(ingredient_id: int, db: Session = Depends(get_db)):
    db_ing = db.get(Ingredient, ingredient_id)
    if not db_ing:
        raise HTTPException(status_code=404, detail="Ingrédient introuvable")

    mapping      = _get_mapping(db_ing.name)
    exclude_words: list[str] = []

    if mapping:
        keywords      = mapping["keywords"]
        exclude_words = mapping.get("exclude", [])
    else:
        # Fallback automatique : tokenise le nom de l'ingrédient
        raw_tokens = db_ing.name.replace("'", " ").replace("-", " ").lower().split()
        keywords   = [t for t in raw_tokens if len(t) > 1 and t not in _IGNORED_WORDS]

    # Aucun keyword → retourner vide plutôt que toute la DB
    if not keywords:
        return []

    # Filtre alcool / soft
    query = db.query(ScannedProduct)
    is_alcohol = bool(db_ing.alcohol_degree and db_ing.alcohol_degree > 0)
    if not is_alcohol:
        query = query.filter(
            or_(
                ScannedProduct.alcohol_degree.is_(None),
                ScannedProduct.alcohol_degree < 1.0,
            )
        )

    # Filtre keywords (brand ou name contient au moins un keyword)
    conditions = [
        cond
        for word in keywords
        for cond in (
            ScannedProduct.brand.ilike(f"%{word}%"),
            ScannedProduct.name.ilike(f"%{word}%"),
        )
    ]
    query = query.filter(or_(*conditions))

    candidates = query.order_by(ScannedProduct.last_scanned_at.desc()).all()

    # Dédoublonnage + filtre exclude côté Python (NULL-safe)
    history: list[ScannedProduct] = []
    seen: set[str] = set()

    for product in candidates:
        # Filtre exclude
        if exclude_words:
            searchable = f"{product.brand or ''} {product.name or ''}".lower()
            if any(ex.lower() in searchable for ex in exclude_words):
                continue

        # Clé de dédoublonnage : brand principal → name → barcode (jamais NULL)
        if product.brand:
            key = product.brand.split(",")[0].strip().lower()
        elif product.name:
            key = product.name.strip().lower()
        else:
            key = product.barcode

        if key not in seen:
            seen.add(key)
            history.append(product)

        if len(history) >= 10:
            break

    return history