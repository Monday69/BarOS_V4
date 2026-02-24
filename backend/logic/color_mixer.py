"""
BarOS V4 - Mélangeur de couleurs CMY
Chemin : backend/logic/color_mixer.py

CORRECTION MATHÉMATIQUE v2 :
  L'algo original normalisait par sum(c+m+y), ce qui déformait la teinte.
  Exemple : Rouge (255,0,0) → CMY=(0,1,1) → sum=2 → M=50ml, Y=50ml
  Reconstruction : RGB(255,128,128) = rose pâle, pas rouge.

  Correction : normaliser par max(c,m,y) pour préserver la teinte,
  puis ajuster par le facteur de concentration des colorants.

MODÈLE PHYSIQUE :
  Pour un volume V avec concentration K (fraction max de colorant) :
    cyan_vol    = (c / max_cmy) × K × V
    magenta_vol = (m / max_cmy) × K × V
    yellow_vol  = (y / max_cmy) × K × V
    water_vol   = V − (cyan + magenta + yellow)

  La teinte résultante est toujours correcte (ratios CMY préservés).
  La saturation dépend de K et de la concentration réelle des colorants.

CALIBRATION :
  Régler `dye_concentration` selon les colorants physiques :
  - 0.1  → colorants très concentrés (quelques gouttes suffisent)
  - 0.3  → colorants alimentaires standard
  - 1.0  → colorants peu concentrés (couleur max = volume entier)
"""


class ColorMixer:
    """
    Convertit des couleurs RGB en volumes de colorants CMY
    avec correction de la teinte et paramètre de concentration.
    """

    # Concentration par défaut — à calibrer selon tes colorants physiques
    # 0.3 = max 30% du volume sera du colorant, reste = eau
    DEFAULT_CONCENTRATION: float = 0.3

    @staticmethod
    def rgb_to_pump_volumes(
        r: int,
        g: int,
        b: int,
        total_volume_ml: float,
        dye_concentration: float = None
    ) -> dict:
        """
        Convertit une couleur RGB en volumes de colorants CMY.

        Algorithme corrigé :
          1. CMY = inverse de RGB (0→1)
          2. k = max(C, M, Y)  ← colorant dominant
          3. Chaque colorant = (CMY_i / k) × concentration × volume
          4. Eau = volume − somme des colorants

        La teinte (hue) est toujours exacte.
        La saturation dépend de `dye_concentration` et des colorants physiques.

        Args:
            r, g, b         : Composantes RGB (0–255)
            total_volume_ml : Volume total à produire (ml)
            dye_concentration: Fraction max de colorant (0.0–1.0).
                               None → utilise DEFAULT_CONCENTRATION.

        Returns:
            {
              "cyan_ml": float,
              "magenta_ml": float,
              "yellow_ml": float,
              "water_ml": float,     ← eau à ajouter (peut être 0)
              "total_ml": float,     ← toujours == total_volume_ml
              "saturation": float,  ← intensité de couleur 0–1
            }

        Raises:
            ValueError: RGB hors limites ou volume invalide.
        """
        # ── Validation ─────────────────────────────────────────────────────────
        if not (0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255):
            raise ValueError(f"Valeurs RGB invalides : ({r}, {g}, {b}) — attendu 0–255")
        if total_volume_ml <= 0:
            raise ValueError(f"Volume invalide : {total_volume_ml} — doit être > 0")

        if dye_concentration is None:
            dye_concentration = ColorMixer.DEFAULT_CONCENTRATION
        if not (0 < dye_concentration <= 1.0):
            raise ValueError(f"concentration invalide : {dye_concentration} — attendu 0 < x ≤ 1")

        # ── Blanc pur → pas de colorant du tout ─────────────────────────────────
        if r == 255 and g == 255 and b == 255:
            return {
                "cyan_ml":    0.0,
                "magenta_ml": 0.0,
                "yellow_ml":  0.0,
                "water_ml":   round(total_volume_ml, 2),
                "total_ml":   round(total_volume_ml, 2),
                "saturation": 0.0,
            }

        # ── Conversion RGB → CMY (0–1) ───────────────────────────────────────────
        c = 1.0 - r / 255.0   # Cyan    = absence de rouge
        m = 1.0 - g / 255.0   # Magenta = absence de vert
        y = 1.0 - b / 255.0   # Yellow  = absence de bleu

        # ── Normalisation par max(CMY) ────────────────────────────────────────────
        # Garantit que la teinte est correcte indépendamment de la saturation.
        # Le colorant dominant reçoit dye_concentration × total_volume_ml.
        # Les autres sont proportionnels → ratios de teinte préservés.
        k = max(c, m, y)

        # Volume max alloué aux colorants
        max_colorant_vol = dye_concentration * total_volume_ml

        cyan_ml    = (c / k) * max_colorant_vol
        magenta_ml = (m / k) * max_colorant_vol
        yellow_ml  = (y / k) * max_colorant_vol

        colorant_total = cyan_ml + magenta_ml + yellow_ml
        water_ml       = max(0.0, total_volume_ml - colorant_total)
        real_total     = colorant_total + water_ml   # == total_volume_ml si water >= 0

        return {
            "cyan_ml":    round(cyan_ml, 2),
            "magenta_ml": round(magenta_ml, 2),
            "yellow_ml":  round(yellow_ml, 2),
            "water_ml":   round(water_ml, 2),
            "total_ml":   round(real_total, 2),
            "saturation": round(k, 3),   # 1.0 = noir, 0.0 = blanc
        }

    @staticmethod
    def hex_to_rgb(hex_code: str) -> tuple:
        """
        Convertit #RRGGBB ou RRGGBB en tuple (r, g, b).
        Raises ValueError si le format est invalide.
        """
        h = hex_code.lstrip('#').strip()
        if len(h) != 6:
            raise ValueError(f"Code hex invalide : '{hex_code}' — attendu #RRGGBB")
        try:
            return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
        except ValueError:
            raise ValueError(f"Code hex invalide : '{hex_code}'")

    @staticmethod
    def verify_mix(cyan_ml: float, magenta_ml: float, yellow_ml: float,
                   water_ml: float, dye_concentration: float = None) -> tuple:
        """
        Recalcule la couleur RGB résultante d'un mélange donné.
        Utile pour la vérification et l'affichage dans le Lab.

        Returns:
            (r, g, b) RGB résultant (0–255)
        """
        total = cyan_ml + magenta_ml + yellow_ml + water_ml
        if total <= 0:
            return (255, 255, 255)  # vide = blanc

        rc = cyan_ml    / total
        rm = magenta_ml / total
        ry = yellow_ml  / total

        r = round((1 - rc) * 255)
        g = round((1 - rm) * 255)
        b = round((1 - ry) * 255)
        return (r, g, b)