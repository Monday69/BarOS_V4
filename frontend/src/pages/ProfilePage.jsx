import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Activity, ShieldCheck, AlertTriangle, Car, Wine,
  User as UserIcon, Star, Zap, Flame, Droplets,
  Clock, ChevronRight, BarChart2, Sparkles, Euro, TrendingUp, TrendingDown, Minus, Percent, Save, BarChart3
} from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:8000/api/users';

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
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors[color]}`}>
        {icon}
      </div>
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
          <Star size={16} className={`transition-colors ${
            n <= (hovered || value) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'
          }`} />
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 mt-0.5">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
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
        <div className="h-32 flex items-center justify-center text-gray-600 text-sm animate-pulse">
          Calcul métabolique…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`rounded-2xl p-6 border flex flex-col items-center text-center gap-4 ${
            canDrive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Taux estimé</div>
            <div className={`text-6xl font-black tabular-nums ${canDrive ? 'text-emerald-400' : 'text-red-400'}`}>
              {(bac ?? 0).toFixed(2)}
              <span className="text-xl text-gray-500 font-normal ml-1">g/L</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${canDrive ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between w-full text-xs text-gray-600">
              <span>0.0</span><span>0.5 ⚠️</span><span>1.0</span><span>1.5</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
              canDrive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
            }`}>
              {canDrive ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
              {data?.status ?? '—'}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4">
            <StatCard icon={<Wine size={18} />}  label="Commandés ce soir"        value={`${data?.drinks_count ?? 0} verres`} color="purple" />
            <StatCard icon={<Clock size={18} />} label="Depuis le premier verre"  value={data?.hours_since_first_drink != null ? `${data.hours_since_first_drink}h` : '—'} color="blue" />
            <StatCard icon={<Car size={18} />}   label="Conduite (limite 0.5 g/L)" value={canDrive ? 'Autorisé ✓' : 'Interdit ✗'} color={canDrive ? 'emerald' : 'rose'} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section Dépenses ─────────────────────────────────────────────────────────
// Affiche : total soirée, prix moyen par cocktail, détail par commande,
// comparaison avec la soirée précédente.

function DepensesSection({ userId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
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
      <div className="h-32 flex items-center justify-center text-gray-600 text-sm animate-pulse">
        Calcul des dépenses…
      </div>
    </div>
  );

  if (!data || data.total_tonight === 0) return (
    <div className="bg-[#111] rounded-3xl p-7 border border-white/[0.08]">
      <SectionTitle icon={<Euro size={18} />} title="Dépenses"
        subtitle="Coût de revient des cocktails commandés" />
      <div className="text-center text-gray-600 py-10 text-sm">
        Aucune dépense enregistrée ce soir.<br />
        <span className="text-gray-700 text-xs">Les prix s'affichent quand les bouteilles ont un prix renseigné.</span>
      </div>
    </div>
  );

  // Comparaison avec soirée précédente
  const diff        = data.total_tonight - (data.prev_session_total ?? 0);
  const hasPrev     = data.prev_session_total != null;
  const TrendIcon   = diff > 0.01 ? TrendingUp : diff < -0.01 ? TrendingDown : Minus;
  const trendColor  = diff > 0.01 ? 'text-red-400' : diff < -0.01 ? 'text-emerald-400' : 'text-gray-400';

  return (
    <div className="bg-[#111] rounded-3xl p-7 border border-white/[0.08]">
      <SectionTitle icon={<Euro size={18} />} title="Dépenses"
        subtitle="Coût de revient des cocktails commandés" />

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Total soirée */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 text-center">
          <div className="text-xs text-emerald-400 font-bold uppercase tracking-widest mb-1">
            Total ce soir
          </div>
          <div className="text-4xl font-black text-white tabular-nums">
            {data.total_tonight.toFixed(2)}
            <span className="text-lg text-emerald-400 ml-1">€</span>
          </div>
          <div className="text-xs text-gray-600 mt-1">{data.count_tonight} cocktail{data.count_tonight > 1 ? 's' : ''}</div>
        </div>

        {/* Prix moyen */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 text-center">
          <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">
            Prix moyen
          </div>
          <div className="text-4xl font-black text-white tabular-nums">
            {data.avg_tonight.toFixed(2)}
            <span className="text-lg text-gray-500 ml-1">€</span>
          </div>
          <div className="text-xs text-gray-600 mt-1">par cocktail</div>
        </div>
      </div>

      {/* Comparaison soirée précédente */}
      {hasPrev && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-5
          ${diff > 0.01 ? 'bg-red-500/5 border-red-500/15' : diff < -0.01 ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-white/5 border-white/10'}`}>
          <TrendIcon size={16} className={trendColor} />
          <span className="text-sm text-gray-400">
            Soirée précédente : <span className="text-white font-bold">{data.prev_session_total.toFixed(2)} €</span>
          </span>
          <span className={`ml-auto text-sm font-bold ${trendColor}`}>
            {diff > 0 ? '+' : ''}{diff.toFixed(2)} €
          </span>
        </div>
      )}

      {/* Détail par cocktail */}
      <button
        onClick={() => setShowDetail(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03]
                   hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-colors mb-2">
        <span className="text-sm font-bold text-gray-400">Détail par cocktail</span>
        <ChevronRight size={14} className={`text-gray-600 transition-transform ${showDetail ? 'rotate-90' : ''}`} />
      </button>

      {showDetail && data.orders?.length > 0 && (
        <div className="space-y-2 mt-1">
          {data.orders.map((o, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3
                                    bg-white/[0.02] border border-white/[0.05] rounded-xl">
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
        <SectionTitle icon={<BarChart2 size={18} />} title="Statistiques de consommation"
          subtitle={`Sur les ${period} derniers jours`} />
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl shrink-0">
          {[7, 30, 90].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === p ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>
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
            <StatCard icon={<Wine size={18} />}     label="Verres"        value={data.total_orders}                  color="purple" />
            <StatCard icon={<Flame size={18} />}    label="Calories"      value={`${data.total_kcal ?? 0} kcal`}     color="amber"  />
            <StatCard icon={<Droplets size={18} />} label="Sucre"         value={`${data.total_sugar_g ?? 0} g`}     color="blue"   />
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
                {Object.entries(data.category_breakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
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

const formatDate = (ts) => {
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

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
      <SectionTitle icon={<Clock size={18} />} title="Historique récent"
        subtitle="30 derniers jours · Note tes verres directement" />

      {loading ? (
        <div className="h-32 flex items-center justify-center text-gray-600 text-sm animate-pulse">Chargement…</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-600 py-10 text-sm">Aucune commande récente.</div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <div key={order.id}
              className="flex items-center justify-between gap-4 bg-white/[0.03] hover:bg-white/5
                         transition-colors rounded-2xl px-5 py-4 border border-white/5">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{order.recipe?.name ?? '—'}</div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-600">{formatDate(order.timestamp)}</span>
                  {order.cost_price != null && (
                    <span className="text-xs text-emerald-400 font-mono font-bold">
                      {order.cost_price.toFixed(2)} €
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {submitting[order.id] ? (
                  <span className="text-xs text-gray-600 animate-pulse">Sauvegarde…</span>
                ) : (
                  <StarRating value={order.rating ?? 0} onChange={(r) => submitRating(order.id, r)} />
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center pt-3">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="text-xs text-gray-500 hover:text-white disabled:opacity-30 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
              ← Précédent
            </button>
            <span className="text-xs text-gray-600">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={!hasMore}
              className="text-xs text-gray-500 hover:text-white disabled:opacity-30 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
              Suivant →
            </button>
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
        <div className="h-32 flex items-center justify-center text-gray-600 text-sm animate-pulse">
          Analyse de tes goûts…
        </div>
      ) : !data?.recommendations?.length ? (
        <div className="text-center text-gray-600 py-10 text-sm">Aucune recommandation disponible.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.recommendations.map(reco => (
            <div key={reco.id} onClick={() => navigate(`/cocktail/${reco.id}`)}
              className="group relative bg-white/[0.03] hover:bg-white/[0.06] border
                         border-white/[0.06] hover:border-white/[0.15] rounded-2xl p-5
                         transition-all cursor-pointer overflow-hidden">
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

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, logout } = useUser();
  const [adminStats,   setAdminStats]   = useState(null);
  const [margin,       setMargin]       = useState(0);
  const [marginInput,  setMarginInput]  = useState(0);
  const [marginSaving, setMarginSaving] = useState(false);
  const [marginSaved,  setMarginSaved]  = useState(false);

  const ADMIN_API = API.replace('/users', '/admin');

  useEffect(() => {
    if (!user?.is_admin) return;
    axios.get(`${API}/${user.id}/admin-stats`)
      .then(res => setAdminStats(res.data))
      .catch(err => console.error("Erreur stats admin:", err));
    axios.get(`${ADMIN_API}/margin`)
      .then(res => { setMargin(res.data.margin_percent); setMarginInput(res.data.margin_percent); })
      .catch(err => console.error("Erreur marge:", err));
  }, [user]);

  const handleSaveMargin = async () => {
    const pwd = window.prompt("Clé admin pour modifier la marge :");
    if (!pwd) return;
    setMarginSaving(true);
    try {
      const res = await axios.put(`${ADMIN_API}/margin`,
        { margin_percent: parseFloat(marginInput) },
        { headers: { 'x-admin-token': pwd } }
      );
      setMargin(res.data.margin_percent);
      setMarginSaved(true);
      setTimeout(() => setMarginSaved(false), 2500);
    } catch { alert("❌ Clé invalide ou erreur serveur."); }
    finally { setMarginSaving(false); }
  };

  const handleClearHistory = async () => {
    const pwd = window.prompt("Zone Danger ⚠️ : Entrez le mot de passe Admin pour purger l'historique :");
    if (!pwd) return;
    try {
      await axios.delete(`${ADMIN_API}/clear-history`, { headers: { 'x-admin-token': pwd } });
      alert("✅ Base de données purgée avec succès !");
      setAdminStats({ total_orders: 0, total_revenue: 0, total_cost: 0, total_margin: 0 });
    } catch (err) {
      alert("❌ Échec : Mauvais mot de passe ou route introuvable.");
      console.error("Erreur de suppression:", err);
    }
  };

  const handleExportCSV = async () => {
    const pwd = window.prompt("Entrez le mot de passe Admin pour exporter la comptabilité :");
    if (!pwd) return;
    try {
      const res = await axios.get(`${ADMIN_API}/export/csv`, {
        headers: { 'x-admin-token': pwd }, responseType: 'blob'
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `BarOS_Compta_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (err) {
      alert("❌ Échec de l'export. Vérifie ton mot de passe !");
      console.error("Erreur d'export:", err);
    }
  };

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
                  <span key={tag} className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    {tag}
                  </span>
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

        {/* ── ESPACE PATRON ── */}
        {user.is_admin && (
          <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-lg shadow-emerald-900/20">
            <div className="absolute -top-10 -right-10 text-emerald-500/10 rotate-12">
              <TrendingUp size={150} />
            </div>
            <div className="relative z-10">
              <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
                <h2 className="text-2xl font-black text-emerald-400 flex items-center gap-3">
                  <BarChart3 size={28} /> Espace Patron : Comptabilité
                </h2>
                <div className="flex gap-3">
                  <button onClick={handleExportCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-300 rounded-xl text-sm font-bold transition-all">
                    <Euro size={16} /> Exporter .CSV
                  </button>
                  <button onClick={handleClearHistory}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold transition-all">
                    <AlertTriangle size={16} /> Remise à zéro
                  </button>
                </div>
              </div>

              {adminStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

              {/* ── SLIDER MARGE ── */}
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
                    Prix client = coût × (1 + {marginInput}/100) — ex: 1€ coût → {(1*(1+marginInput/100)).toFixed(2)}€
                  </p>
                  <button onClick={handleSaveMargin}
                    disabled={marginSaving || marginInput === margin}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all">
                    <Save size={13} />
                    {marginSaving ? 'Sauvegarde…' : 'Appliquer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <AlcoolemieSection userId={user.id} />
        <DepensesSection   userId={user.id} />
        <StatsSection      userId={user.id} />
        <HistoriqueSection userId={user.id} />
        <RecoSection       userId={user.id} />

      </div>
    </div>
  );
}