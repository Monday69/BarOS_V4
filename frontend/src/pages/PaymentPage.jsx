/**
 * BarOS V4 — Terminal de Paiement Hybrid-Pay
 * Chemin : src/pages/PaymentPage.jsx
 *
 * Flow :
 *   1. User arrive sur /payment (depuis CocktailPage si solde insuffisant)
 *   2. Choisit un montant → POST /api/payments/create-checkout
 *   3. Backend retourne une Stripe Checkout URL
 *   4. La page génère un QR code avec cette URL (qrcode.react)
 *   5. User scanne avec son téléphone → paie Apple Pay / CB sur Stripe
 *   6. Webhook Stripe confirme → solde crédité en base
 *   7. Polling toutes les 2s sur GET /api/payments/balance/:userId
 *   8. Dès que le solde augmente → vue "Paiement confirmé" + bouton retour cocktail
 *
 * Dépendance : npm install qrcode.react
 *
 * navigate('/payment', { state: { userId, userName, requiredAmount, returnTo } })
 */
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  CreditCard, Wallet, CheckCircle2, Loader2,
  ArrowLeft, Smartphone, Euro, RefreshCw, Zap
} from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:8000/api';

// ── États de la machine ───────────────────────────────────────────────────────
// idle → selecting → generating → waiting_payment → confirmed
const STATE = {
  SELECTING:        'selecting',
  GENERATING:       'generating',
  WAITING_PAYMENT:  'waiting_payment',
  CONFIRMED:        'confirmed',
};

export default function PaymentPage() {
  const location  = useLocation();
  const navigate  = useNavigate();

  const {
    userId,
    userName,
    requiredAmount,
    returnTo,
  } = location.state || {};

  const [phase,        setPhase]        = useState(STATE.SELECTING);
  const [config,       setConfig]       = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [checkoutUrl,  setCheckoutUrl]  = useState(null);
  const [balanceBefore,setBalanceBefore]= useState(null);   // solde avant paiement
  const [balanceAfter, setBalanceAfter] = useState(null);   // solde après confirmation
  const [pollCount,    setPollCount]    = useState(0);
  const [error,        setError]        = useState(null);
  const pollRef = useRef(null);

  // ── Charger config paiement + solde initial ───────────────────────────────
  useEffect(() => {
    axios.get(`${API}/payments/config`).then(r => {
      setConfig(r.data);
      if (r.data.recharge_amounts?.length) {
        // Pré-sélectionner le montant minimal couvrant le besoin
        const sufficient = requiredAmount
          ? r.data.recharge_amounts.find(a => a >= requiredAmount)
          : null;
        setSelected(sufficient ?? r.data.recharge_amounts[1] ?? r.data.recharge_amounts[0]);
      }
    }).catch(() => setError("Impossible de charger la configuration."));

    if (userId) {
      axios.get(`${API}/payments/balance/${userId}`)
        .then(r => setBalanceBefore(r.data.balance))
        .catch(() => {});
    }
  }, []);

  // ── Démarrer le polling quand on entre en phase WAITING_PAYMENT ───────────
  useEffect(() => {
    if (phase !== STATE.WAITING_PAYMENT) {
      clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const r = await axios.get(`${API}/payments/balance/${userId}`);
        const newBalance = r.data.balance;
        setPollCount(c => c + 1);

        // Le webhook a crédité le solde → paiement confirmé
        if (newBalance > balanceBefore) {
          clearInterval(pollRef.current);
          setBalanceAfter(newBalance);
          setPhase(STATE.CONFIRMED);
        }
      } catch {/* réseau instable, on réessaie au prochain tick */}
    }, 2000);

    return () => clearInterval(pollRef.current);
  }, [phase, balanceBefore, userId]);

  // ── Générer la session Stripe + URL ──────────────────────────────────────
  const handleGenerateQR = async () => {
    if (!selected || !userId) return;
    setPhase(STATE.GENERATING);
    setError(null);
    try {
      const r = await axios.post(`${API}/payments/create-checkout`, {
        user_id: userId,
        amount:  selected,
      });
      setCheckoutUrl(r.data.checkout_url);
      setPhase(STATE.WAITING_PAYMENT);
    } catch (err) {
      const msg = err.response?.data?.detail ?? "Erreur de création de session Stripe.";
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setPhase(STATE.SELECTING);
    }
  };

  const handleReset = () => {
    clearInterval(pollRef.current);
    setPhase(STATE.SELECTING);
    setCheckoutUrl(null);
    setPollCount(0);
    setError(null);
    // Rafraîchir le solde de référence
    if (userId) {
      axios.get(`${API}/payments/balance/${userId}`)
        .then(r => setBalanceBefore(r.data.balance))
        .catch(() => {});
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* ── PHASE : SÉLECTION DU MONTANT ── */}
        {phase === STATE.SELECTING && (
          <div className="space-y-6">

            {/* Header */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl
                              flex items-center justify-center mx-auto shadow-lg shadow-violet-500/20">
                <Wallet size={30} />
              </div>
              <div>
                <h1 className="text-3xl font-black">Recharger mon solde</h1>
                {userName && <p className="text-gray-500 text-sm mt-1">{userName}</p>}
              </div>
            </div>

            {/* Solde actuel */}
            {balanceBefore !== null && (
              <div className={`rounded-2xl p-4 border text-center ${
                requiredAmount && balanceBefore < requiredAmount
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-white/5 border-white/10'
              }`}>
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Solde actuel</div>
                <div className={`text-3xl font-black tabular-nums ${
                  requiredAmount && balanceBefore < requiredAmount ? 'text-red-400' : 'text-white'
                }`}>
                  {balanceBefore.toFixed(2)} €
                </div>
                {requiredAmount && balanceBefore < requiredAmount && (
                  <div className="text-xs text-red-400/70 mt-1">
                    Manque {(requiredAmount - balanceBefore).toFixed(2)} € pour ce cocktail
                  </div>
                )}
              </div>
            )}

            {/* Choix du montant */}
            {config && (
              <div className="space-y-3">
                <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
                  Choisir le montant
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {config.recharge_amounts.map(amount => (
                    <button key={amount} onClick={() => setSelected(amount)}
                      className={`py-5 rounded-xl font-black text-2xl transition-all ${
                        selected === amount
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30 scale-105'
                          : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                      }`}>
                      {amount} €
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Info méthodes */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
              <Smartphone size={13} />
              <span>Scannez le QR avec votre téléphone · Apple Pay / Google Pay / CB</span>
            </div>

            {/* Erreur */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* Bouton générer QR */}
            <button onClick={handleGenerateQR}
              disabled={!selected || !config?.stripe_enabled}
              className="w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3
                         bg-gradient-to-r from-violet-600 to-indigo-600
                         hover:from-violet-500 hover:to-indigo-500
                         disabled:opacity-40 disabled:cursor-not-allowed
                         shadow-[0_0_30px_rgba(139,92,246,0.3)]
                         hover:shadow-[0_0_50px_rgba(139,92,246,0.5)]
                         transition-all hover:scale-[1.02] active:scale-95">
              <CreditCard size={22} />
              Générer le QR code
            </button>

            {!config?.stripe_enabled && (
              <p className="text-center text-xs text-red-400/60">
                Stripe non configuré — ajouter STRIPE_SECRET_KEY dans .env
              </p>
            )}

            {/* Retour */}
            <button onClick={() => navigate(returnTo ?? '/bar')}
              className="w-full py-3 text-gray-600 hover:text-gray-400 text-sm transition-colors
                         flex items-center justify-center gap-2">
              <ArrowLeft size={15} /> Retourner au bar
            </button>
          </div>
        )}

        {/* ── PHASE : GÉNÉRATION EN COURS ── */}
        {phase === STATE.GENERATING && (
          <div className="text-center space-y-4">
            <Loader2 size={48} className="text-violet-400 animate-spin mx-auto" />
            <p className="text-gray-400 animate-pulse">Création de la session Stripe…</p>
          </div>
        )}

        {/* ── PHASE : QR CODE AFFICHÉ — EN ATTENTE DU PAIEMENT ── */}
        {phase === STATE.WAITING_PAYMENT && checkoutUrl && (
          <div className="space-y-6">

            {/* Header */}
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-black">Scannez pour payer</h1>
              <p className="text-gray-500 text-sm">
                {selected} € · {userName ?? 'Invité'}
              </p>
            </div>

            {/* QR Code — grand, bien lisible */}
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-5 rounded-3xl shadow-[0_0_60px_rgba(139,92,246,0.4)]
                              border-4 border-violet-500/30">
                <QRCodeSVG
                  value={checkoutUrl}
                  size={220}
                  level="M"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#0a0a0a"
                />
              </div>

              {/* Animation polling */}
              <div className="flex items-center gap-2 text-violet-400 text-sm font-semibold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
                </span>
                En attente du paiement…
                <span className="text-white/20 text-xs font-normal ml-1">({pollCount * 2}s)</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-2.5">
              {[
                ['1', 'Ouvrez l\'appareil photo ou Lydia'],
                ['2', 'Scannez le QR code'],
                ['3', 'Payez par Apple Pay, Google Pay ou CB'],
                ['4', 'Revenez ici — la page se met à jour automatiquement'],
              ].map(([n, txt]) => (
                <div key={n} className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400
                                   text-xs font-black flex items-center justify-center shrink-0">
                    {n}
                  </span>
                  <span className="text-gray-400">{txt}</span>
                </div>
              ))}
            </div>

            {/* Bouton changer de montant */}
            <button onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 py-3 text-gray-600
                         hover:text-gray-400 text-sm transition-colors">
              <RefreshCw size={14} /> Changer le montant
            </button>
          </div>
        )}

        {/* ── PHASE : PAIEMENT CONFIRMÉ ── */}
        {phase === STATE.CONFIRMED && (
          <div className="space-y-6 text-center">

            {/* Icône succès */}
            <div className="relative mx-auto w-28 h-28">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="relative w-28 h-28 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40
                              flex items-center justify-center">
                <CheckCircle2 size={52} className="text-emerald-400" />
              </div>
            </div>

            <div>
              <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-1">
                Paiement confirmé
              </p>
              <div className="text-5xl font-black text-white tabular-nums">
                +{selected} <span className="text-2xl text-emerald-400">€</span>
              </div>
            </div>

            {/* Nouveau solde */}
            {balanceAfter !== null && (
              <div className="bg-white/5 border border-white/10 rounded-2xl px-8 py-5">
                <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">Nouveau solde</div>
                <div className="text-4xl font-black text-white tabular-nums">
                  {balanceAfter.toFixed(2)} <span className="text-xl text-emerald-400">€</span>
                </div>
              </div>
            )}

            {/* Bouton retour cocktail */}
            <button onClick={() => navigate(returnTo ?? '/bar')}
              className="w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3
                         bg-gradient-to-r from-emerald-600 to-teal-600
                         hover:from-emerald-500 hover:to-teal-500
                         shadow-[0_0_30px_rgba(16,185,129,0.3)]
                         hover:shadow-[0_0_50px_rgba(16,185,129,0.5)]
                         transition-all hover:scale-[1.02] active:scale-95">
              <Zap size={22} fill="currentColor" />
              {returnTo ? 'Commander mon cocktail' : 'Retour au bar'}
            </button>

          </div>
        )}

      </div>
    </div>
  );
}