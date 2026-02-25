import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Droplets, Clock, Loader2, Heart,
  CheckCircle, AlertCircle, Euro, ChevronDown, ChevronUp
} from 'lucide-react';
import axios from 'axios';
import { useUser } from '../context/UserContext';

const API = 'http://localhost:8000/api';

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%231a1a1a'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23333' font-size='72'%3E🍹%3C/text%3E%3C/svg%3E";

const WIDMARK_R = { F: 0.55, M: 0.68, default: 0.61 };

function calcBacImpact(standardDrinks, weightKg, gender) {
  if (!weightKg || standardDrinks <= 0) return null;
  const r = WIDMARK_R[gender] ?? WIDMARK_R.default;
  return (standardDrinks * 10) / (weightKg * r);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed top-20 right-6 z-[999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-semibold
                      shadow-2xl border backdrop-blur-xl pointer-events-auto
                      animate-in slide-in-from-right-4 duration-300
                      ${t.type === 'success'
                        ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
                        : 'bg-red-950/90 border-red-500/30 text-red-300'}`}>
          {t.type === 'success'
            ? <CheckCircle size={16} className="shrink-0" />
            : <AlertCircle  size={16} className="shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);
  return { toasts, toast: add };
}

// ── Badge nutrition ───────────────────────────────────────────────────────────
function NutritionBadge({ label, value, unit, highlight }) {
  return (
    <div className={`flex flex-col items-center p-3 rounded-xl border w-24
                     ${highlight
                       ? 'bg-red-500/10 border-red-500/30'
                       : 'bg-white/5 border-white/10'}`}>
      <span className={`text-2xl font-bold ${highlight ? 'text-red-400' : 'text-white'}`}>
        {value}<span className="text-sm font-normal text-gray-500">{unit}</span>
      </span>
      <span className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">{label}</span>
    </div>
  );
}

// ── Bloc prix — coût de revient + marge + prix de vente ──────────────────────
function CostBreakdown({ cocktail }) {
  const [open, setOpen] = useState(false);

  const cost      = cocktail.cost_price;
  const salePrice = cocktail.sale_price;
  const margin    = cocktail.margin_percent;
  const breakdown = cocktail.cost_breakdown;

  if (cost == null || cost === 0) return null;

  return (
    <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 overflow-hidden">
      {/* Ligne principale — prix de vente mis en avant */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <Euro size={18} className="text-orange-400 shrink-0" />
          <div className="text-left">
            <div className="text-xs text-orange-400 font-bold uppercase tracking-widest mb-0.5">
              Prix de vente
            </div>
            <div className="text-white font-black text-2xl leading-tight">
              {salePrice != null ? salePrice.toFixed(2) : cost.toFixed(2)} €
            </div>
            {salePrice != null && margin > 0 && (
              <div className="text-white/30 text-xs mt-0.5">
                dont {margin}% de marge
              </div>
            )}
          </div>
        </div>
        <div className="text-orange-400/60">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Détail déplié */}
      {open && (
        <div className="border-t border-orange-500/10 px-5 pb-5 pt-4 space-y-3">

          {/* Ligne par ingrédient */}
          {breakdown?.length > 0 && (
            <div className="space-y-2">
              {breakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-white/60">
                    <span className="font-mono text-xs text-white/25 w-12 shrink-0">
                      {item.volume_ml}ml
                    </span>
                    <span>{item.name}</span>
                  </div>
                  <span className="text-white/70 font-mono">
                    {item.cost != null ? `${item.cost.toFixed(3)} €` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Séparateur + récap */}
          <div className="border-t border-white/5 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Coût de revient</span>
              <span className="text-white/70 font-mono">{cost.toFixed(2)} €</span>
            </div>
            {salePrice != null && margin > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Marge ({margin}%)</span>
                <span className="text-emerald-400/80 font-mono">
                  +{(salePrice - cost).toFixed(2)} €
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black pt-1 border-t border-white/5">
              <span className="text-orange-400">Prix de vente</span>
              <span className="text-orange-400 text-base">
                {salePrice != null ? salePrice.toFixed(2) : cost.toFixed(2)} €
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function CocktailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { user, favorites, toggleFavorite } = useUser();
  const { toasts, toast } = useToast();

  const [cocktail,  setCocktail]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [isPouring, setIsPouring] = useState(false);
  const [imgError,  setImgError]  = useState(false);
  const [balance,   setBalance]   = useState(null);
  const [payConfig, setPayConfig] = useState({ require_payment: false });

  const isFav = cocktail && favorites.includes(cocktail.id);

  useEffect(() => {
    setLoading(true);
    setImgError(false);
    axios.get(`${API}/cocktails/${id}`)
      .then(r => setCocktail(r.data))
      .catch(e => { console.error("Erreur chargement cocktail:", e); setCocktail(null); })
      .finally(() => setLoading(false));
    // Config paiement
    axios.get(`${API}/payments/config`).then(r => setPayConfig(r.data)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!user?.id) return;
    axios.get(`${API}/payments/balance/${user.id}`)
      .then(r => setBalance(r.data.balance))
      .catch(() => {});
  }, [user]);

  // ── Commande — avec vérification solde et débit Stripe ─────────────────
  const handleOrder = async () => {
    if (!cocktail || isPouring) return;

    // 🔒 VERROU 1 : Vérifier si un utilisateur est connecté
    if (!user) {
      toast("🚫 Veuillez scanner votre badge pour commander", 'error');
      // Optionnel : rediriger vers la home pour qu'ils badgent
      // navigate('/'); 
      return;
    }

    // Si paiement requis et solde insuffisant → rediriger vers la recharge
    if (payConfig.require_payment && cocktail.sale_price != null && user) {
      const currentBalance = balance ?? 0;
      if (currentBalance < cocktail.sale_price) {
        navigate('/payment', {
          state: {
            userId:         user.id,
            userName:       user.name,
            requiredAmount: cocktail.sale_price,
            returnTo:       `/cocktail/${cocktail.id}`,
          }
        });
        return;
      }
    }

    setIsPouring(true);
    try {
      const params = user ? { user_id: user.id } : {};
      if (cocktail.cost_price != null)  params.cost_price  = cocktail.cost_price;
      if (cocktail.sale_price != null)  params.sale_price  = cocktail.sale_price;

      const res   = await axios.post(`${API}/cocktails/${cocktail.id}/pour`, null, { params });
      const temps = Math.round(res.data.estimated_time ?? 0);

      // Mettre à jour le solde affiché
      if (res.data.new_balance != null) setBalance(res.data.new_balance);

      toast(`✅ Préparation lancée — environ ${temps}s`, 'success');
    } catch (err) {
      const detail = err.response?.data?.detail;
      // 402 = solde insuffisant (race condition entre check et débit)
      if (err.response?.status === 402 && typeof detail === 'object' && user) {
        navigate('/payment', {
          state: {
            userId:         user.id,
            userName:       user.name,
            requiredAmount: detail.required,
            returnTo:       `/cocktail/${cocktail.id}`,
          }
        });
        return;
      }
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map(d => d.msg).join(', ')
          : "Erreur de connexion au serveur";
      toast(`❌ ${msg}`, 'error');
    } finally {
      setIsPouring(false);
    }
  };

  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    if (!user) { toast("Connecte-toi pour ajouter des favoris !", 'error'); return; }
    toggleFavorite(cocktail.id);
  };

  const bacImpact = cocktail && user?.weight_kg
    ? calcBacImpact(cocktail.standard_drinks, user.weight_kg, user.gender)
    : null;

  if (loading) return (
    <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto" />
        <p className="text-orange-500 font-mono text-sm animate-pulse">CHARGEMENT…</p>
      </div>
    </div>
  );

  if (!cocktail) return (
    <div className="h-screen w-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
      <AlertCircle size={48} className="text-red-400" />
      <p className="text-white text-xl font-bold">Cocktail introuvable</p>
      <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-colors text-sm mt-2">
        ← Retour
      </button>
    </div>
  );

  const imgSrc = imgError || !cocktail.image_url ? FALLBACK_IMG : cocktail.image_url;

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white relative overflow-hidden flex flex-col md:flex-row">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-20px); }
        }
      `}</style>

      <Toast toasts={toasts} />

      {/* ── Bouton retour ──────────────────────────────────────────────────── */}
      <button onClick={() => navigate(-1)}
        className="absolute top-6 left-6 z-50 p-3 bg-black/20 backdrop-blur-md rounded-full
                   border border-white/10 hover:bg-white/10 transition-all group">
        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
      </button>

      {/* ── Section image ──────────────────────────────────────────────────── */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-screen relative flex items-center
                      justify-center overflow-hidden bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]">
        <div className="absolute inset-0 bg-cover bg-center opacity-40 blur-[50px] scale-150"
          style={{ backgroundImage: `url(${imgSrc})` }} />
        <button onClick={handleToggleFavorite}
          className="absolute top-6 right-6 z-50 p-4 rounded-full bg-black/40
                     backdrop-blur-xl border border-white/10 hover:bg-white/10
                     transition-all hover:scale-110 active:scale-90">
          <Heart size={32} className={`transition-all duration-300 ${isFav ? 'fill-red-500 text-red-500' : 'text-white'}`} />
        </button>
        <div className="relative z-10 w-full h-full flex items-center justify-center p-8">
          <img
            src={imgSrc}
            alt={cocktail.name}
            onError={() => setImgError(true)}
            style={{ animation: 'float 6s ease-in-out infinite' }}
            className="h-[80%] w-full object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)]"
          />
        </div>
      </div>

      {/* ── Section infos ──────────────────────────────────────────────────── */}
      <div className="w-full md:w-1/2 h-auto md:h-screen bg-[#0f0f0f]/90 backdrop-blur-xl
                      border-l border-white/5 flex flex-col justify-center p-8 md:p-16
                      relative z-20 overflow-y-auto">
        <div className="space-y-6 max-w-lg mx-auto mt-16 md:mt-0">

          {/* Nom */}
          <div>
            <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent
                           bg-gradient-to-r from-white to-gray-500 mb-2">
              {cocktail.name}
            </h1>
          </div>

          {/* Badges texte */}
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 bg-white/10 w-fit
                            px-4 py-1.5 rounded-full border border-white/20
                            text-sm font-bold text-gray-300">
              {cocktail.nutriscore_warning}
              {cocktail.standard_drinks > 0 && (
                <span className="text-orange-400 ml-2 border-l border-white/20 pl-2">
                  {cocktail.standard_drinks} verre{cocktail.standard_drinks > 1 ? 's' : ''} standard
                </span>
              )}
            </div>
            {bacImpact !== null && (
              <div className={`inline-flex items-center gap-2 w-fit px-4 py-1.5
                              rounded-full border text-sm font-bold
                              ${bacImpact > 0.5
                                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'}`}>
                🩸 Impact estimé :
                <span className={bacImpact > 0.5 ? 'text-red-400' : 'text-green-400'}>
                  +{bacImpact.toFixed(2)} g/L
                </span>
              </div>
            )}
          </div>

          {/* Badges chiffres */}
          <div className="flex gap-4">
            <NutritionBadge label="Alcool"  value={cocktail.alcohol_degree ?? 0}  unit="°" />
            <NutritionBadge label="Kcal"    value={cocktail.total_kcal ?? 0}       unit="" />
            <NutritionBadge label="Sucre"   value={cocktail.total_sugar_g ?? 0}    unit="g"
              highlight={(cocktail.total_sugar_g ?? 0) > 25} />
          </div>

          {/* Solde + avertissement si insuffisant */}
          {payConfig.require_payment && user && balance !== null && cocktail.sale_price != null && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm
                            ${balance >= cocktail.sale_price
                              ? 'bg-emerald-500/5 border-emerald-500/20'
                              : 'bg-red-500/5 border-red-500/20'}`}>
              <span className="text-gray-400">Ton solde</span>
              <div className="flex items-center gap-3">
                <span className={`font-black text-lg ${balance >= cocktail.sale_price ? 'text-emerald-400' : 'text-red-400'}`}>
                  {balance.toFixed(2)} €
                </span>
                {balance < cocktail.sale_price && (
                  <button
                    onClick={() => navigate('/payment', { state: { userId: user.id, userName: user.name, requiredAmount: cocktail.sale_price, returnTo: `/cocktail/${cocktail.id}` }})}
                    className="text-xs bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg font-bold transition-all"
                  >
                    Recharger
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Prix de revient cliquable */}
          <CostBreakdown cocktail={cocktail} />

          {/* Temps + volume */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-xl flex items-center gap-3 border border-white/5">
              <Clock className="text-orange-500 shrink-0" />
              <div>
                <div className="text-xs text-gray-500 uppercase">Temps estimé</div>
                <div className="font-bold">~{Math.round(cocktail.estimated_time ?? 0)}s</div>
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl flex items-center gap-3 border border-white/5">
              <Droplets className="text-blue-400 shrink-0" />
              <div>
                <div className="text-xs text-gray-500 uppercase">Volume total</div>
                <div className="font-bold">{cocktail.total_volume_ml ?? 0} ml</div>
              </div>
            </div>
          </div>

          {/* Bouton commander */}
          <div className="pt-4">
            <button
              onClick={handleOrder}
              disabled={isPouring || (user && !cocktail.compatible_with_stock)}
              className={`w-full py-5 rounded-2xl font-bold text-xl text-white
                          flex items-center justify-center gap-3 transition-all
                          ${!user 
                            ? 'bg-violet-900/40 border border-violet-500/50 text-violet-200 shadow-[0_0_20px_rgba(139,92,246,0.2)]' 
                            : isPouring
                              ? 'bg-gray-700 cursor-wait'
                              : !cocktail.compatible_with_stock
                                ? 'bg-red-900/50 cursor-not-allowed border border-red-500/50'
                                : `bg-gradient-to-r from-orange-500 to-red-600
                                   shadow-[0_0_30px_rgba(249,115,22,0.4)]
                                   hover:shadow-[0_0_50px_rgba(249,115,22,0.6)]
                                   hover:scale-[1.02] active:scale-95`}`}
            >
              {isPouring ? (
                <><Loader2 className="animate-spin" /> PRÉPARATION…</>
              ) : !user ? (
                <><CheckCircle className="text-violet-400" /> SCANNEZ VOTRE BADGE</>
              ) : !cocktail.compatible_with_stock ? (
                "STOCK INSUFFISANT"
              ) : (
                <><Play fill="currentColor" /> LANCER LA PRÉPARATION</>
              )}
            </button>
            
            {!user && (
              <p className="text-center text-xs text-violet-400/60 mt-3 animate-pulse">
                L'identification est requise pour servir une boisson
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}