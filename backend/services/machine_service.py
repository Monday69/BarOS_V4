"""
BarOS V4 - Service Machine (Gestion des Pompes)
Chemin : backend/services/machine_service.py

Corrections v2 :
  - Ingredient.pump_id != None → Ingredient.pump_id.is_not(None)
    Le comparateur != None génère un SAWarning en SQLAlchemy 2.x
    (comparaison Python avec None au lieu du SQL IS NOT NULL).
  - apply_config : `raise e` → `raise` (re-raise sans perdre le traceback)
"""
from sqlalchemy.orm import Session
from backend.models import Ingredient

# Seuils d'alerte (% du volume max)
THRESHOLD_CRITICAL = 10   # < 10% → critique (rouge)
THRESHOLD_WARNING  = 25   # < 25% → attention (orange)


class MachineService:

    # ── État complet ──────────────────────────────────────────────────────────
    async def get_full_status(self, db: Session) -> dict:
        # ✅ Fix : is_not(None) → SQL IS NOT NULL (SQLAlchemy 2.x)
        assigned = db.query(Ingredient).filter(
            Ingredient.pump_id.is_not(None)
        ).all()

        slots_data = {
            str(ing.pump_id): {
                "name":      ing.name,
                "volume_ml": ing.current_volume_ml,
                "type":      ing.type,
            }
            for ing in assigned
        }

        return {
            "status":             "online",
            "mode":               "kiosk",
            "maintenance_needed": False,
            "slots":              slots_data,
            "stock_alerts":       self.get_stock_alerts(db),
        }

    # ── Alertes stocks ────────────────────────────────────────────────────────
    def get_stock_alerts(self, db: Session) -> dict:
        ingredients = db.query(Ingredient).filter(
            Ingredient.pump_id.is_not(None),       # ✅ Fix : is_not(None)
            Ingredient.is_available == True,
        ).all()

        critical, warning, ok = [], [], []

        for ing in ingredients:
            if ing.max_volume_ml <= 0:
                continue

            pct   = (ing.current_volume_ml / ing.max_volume_ml) * 100
            entry = {
                "id":         ing.id,
                "name":       ing.name,
                "pump_id":    ing.pump_id,
                "current_ml": round(ing.current_volume_ml, 1),
                "max_ml":     round(ing.max_volume_ml, 1),
                "percent":    round(pct, 1),
            }

            if pct < THRESHOLD_CRITICAL:
                entry["level"]   = "critical"
                entry["message"] = f"Stock critique ! ({entry['percent']}% restant)"
                critical.append(entry)
            elif pct < THRESHOLD_WARNING:
                entry["level"]   = "warning"
                entry["message"] = f"Stock bas ({entry['percent']}% restant)"
                warning.append(entry)
            else:
                entry["level"] = "ok"
                ok.append(entry)

        total = len(critical) + len(warning) + len(ok)
        if total == 0:
            health_score = 100
        else:
            penalty      = (len(critical) * 3 + len(warning)) / (total * 3)
            health_score = round(max(0, (1 - penalty) * 100))

        return {
            "critical": critical,
            "warning":  warning,
            "ok":       ok,
            "summary": {
                "total_pumps":    total,
                "critical_count": len(critical),
                "warning_count":  len(warning),
                "ok_count":       len(ok),
                "health_score":   health_score,
                "has_alerts":     len(critical) + len(warning) > 0,
            },
        }

    # ── Config pompes ─────────────────────────────────────────────────────────
    async def apply_config(self, slots: dict, db: Session) -> dict:
        print(f"[Machine] Sauvegarde configuration : {slots}")
        try:
            # Désassigner toutes les pompes
            db.query(Ingredient).update({Ingredient.pump_id: None})

            for pump_str, data in slots.items():
                if not data:
                    continue
                ing_name = data.get("name")
                if not ing_name or ing_name == "Vide":
                    continue
                ingredient = db.query(Ingredient).filter(
                    Ingredient.name == ing_name
                ).first()
                if ingredient:
                    ingredient.pump_id    = int(pump_str)
                    ingredient.is_available = True   # ✅ Fix : assigner une pompe rend l'ingrédient disponible
                    print(f"   OK  Pompe {pump_str} → {ing_name}")
                else:
                    print(f"   WARN Ingrédient inconnu : {ing_name}")

            db.commit()
            return {"valid": True, "errors": []}

        except Exception:
            db.rollback()
            # ✅ Fix : `raise` sans argument — conserve le traceback original.
            # `raise e` crée un nouveau traceback qui masque l'origine réelle.
            raise

    async def validate_config(self, slots: dict) -> dict:
        return {"valid": True, "errors": []}