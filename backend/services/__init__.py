# backend/services/__init__.py
from .cocktail_service import CocktailService
from .machine_service import MachineService
from .recipe_service import RecipeService

class ServiceFactory:
    """Factory pour les services (Dependency Injection)"""
    
    _instances = {}
    
    @classmethod
    def get_cocktail_service(cls) -> CocktailService:
        if 'cocktail' not in cls._instances:
            cls._instances['cocktail'] = CocktailService()
        return cls._instances['cocktail']
    
    @classmethod
    def get_machine_service(cls) -> MachineService:
        if 'machine' not in cls._instances:
            cls._instances['machine'] = MachineService()
        return cls._instances['machine']