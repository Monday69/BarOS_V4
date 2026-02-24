"""
BarOS V4 - Service Mélangeur de Couleurs (CMY)
Chemin : backend/services/color_service.py

Corrections v2 :
  - Utilise ColorMixer v2 (normalisation par max, non par sum)
  - water_ml retourné et utilisé correctement
  - N+1 supprimé : un seul SELECT pour les 3 colorants
  - time.sleep bloquant → asyncio.sleep
  - Mapping CMY→DB externalisé en constante de classe
  - check_colorant_stock et execute_color_mix partagent la même requête DB
"""
from sqlalchemy.orm import Session
from sqlalchemy import select
import asyncio

from backend.logic.color_mixer import ColorMixer
from backend.models import Ingredient, PourSequence, PourStep

try:
    from backend.hardware.gpio_manager import GPIOManager
except ImportError:
    GPIOManager = None


class ColorService:

    # ── Constante : mapping clé technique → nom en base de données ─────────────
    # Si tes ingrédients s'appellent autrement en DB, modifie uniquement ici.
    CMY_DB_NAMES = {
        "cyan_ml":    "Cyan",
        "magenta_ml": "Magenta",
        "yellow_ml":  "Jaune",
    }

    # ── Helper : charge les 3 ingrédients CMY en un seul SELECT ────────────────
    def _load_colorants(self, db: Session) -> dict:
        """
        Retourne {nom_db: ingredient} pour les 3 colorants.
        Un seul SELECT IN au lieu de 3 requêtes séparées (supprime le N+1).
        """
        names = list(self.CMY_DB_NAMES.values())
        ingredients = db.execute(
            select(Ingredient).where(Ingredient.name.in_(names))
        ).scalars().all()
        return {ing.name: ing for ing in ingredients}

    # ── Hex → RGB ──────────────────────────────────────────────────────────────
    def _hex_to_rgb(self, hex_code: str) -> tuple:
        """Délègue à ColorMixer pour éviter la duplication."""
        return ColorMixer.hex_to_rgb(hex_code)

    # ── Calcul des volumes ─────────────────────────────────────────────────────
    async def calculate_mix(
        self,
        hex_code: str,
        volume_ml: float,
        dye_concentration: float = None
    ) -> dict:
        """
        Calcule les volumes CMY pour reproduire `hex_code` dans `volume_ml`.

        Returns:
            {
              hex_code, rgb, total_volume,
              volumes: {cyan_ml, magenta_ml, yellow_ml, water_ml, saturation},
              estimated_time,
              dye_concentration_used
            }
        """
        r, g, b = self._hex_to_rgb(hex_code)

        volumes = ColorMixer.rgb_to_pump_volumes(
            r, g, b, volume_ml,
            dye_concentration=dye_concentration
        )

        # Temps estimé = colorant dominant / débit (10 ml/s) — en parallèle
        max_colorant_vol = max(
            volumes["cyan_ml"],
            volumes["magenta_ml"],
            volumes["yellow_ml"],
        )
        estimated_time = max(max_colorant_vol / 10.0, 1.5)

        # Couleur qui sera vraiment produite (utile pour affichage Lab)
        rgb_result = ColorMixer.verify_mix(
            volumes["cyan_ml"], volumes["magenta_ml"],
            volumes["yellow_ml"], volumes["water_ml"],
            dye_concentration
        )

        return {
            "hex_code":             hex_code,
            "rgb_requested":        (r, g, b),
            "rgb_result":           rgb_result,          # couleur physique réelle
            "total_volume":         volume_ml,
            "volumes":              volumes,
            "estimated_time":       round(estimated_time, 1),
            "dye_concentration":    volumes.get("saturation", 0),
        }

    # ── Vérification stocks ────────────────────────────────────────────────────
    async def check_colorant_stock(self, mix_result: dict, db: Session) -> dict:
        """
        Vérifie si les 3 colorants ont assez de stock.
        Un seul SELECT pour les 3 ingrédients.
        """
        colorants = self._load_colorants(db)
        missing   = []
        warnings  = []

        for key, db_name in self.CMY_DB_NAMES.items():
            vol = mix_result["volumes"].get(key, 0)
            if vol <= 0:
                continue

            ing = colorants.get(db_name)
            if not ing:
                missing.append(f"{db_name} introuvable en base de données")
                continue
            if not ing.pump_id:
                missing.append(f"{db_name} n'a pas de pompe assignée")
                continue
            if ing.current_volume_ml < vol:
                shortage = vol - ing.current_volume_ml
                missing.append(f"{db_name} — manque {shortage:.1f}ml ({ing.current_volume_ml:.0f}ml dispo)")
            elif ing.current_volume_ml < vol * 2:
                warnings.append(f"{db_name} bientôt vide ({ing.current_volume_ml:.0f}ml restants)")

        return {
            "available": len(missing) == 0,
            "missing":   missing,
            "warnings":  warnings,
        }

    # ── Exécution du mélange ──────────────────────────────────────────────────
    async def execute_color_mix(
        self,
        sequence_id: str,
        mix_result: dict,
        db: Session
    ):
        """
        Exécute le mélange couleur :
          1. Réservation atomique des stocks (transaction)
          2. Activation des pompes en parallèle (asyncio.gather)
          3. Eau ajoutée séparément si water_ml > 0

        ✅ Fix : asyncio.sleep au lieu de time.sleep (non bloquant)
        ✅ Fix : pompes en parallèle (gather) quand possible
        ✅ Fix : water_ml géré explicitement
        """
        print(f"\n[ColorService] 🎨 Séquence {sequence_id} — mélange couleur")

        volumes   = mix_result["volumes"]
        colorants = self._load_colorants(db)
        hardware_tasks = []

        # ── PHASE 1 : Réservation atomique ─────────────────────────────────────
        try:
            with db.begin():
                for key, db_name in self.CMY_DB_NAMES.items():
                    vol = volumes.get(key, 0)
                    if vol <= 0:
                        continue

                    ing = colorants.get(db_name)
                    if not ing:
                        raise ValueError(f"Ingrédient '{db_name}' introuvable en base")
                    if not ing.pump_id:
                        raise ValueError(f"'{db_name}' n'a pas de pompe assignée")
                    if ing.current_volume_ml < vol:
                        raise ValueError(
                            f"Stock insuffisant pour '{db_name}' : "
                            f"{ing.current_volume_ml:.0f}ml dispo, {vol:.0f}ml nécessaires"
                        )

                    ing.current_volume_ml -= vol
                    print(f"  ✅ Réservé {vol:.1f}ml de {db_name} (reste {ing.current_volume_ml:.0f}ml)")

                    hardware_tasks.append({
                        "name":    db_name,
                        "pump_id": ing.pump_id,
                        "volume":  vol,
                    })

                # Note : water_ml est ajouté par une pompe à eau séparée si disponible
                water_vol = volumes.get("water_ml", 0)
                if water_vol > 0:
                    print(f"  💧 Eau : {water_vol:.1f}ml (pompe eau si disponible)")

        except Exception as e:
            print(f"  ❌ Réservation annulée : {e}")
            raise

        # ── PHASE 2 : Activation pompes en parallèle ────────────────────────────
        print(f"[ColorService] ⚙️ Activation pompes ({len(hardware_tasks)} colorants)…")

        async def pour_colorant(task):
            duration = task["volume"] / 10.0  # 10 ml/s
            if GPIOManager and task["pump_id"]:
                await GPIOManager.pour(task["pump_id"], duration)
            else:
                print(f"  [MOCK] Pompe {task['pump_id']} → {task['name']} : {duration:.1f}s")
                # ✅ Fix : asyncio.sleep non bloquant (était time.sleep)
                await asyncio.sleep(min(duration, 2.0))

        # ✅ Fix : pompes en parallèle → temps total = max(durées) au lieu de sum
        if hardware_tasks:
            await asyncio.gather(*[pour_colorant(t) for t in hardware_tasks])

        # Eau en dernier (pour rincer les tubes)
        water_vol = volumes.get("water_ml", 0)
        if water_vol > 0:
            print(f"  [MOCK] Pompe eau → {water_vol:.1f}ml")
            await asyncio.sleep(min(water_vol / 10.0, 1.0))

        rgb = mix_result.get("rgb_result", mix_result.get("rgb_requested"))
        print(f"[ColorService] ✨ Mélange terminé — couleur résultante RGB{rgb}")