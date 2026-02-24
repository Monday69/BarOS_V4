"""
BarOS V4 - Service Scanner (OpenFoodFacts avec Cache)
Chemin : backend/services/barcode_service.py

Corrections v2 :
  - db.query().get() déprécié → db.get() (SQLAlchemy 2.0)
  - httpx.AsyncClient recréé à chaque appel → client partagé (singleton)
  - Fallback kJ → kcal : OFF retourne souvent energy_100g (kJ)
    sans energy-kcal_100g → les calories étaient perdues (0 affiché)
  - Retry unique sur TimeoutException (réseau instable sur Raspberry)
  - Extraction des champs OFF plus défensive (None vs champ absent)
"""
import httpx
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from backend.models import ScannedProduct

OFF_URL = "https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
TIMEOUT = 6.0   # secondes — légèrement plus que le défaut pour Raspberry Pi
KJ_TO_KCAL = 4.184


class BarcodeService:
    """
    Service de scan code-barres avec cache local (DB) et fallback OpenFoodFacts.

    Le client httpx est partagé sur toute la durée de vie du service
    pour réutiliser les connexions TCP (keep-alive) plutôt que d'en
    ouvrir une nouvelle à chaque scan.
    """

    # ✅ Fix : client httpx partagé — évite de rouvrir une connexion TCP
    # à chaque appel. Instancié une seule fois, réutilisé pour tous les scans.
    _client: httpx.AsyncClient | None = None

    @classmethod
    def _get_client(cls) -> httpx.AsyncClient:
        if cls._client is None or cls._client.is_closed:
            cls._client = httpx.AsyncClient(timeout=TIMEOUT)
        return cls._client

    # ── Extraction kcal robuste ───────────────────────────────────────────────
    @staticmethod
    def _extract_kcal(nutriments: dict) -> float:
        """
        OFF retourne parfois seulement energy_100g (kJ), pas energy-kcal_100g.
        Stratégie : kcal direct → fallback conversion kJ → zéro.

        ✅ Fix : sans ce fallback, tous les produits sans kcal direct
        s'affichaient à 0 kcal alors que la valeur kJ était présente.
        """
        kcal = float(nutriments.get("energy-kcal_100g") or 0)
        if kcal == 0:
            kj = float(nutriments.get("energy_100g") or 0)
            kcal = kj / KJ_TO_KCAL
        return round(kcal, 1)

    @staticmethod
    def _extract_float(nutriments: dict, key: str) -> float:
        """Extraction défensive d'un float depuis les nutriments OFF."""
        return round(float(nutriments.get(key) or 0), 2)

    # ── Scan principal ────────────────────────────────────────────────────────
    async def scan_product(self, barcode: str, db: Session) -> ScannedProduct | None:
        """
        Cherche un produit par son code-barres.
          1. Cache local (DB)   → réponse immédiate
          2. OpenFoodFacts API  → mise en cache puis retour

        Returns None si le produit est introuvable dans les deux sources.
        """
        # 1. Cache local ──────────────────────────────────────────────────────
        # ✅ Fix : db.query().get() déprécié → db.get() (SQLAlchemy 2.0)
        existing = db.get(ScannedProduct, barcode)
        if existing:
            print(f"[Scanner] ✅ Cache local : {barcode}")
            existing.last_scanned_at = datetime.now(timezone.utc)
            db.commit()
            return existing

        # 2. OpenFoodFacts API ─────────────────────────────────────────────────
        print(f"[Scanner] 🌍 Requête OFF pour {barcode}…")
        product_data = await self._fetch_off(barcode)
        if product_data is None:
            return None

        # 3. Mise en cache ─────────────────────────────────────────────────────
        nutriments = product_data.get("nutriments", {})
        new_product = ScannedProduct(
            barcode   = barcode,
            name      = (product_data.get("product_name") or "Inconnu").strip() or "Inconnu",
            brand     = (product_data.get("brands")       or "Inconnu").split(",")[0].strip(),
            image_url = product_data.get("image_front_url") or product_data.get("image_url") or "",

            # ✅ Fix : fallback kJ → kcal si energy-kcal_100g absent
            kcal_per_100ml    = self._extract_kcal(nutriments),
            sugar_g_per_100ml = self._extract_float(nutriments, "sugars_100g"),
            alcohol_degree    = self._extract_float(nutriments, "alcohol_100g"),
        )

        try:
            db.add(new_product)
            db.commit()
            db.refresh(new_product)
            print(f"  → Sauvegardé : {new_product.brand} — {new_product.name}")
        except Exception as e:
            db.rollback()
            print(f"[Scanner] ⚠️ Erreur cache DB : {e}")

        return new_product

    # ── Appel HTTP ────────────────────────────────────────────────────────────
    async def _fetch_off(self, barcode: str) -> dict | None:
        """
        Appel à l'API OpenFoodFacts avec un retry unique sur timeout.
        ✅ Fix : réseau instable sur Raspberry Pi → on retente une fois
        avant de déclarer le produit introuvable.
        """
        client = self._get_client()
        url    = OFF_URL.format(barcode=barcode)

        for attempt in range(2):  # 1 essai + 1 retry
            try:
                response = await client.get(url)
                if response.status_code != 200:
                    print(f"[Scanner] ❌ OFF HTTP {response.status_code} pour {barcode}")
                    return None

                data = response.json()
                if data.get("status") != 1:
                    print(f"[Scanner] ❌ Produit {barcode} non référencé sur OFF")
                    return None

                return data.get("product", {})

            except httpx.TimeoutException:
                if attempt == 0:
                    print(f"[Scanner] ⏱️ Timeout OFF, retry…")
                    continue
                print(f"[Scanner] ⏱️ Timeout définitif pour {barcode}")
                return None

            except Exception as e:
                print(f"[Scanner] 💥 Erreur OFF : {e}")
                return None

        return None