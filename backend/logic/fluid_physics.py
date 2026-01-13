"""
BarOS V4 - Physique des fluides pour le calcul du débit
Implémentation de la simulation Torricelli pour le calcul de la durée de versement
"""

import math


class FluidPhysics:
    """
    Classe pour calculer la physique des fluides lors du versement
    Basée sur la loi de Torricelli pour simuler le débit variable
    """
    
    # Débit maximum en ml/s (bouteille pleine)
    MAX_FLOW_RATE_ML_PER_SEC = 10.0
    
    @staticmethod
    def calculate_pour_duration(
        target_volume_ml: float,
        current_volume_ml: float,
        max_volume_ml: float
    ) -> float:
        """
        Calcule la durée nécessaire pour verser un volume donné
        
        Utilise la simulation Torricelli :
        - Le débit diminue selon la racine carrée du taux de remplissage
        - Formule : flow_rate = max_flow_rate * sqrt(current_volume / max_volume)
        
        Args:
            target_volume_ml: Volume à verser en millilitres
            current_volume_ml: Volume actuel dans la bouteille en ml
            max_volume_ml: Volume maximum de la bouteille en ml
        
        Returns:
            Durée en secondes nécessaire pour verser le volume demandé
        
        Raises:
            ValueError: Si les paramètres sont invalides
        """
        # Validation des paramètres
        if target_volume_ml <= 0:
            raise ValueError("Le volume cible doit être positif")
        
        if current_volume_ml <= 0:
            raise ValueError("Le volume actuel doit être positif")
        
        if max_volume_ml <= 0:
            raise ValueError("Le volume maximum doit être positif")
        
        if current_volume_ml > max_volume_ml:
            raise ValueError("Le volume actuel ne peut pas dépasser le volume maximum")
        
        if target_volume_ml > current_volume_ml:
            raise ValueError(f"Volume insuffisant: {current_volume_ml}ml disponible, {target_volume_ml}ml demandé")
        
        # Calcul de la durée en intégrant le débit variable
        # On utilise une approximation par intégration numérique
        # Pour plus de précision, on divise le versement en petits segments
        
        duration = 0.0
        remaining_volume = target_volume_ml
        current_vol = current_volume_ml
        time_step = 0.01  # Pas de temps de 10ms pour la précision
        
        while remaining_volume > 0.001 and current_vol > 0:  # Tolérance de 0.001ml
            # Calcul du débit instantané selon Torricelli
            fill_ratio = current_vol / max_volume_ml
            flow_rate = FluidPhysics.MAX_FLOW_RATE_ML_PER_SEC * math.sqrt(fill_ratio)
            
            # Volume versé pendant ce pas de temps
            volume_poured = min(flow_rate * time_step, remaining_volume, current_vol)
            
            # Mise à jour
            remaining_volume -= volume_poured
            current_vol -= volume_poured
            duration += time_step
        
        return duration
