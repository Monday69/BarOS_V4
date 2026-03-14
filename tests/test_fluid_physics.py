"""
BarOS V4 — Tests Unitaires : FluidPhysics (Loi de Torricelli)
Chemin : tests/test_fluid_physics.py

Lancement :
    pytest tests/test_fluid_physics.py -v
    pytest tests/test_fluid_physics.py -v --tb=short   (sorties courtes)

Couverture ciblée :
    1. Cohérence physique          — T > 0, T croît avec le volume demandé
    2. Formule analytique exacte   — vérification numérique indépendante
    3. Cas limites                 — quasi-vide, vidage total, petits volumes
    4. Débit instantané            — plein / mi-plein / vide
    5. Validation des entrées      — chaque ValueError documentée dans le code
    6. Performance                 — < 1ms par appel (garanti par la formule analytique)
"""
import math
import time
import pytest

# Le chemin d'import suppose que pytest est lancé depuis la racine du projet (BarOS_V4/)
from backend.logic.fluid_physics import FluidPhysics


# ─────────────────────────────────────────────────────────────────────────────
#  Constantes de référence
# ─────────────────────────────────────────────────────────────────────────────
F_MAX   = FluidPhysics.MAX_FLOW_RATE_ML_PER_SEC  # 10.0 ml/s
V_MAX   = 1000.0   # ml — bouteille standard
V_FULL  = 1000.0   # ml
V_HALF  = 500.0    # ml
V_LOW   = 50.0     # ml — quasi-vide


# ─────────────────────────────────────────────────────────────────────────────
#  Helper : formule analytique recalculée indépendamment
# ─────────────────────────────────────────────────────────────────────────────
def expected_duration(target_ml, current_ml, max_ml):
    """Reproduction indépendante de la formule pour les assertions."""
    v_start = current_ml
    v_end   = current_ml - target_ml
    return (2.0 * math.sqrt(max_ml) / F_MAX) * (math.sqrt(v_start) - math.sqrt(v_end))


# ─────────────────────────────────────────────────────────────────────────────
#  1. COHÉRENCE PHYSIQUE
# ─────────────────────────────────────────────────────────────────────────────
class TestPhysicalCoherence:
    """La durée doit se comporter comme attendu physiquement."""

    def test_duration_is_positive(self):
        """Toute durée calculée doit être strictement positive."""
        d = FluidPhysics.calculate_pour_duration(100, V_FULL, V_MAX)
        assert d > 0, f"Durée attendue > 0, obtenu {d}"

    def test_more_volume_takes_longer(self):
        """Verser 200ml doit prendre plus de temps que 100ml (même niveau)."""
        d100 = FluidPhysics.calculate_pour_duration(100, V_FULL, V_MAX)
        d200 = FluidPhysics.calculate_pour_duration(200, V_FULL, V_MAX)
        assert d200 > d100, "200ml doit prendre plus de temps que 100ml"

    def test_lower_level_takes_longer(self):
        """
        Verser 100ml depuis une bouteille à moitié pleine doit prendre
        plus de temps que depuis une bouteille pleine (débit réduit).
        """
        d_full = FluidPhysics.calculate_pour_duration(100, V_FULL, V_MAX)
        d_half = FluidPhysics.calculate_pour_duration(100, V_HALF, V_MAX)
        assert d_half > d_full, (
            f"Bouteille à moitié : {d_half:.4f}s doit être > pleine : {d_full:.4f}s"
        )

    def test_full_bottle_faster_than_low_bottle(self):
        """Bouteille pleine → débit max → versement le plus rapide."""
        d_full = FluidPhysics.calculate_pour_duration(30, V_FULL, V_MAX)
        d_low  = FluidPhysics.calculate_pour_duration(30, V_LOW,  V_MAX)
        assert d_full < d_low

    def test_duration_increases_with_target(self):
        """Relation monotone croissante entre volume demandé et durée."""
        durations = [
            FluidPhysics.calculate_pour_duration(v, V_FULL, V_MAX)
            for v in [10, 30, 60, 100, 200, 500]
        ]
        assert durations == sorted(durations), "Les durées doivent être croissantes"


# ─────────────────────────────────────────────────────────────────────────────
#  2. EXACTITUDE DE LA FORMULE ANALYTIQUE
# ─────────────────────────────────────────────────────────────────────────────
class TestAnalyticalFormula:
    """Vérification numérique indépendante de la formule T = 2√Vmax/Fmax × (√v1 − √v2)."""

    TOLERANCE_S = 0.001  # 1ms — bien en dessous du seuil observable

    @pytest.mark.parametrize("target, current, max_vol", [
        (100,  1000, 1000),   # bouteille pleine, versement standard
        (50,    500, 1000),   # mi-plein
        (30,    100, 1000),   # niveau bas
        (200,   750,  750),   # bouteille 75cl presque pleine
        (10,     15, 1000),   # tout petit volume
        (999,  1000, 1000),   # quasi-vidage total
        (1,    500,  500),   # bouteille 50cl, 1ml
    ])
    def test_formula_matches_independent_calculation(self, target, current, max_vol):
        result   = FluidPhysics.calculate_pour_duration(target, current, max_vol)
        expected = expected_duration(target, current, max_vol)
        assert abs(result - expected) < self.TOLERANCE_S, (
            f"target={target}ml, current={current}ml, max={max_vol}ml : "
            f"obtenu {result:.6f}s, attendu {expected:.6f}s "
            f"(écart {abs(result-expected)*1000:.3f}ms)"
        )

    def test_total_drain_formula(self):
        """Vider exactement 1000ml depuis 1000ml : v_end=0, √0=0 → T = 2√Vmax/Fmax × √Vmax."""
        d        = FluidPhysics.calculate_pour_duration(1000, 1000, 1000)
        expected = (2.0 * math.sqrt(1000) / F_MAX) * math.sqrt(1000)
        # = 2 * 1000 / 10 = 200s
        assert abs(d - expected) < self.TOLERANCE_S
        assert abs(d - 200.0) < self.TOLERANCE_S, f"Vidage total : attendu 200s, obtenu {d:.4f}s"

    def test_known_value_full_bottle_100ml(self):
        """
        Valeur de référence calculée à la main :
          T = 2×√1000/10 × (√1000 − √900)
            = 2×31.623/10 × (31.623 − 30.000)
            = 6.3246 × 1.6228
            ≈ 10.267s
        """
        d        = FluidPhysics.calculate_pour_duration(100, 1000, 1000)
        expected = (2 * math.sqrt(1000) / 10) * (math.sqrt(1000) - math.sqrt(900))
        assert abs(d - expected) < self.TOLERANCE_S
        # Vérification ordre de grandeur
        assert 9.0 < d < 12.0, f"Valeur hors plage attendue : {d:.3f}s"


# ─────────────────────────────────────────────────────────────────────────────
#  3. CAS LIMITES
# ─────────────────────────────────────────────────────────────────────────────
class TestEdgeCases:

    def test_exact_drain(self):
        """Verser exactement ce qui reste dans la bouteille — doit fonctionner."""
        d = FluidPhysics.calculate_pour_duration(V_LOW, V_LOW, V_MAX)
        assert d > 0

    def test_1ml_volume(self):
        """1ml — le plus petit versement raisonnable."""
        d = FluidPhysics.calculate_pour_duration(1, V_FULL, V_MAX)
        assert d > 0
        assert d < 1.0, f"1ml depuis bouteille pleine doit prendre < 1s, obtenu {d:.3f}s"

    def test_very_low_level(self):
        """Bouteille à 5ml — débit très faible, durée proportionnellement longue."""
        d = FluidPhysics.calculate_pour_duration(5, 5, V_MAX)
        assert d > 0
        # À 5ml/1000ml de remplissage, le débit est très réduit
        d_full = FluidPhysics.calculate_pour_duration(5, V_FULL, V_MAX)
        assert d > d_full * 5, "Niveau très bas → durée bien supérieure au niveau plein"

    def test_small_bottle_max_volume(self):
        """Bouteille 200ml pleine — max_vol différent de 1000."""
        d = FluidPhysics.calculate_pour_duration(50, 200, 200)
        assert d > 0
        expected = expected_duration(50, 200, 200)
        assert abs(d - expected) < 0.001

    def test_result_is_float(self):
        """La durée retournée doit toujours être un float."""
        d = FluidPhysics.calculate_pour_duration(100, 500, 1000)
        assert isinstance(d, float)


# ─────────────────────────────────────────────────────────────────────────────
#  4. DÉBIT INSTANTANÉ
# ─────────────────────────────────────────────────────────────────────────────
class TestInstantaneousFlowRate:

    def test_full_bottle_max_flow(self):
        """Bouteille pleine → débit = F_MAX."""
        flow = FluidPhysics.instantaneous_flow_rate(V_FULL, V_MAX)
        assert abs(flow - F_MAX) < 0.001, f"Attendu {F_MAX}, obtenu {flow}"

    def test_half_bottle_flow(self):
        """Bouteille à moitié → débit = F_MAX × √0.5 ≈ 7.071 ml/s."""
        flow     = FluidPhysics.instantaneous_flow_rate(V_HALF, V_MAX)
        expected = F_MAX * math.sqrt(0.5)
        assert abs(flow - expected) < 0.001

    def test_empty_bottle_zero_flow(self):
        """Bouteille vide → débit = 0."""
        flow = FluidPhysics.instantaneous_flow_rate(0.0, V_MAX)
        assert flow == 0.0

    def test_flow_decreases_with_level(self):
        """Débit décroît quand le niveau baisse."""
        flows = [FluidPhysics.instantaneous_flow_rate(v, V_MAX) for v in [1000, 750, 500, 250, 50]]
        assert flows == sorted(flows, reverse=True), "Débit doit être décroissant"

    def test_overflow_clamped(self):
        """Volume > max → débit plafonné à F_MAX (pas d'erreur)."""
        flow = FluidPhysics.instantaneous_flow_rate(1200, V_MAX)
        assert flow == F_MAX

    def test_zero_max_volume(self):
        """max_volume=0 → retourne 0 sans crash."""
        flow = FluidPhysics.instantaneous_flow_rate(100, 0)
        assert flow == 0.0


# ─────────────────────────────────────────────────────────────────────────────
#  5. VALIDATION DES ENTRÉES (ValueError)
# ─────────────────────────────────────────────────────────────────────────────
class TestInputValidation:

    def test_negative_target_volume(self):
        with pytest.raises(ValueError, match="Volume cible invalide"):
            FluidPhysics.calculate_pour_duration(-10, 500, 1000)

    def test_zero_target_volume(self):
        with pytest.raises(ValueError, match="Volume cible invalide"):
            FluidPhysics.calculate_pour_duration(0, 500, 1000)

    def test_zero_current_volume(self):
        with pytest.raises(ValueError, match="Volume actuel invalide"):
            FluidPhysics.calculate_pour_duration(10, 0, 1000)

    def test_negative_current_volume(self):
        with pytest.raises(ValueError, match="Volume actuel invalide"):
            FluidPhysics.calculate_pour_duration(10, -50, 1000)

    def test_zero_max_volume(self):
        with pytest.raises(ValueError, match="Volume maximum invalide"):
            FluidPhysics.calculate_pour_duration(10, 500, 0)

    def test_current_exceeds_max(self):
        with pytest.raises(ValueError, match="volume maximum"):
            FluidPhysics.calculate_pour_duration(10, 1200, 1000)

    def test_target_exceeds_current(self):
        with pytest.raises(ValueError, match="Stock insuffisant"):
            FluidPhysics.calculate_pour_duration(600, 500, 1000)

    def test_target_equals_current_plus_one(self):
        """Un millilitre de trop → ValueError."""
        with pytest.raises(ValueError, match="Stock insuffisant"):
            FluidPhysics.calculate_pour_duration(501, 500, 1000)


# ─────────────────────────────────────────────────────────────────────────────
#  6. PERFORMANCE
# ─────────────────────────────────────────────────────────────────────────────
class TestPerformance:
    """
    La formule analytique doit être quasi-instantanée.
    Seuil conservateur : < 1ms par appel (la doc annonce ~0.0002ms).
    """

    N_CALLS = 10_000  # appels répétés pour mesurer la moyenne

    def test_calculate_pour_duration_speed(self):
        start = time.perf_counter()
        for _ in range(self.N_CALLS):
            FluidPhysics.calculate_pour_duration(100, 800, 1000)
        elapsed = time.perf_counter() - start
        avg_ms = (elapsed / self.N_CALLS) * 1000

        assert avg_ms < 1.0, (
            f"Performance dégradée : {avg_ms:.4f}ms/appel "
            f"(seuil : 1ms, {self.N_CALLS} appels en {elapsed*1000:.1f}ms total)"
        )
        # Log informatif (visible avec pytest -v -s)
        print(f"\n  ⚡ {self.N_CALLS} appels en {elapsed*1000:.2f}ms → {avg_ms:.5f}ms/appel")

    def test_instantaneous_flow_rate_speed(self):
        start = time.perf_counter()
        for _ in range(self.N_CALLS):
            FluidPhysics.instantaneous_flow_rate(500, 1000)
        elapsed = time.perf_counter() - start
        avg_ms  = (elapsed / self.N_CALLS) * 1000
        assert avg_ms < 1.0, f"instantaneous_flow_rate trop lent : {avg_ms:.4f}ms/appel"