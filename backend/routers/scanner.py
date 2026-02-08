"""
BarOS V4 - Router Scanner
Chemin : backend/routers/scanner.py
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.services.barcode_service import BarcodeService

router = APIRouter(prefix="/scanner", tags=["scanner"])
service = BarcodeService()

@router.get("/{barcode}")
async def get_product_info(barcode: str, db: Session = Depends(get_db)):
    """Scanne un code-barres et retourne les infos (Cache ou API)."""
    product = await service.scan_product(barcode, db)
    if not product:
        raise HTTPException(status_code=404, detail="Produit inconnu au bataillon")
    return product