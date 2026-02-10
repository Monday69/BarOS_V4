"""
BarOS V4 - Router Ingrédients (SÉCURISÉ + SCANNER CACHE)
Chemin : backend/routers/ingredients.py
"""
import os
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy import or_

from backend.database import get_db
from backend.models import Ingredient
from backend.services.barcode_service import BarcodeService
from backend.models import Ingredient, ScannedProduct

router = APIRouter()

# --- SÉCURITÉ ---
ADMIN_SECRET = os.getenv("BAROS_ADMIN_SECRET", "BarOS_Admin_Secret")

async def verify_admin(x_admin_token: str = Header(default=None)):
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="⛔ Accès Refusé : Clé d'administration invalide."
        )

# --- MODÈLES PYDANTIC ---
class IngredientBase(BaseModel):
    name: str
    type: str
    alcohol_degree: float = 0.0
    pump_id: Optional[int] = None 

class IngredientCreate(IngredientBase):
    current_volume_ml: float = 1000.0
    max_volume_ml: float = 1000.0

class IngredientUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    alcohol_degree: Optional[float] = None
    pump_id: Optional[int] = None
    current_volume_ml: Optional[float] = None
    max_volume_ml: Optional[float] = None

class IngredientResponse(IngredientBase):
    id: int
    current_volume_ml: float
    max_volume_ml: float
    barcode: Optional[str] = None
    brand: Optional[str] = None
    
    class Config:
        from_attributes = True

# --- ROUTES ---

@router.get("", response_model=List[IngredientResponse])
def read_ingredients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    ingredients = db.query(Ingredient).offset(skip).limit(limit).all()
    return ingredients

@router.post("", response_model=IngredientResponse, dependencies=[Depends(verify_admin)])
def create_ingredient(ingredient: IngredientCreate, db: Session = Depends(get_db)):
    db_ingredient = Ingredient(**ingredient.dict())
    db.add(db_ingredient)
    db.commit()
    db.refresh(db_ingredient)
    return db_ingredient

@router.put("/{ingredient_id}", response_model=IngredientResponse, dependencies=[Depends(verify_admin)])
def update_ingredient(ingredient_id: int, ingredient: IngredientUpdate, db: Session = Depends(get_db)):
    db_ing = db.query(Ingredient).filter(Ingredient.id == ingredient_id).first()
    if not db_ing:
        raise HTTPException(status_code=404, detail="Ingrédient introuvable")
    
    update_data = ingredient.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_ing, key, value)
    
    db.commit()
    db.refresh(db_ing)
    return db_ing

# 👇 LA ROUTE SCANNER (ADAPTÉE À TON SERVICE)
@router.post("/{ingredient_id}/scan", dependencies=[Depends(verify_admin)])
async def scan_and_update_ingredient(
    ingredient_id: int, 
    barcode: str, 
    db: Session = Depends(get_db)
):
    """
    Associe un ingrédient existant à un produit réel via son Code-Barres.
    Utilise le cache local ou OpenFoodFacts.
    """
    # 1. Trouver l'ingrédient cible
    db_ing = db.query(Ingredient).filter(Ingredient.id == ingredient_id).first()
    if not db_ing:
        raise HTTPException(404, "Ingrédient introuvable")

    # 2. Appeler le service (qui gère le cache DB)
    service = BarcodeService()
    # ✅ On passe 'db' car ton service en a besoin pour le cache
    scanned_product = await service.scan_product(barcode, db)
    
    if not scanned_product:
        raise HTTPException(404, "Code-barres inconnu (OFF & Local)")

    # 3. Mise à jour de l'ingrédient avec les données du scan
    print(f"🔄 Fusion : {db_ing.name} <== {scanned_product.brand} ({scanned_product.name})")
    
    db_ing.barcode = scanned_product.barcode

    # 👇 MODIFICATION ICI : LOGIQUE INTELLIGENTE POUR LE NOM 👇
    # Si on a un nom précis (ex: "Coca-Cola Zéro"), on l'utilise
    if scanned_product.name and scanned_product.name != "Inconnu":
        db_ing.brand = scanned_product.name
    # Sinon, on prend la marque, mais on nettoie tout ce qui est après la virgule
    elif scanned_product.brand:
        db_ing.brand = scanned_product.brand.split(',')[0].strip()
    else:
        db_ing.brand = "Inconnu"
    # 👆 FIN MODIFICATION 👆
    
    # Mise à jour nutritionnelle
    db_ing.sugar_g_per_100ml = scanned_product.sugar_g_per_100ml
    db_ing.kcal_per_100ml = scanned_product.kcal_per_100ml
    
    # Mise à jour image (si dispo)
    if scanned_product.image_url:
        db_ing.image_url = scanned_product.image_url
    
    # Mise à jour alcool (si pertinent)
    if scanned_product.alcohol_degree > 0:
        db_ing.alcohol_degree = scanned_product.alcohol_degree

    db.commit()
    db.refresh(db_ing)
    
    return db_ing

@router.get("/{ingredient_id}/history", dependencies=[Depends(verify_admin)])
def get_ingredient_history(ingredient_id: int, db: Session = Depends(get_db)):
    """
    Retourne un historique INTELLIGENT (V3 - Avec Marques Forcées)
    """
    # 1. On récupère l'ingrédient
    current_ing = db.query(Ingredient).filter(Ingredient.id == ingredient_id).first()
    if not current_ing:
        raise HTTPException(404, "Ingrédient introuvable")

    query = db.query(ScannedProduct)

    # --- FILTRE 1 : SÉCURITÉ ALCOOL ---
    if current_ing.alcohol_degree > 0:
        query = query.filter(ScannedProduct.alcohol_degree > 0)
    else:
        query = query.filter(ScannedProduct.alcohol_degree < 1)

    # --- FILTRE 2 : MOTS-CLÉS OU MARQUES FORCÉES ---
    
    # 👇 LE COUP DE POUCE MANUEL (Mapping) 👇
    # Ici, tu peux définir des marques précises pour tes ingrédients génériques
    BRAND_MAPPING = {
        "Eau Gazeuse": ["Perrier", "Pellegrino", "Badoit", "Quezac", "Salvetat", "Vichy"],
        "Tonic": ["Schweppes", "Fever", "Tree"],
        "Cola": ["Coca", "Pepsi", "Breizh"],
        # Tu peux en ajouter d'autres si besoin
    }

    # On nettoie le nom pour être sûr (ex: "Eau-Gazeuse" -> "Eau Gazeuse")
    clean_name_key = current_ing.name.replace("-", " ").strip()

    smart_keywords = []

    # CAS A : On a une liste de marques forcées pour cet ingrédient
    if clean_name_key in BRAND_MAPPING:
        smart_keywords = BRAND_MAPPING[clean_name_key]
        print(f"✨ Mode Marques Forcées pour '{current_ing.name}' : {smart_keywords}")
    
    # CAS B : Sinon, on fait la méthode automatique (découpage des mots)
    else:
        clean_name = current_ing.name.replace("'", " ").replace("-", " ")
        raw_keywords = clean_name.split()
        ignored_words = [
            "le", "la", "les", "de", "du", "des", "d", "l", "un", "une", 
            "jus", "sirop", "crème", "liqueur", "a", "au", "aux", "gout", "saveur",
            "eau", "boisson", "soda", "soft", "gazeuse" # J'ai ajouté gazeuse ici pour éviter le coca
        ]
        smart_keywords = [
            k for k in raw_keywords 
            if len(k) > 1 and k.lower() not in ignored_words
        ]

    # --- APPLICATION DE LA RECHERCHE ---
    if smart_keywords:
        conditions = []
        for word in smart_keywords:
            conditions.append(ScannedProduct.brand.ilike(f"%{word}%"))
            conditions.append(ScannedProduct.name.ilike(f"%{word}%"))
        
        query = query.filter(or_(*conditions))

    # On trie par le plus récemment scanné
    history = query.order_by(ScannedProduct.last_scanned_at.desc()).limit(10).all()

    return history