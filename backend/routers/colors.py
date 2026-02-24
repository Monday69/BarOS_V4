"""
BarOS V4 - Router Couleurs
Chemin : backend/routers/colors.py

Endpoint POST /mix :
  - Reçoit une couleur HEX + un volume total en ml
  - Convertit HEX → RGB → CMJ (cyan, magenta, jaune)
  - Calcule les volumes de chaque colorant à pomper
  - Lance la séquence via les pompes assignées aux colorants
  - Retourne les volumes calculés + la couleur réellement produite

Logique CMJ :
  Le mélange soustractif CMJ (impression) est utilisé.
  Blanc = 0 colorant, Noir = 100% des 3 colorants.
  La saturation est le max des 3 composantes CMJ.
  Si saturation < seuil minimum, on complète avec de l'eau.
"""
import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from backend.database import get_db, SessionLocal
from backend.models import Ingredient, PourSequence, PourStep
from backend.services.cocktail_service import CocktailService

router = APIRouter(tags=["colors"])

cocktail_service = CocktailService()

# ── Noms attendus en base pour les colorants ──────────────────────────────────
COLORANT_NAMES = {
    "cyan":    "Colorant Cyan",
    "magenta": "Colorant Magenta",
    "yellow":  "Colorant Jaune",
    "water":   "Eau",
}

MIN_VOLUME_ML = 2.0   # volume minimum pompé par couleur (évite les micro-doses)
MIN_SATURATION = 0.05 # en dessous, on considère la couleur comme "blanche" → eau seule


# ── Background task ───────────────────────────────────────────────────────────

async def execute_color_background(sequence_id: int):
    db = SessionLocal()
    try:
        await cocktail_service.execute_sequence(sequence_id, db)
    except Exception as e:
        print(f"🎨 ERREUR séquence couleur #{sequence_id}: {e}")
    finally:
        db.close()


# ── Modèles Pydantic ──────────────────────────────────────────────────────────

class ColorMixRequest(BaseModel):
    hex_code:  str        # ex: "#FF5500" ou "FF5500"
    volume_ml: int = 100  # volume total à produire


class ColorMixResponse(BaseModel):
    status:         str
    sequence_id:    Optional[int]  = None
    estimated_time: Optional[float] = None
    rgb_requested:  list[int]      # [R, G, B] demandé
    rgb_result:     list[int]      # [R, G, B] réellement produit (après arrondi)
    volumes: dict                  # {cyan_ml, magenta_ml, yellow_ml, water_ml, saturation}


# ── Helpers ───────────────────────────────────────────────────────────────────

def hex_to_rgb(hex_code: str) -> tuple[int, int, int]:
    """Convertit #RRGGBB ou RRGGBB en (R, G, B)."""
    hex_code = hex_code.lstrip("#").strip()
    if len(hex_code) != 6:
        raise ValueError(f"Format HEX invalide : {hex_code}")
    r = int(hex_code[0:2], 16)
    g = int(hex_code[2:4], 16)
    b = int(hex_code[4:6], 16)
    return r, g, b


def rgb_to_cmy(r: int, g: int, b: int) -> tuple[float, float, float]:
    """
    Convertit RGB (0-255) en CMJ (0.0-1.0) via mélange soustractif.
    C = 1 - R/255, M = 1 - G/255, Y = 1 - B/255
    """
    c = 1.0 - r / 255.0
    m = 1.0 - g / 255.0
    y = 1.0 - b / 255.0
    return c, m, y


def cmy_to_rgb(c: float, m: float, y: float) -> tuple[int, int, int]:
    """Inverse : CMJ → RGB pour calculer la couleur réellement produite."""
    r = round((1.0 - c) * 255)
    g = round((1.0 - m) * 255)
    b = round((1.0 - y) * 255)
    return (
        max(0, min(255, r)),
        max(0, min(255, g)),
        max(0, min(255, b)),
    )


def calculate_volumes(
    c: float, m: float, y: float, total_ml: int
) -> dict:
    """
    Calcule les volumes en ml pour chaque colorant + eau de complément.

    Stratégie :
    - saturation = max(C, M, Y) — indique la richesse en couleur
    - Les volumes sont proportionnels aux composantes CMJ
    - L'eau complète si saturation < 1 (couleurs pastel)
    - Volumes < MIN_VOLUME_ML → arrondis à 0 pour éviter les micro-doses
    """
    saturation = max(c, m, y)

    if saturation < MIN_SATURATION:
        # Couleur quasi-blanche → eau seule
        return {
            "cyan_ml":    0.0,
            "magenta_ml": 0.0,
            "yellow_ml":  0.0,
            "water_ml":   float(total_ml),
            "saturation": saturation,
        }

    # Volume de colorant total = saturation × volume_total
    color_volume = saturation * total_ml

    # Proportions relatives de chaque couleur
    cyan_ml    = (c / saturation) * color_volume
    magenta_ml = (m / saturation) * color_volume
    yellow_ml  = (y / saturation) * color_volume

    # Arrondir et éliminer les micro-doses
    cyan_ml    = round(cyan_ml, 1)    if cyan_ml    >= MIN_VOLUME_ML else 0.0
    magenta_ml = round(magenta_ml, 1) if magenta_ml >= MIN_VOLUME_ML else 0.0
    yellow_ml  = round(yellow_ml, 1)  if yellow_ml  >= MIN_VOLUME_ML else 0.0

    # Eau = complément
    water_ml = max(0.0, round(total_ml - cyan_ml - magenta_ml - yellow_ml, 1))

    return {
        "cyan_ml":    cyan_ml,
        "magenta_ml": magenta_ml,
        "yellow_ml":  yellow_ml,
        "water_ml":   water_ml,
        "saturation": round(saturation, 3),
    }


# ── Endpoint POST /mix ────────────────────────────────────────────────────────

@router.post("/mix", response_model=ColorMixResponse)
async def mix_color(
    request:          ColorMixRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Mélange une couleur à partir d'un code HEX.
    Vérifie que les pompes de colorant sont disponibles et stockées,
    crée une séquence, lance en background.
    """
    # 1. Parser la couleur
    try:
        r, g, b = hex_to_rgb(request.hex_code)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # 2. Conversion CMJ + calcul des volumes
    c, m, y = rgb_to_cmy(r, g, b)
    volumes  = calculate_volumes(c, m, y, request.volume_ml)

    # 3. Couleur réellement produite (après arrondis)
    # Recalculer C/M/Y réels depuis les volumes arrondis
    total_color = volumes["cyan_ml"] + volumes["magenta_ml"] + volumes["yellow_ml"]
    if total_color > 0:
        c_real = (volumes["cyan_ml"]    / request.volume_ml)
        m_real = (volumes["magenta_ml"] / request.volume_ml)
        y_real = (volumes["yellow_ml"]  / request.volume_ml)
    else:
        c_real = m_real = y_real = 0.0

    r_real, g_real, b_real = cmy_to_rgb(c_real, m_real, y_real)

    # 4. Charger les ingrédients colorants depuis la DB
    colorant_map: dict[str, Ingredient] = {}
    for key, name in COLORANT_NAMES.items():
        # Certains volumes peuvent être 0 → pas besoin de charger cet ingrédient
        needed_vol = volumes.get(f"{key}_ml", 0.0)
        if key == "water":
            needed_vol = volumes.get("water_ml", 0.0)
        if needed_vol <= 0:
            continue

        ing = db.query(Ingredient).filter(
            Ingredient.name == name,
            Ingredient.pump_id.isnot(None),
        ).first()

        if not ing:
            raise HTTPException(
                400,
                f"'{name}' n'est pas assigné à une pompe. "
                f"Configurez-le dans les réglages avant de lancer un mélange couleur."
            )
        if ing.current_volume_ml < needed_vol:
            raise HTTPException(
                400,
                f"Stock insuffisant pour '{name}' "
                f"({ing.current_volume_ml:.0f}ml dispo, {needed_vol:.1f}ml requis)"
            )
        colorant_map[key] = ing

    # 5. Créer la PourSequence
    sequence = PourSequence(recipe_id=None, user_nfc=None, status="PENDING")
    db.add(sequence)
    db.flush()

    order = 0
    for key in ["cyan", "magenta", "yellow", "water"]:
        vol = volumes.get(f"{key}_ml", 0.0)
        ing = colorant_map.get(key)
        if ing and vol > 0:
            db.add(PourStep(
                sequence_id=sequence.id,
                ingredient_id=ing.id,
                volume_ml=vol,
                order=order,
            ))
            order += 1

    db.commit()
    db.refresh(sequence)

    # 6. Lancer en background
    background_tasks.add_task(execute_color_background, sequence.id)

    # Temps estimé : ~2s par étape + 0.1s/ml
    steps_count    = sum(1 for k in ["cyan", "magenta", "yellow", "water"] if volumes.get(f"{k}_ml", 0) > 0)
    estimated_time = steps_count * 2 + request.volume_ml * 0.1

    return ColorMixResponse(
        status="started",
        sequence_id=sequence.id,
        estimated_time=round(estimated_time, 1),
        rgb_requested=[r, g, b],
        rgb_result=[r_real, g_real, b_real],
        volumes=volumes,
    )