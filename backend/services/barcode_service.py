"""
BarOS V4 - Service Scanner (OpenFoodFacts)
Chemin : backend/services/barcode_service.py
"""
import httpx
from sqlalchemy.orm import Session
from datetime import datetime
from backend.models import ScannedProduct

OPENFOODFACTS_API = "https://world.openfoodfacts.org/api/v0/product/{}.json"

class BarcodeService:
    
    async def scan_product(self, barcode: str, db: Session):
        """
        Cherche un produit par son code-barres.
        D'abord en cache local (DB), sinon via l'API OpenFoodFacts.
        """
        # 1. Vérifier si on l'a déjà en cache local
        existing = db.query(ScannedProduct).get(barcode)
        if existing:
            print(f"[Scanner] ✅ Produit {barcode} trouvé en cache local.")
            existing.last_scanned_at = datetime.utcnow()
            db.commit()
            return existing

        # 2. Interroger l'API OpenFoodFacts
        print(f"[Scanner] 🌍 Recherche internet pour {barcode}...")
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(OPENFOODFACTS_API.format(barcode), timeout=5.0)
                if response.status_code != 200:
                    return None
                
                data = response.json()
                if data.get("status") != 1: # Produit non trouvé
                    print(f"[Scanner] ❌ Produit {barcode} introuvable sur OFF.")
                    return None
                
                product_data = data["product"]
                nutriments = product_data.get("nutriments", {})
                
                # 3. Création de l'objet
                new_product = ScannedProduct(
                    barcode=barcode,
                    name=product_data.get("product_name", "Inconnu"),
                    brand=product_data.get("brands", ""),
                    image_url=product_data.get("image_url", ""),
                    
                    # On récupère les infos nutritionnelles (souvent pour 100g/ml)
                    alcohol_degree=float(nutriments.get("alcohol_100g", 0.0) or 0.0),
                    sugar_g_per_100ml=float(nutriments.get("sugars_100g", 0.0) or 0.0),
                    kcal_per_100ml=float(nutriments.get("energy-kcal_100g", 0.0) or 0.0)
                )
                
                # 4. Sauvegarder en cache
                db.add(new_product)
                db.commit()
                db.refresh(new_product)
                return new_product

            except Exception as e:
                print(f"[Scanner] 💥 Erreur API: {e}")
                return None