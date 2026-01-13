"""
BarOS V4 - Routes pour la gestion des cocktails
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.database import get_db, Recipe, RecipeStep, Ingredient
from backend.hardware.gpio_manager import gpio_manager
from backend.logic.fluid_physics import FluidPhysics
from backend.logic.color_mixer import ColorMixer
import asyncio

router = APIRouter(tags=["cocktails"])


async def pour_recipe_steps(recipe_id: int, db: Session):
    """
    Fonction de fond pour verser tous les ingrédients d'une recette
    
    Args:
        recipe_id: ID de la recette à préparer
        db: Session de base de données
    """
    # Récupérer la recette et ses étapes
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        print(f"[Cocktails] Recette {recipe_id} non trouvée")
        return
    
    # Récupérer les étapes triées par ordre
    steps = db.query(RecipeStep).filter(
        RecipeStep.recipe_id == recipe_id
    ).order_by(RecipeStep.order).all()
    
    if not steps:
        print(f"[Cocktails] Aucune étape trouvée pour la recette {recipe_id}")
        return
    
    print(f"[Cocktails] Début de la préparation de '{recipe.name}' ({len(steps)} étapes)")
    
    # Pour chaque étape, verser l'ingrédient
    for step in steps:
        # Recharger l'ingrédient depuis la DB pour avoir les volumes à jour
        ingredient = db.query(Ingredient).filter(
            Ingredient.id == step.ingredient_id
        ).first()
        
        if not ingredient:
            print(f"[Cocktails] Ingrédient non trouvé pour l'étape {step.id}")
            continue
        
        if not ingredient.pump_id:
            print(f"[Cocktails] Aucune pompe configurée pour l'ingrédient '{ingredient.name}'")
            continue
        
        # Vérifier que le volume disponible est suffisant
        if ingredient.current_volume_ml < step.volume_ml:
            print(f"[Cocktails] Volume insuffisant pour {ingredient.name}: {ingredient.current_volume_ml}ml disponible, {step.volume_ml}ml demandé")
            continue
        
        # Calculer la durée en utilisant la physique des fluides (Torricelli)
        try:
            duration = FluidPhysics.calculate_pour_duration(
                target_volume_ml=step.volume_ml,
                current_volume_ml=ingredient.current_volume_ml,
                max_volume_ml=ingredient.max_volume_ml
            )
        except ValueError as e:
            print(f"[Cocktails] Erreur de calcul de durée pour {ingredient.name}: {e}")
            continue
        
        print(f"[Cocktails] Versement: {ingredient.name} ({step.volume_ml}ml) via pompe {ingredient.pump_id} pendant {duration:.2f}s (volume restant: {ingredient.current_volume_ml}ml)")
        
        try:
            # Verser l'ingrédient
            await gpio_manager.pour_ingredient(ingredient.pump_id, duration)
            
            # Mettre à jour le volume dans la base de données
            ingredient.current_volume_ml -= step.volume_ml
            # S'assurer que le volume ne devient pas négatif
            if ingredient.current_volume_ml < 0:
                ingredient.current_volume_ml = 0.0
            
            db.commit()
            print(f"[Cocktails] Volume mis à jour pour {ingredient.name}: {ingredient.current_volume_ml}ml restant")
            
        except Exception as e:
            print(f"[Cocktails] Erreur lors du versement de {ingredient.name}: {e}")
            db.rollback()
            # Continuer avec les autres ingrédients même en cas d'erreur
    
    print(f"[Cocktails] Préparation de '{recipe.name}' terminée")

@router.get("/")
def get_recipes(db: Session = Depends(get_db)):
    """Récupère la liste de toutes les recettes disponibles"""
    return db.query(Recipe).all()

@router.post("/pour/{recipe_id}")
async def pour_cocktail(
    recipe_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Lance la préparation d'un cocktail en arrière-plan
    
    Args:
        recipe_id: ID de la recette à préparer
        background_tasks: Tâches de fond FastAPI
        db: Session de base de données
    
    Returns:
        Message de confirmation que la préparation a été lancée
    """
    # Vérifier que la recette existe
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail=f"Recette {recipe_id} non trouvée")
    
    # Vérifier que la recette a des étapes
    steps = db.query(RecipeStep).filter(RecipeStep.recipe_id == recipe_id).count()
    if steps == 0:
        raise HTTPException(
            status_code=400,
            detail=f"La recette '{recipe.name}' n'a aucune étape configurée"
        )
    
    # Ajouter la tâche de versement en arrière-plan
    background_tasks.add_task(pour_recipe_steps, recipe_id, db)
    
    return {
        "message": f"Préparation de '{recipe.name}' lancée",
        "recipe_id": recipe_id,
        "recipe_name": recipe.name,
        "status": "started"
    }


class MixColorRequest(BaseModel):
    """Modèle de requête pour le mélange de couleurs"""
    hex_code: str  # Ex: "#00FF00"
    volume_ml: float


async def pour_color_ingredients(cyan_ml: float, magenta_ml: float, yellow_ml: float, db: Session):
    """
    Fonction de fond pour verser les colorants en parallèle
    
    Args:
        cyan_ml: Volume de cyan à verser
        magenta_ml: Volume de magenta à verser
        yellow_ml: Volume de yellow à verser
        db: Session de base de données
    """
    # Chercher les ingrédients par leur nom
    cyan = db.query(Ingredient).filter(Ingredient.name == "Cyan").first()
    magenta = db.query(Ingredient).filter(Ingredient.name == "Magenta").first()
    yellow = db.query(Ingredient).filter(Ingredient.name == "Yellow").first()
    
    tasks = []
    ingredients_to_update = []
    
    # Préparer les tâches de versement pour chaque colorant
    if cyan_ml > 0:
        if not cyan:
            print("[Cocktails] Ingrédient 'Cyan' non trouvé")
        elif not cyan.pump_id:
            print("[Cocktails] Aucune pompe configurée pour 'Cyan'")
        elif cyan.current_volume_ml < cyan_ml:
            print(f"[Cocktails] Volume insuffisant pour Cyan: {cyan.current_volume_ml}ml disponible, {cyan_ml}ml demandé")
        else:
            try:
                duration = FluidPhysics.calculate_pour_duration(
                    target_volume_ml=cyan_ml,
                    current_volume_ml=cyan.current_volume_ml,
                    max_volume_ml=cyan.max_volume_ml
                )
                tasks.append(gpio_manager.pour_ingredient(cyan.pump_id, duration))
                ingredients_to_update.append((cyan, cyan_ml))
                print(f"[Cocktails] Versement Cyan: {cyan_ml}ml via pompe {cyan.pump_id} pendant {duration:.2f}s")
            except Exception as e:
                print(f"[Cocktails] Erreur de calcul pour Cyan: {e}")
    
    if magenta_ml > 0:
        if not magenta:
            print("[Cocktails] Ingrédient 'Magenta' non trouvé")
        elif not magenta.pump_id:
            print("[Cocktails] Aucune pompe configurée pour 'Magenta'")
        elif magenta.current_volume_ml < magenta_ml:
            print(f"[Cocktails] Volume insuffisant pour Magenta: {magenta.current_volume_ml}ml disponible, {magenta_ml}ml demandé")
        else:
            try:
                duration = FluidPhysics.calculate_pour_duration(
                    target_volume_ml=magenta_ml,
                    current_volume_ml=magenta.current_volume_ml,
                    max_volume_ml=magenta.max_volume_ml
                )
                tasks.append(gpio_manager.pour_ingredient(magenta.pump_id, duration))
                ingredients_to_update.append((magenta, magenta_ml))
                print(f"[Cocktails] Versement Magenta: {magenta_ml}ml via pompe {magenta.pump_id} pendant {duration:.2f}s")
            except Exception as e:
                print(f"[Cocktails] Erreur de calcul pour Magenta: {e}")
    
    if yellow_ml > 0:
        if not yellow:
            print("[Cocktails] Ingrédient 'Yellow' non trouvé")
        elif not yellow.pump_id:
            print("[Cocktails] Aucune pompe configurée pour 'Yellow'")
        elif yellow.current_volume_ml < yellow_ml:
            print(f"[Cocktails] Volume insuffisant pour Yellow: {yellow.current_volume_ml}ml disponible, {yellow_ml}ml demandé")
        else:
            try:
                duration = FluidPhysics.calculate_pour_duration(
                    target_volume_ml=yellow_ml,
                    current_volume_ml=yellow.current_volume_ml,
                    max_volume_ml=yellow.max_volume_ml
                )
                tasks.append(gpio_manager.pour_ingredient(yellow.pump_id, duration))
                ingredients_to_update.append((yellow, yellow_ml))
                print(f"[Cocktails] Versement Yellow: {yellow_ml}ml via pompe {yellow.pump_id} pendant {duration:.2f}s")
            except Exception as e:
                print(f"[Cocktails] Erreur de calcul pour Yellow: {e}")
    
    if not tasks:
        print("[Cocktails] Aucune tâche de versement à exécuter")
        return
    
    # Exécuter tous les versements en parallèle
    print(f"[Cocktails] Début du mélange de couleurs ({len(tasks)} colorants en parallèle)")
    try:
        await asyncio.gather(*tasks)
        
        # Mettre à jour les volumes dans la base de données
        for ingredient, volume_poured in ingredients_to_update:
            ingredient.current_volume_ml -= volume_poured
            if ingredient.current_volume_ml < 0:
                ingredient.current_volume_ml = 0.0
        
        db.commit()
        print("[Cocktails] Mélange de couleurs terminé et volumes mis à jour")
        
    except Exception as e:
        print(f"[Cocktails] Erreur lors du mélange de couleurs: {e}")
        db.rollback()


@router.post("/mix_color")
async def mix_color(
    request: MixColorRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Mélange une couleur en versant les colorants CMY en parallèle
    
    Args:
        request: Requête contenant hex_code et volume_ml
        background_tasks: Tâches de fond FastAPI
        db: Session de base de données
    
    Returns:
        Message de confirmation que le mélange a été lancé
    """
    # Validation du code hexadécimal
    hex_code = request.hex_code.strip().upper()
    if not hex_code.startswith("#"):
        hex_code = "#" + hex_code
    
    if len(hex_code) != 7:
        raise HTTPException(
            status_code=400,
            detail="Le code hexadécimal doit être au format #RRGGBB (ex: #00FF00)"
        )
    
    try:
        # Conversion hex vers RGB
        r = int(hex_code[1:3], 16)
        g = int(hex_code[3:5], 16)
        b = int(hex_code[5:7], 16)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Code hexadécimal invalide"
        )
    
    # Calcul des volumes CMY
    try:
        volumes = ColorMixer.rgb_to_pump_volumes(r, g, b, request.volume_ml)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Vérifier que les ingrédients existent
    cyan = db.query(Ingredient).filter(Ingredient.name == "Cyan").first()
    magenta = db.query(Ingredient).filter(Ingredient.name == "Magenta").first()
    yellow = db.query(Ingredient).filter(Ingredient.name == "Yellow").first()
    
    missing = []
    if volumes["cyan_ml"] > 0 and not cyan:
        missing.append("Cyan")
    if volumes["magenta_ml"] > 0 and not magenta:
        missing.append("Magenta")
    if volumes["yellow_ml"] > 0 and not yellow:
        missing.append("Yellow")
    
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Ingrédients manquants: {', '.join(missing)}"
        )
    
    # Ajouter la tâche de mélange en arrière-plan
    background_tasks.add_task(
        pour_color_ingredients,
        volumes["cyan_ml"],
        volumes["magenta_ml"],
        volumes["yellow_ml"],
        db
    )
    
    return {
        "message": f"Mélange de couleur {hex_code} lancé",
        "hex_code": hex_code,
        "rgb": {"r": r, "g": g, "b": b},
        "volumes": volumes,
        "total_volume_ml": request.volume_ml,
        "status": "started"
    }
    
# --- GESTION DES STOCKS ---

@router.get("/ingredients")
def get_ingredients(db: Session = Depends(get_db)):
    """Récupère l'état de tous les réservoirs"""
    return db.query(Ingredient).all()

@router.put("/ingredients/{ingredient_id}/refill")
def refill_ingredient(ingredient_id: int, db: Session = Depends(get_db)):
    """Remplit une bouteille au maximum"""
    ingredient = db.query(Ingredient).filter(Ingredient.id == ingredient_id).first()
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingrédient introuvable")
    
    ingredient.current_volume_ml = ingredient.max_volume_ml
    db.commit()
    return {"message": f"{ingredient.name} rempli à 100% ({ingredient.max_volume_ml}ml)"}
