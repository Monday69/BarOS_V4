// ProfilePage.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Activity, ShieldCheck, AlertTriangle, Car, Wine,
  User as UserIcon, Star, Zap, Flame, Droplets,
  Clock, ChevronRight, BarChart2, Sparkles, Euro, TrendingUp, TrendingDown,
  Minus, Percent, Save, BarChart3, Wallet, CreditCard, ToggleLeft, ToggleRight, Plus,
  Heart, ArrowRight
} from 'lucide-react';
import { FileSpreadsheet } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';

const API_BASE = API_BASE_URL;
const API      = `${API_BASE_URL}/users`;
const ADMIN_API = `${API_BASE_URL}/admin`;
const PAY_API  = `${API_BASE_URL}/payments`;

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%231a1a1a'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23333' font-size='48'%3E🍹%3C/text%3E%3C/svg%3E";

const getAdminKey = () => sessionStorage.getItem('baros_admin_key') ?? '';
const saveAdminKey = (k) => { if (k) sessionStorage.setItem('baros_admin_key', k); };
const promptAdminKey = (msg = 'Clé admin :') => {
  const existing = getAdminKey();
  if (existing) return existing;
  const entered = window.prompt(msg);
  if (entered) saveAdminKey(entered);
  return entered;
};
const adminHeaders = (key) => ({ 'x-admin-token': key });

// ─── Composants utilitaires ───────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
    purple:  'bg-purple-500/10 border-purple-500/20 text-purple-400',
    amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
    rose:    'bg-rose-500/10 border-rose-500/20 text-rose-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  };
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border ${colors[color]}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors[color]}`}>{icon}</div>
      <div>
        <div className="text-lg font-bold text-white leading-tight">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-125">
          <Star size={16} className={`transition-colors ${n <= (hovered || value) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 mt-0.5">{icon}</div>
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Section Mes Favoris ──────────────────────────────────────────────────────

function FavoritesSection({ userId }) {
  const navigate             = useNavigate();
  const { favorites, toggleFavorite } = useUser();
  const [favRecipes, setFavRecipes]   = useState([]);
  const [allRecipes, setAllRecipes]   = useState([]);
  const [ratings, setRatings]         = useState({});
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [recipesRes, ratingsRes] = await Promise.all([
          axios.get(`${API_BASE}/cocktails/?available_only=false&limit=200`),
          axios.get(`${API_BASE}/cocktails/ratings/all`),
        ]);
        setAllRecipes(recipesRes.data);
        setRatings(ratingsRes.data);
      } catch (e) {
        console.error("Erreur chargement favoris:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    const favs = allRecipes.filter(r => favorites.includes(r.id));
    setFavRecipes(favs);
  }, [favorites, allRecipes]);

  if (loading) return (
    <div className="bg-[#111] rounded-3xl p-7 border border-white/[0.08]">
      <SectionTitle icon={<Heart size={18} />} title="Mes Favoris" />
      <div className="h-24 flex items-center justify-center text-gray-600 text-sm animate-pulse">Chargement…</div>
    </div>
  );

  return (
    <div className="bg-[#111] rounded-3xl p-7 border border-red-500/10">
      <div className="flex items-start justify-between mb-6">
        <SectionTitle
          icon={<Heart size={18} className="text-red-400 fill-red-400" />}
          title="Mes Favoris"
          subtitle={favRecipes.length > 0 ? `${favRecipes.length} cocktail${favRecipes.length > 1 ? 's' : ''} likés` : 'Aucun favori pour le moment'}
        />
        {favRecipes.length > 0 && (
          <button
            onClick={() => navigate('/')}
            className="text-xs text-gray-500 hover:text-orange-400 transition-colors flex items-center gap-1 shrink-0"
          >
            Voir le bar <ArrowRight size={12} />
          </button>
        )}
      </div>

      {favRecipes.length === 0 ? (
        <div className="text-center py-10">
          <Heart size={40} className="text-gray-800 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Appuie sur ❤️ sur la fiche d'un cocktail pour l'ajouter ici.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {favRecipes.map(recipe => {
            const rating = ratings[recipe.id];
            return (
              <div
                key={recipe.id}
                className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-red-500/20 rounded-2xl overflow-hidden transition-all cursor-pointer"
                onClick={() => navigate(`/cocktail/${recipe.id}`)}
              >
                {/* Mini image en fond */}
                {recipe.image_url && (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-[0.06] group-hover:opacity-[0.1] transition-opacity"
                    style={{ backgroundImage: `url(${recipe.image_url})` }}
                  />
                )}
                <div className="relative p-4 flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-white/5">
                    <img
                      src={recipe.image_url || FALLBACK_IMG}
                      alt={recipe.name}
                      className="w-full h-full object-cover"
                      onError={e => { e.target.src = FALLBACK_IMG; }}
                    />
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate">{recipe.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {rating?.average ? (
                        <>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} size={10}
                                className={n <= Math.round(rating.average)
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-gray-700'} />
                            ))}
                          </div>
                          <span className="text-amber-400 text-xs font-bold">{rating.average}</span>
                        </>
                      ) : (
                        <span className="text-gray-600 text-xs">Pas encore noté</span>
                      )}
                      {recipe.price > 0 && (
                        <span className="text-orange-400 text-xs font-mono ml-auto">{recipe.price.toFixed(2)} €</span>
                      )}
                    </div>
                    {/* Ingrédients en mini */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {recipe.ingredients.slice(0, 3).map(ing => (
                        <span key={typeof ing === 'string' ? ing : ing.name}
                          className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">
                          {typeof ing === 'string' ? ing : ing.name}
                        </span>
                      ))}
                      {recipe.ingredients.length > 3 && (
                        <span className="text-[10px] text-gray-700">+{recipe.ingredients.length - 3}</span>
                      )}
                    </div>
                  </div>

                  {/* Bouton unlike */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleFavorite(recipe.id); }}
                    className="shrink-0 p-2 rounded-full hover:bg-red-500/10 transition-all group/heart"
                    title="Retirer des favoris"
                  >
                    <Heart size={16} className="text-red-400 fill-red-400 group-hover/heart:fill-transparent transition-all" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Carte solde ──────────────────────────────────────────────────────────────

function SoldeCard({ userId, navigate }) {
  const [balance,  setBalance]  = useState(null);
  const [history,  setHistory]  = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${PAY_API}/balance/${userId}`),
      axios.get(`${PAY_API}/transactions/${userId}?limit=5`),
    ]).then(([balRes, txRes]) => {
      setBalance(balRes.data.balance);
      setHistory(txRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  const typeLabel = (t) => {
    if (t.type === 'stripe') return '💳 Recharge Stripe';
    if (t.type === 'manual') return '🤝 Recharge admin';
    if (t.type === 'debit')  return '🍹 Cocktail';
    return t.type;
  };

  return (
    <div className="bg-[#111] rounded-3xl border border-white/[0.08] overflow-hidden">
      <div onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center justify-between p-7 hover:bg-white/[0.02] transition-colors cursor-pointer">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Wallet size={22} className="text-violet-400" />
          </div>
          <div className="text-left">
            <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-0.5">Mon solde</div>
            {loading ? (
              <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
            ) : (
              <div className={`text-3xl font-black tabular-nums ${balance > 0 ? 'text-white' : 'text-gray-500'}`}>
                {balance?.toFixed(2) ?? '—'} <span className="text-lg text-violet-400">€</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); navigate('/payment', { state: { userId } }); }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all">
            <Plus size={14} /> Recharger
          </button>
          <ChevronRight size={16} className={`text-gray-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.06] px-7 pb-5 pt-4">
          <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Dernières transactions</div>
          {history.length === 0 ? (
            <div className="text-gray-600 text-sm text-center py-4">Aucune transaction.</div>
          ) : (
            <div className="space-y-2">
              {history.map(tx => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                  <div>
                    <div className="text-white text-sm font-semibold">{typeLabel(tx)}</div>
                    <div className="text-gray-600 text-xs mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className={`font-mono font-black text-sm ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section Alcoolémie ───────────────────────────────────────────────────────

function AlcoolemieSection({ userId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/${userId}/alcoolemia`)
      .then(r => setData(r.data))
      .catch(e => console.error("Erreur alcoolémie:", e))
      .finally(() => setLoading(false));
  }, [userId]);

  const bac      = data?.current_bac ?? 0;
  const pct      = Math.min((bac / 1.5) * 100, 100);
  const canDrive = data?.can_drive ?? true;

  return (
    <div className="bg-[#111] rounded-3xl p-7 border border-white/[0.08]">
      <SectionTitle icon={<Activity size={18} />} title="Alcoolémie en temps réel"
        subtitle="Formule de Widmark · Mise à jour à chaque visite" />
      {loading ? (
        <div className="h-32 flex items-center justify-center text-gray-600 text-sm animate-pulse">Calcul métabolique…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`rounded-2xl p-6 border flex flex-col items-center text-center gap-4 ${canDrive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Taux estimé</div>
            <div className={`text-6xl font-black tabular-nums ${canDrive ? 'text-emerald-400' : 'text-red-400'}`}>
              {(bac ?? 0).toFixed(2)}<span className="text-xl text-gray-500 font-normal ml-1">g/L</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${canDrive ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between w-full text-xs text-gray-600">
              <span>0.0</span><span>0.5 ⚠️</span><span>1.0</span><span>1.5</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${canDrive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
              {canDrive ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
              {data?.status ?? '—'}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4">
            <StatCard icon={<Wine size={18} />}  label="Commandés ce soir"         value={`${data?.drinks_count ?? 0} verres`} color="purple" />
            <StatCard icon={<Clock size={18} />} label="Depuis le premier verre"   value={data?.hours_since_first_drink != null ? `${data.hours_since_first_drink}h` : '—'} color="blue" />
            <StatCard icon={<Car size={18} />}   label="Conduite (limite 0.5 g/L)" value={canDrive ? 'Autorisé ✓' : 'Interdit ✗'} color={canDrive ? 'emerald' : 'rose'} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section Dépenses ─────────────────────────────────────────────────────────

function DepensesSection({ userId }) {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    axios.get(`${API}/${userId}/spending`)
      .then(r => setData(r.data))
      .catch(e => console.error("Erreur dépenses:", e))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="bg-[#111] rounded-3xl p-7 border border-white/[0.08]">
      <SectionTitle icon={<Euro size={18} />} title="Dépenses" />
      <div className="h-32 flex items-center justify-center text-gray-600 text-sm animate-pulse">Calcul des dépenses…</div>
    </div>
  );

  if (!data || data.total_tonight === 0) return (
    <div className="bg-[#111] rounded-3xl p-7 border border-white/[0.08]">
      <SectionTitle icon={<Euro size={18} />} title="Dépenses" subtitle="Coût de revient des cocktails commandés" />
      <div className="text-center text-gray-600 py-10 text-sm">
        Aucune dépense enregistrée ce soir.<br />
        <span className="text-gray-700 text-xs">Les prix s'affichent quand les bouteilles ont un prix renseigné.</span>
      </div>
    </div>
  );

  const diff       = data.total_tonight - (data.prev_session_total ?? 0);
  const hasPrev    = data.prev_session_total != null;
  const TrendIcon  = diff > 0.01 ? TrendingUp : diff < -0.01 ? TrendingDown : Minus;
  const trendColor = diff > 0.01 ? 'text-red-400' : diff < -0.01 ? 'text-emerald-400' : 'text-gray-400';

  return (
    <div className="bg-[#111] rounded-3xl p-7 border border-white/[0.08]">
      <SectionTitle icon={<Euro size={18} />} title="Dépenses" subtitle="Coût de revient des cocktails commandés" />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 text-center">
          <div className="text-xs text-emerald-400 font-bold uppercase tracking-widest mb-1">Total ce soir</div>
          <div className="text-4xl font-black text-white tabular-nums">{data.total_tonight.toFixed(2)}<span className="text-lg text-emerald-400 ml-1">€</span></div>
          <div className="text-xs text-gray-600 mt-1">{data.count_tonight} cocktail{data.count_tonight > 1 ? 's' : ''}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 text-center">
          <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Prix moyen</div>
          <div className="text-4xl font-black text-white tabular-nums">{data.avg_tonight.toFixed(2)}<span className="text-lg text-gray-500 ml-1">€</span></div>
          <div className="text-xs text-gray-600 mt-1">par cocktail</div>
        </div>
      </div>
      {hasPrev && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-5 ${diff > 0.01 ? 'bg-red-500/5 border-red-500/15' : diff < -0.01 ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-white/5 border-white/10'}`}>
          <TrendIcon size={16} className={trendColor} />
          <span className="text-sm text-gray-400">Soirée précédente : <span className="text-white font-bold">{data.prev_session_total.toFixed(2)} €</span></span>
          <span className={`ml-auto text-sm font-bold ${trendColor}`}>{diff > 0 ? '+' : ''}{diff.toFixed(2)} €</span>
        </div>
      )}
      <button onClick={() => setShowDetail(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-colors mb-2">
        <span className="text-sm font-bold text-gray-400">Détail par cocktail</span>
        <ChevronRight size={14} className={`text-gray-600 transition-transform ${showDetail ? 'rotate-90' : ''}`} />
      </button>
      {showDetail && data.orders?.length > 0 && (
        <div className="space-y-2 mt-1">
          {data.orders.map((o, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
              <div>
                <div className="text-white text-sm font-semibold">{o.recipe_name ?? '—'}</div>
                <div className="text-gray-600 text-xs mt-0.5">{o.time}</div>
              </div>
              <div className="text-right">
                {o.cost_price != null
                  ? <div className="text-emerald-400 font-mono font-bold text-sm">{o.cost_price.toFixed(2)} €</div>
                  : <div className="text-gray-600 text-xs">Prix non renseigné</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section Stats ────────────────────────────────────────────────────────────

function StatsSection({ userId }) {
  const [data, setData]       = useState(null);
  const [period, setPeriod]   = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/${userId}/stats?days=${period}`)
      .then(r => setData(r.data))
      .catch(e => console.error("Erreur stats:", e))
      .finally(() => setLoading(false));
  }, [userId, period]);

  return (
    <div className="bg-[#111] rounded-3xl p-7 border border-white/[0.08]">
      <div className="flex items-start justify-between mb-6">
        <SectionTitle icon={<BarChart2 size={18} />} title="Statistiques de consommation" subtitle={`Sur les ${period} derniers jours`} />
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl shrink-0">
          {[7, 30, 90].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {p}j
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-32 flex items-center justify-center text-gray-600 text-sm animate-pulse">Chargement…</div>
      ) : !data || data.total_orders === 0 ? (
        <div className="text-center text-gray-600 py-10 text-sm">Aucune commande sur cette période.</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<Wine size={18} />}     label="Verres"        value={data.total_orders}              color="purple" />
            <StatCard icon={<Flame size={18} />}    label="Calories"      value={`${data.total_kcal ?? 0} kcal`} color="amber" />
            <StatCard icon={<Droplets size={18} />} label="Sucre"         value={`${data.total_sugar_g ?? 0} g`} color="blue" />
            <StatCard icon={<Zap size={18} />}      label="Unités alcool" value={data.total_alcohol_units} sub="1 unité = 10g" color="rose" />
          </div>
          {data.average_rating && (
            <div className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/15 rounded-2xl px-5 py-4">
              <Star size={18} className="text-amber-400 fill-amber-400" />
              <span className="text-white font-semibold">{data.average_rating}/5</span>
              <span className="text-gray-500 text-sm">Moyenne de tes notes</span>
            </div>
          )}
          {data.top_cocktails?.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Tes favoris du moment</div>
              <div className="space-y-2">
                {data.top_cocktails.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/5 transition-colors rounded-xl px-4 py-3">
                    <span className="text-gray-600 font-mono text-sm w-5">{i + 1}.</span>
                    <span className="text-white font-medium flex-1">{c.name}</span>
                    <span className="text-gray-500 text-sm">{c.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.category_breakdown && Object.keys(data.category_breakdown).length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Par catégorie</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.category_breakdown).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <span key={cat} className="bg-white/5 border border-white/[0.08] text-gray-300 text-xs px-3 py-1.5 rounded-full">
                    {cat} · <span className="text-gray-500">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section Historique + Notation ───────────────────────────────────────────

const formatDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
});

function HistoriqueSection({ userId }) {
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [submitting, setSubmitting] = useState({});

  const fetchHistory = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/${userId}/history?page=${page}&page_size=5&days=30`)
      .then(r => { setOrders(r.data); setHasMore(r.data.length === 5); })
      .catch(e => console.error("Erreur historique:", e))
      .finally(() => setLoading(false));
  }, [userId, page]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const submitRating = async (orderId, rating) => {
    setSubmitting(p => ({ ...p, [orderId]: true }));
    try {
      await axios.post(`${API}/${userId}/history/${orderId}/rate`, { rating });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, rating } : o));
    } catch (e) { console.error("Erreur notation:", e); }
    finally { setSubmitting(p => ({ ...p, [orderId]: false })); }
  };

  return (
    <div className="bg-[#111] rounded-3xl p-7 border border-white/[0.08]">
      <SectionTitle icon={<Clock size={18} />} title="Historique récent" subtitle="30 derniers jours · Note tes verres directement" />
      {loading ? (
        <div className="h-32 flex items-center justify-center text-gray-600 text-sm animate-pulse">Chargement…</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-600 py-10 text-sm">Aucune commande récente.</div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <div key={order.id} className="flex items-center justify-between gap-4 bg-white/[0.03] hover:bg-white/5 transition-colors rounded-2xl px-5 py-4 border border-white/5">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{order.recipe?.name ?? '—'}</div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-600">{formatDate(order.timestamp)}</span>
                  {order.cost_price != null && (
                    <span className="text-xs text-emerald-400 font-mono font-bold">{order.cost_price.toFixed(2)} €</span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {submitting[order.id]
                  ? <span className="text-xs text-gray-600 animate-pulse">Sauvegarde…</span>
                  : <StarRating value={order.rating ?? 0} onChange={r => submitRating(order.id, r)} />}
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center pt-3">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="text-xs text-gray-500 hover:text-white disabled:opacity-30 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">← Précédent</button>
            <span className="text-xs text-gray-600">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={!hasMore}
              className="text-xs text-gray-500 hover:text-white disabled:opacity-30 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">Suivant →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section Recommandations ──────────────────────────────────────────────────

function RecoSection({ userId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate              = useNavigate();

  useEffect(() => {
    axios.get(`${API}/${userId}/recommendations?limit=4`)
      .then(r => setData(r.data))
      .catch(e => console.error("Erreur recommandations:", e))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="bg-[#111] rounded-3xl p-7 border border-white/[0.08]">
      <SectionTitle icon={<Sparkles size={18} />} title="Pour toi ce soir"
        subtitle={data?.mode === 'personnalisé' ? `Basé sur ${data.based_on_orders} commandes · Personnalisé` : 'Sélection populaire'} />
      {loading ? (
        <div className="h-32 flex items-center justify-center text-gray-600 text-sm animate-pulse">Analyse de tes goûts…</div>
      ) : !data?.recommendations?.length ? (
        <div className="text-center text-gray-600 py-10 text-sm">Aucune recommandation disponible.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.recommendations.map(reco => (
            <div key={reco.id} onClick={() => navigate(`/cocktail/${reco.id}`)}
              className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.15] rounded-2xl p-5 transition-all cursor-pointer overflow-hidden">
              {reco.image_url && (
                <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity bg-cover bg-center rounded-2xl"
                  style={{ backgroundImage: `url(${reco.image_url})` }} />
              )}
              <div className="relative">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-white">{reco.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{reco.category}</div>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors mt-0.5" />
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {reco.reasons.slice(0, 2).map((r, i) => (
                    <span key={i} className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-full">{r}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserSearchDropdown({ users, value, onChange }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const ref                 = useRef(null);

  const selected = users.find(u => String(u.id) === String(value));
  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all
          ${open ? 'border-violet-500/60 bg-violet-600/10' : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'}`}
      >
        {selected ? (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center text-xs font-black text-white shrink-0">
              {selected.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-white font-semibold text-sm">{selected.name}</span>
            {selected.balance != null && (
              <span className="text-gray-500 text-xs font-mono">{selected.balance.toFixed(2)} €</span>
            )}
          </div>
        ) : (
          <span className="text-gray-500 text-sm">Choisir un utilisateur…</span>
        )}
        <ChevronRight size={14} className={`text-gray-500 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl shadow-black/60">
          <div className="p-2 border-b border-white/[0.06]">
            <input
              autoFocus
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center text-gray-600 text-sm py-6">Aucun résultat</div>
            ) : (
              filtered.map(u => (
                <button
                  key={u.id}
                  onClick={() => { onChange(String(u.id)); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                    ${String(value) === String(u.id)
                      ? 'bg-violet-600/20 text-white'
                      : 'text-gray-300 hover:bg-white/[0.05] hover:text-white'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0
                    ${String(value) === String(u.id) ? 'bg-violet-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{u.name}</div>
                    {u.balance != null && (
                      <div className="text-xs text-gray-600 font-mono">{u.balance.toFixed(2)} €</div>
                    )}
                  </div>
                  {String(value) === String(u.id) && (
                    <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Espace Patron ────────────────────────────────────────────────────────────

function EspacePatron() {
  const { user } = useUser();

  const [adminKey,      setAdminKey]      = useState(() => getAdminKey());
  const [adminStats,    setAdminStats]    = useState(null);
  const [margin,        setMargin]        = useState(0);
  const [marginInput,   setMarginInput]   = useState(0);
  const [marginSaving,  setMarginSaving]  = useState(false);
  const [marginSaved,   setMarginSaved]   = useState(false);
  const [requirePay,    setRequirePay]    = useState(false);
  const [toggleSaving,  setToggleSaving]  = useState(false);
  const [rechargeUser,  setRechargeUser]  = useState('');
  const [rechargeAmt,   setRechargeAmt]   = useState(10);
  const [rechargeSaving,setRechargeSaving]= useState(false);
  const [rechargeMsg,   setRechargeMsg]   = useState(null);
  const [users,         setUsers]         = useState([]);

  const ensureKeyAndLoadUsers = useCallback(async (key) => {
    try {
      const res = await axios.get(`${API}/`, { headers: adminHeaders(key) });
      setUsers(res.data);
    } catch (e) {
      if (e.response?.status === 403) {
        sessionStorage.removeItem('baros_admin_key');
        setAdminKey('');
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    axios.get(`${API}/${user.id}/admin-stats`).then(r => setAdminStats(r.data)).catch(() => {});
    axios.get(`${ADMIN_API}/margin`).then(r => {
      setMargin(r.data.margin_percent);
      setMarginInput(r.data.margin_percent);
    }).catch(() => {});
    axios.get(`${PAY_API}/config`).then(r => setRequirePay(r.data.require_payment)).catch(() => {});
    const key = getAdminKey() || window.prompt('Clé admin (pour la liste des recharges) :');
    if (key) {
      saveAdminKey(key);
      setAdminKey(key);
      ensureKeyAndLoadUsers(key);
    }
  }, [user, ensureKeyAndLoadUsers]);

  const requireKey = (msg) => {
    if (adminKey) return adminKey;
    const k = window.prompt(msg ?? 'Clé admin :');
    if (k) { saveAdminKey(k); setAdminKey(k); }
    return k || null;
  };

  const saveMargin = async () => {
    const key = requireKey('Clé admin :');
    if (!key) return;
    setMarginSaving(true);
    try {
      const r = await axios.put(`${ADMIN_API}/margin`,
        { margin_percent: parseFloat(marginInput) },
        { headers: adminHeaders(key) }
      );
      setMargin(r.data.margin_percent);
      setMarginSaved(true);
      setTimeout(() => setMarginSaved(false), 2500);
    } catch {
      alert('❌ Clé invalide');
      sessionStorage.removeItem('baros_admin_key');
      setAdminKey('');
    } finally { setMarginSaving(false); }
  };

  const toggleRequirePay = async () => {
    const key = requireKey('Clé admin pour modifier le mode paiement :');
    if (!key) return;
    setToggleSaving(true);
    try {
      await axios.put(`${ADMIN_API}/payment-config`,
        { require_payment: !requirePay },
        { headers: adminHeaders(key) }
      );
      setRequirePay(v => !v);
    } catch {
      alert('❌ Clé invalide');
      sessionStorage.removeItem('baros_admin_key');
      setAdminKey('');
    } finally { setToggleSaving(false); }
  };

  const resetUserPin = async (uid, uname) => {
    const key = requireKey(`Clé admin pour reset le PIN de ${uname} :`);
    if (!key) return;
    try {
      await axios.post(`${API}/reset-pin`, { user_id: uid }, { headers: adminHeaders(key) });
      alert(`✅ PIN de ${uname} réinitialisé.`);
    } catch {
      alert('❌ Clé invalide');
      sessionStorage.removeItem('baros_admin_key');
      setAdminKey('');
    }
  };

  const doManualRecharge = async () => {
    if (!rechargeUser || rechargeAmt <= 0) return;
    const key = requireKey('Clé admin pour confirmer la recharge :');
    if (!key) return;
    setRechargeSaving(true);
    try {
      const r = await axios.post(`${PAY_API}/manual-recharge`,
        { user_id: parseInt(rechargeUser), amount: rechargeAmt, description: 'Recharge manuelle admin' },
        { headers: adminHeaders(key) }
      );
      setRechargeMsg(`✅ ${r.data.user} → ${r.data.new_balance.toFixed(2)} €`);
      setTimeout(() => setRechargeMsg(null), 4000);
    } catch {
      alert('❌ Erreur recharge');
    } finally { setRechargeSaving(false); }
  };

  const handleClearHistory = async () => {
    const key = requireKey('Zone Danger ⚠️ : Clé admin pour purger l\'historique :');
    if (!key) return;
    try {
      await axios.delete(`${ADMIN_API}/clear-history`, { headers: adminHeaders(key) });
      alert('✅ Base de données purgée !');
      setAdminStats({ total_orders: 0, total_revenue: 0, total_cost: 0, total_margin: 0 });
    } catch { alert('❌ Mauvaise clé.'); }
  };

  const handleExportCSV = async () => {
    const key = requireKey('Clé admin pour exporter :');
    if (!key) return;
    try {
      const res = await axios.get(`${ADMIN_API}/export/csv`,
        { headers: adminHeaders(key), responseType: 'blob' }
      );
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `BarOS_Compta_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch { alert('❌ Échec de l\'export.'); }
  };

  const handleExportUsers = async () => {
    const key = requireKey('Clé admin pour exporter les utilisateurs :');
    if (!key) return;
    try {
      const res = await axios.get(`${ADMIN_API}/export/users`,
        { headers: adminHeaders(key), responseType: 'blob' }
      );
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `BarOS_Users_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch { alert('❌ Échec export utilisateurs'); }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-lg shadow-emerald-900/20">
      <div className="absolute -top-10 -right-10 text-emerald-500/10 rotate-12"><TrendingUp size={150} /></div>
      <div className="relative z-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-emerald-400 flex items-center gap-3">
            <BarChart3 size={28} /> Espace Patron
          </h2>
          <div className="flex gap-3">
            <button onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-300 rounded-xl text-sm font-bold transition-all">
              <Euro size={16} /> Exporter .CSV
            </button>
            <button onClick={handleExportUsers}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-300 rounded-xl text-sm font-bold transition-all">
              <FileSpreadsheet size={16} /> Export Users
            </button>
            <button onClick={handleClearHistory}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold transition-all">
              <AlertTriangle size={16} /> Remise à zéro
            </button>
          </div>
        </div>

        {adminStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/40 border border-white/5 p-5 rounded-2xl">
              <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">Chiffre d'Affaires</div>
              <div className="text-3xl font-black text-white">{Number(adminStats.total_revenue).toFixed(2)} <span className="text-lg text-emerald-400">€</span></div>
            </div>
            <div className="bg-black/40 border border-white/5 p-5 rounded-2xl">
              <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">Coût Ingrédients</div>
              <div className="text-3xl font-black text-white">{Number(adminStats.total_cost).toFixed(2)} <span className="text-lg text-red-400">€</span></div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl">
              <div className="text-emerald-500/60 text-xs font-bold uppercase tracking-wider mb-2">Bénéfice Net</div>
              <div className="text-3xl font-black text-emerald-400">{Number(adminStats.total_margin).toFixed(2)} <span className="text-lg">€</span></div>
            </div>
            <div className="bg-black/40 border border-white/5 p-5 rounded-2xl">
              <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">Verres Servis</div>
              <div className="text-3xl font-black text-white">{adminStats.total_orders} <span className="text-lg text-blue-400">🍹</span></div>
            </div>
          </div>
        )}

        <div className="bg-black/30 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
                <CreditCard size={15} className="text-violet-400" />
                Paiement requis pour commander
              </div>
              <p className="text-white/30 text-xs">
                {requirePay
                  ? '✅ Activé — le solde est débité à chaque commande'
                  : '⭕ Désactivé — mode libre, pas de débit'}
              </p>
            </div>
            <button onClick={toggleRequirePay} disabled={toggleSaving} className="shrink-0 ml-4">
              {requirePay
                ? <ToggleRight size={44} className="text-emerald-400" />
                : <ToggleLeft  size={44} className="text-gray-600" />}
            </button>
          </div>
        </div>

        <div className="bg-black/30 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-white mb-4">
            <Wallet size={15} className="text-violet-400" /> Recharge manuelle
          </div>
          <div className="mb-3 relative">
            <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">Bénéficiaire</div>
            <UserSearchDropdown users={users} value={rechargeUser} onChange={setRechargeUser} />
          </div>
          <div className="mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">Montant</div>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map(a => (
                <button key={a} onClick={() => setRechargeAmt(a)}
                  className={`py-2.5 rounded-xl font-bold text-sm transition-all border
                    ${rechargeAmt === a
                      ? 'bg-violet-600/30 border-violet-500/60 text-white'
                      : 'bg-white/[0.03] border-white/[0.08] text-gray-400 hover:bg-white/[0.07] hover:text-white'}`}>
                  {a} €
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={doManualRecharge} disabled={!rechargeUser || rechargeSaving}
              className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
              <Plus size={15} /> {rechargeSaving ? 'Traitement…' : `Créditer ${rechargeAmt} €`}
            </button>
            {rechargeUser && (
              <button
                onClick={() => {
                  const u = users.find(u => String(u.id) === String(rechargeUser));
                  if (u) resetUserPin(u.id, u.name);
                }}
                className="px-3 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all">
                Reset PIN
              </button>
            )}
          </div>
          {rechargeMsg && <p className="text-emerald-400 text-xs text-center font-bold mt-2 animate-pulse">{rechargeMsg}</p>}
        </div>

        <div className="bg-black/30 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Percent size={16} className="text-emerald-400" />
              <span className="text-sm font-bold text-white">Marge sur les cocktails</span>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full transition-all ${marginSaved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40'}`}>
              {marginSaved ? '✅ Sauvegardé' : `Actuelle : ${margin}%`}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <input type="range" min="0" max="200" step="5" value={marginInput}
              onChange={e => setMarginInput(Number(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-emerald-500" />
            <span className="text-white font-black text-xl w-16 text-right tabular-nums">{marginInput}%</span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-white/25 text-xs">
              Ex : 1 € coût → {(1 * (1 + marginInput / 100)).toFixed(2)} € prix client
            </p>
            <button onClick={saveMargin} disabled={marginSaving || marginInput === margin}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all">
              <Save size={13} /> {marginSaving ? 'Sauvegarde…' : 'Appliquer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, logout } = useUser();
  const navigate         = useNavigate();

  if (!user) return (
    <div className="h-screen w-full bg-[#0a0a0a] flex flex-col items-center justify-center text-white gap-4">
      <UserIcon size={56} className="text-gray-700" />
      <h2 className="text-2xl font-bold text-gray-400">Aucun profil connecté</h2>
      <p className="text-gray-600 text-sm">Badgez votre carte NFC pour accéder à votre tableau de bord.</p>
    </div>
  );

  const genderLabel = user.gender === 'M' ? 'Homme' : user.gender === 'F' ? 'Femme' : 'Autre';
  const profileTags = [
    user.age       != null ? `${user.age} ans`      : null,
    user.weight_kg != null ? `${user.weight_kg} kg` : null,
    genderLabel,
  ].filter(Boolean);

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white pb-16 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 pt-10 space-y-5">

        {/* HEADER */}
        <div className="flex justify-between items-center bg-[#111] p-7 rounded-3xl border border-white/[0.08]">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl
                            flex items-center justify-center text-2xl font-black shadow-lg shadow-indigo-500/20">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">{user.name}</h1>
              <div className="flex gap-2 mt-2 flex-wrap">
                {profileTags.map(tag => (
                  <span key={tag} className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={logout}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 border border-red-500/20
                       hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 px-5 py-2.5 rounded-xl
                       transition-all text-sm font-semibold">
            <LogOut size={16} /> Déco
          </button>
        </div>

        <SoldeCard userId={user.id} navigate={navigate} />
        {user.is_admin && <EspacePatron />}

        {/* ── Section Favoris — placée après le solde, avant l'alcoolémie ── */}
        <FavoritesSection userId={user.id} />

        <AlcoolemieSection userId={user.id} />
        <DepensesSection   userId={user.id} />
        <StatsSection      userId={user.id} />
        <HistoriqueSection userId={user.id} />
        <RecoSection       userId={user.id} />

      </div>
    </div>
  );
}