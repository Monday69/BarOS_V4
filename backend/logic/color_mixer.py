"""
BarOS V4 - Mélangeur de couleurs CMY
Convertit des couleurs RGB en volumes de colorants Cyan, Magenta, Yellow
"""


class ColorMixer:
    """
    Classe pour convertir des couleurs RGB en volumes de colorants CMY
    """
    
    @staticmethod
    def rgb_to_pump_volumes(r: int, g: int, b: int, total_volume_ml: float) -> dict:
        """
        Convertit une couleur RGB en volumes de colorants CMY
        
        Logique :
        - Conversion RGB (0-255) en CMY (0-1) : C = 1 - R/255, M = 1 - G/255, Y = 1 - B/255
        - Normalisation des ratios pour que leur somme corresponde au total_volume_ml
        - Si blanc (255, 255, 255), tout est à 0 (c'est de l'eau)
        
        Args:
            r: Composante rouge (0-255)
            g: Composante verte (0-255)
            b: Composante bleue (0-255)
            total_volume_ml: Volume total à produire en millilitres
        
        Returns:
            Dictionnaire avec les volumes : {"cyan_ml": float, "magenta_ml": float, "yellow_ml": float}
        
        Raises:
            ValueError: Si les valeurs RGB sont hors limites ou si le volume est invalide
        """
        # Validation des paramètres
        if not (0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255):
            raise ValueError("Les valeurs RGB doivent être entre 0 et 255")
        
        if total_volume_ml <= 0:
            raise ValueError("Le volume total doit être positif")
        
        # Conversion RGB vers CMY (0-1)
        # CMY est l'inverse de RGB
        c = 1.0 - (r / 255.0)  # Cyan
        m = 1.0 - (g / 255.0)  # Magenta
        y = 1.0 - (b / 255.0)  # Yellow
        
        # Si blanc (255, 255, 255), alors C=M=Y=0 (eau pure)
        if r == 255 and g == 255 and b == 255:
            return {
                "cyan_ml": 0.0,
                "magenta_ml": 0.0,
                "yellow_ml": 0.0
            }
        
        # Calcul de la somme des composantes CMY
        total_cmy = c + m + y
        
        # Si la somme est 0 (cas théorique, ne devrait pas arriver sauf pour blanc)
        if total_cmy == 0:
            return {
                "cyan_ml": 0.0,
                "magenta_ml": 0.0,
                "yellow_ml": 0.0
            }
        
        # Normalisation : distribuer le total_volume_ml proportionnellement aux ratios CMY
        # Chaque composante reçoit une part proportionnelle à sa valeur CMY
        cyan_ml = (c / total_cmy) * total_volume_ml
        magenta_ml = (m / total_cmy) * total_volume_ml
        yellow_ml = (y / total_cmy) * total_volume_ml
        
        return {
            "cyan_ml": cyan_ml,
            "magenta_ml": magenta_ml,
            "yellow_ml": yellow_ml
        }
