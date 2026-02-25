"""
BarOS V4 - Router Paiements Stripe
Chemin : backend/routers/payments.py

Flow :
  1. POST /create-checkout  → crée une Stripe Checkout Session (CB / Apple Pay / Google Pay)
  2. Stripe redirige vers /success?session_id=... ou /cancel
  3. POST /webhook           → Stripe confirme le paiement → crédite le solde user
  4. POST /manual-recharge   → recharge manuelle par l'admin (backup)
  5. GET  /balance/{user_id} → solde actuel
  6. GET  /config            → montants dispo + require_payment (pour le frontend)

Variables d'environnement requises :
  STRIPE_SECRET_KEY       → sk_test_...
  STRIPE_WEBHOOK_SECRET   → whsec_...
  FRONTEND_URL            → http://localhost:5173 (ou ton domaine)
"""
import os
import json
import stripe

from fastapi             import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.orm      import Session
from pydantic            import BaseModel
from typing              import Optional

from backend.database    import get_db
from backend.models      import User, PaymentTransaction

router = APIRouter(tags=["payments"])

# ── Config Stripe ─────────────────────────────────────────────────────────────
stripe.api_key   = os.getenv("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET   = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL     = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ── Config locale ─────────────────────────────────────────────────────────────
def _read_config() -> dict:
    try:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        with open(os.path.join(base, "config.json")) as f:
            return json.load(f)
    except Exception:
        return {}

def _payment_config() -> dict:
    return _read_config().get("payment", {
        "require_payment":  False,
        "recharge_amounts": [5, 10, 20],
        "currency":         "eur",
    })

# ── Sécurité admin ────────────────────────────────────────────────────────────
_ADMIN_SECRET = os.getenv("BAROS_ADMIN_SECRET")

async def verify_admin(x_admin_token: str = Header(default=None)):
    if not _ADMIN_SECRET or x_admin_token != _ADMIN_SECRET:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé.")

# ── Modèles ───────────────────────────────────────────────────────────────────
class CheckoutRequest(BaseModel):
    user_id: int
    amount:  float          # ex: 10.0 (€)

class ManualRechargeRequest(BaseModel):
    user_id:     int
    amount:      float
    description: Optional[str] = "Recharge manuelle admin"

# ── GET /config ───────────────────────────────────────────────────────────────
@router.get("/config")
def get_payment_config():
    """Retourne la config paiement publique pour le frontend."""
    cfg = _payment_config()
    return {
        "require_payment":  cfg.get("require_payment", False),
        "recharge_amounts": cfg.get("recharge_amounts", [5, 10, 20]),
        "currency":         cfg.get("currency", "eur"),
        "stripe_enabled":   bool(stripe.api_key and stripe.api_key.startswith("sk_")),
    }

# ── GET /balance/{user_id} ────────────────────────────────────────────────────
@router.get("/balance/{user_id}")
def get_balance(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    return {"user_id": user_id, "balance": round(user.balance, 2), "name": user.name}

# ── POST /create-checkout ─────────────────────────────────────────────────────
@router.post("/create-checkout")
async def create_checkout(payload: CheckoutRequest, db: Session = Depends(get_db)):
    """
    Crée une Stripe Checkout Session.
    Retourne l'URL vers laquelle rediriger le user.
    """
    if not stripe.api_key or not stripe.api_key.startswith("sk_"):
        raise HTTPException(503, "Stripe non configuré (STRIPE_SECRET_KEY manquante)")

    cfg = _payment_config()
    allowed = cfg.get("recharge_amounts", [5, 10, 20])

    if payload.amount not in allowed:
        raise HTTPException(400, f"Montant non autorisé. Valeurs acceptées : {allowed}")

    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    # Créer la transaction en "pending" avant la redirection
    tx = PaymentTransaction(
        user_id     = payload.user_id,
        amount      = payload.amount,
        type        = "stripe",
        status      = "pending",
        description = f"Recharge {payload.amount}€ — {user.name}",
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],   # Apple Pay / Google Pay activés auto dans Stripe Dashboard
            line_items=[{
                "price_data": {
                    "currency":     cfg.get("currency", "eur"),
                    "unit_amount":  int(payload.amount * 100),   # centimes
                    "product_data": {
                        "name":        f"Recharge BarOS — {payload.amount:.0f}€",
                        "description": f"Crédit pour {user.name}",
                    },
                },
                "quantity": 1,
            }],
            mode="payment",
            # On passe user_id + tx_id en metadata pour le webhook
            metadata={
                "user_id": str(payload.user_id),
                "tx_id":   str(tx.id),
            },
            client_reference_id=str(payload.user_id),
            success_url=f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url =f"{FRONTEND_URL}/payment/cancel",
        )

        # Stocker le session_id pour vérification webhook
        tx.stripe_session_id = session.id
        db.commit()

        return {"checkout_url": session.url, "session_id": session.id}

    except stripe.StripeError as e:
        # Annuler la transaction si Stripe échoue
        tx.status = "failed"
        db.commit()
        raise HTTPException(502, f"Erreur Stripe : {e.user_message or str(e)}")


# ── POST /webhook ─────────────────────────────────────────────────────────────
@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Endpoint appelé par Stripe après confirmation du paiement.
    NE PAS protéger par auth — Stripe signe la requête avec STRIPE_WEBHOOK_SECRET.
    
    À configurer dans le Stripe Dashboard :
      URL : https://ton-domaine/api/payments/webhook
      Events : checkout.session.completed
    """
    payload    = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    # Vérification signature Stripe (protection contre les faux webhooks)
    try:
        if WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
        else:
            # Mode dev sans webhook secret (déconseillé en prod)
            import json as _json
            event = _json.loads(payload)
    except (ValueError, stripe.SignatureVerificationError) as e:
        raise HTTPException(400, f"Webhook invalide : {e}")

    # On ne traite que les paiements confirmés
    if event["type"] == "checkout.session.completed":
        session  = event["data"]["object"]
        metadata = session.get("metadata", {})
        user_id  = int(metadata.get("user_id", 0))
        tx_id    = int(metadata.get("tx_id",   0))
        amount   = session.get("amount_total", 0) / 100.0  # centimes → €

        if not user_id:
            return {"status": "ignored"}

        user = db.get(User, user_id)
        tx   = db.get(PaymentTransaction, tx_id) if tx_id else None

        if not user:
            return {"status": "user_not_found"}

        # Idempotence — évite le double crédit si Stripe renvoie l'event
        if tx and tx.status == "completed":
            return {"status": "already_processed"}

        # ✅ Créditer le solde
        user.balance = round(user.balance + amount, 2)

        if tx:
            tx.status           = "completed"
            tx.stripe_payment_id = session.get("payment_intent")
        else:
            # Créer la transaction si elle n'existe pas (cas edge)
            db.add(PaymentTransaction(
                user_id            = user_id,
                amount             = amount,
                type               = "stripe",
                status             = "completed",
                stripe_session_id  = session.get("id"),
                stripe_payment_id  = session.get("payment_intent"),
                description        = f"Recharge Stripe {amount:.2f}€",
            ))

        db.commit()
        return {"status": "success", "credited": amount, "new_balance": user.balance}

    return {"status": "ignored"}


# ── POST /verify-session ──────────────────────────────────────────────────────
@router.get("/verify-session/{session_id}")
async def verify_session(session_id: str, db: Session = Depends(get_db)):
    """
    Appelé par la page /payment/success pour confirmer le paiement
    et récupérer le nouveau solde.
    """
    tx = db.query(PaymentTransaction).filter(
        PaymentTransaction.stripe_session_id == session_id
    ).first()

    if not tx:
        raise HTTPException(404, "Session introuvable")

    user = db.get(User, tx.user_id)
    return {
        "status":      tx.status,
        "amount":      tx.amount,
        "new_balance": round(user.balance, 2) if user else 0,
        "user_name":   user.name if user else "—",
    }


# ── POST /manual-recharge ─────────────────────────────────────────────────────
@router.post("/manual-recharge", dependencies=[Depends(verify_admin)])
def manual_recharge(payload: ManualRechargeRequest, db: Session = Depends(get_db)):
    """Recharge manuelle par l'admin (espèces, virement, etc.)."""
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    if payload.amount <= 0:
        raise HTTPException(400, "Montant invalide")

    user.balance = round(user.balance + payload.amount, 2)

    db.add(PaymentTransaction(
        user_id     = payload.user_id,
        amount      = payload.amount,
        type        = "manual",
        status      = "completed",
        description = payload.description,
    ))
    db.commit()
    return {
        "status":      "success",
        "user":        user.name,
        "credited":    payload.amount,
        "new_balance": user.balance,
    }


# ── GET /transactions/{user_id} ───────────────────────────────────────────────
@router.get("/transactions/{user_id}")
def get_transactions(user_id: int, limit: int = 20, db: Session = Depends(get_db)):
    """Historique des transactions d'un user."""
    txs = db.query(PaymentTransaction).filter(
        PaymentTransaction.user_id == user_id
    ).order_by(PaymentTransaction.created_at.desc()).limit(limit).all()

    return [{
        "id":          t.id,
        "amount":      t.amount,
        "type":        t.type,
        "status":      t.status,
        "description": t.description,
        "created_at":  t.created_at.isoformat(),
    } for t in txs]