"""
BarOS V4 - Router Ingrédients (CORRIGÉ PATCH)
Chemin : backend/routers/ingredients.py
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.models import Ingredient

router = APIRouter()

# --- MODÈLES PYDANTIC ---

class IngredientBase(BaseModel):
    name: str
    type: str
    alcohol_degree: float = 0.0
    pump_id: Optional[int] = None 

# Modèle pour la création (tout est requis)
class IngredientCreate(IngredientBase):
    current_volume_ml: float = 1000.0
    max_volume_ml: float = 1000.0

# Modèle pour la MISE À JOUR (Tout est optionnel)
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
    
    class Config:
        from_attributes = True

# --- ROUTES ---

@router.get("", response_model=List[IngredientResponse])
def read_ingredients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    ingredients = db.query(Ingredient).offset(skip).limit(limit).all()
    return ingredients

@router.post("", response_model=IngredientResponse)
def create_ingredient(ingredient: IngredientCreate, db: Session = Depends(get_db)):
    db_ingredient = Ingredient(**ingredient.dict())
    db.add(db_ingredient)
    db.commit()
    db.refresh(db_ingredient)
    return db_ingredient

# 👇 C'est ici que la magie opère : on utilise IngredientUpdate
@router.put("/{ingredient_id}", response_model=IngredientResponse)
def update_ingredient(ingredient_id: int, ingredient: IngredientUpdate, db: Session = Depends(get_db)):
    db_ing = db.query(Ingredient).filter(Ingredient.id == ingredient_id).first()
    if not db_ing:
        raise HTTPException(status_code=404, detail="Ingrédient introuvable")
    
    # On met à jour seulement les champs envoyés (exclude_unset=True)
    update_data = ingredient.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_ing, key, value)
    
    db.commit()
    db.refresh(db_ing)
    return db_ing