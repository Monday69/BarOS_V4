import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import {
  Settings as SettingsIcon, Zap, RefreshCw, AlertTriangle, Edit3,
  X, Check, Trash2, Scan, Search, Filter, BookOpen, ChevronRight,
  AlertOctagon, Flame, Droplets, Wine, CheckCircle, Lock, ShieldCheck, Euro
} from 'lucide-react';




// ── Écran de déverrouillage admin ─────────────────────────────────────────────
// Affiché UNE SEULE FOIS à l'entrée de la page Settings.
// La clé est gardée en mémoire React (useRef) — jamais en localStorage.
// Elle disparaît dès que le composant est démonté (changement de page).
function AdminUnlockScreen({ onUnlock }) {
  const [key,   setKey]   = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key.trim()) { setError(true); return; }
    setLoading(true);
    // Vérification rapide : on tente un GET protégé pour valider la clé
    try {
      await axios.get(`${API_BASE_URL}/ingredients`, {
        headers: { 'x-admin-token': key.trim() }
      });
      onUnlock(key.trim());
    } catch (err) {
      // 403 = clé invalide, autre = erreur réseau (on laisse passer)
      if (err.response?.status === 403) {
        setError(true);
        setLoading(false);
      } else {
        // Erreur réseau ou endpoint sans auth — on unlock quand même
        onUnlock(key.trim());
      }
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-8">

        {/* Icône */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20
                          flex items-center justify-center">
            <Lock size={36} className="text-amber-400" />
          </div>
        </div>

        {/* Titre */}
        <div>
          <h2 className="text-2xl font-black text-white mb-2">Zone Admin</h2>
          <p className="text-white/30 text-sm">
            Entrez la clé admin une seule fois pour accéder aux réglages.
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            autoFocus
            placeholder="Clé administrateur…"
            value={key}
            onChange={e => { setKey(e.target.value); setError(false); }}
            className={`w-full bg-white/[0.04] border text-white px-5 py-4 rounded-2xl
                        font-mono text-sm focus:outline-none transition-colors
                        placeholder:text-white/15
                        ${error
                          ? 'border-red-500/50 focus:border-red-500/70'
                          : 'border-white/[0.08] focus:border-amber-500/50'}`}
          />
          {error && (
            <p className="text-red-400 text-xs text-left">Clé admin incorrecte</p>
          )}
          <button type="submit" disabled={!key.trim() || loading}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-30
                       text-black font-black rounded-2xl transition-all text-sm
                       disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading
              ? <span className="animate-pulse">Vérification…</span>
              : <><ShieldCheck size={18} /> Accéder aux réglages</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Toast système ─────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm font-semibold shadow-2xl
            backdrop-blur-md animate-in slide-in-from-right-4 duration-300
            ${t.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : t.type === 'error'   ? 'bg-red-500/15 border-red-500/30 text-red-300'
            : 'bg-blue-500/15 border-blue-500/30 text-blue-300'}`}
        >
          {t.type === 'success' ? <CheckCircle size={16} />
           : t.type === 'error' ? <AlertOctagon size={16} />
           : <Zap size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Pill nutrition ────────────────────────────────────────────────────────────
function NutriBadge({ icon, value, unit, color, warn }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold
      ${warn ? 'bg-red-500/15 text-red-400 border border-red-500/20'
             : `${color} border border-white/5`}`}>
      {icon}
      <span>{value}</span>
      <span className="opacity-50">{unit}</span>
    </div>
  );
}

// ── Barre de stock ────────────────────────────────────────────────────────────
function StockBar({ current, max }) {
  const pct = Math.min((current / max) * 100, 100);
  const hue = Math.min(120, Math.max(0, pct * 1.2));
  return (
    <div className="relative">
      <div className="h-5 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
        <div className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${pct}%`, backgroundColor: `hsl(${hue}, 100%, 45%)` }} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black text-white/80 drop-shadow">
          {Math.round(current)} / {max} ml
        </span>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
const Settings = () => {

  // ✅ Session admin — clé en mémoire React (useRef = pas de re-render)
  // null = page non déverrouillée, string = clé valide pour la session
  const adminKeyRef = useRef(null);
  const [unlocked, setUnlocked] = useState(false);

  const handleUnlock = (key) => {
    adminKeyRef.current = key;
    setUnlocked(true);
  };

  // Si pas encore déverrouillé → écran de saisie de clé
  if (!unlocked) {
    return <AdminUnlockScreen onUnlock={handleUnlock} />;
  }

  return <SettingsContent adminKey={adminKeyRef.current} />;
};

// ── Contenu Settings (rendu seulement après déverrouillage) ──────────────────
const SettingsContent = ({ adminKey }) => {
  const [ingredients, setIngredients]   = useState([]);
  const [alerts, setAlerts]             = useState(null);
  const [loading, setLoading]           = useState(true);
  const [refillingId, setRefillingId]   = useState(null);
  const [showAll, setShowAll]           = useState(false);
  const [toasts, setToasts]             = useState([]);

  // Modals
  const [editingIngredient, setEditingIngredient]   = useState(null);
  const [tempVolume, setTempVolume]                 = useState(0);
  // ✅ Nouveau : prix d'achat dans le modal edit
  const [tempPrice, setTempPrice]                   = useState('');

  const [scanningIngredient, setScanningIngredient] = useState(null);
  const [barcodeInput, setBarcodeInput]             = useState('');
  const [scanLoading, setScanLoading]               = useState(false);
  const [scanResult, setScanResult]                 = useState(null);
  // ✅ Nouveau : prix d'achat dans le modal scan (saisi après confirmation produit)
  const [scanPrice, setScanPrice]                   = useState('');
  const [showHistory, setShowHistory]               = useState(false);
  const [historyList, setHistoryList]               = useState([]);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Helpers requêtes admin — utilisent la clé de session, pas de modale ──
  const authHeaders = { 'x-admin-token': adminKey };

  const adminPut = async (url, body) => {
    try {
      await axios.put(url, body, { headers: authHeaders });
      return true;
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        toast("Session expirée — rechargez la page", 'error');
      } else {
        toast(err.response?.data?.detail || "Erreur serveur", 'error');
      }
      return false;
    }
  };

  const adminGet = async (url) => {
    try {
      const res = await axios.get(url, { headers: authHeaders });
      return res.data;
    } catch {
      toast("Erreur — ressource introuvable", 'error');
      return null;
    }
  };

  const adminPost = async (url, body, params) => {
    try {
      const res = await axios.post(url, body, { headers: authHeaders, params });
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.detail || "Erreur scan";
      toast(`Scan échoué — ${msg}`, 'error');
      return null;
    }
  };

  // ── Fetch données ─────────────────────────────────────────────────────────
  const fetchIngredients = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/ingredients`);
      setIngredients(res.data.sort((a, b) => {
        if (a.pump_id && !b.pump_id) return -1;
        if (!a.pump_id && b.pump_id) return 1;
        return (a.pump_id || 999) - (b.pump_id || 999);
      }));
    } catch (e) {
      console.error("Erreur stocks:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/machine/alerts`);
      setAlerts(res.data);
    } catch (e) {
      console.error("Erreur alertes:", e);
    }
  }, []);

  useEffect(() => {
    fetchIngredients();
    fetchAlerts();
    const i1 = setInterval(fetchIngredients, 5000);
    const i2 = setInterval(fetchAlerts, 15000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, [fetchIngredients, fetchAlerts]);

  const displayedIngredients = showAll
    ? ingredients
    : ingredients.filter(i => i.pump_id !== null);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleRefill = async (ing) => {
    setRefillingId(ing.id);
    const ok = await adminPut(
      `${API_BASE_URL}/ingredients/${ing.id}`,
      { current_volume_ml: ing.max_volume_ml || 1000 }
    );
    if (ok) {
      await fetchIngredients();
      await fetchAlerts();
      toast(`${ing.name} remplie à fond !`);
    }
    setRefillingId(null);
  };

  const saveVolume = async () => {
    if (!editingIngredient) return;
    // ✅ Nouveau : inclure le prix si renseigné
    const body = { current_volume_ml: parseFloat(tempVolume) };
    const parsedPrice = parseFloat(tempPrice);
    if (!isNaN(parsedPrice) && parsedPrice > 0) {
      body.purchase_price_per_liter = parsedPrice;
    }
    const ok = await adminPut(`${API_BASE_URL}/ingredients/${editingIngredient.id}`, body);
    if (ok) {
      setEditingIngredient(null);
      fetchIngredients();
      fetchAlerts();
      toast("Volume mis à jour");
    }
  };

  const handleUnassign = async () => {
    if (!editingIngredient) return;
    const ok = await adminPut(
      `${API_BASE_URL}/ingredients/${editingIngredient.id}`,
      { pump_id: null }
    );
    if (ok) {
      setEditingIngredient(null);
      fetchIngredients();
      toast(`${editingIngredient.name} déconnectée`, 'info');
    }
  };

  // ── Scanner ───────────────────────────────────────────────────────────────
  const openScanModal = (ing) => {
    setEditingIngredient(null);
    setScanningIngredient(ing);
    setBarcodeInput('');
    setScanResult(null);
    setScanPrice('');
    setShowHistory(false);
  };

  const openEditModal = (ing) => {
    setScanningIngredient(null);
    setEditingIngredient(ing);
    setTempVolume(ing.current_volume_ml);
    // ✅ Nouveau : pré-remplir le prix si déjà renseigné sur cet ingrédient
    setTempPrice(ing.purchase_price_per_liter != null ? String(ing.purchase_price_per_liter) : '');
  };

  const toggleHistory = async () => {
    if (showHistory) { setShowHistory(false); return; }
    const data = await adminGet(
      `${API_BASE_URL}/ingredients/${scanningIngredient.id}/history`
    );
    if (data) { setHistoryList(data); setShowHistory(true); }
  };

  const submitScan = async (e) => {
    e.preventDefault();
    if (!barcodeInput) return;
    setScanLoading(true);
    setScanResult(null);
    const data = await adminPost(
      `${API_BASE_URL}/ingredients/${scanningIngredient.id}/scan`,
      {},
      { barcode: barcodeInput }
    );
    if (data) setScanResult(data);
    setScanLoading(false);
  };

  // ✅ Nouveau : confirmScan envoie aussi le prix si renseigné (PUT séparé)
  const confirmScan = async () => {
    const parsedPrice = parseFloat(scanPrice);
    if (!isNaN(parsedPrice) && parsedPrice > 0) {
      await adminPut(`${API_BASE_URL}/ingredients/${scanningIngredient.id}`, {
        purchase_price_per_liter: parsedPrice,
      });
    }
    toast(`✅ ${scanResult.brand || scanResult.name} associé !`);
    setScanningIngredient(null);
    setScanResult(null);
    setScanPrice('');
    await fetchIngredients();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const alertItems = [
    ...(alerts?.critical || []),
    ...(alerts?.warning  || []),
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6 pb-24">
      <Toast toasts={toasts} />

      {/* ── BANNER ALERTES ────────────────────────────────────────────────── */}
      {alertItems.length > 0 && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/5 px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon size={16} className="text-red-400" />
            <span className="text-sm font-bold text-red-400 uppercase tracking-widest">
              {alertItems.length} alerte{alertItems.length > 1 ? 's' : ''} stock
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertItems.map(item => (
              <div key={item.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border
                  ${item.level === 'critical'
                    ? 'bg-red-500/15 border-red-500/30 text-red-400'
                    : 'bg-orange-500/10 border-orange-500/25 text-orange-400'}`}>
                <AlertTriangle size={11} />
                {item.name}
                <span className="opacity-60">— {item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-1">Maintenance</h1>
          <p className="text-white/30 text-sm">
            Stocks · Identification produits ·
            {alerts?.summary ? ` Score santé : ${alerts.summary.health_score}%` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Badge session active */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl
                          bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">Session active</span>
          </div>
          <button onClick={() => setShowAll(!showAll)}
            className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 text-sm font-bold transition-all
              ${showAll
                ? 'bg-white/10 border-white/15 text-white'
                : 'bg-blue-600/80 border-blue-500/50 text-white shadow-[0_0_20px_rgba(37,99,235,0.25)]'}`}>
            <Filter size={16} />
            {showAll ? 'Tout afficher' : 'Pompes actives'}
          </button>
          <button onClick={() => { fetchIngredients(); fetchAlerts(); }}
            className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/40
                       hover:text-white/70 transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── GRILLE INGRÉDIENTS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-20 text-white/20 animate-pulse text-sm">
            Chargement des stocks…
          </div>
        ) : displayedIngredients.length === 0 ? (
          <div className="col-span-2 text-center py-20 bg-white/[0.02] rounded-3xl
                         border border-dashed border-white/10">
            <Zap className="mx-auto h-12 w-12 text-white/10 mb-4" />
            <p className="text-white/30 font-bold">
              {showAll ? 'Aucun ingrédient' : 'Aucune pompe connectée'}
            </p>
            {!showAll && (
              <button onClick={() => setShowAll(true)}
                className="mt-3 text-blue-400 hover:text-blue-300 text-sm underline">
                Afficher tout le stock
              </button>
            )}
          </div>
        ) : displayedIngredients.map(ing => {
          const maxVol     = ing.max_volume_ml || 1000;
          const pct        = (ing.current_volume_ml / maxVol) * 100;
          const isCritical = pct < 10;
          const isWarning  = pct < 25 && !isCritical;

          return (
            <div key={ing.id}
              className={`bg-[#141414] border rounded-3xl p-6 flex flex-col gap-5 transition-all duration-300
                ${isCritical ? 'border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.05)]'
                : isWarning  ? 'border-orange-500/20'
                : 'border-white/[0.07] hover:border-white/[0.12]'}`}>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-black/30 shrink-0">
                    {ing.image_url
                      ? <img src={ing.image_url} alt={ing.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <Wine size={24} className="text-white/20" />
                        </div>}
                  </div>
                  <div>
                    <div className="font-black text-white text-lg leading-tight">{ing.name}</div>
                    {ing.brand && (
                      <div className="text-white/35 text-xs mt-0.5 font-mono">{ing.brand}</div>
                    )}
                    {/* ✅ Nouveau : affiche le prix €/L si renseigné */}
                    {ing.purchase_price_per_liter != null && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-emerald-400/70 font-mono">
                        <Euro size={9} />
                        {ing.purchase_price_per_liter.toFixed(2)} /L
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {ing.pump_id && (
                        <span className="text-xs font-bold bg-blue-500/10 border border-blue-500/20
                                         text-blue-400 px-2 py-0.5 rounded-full">
                          Pompe {ing.pump_id}
                        </span>
                      )}
                      {ing.alcohol_degree > 0 && (
                        <NutriBadge icon={<Flame size={10} />} value={`${ing.alcohol_degree}°`}
                          color="bg-amber-500/10 text-amber-400" warn={ing.alcohol_degree > 40} />
                      )}
                      {ing.kcal_per_100ml > 0 && (
                        <NutriBadge icon={<Zap size={10} />} value={Math.round(ing.kcal_per_100ml)}
                          unit="kcal" color="bg-orange-500/10 text-orange-400" />
                      )}
                      {ing.sugar_g_per_100ml > 0 && (
                        <NutriBadge icon={<Droplets size={10} />} value={ing.sugar_g_per_100ml}
                          unit="g" color="bg-cyan-500/10 text-cyan-400"
                          warn={ing.sugar_g_per_100ml > 15} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openScanModal(ing)}
                    title="Scanner code-barres"
                    className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl
                               text-purple-400 hover:bg-purple-500/20 transition-colors">
                    <Scan size={16} />
                  </button>
                  <button onClick={() => openEditModal(ing)}
                    title="Modifier volume / prix"
                    className="p-2.5 bg-white/5 border border-white/10 rounded-xl
                               text-white/40 hover:text-white/70 transition-colors">
                    <Edit3 size={16} />
                  </button>
                </div>
              </div>

              <StockBar current={ing.current_volume_ml} max={maxVol} />

              <button
                onClick={() => handleRefill(ing)}
                disabled={refillingId === ing.id}
                className="w-full py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl
                           text-white/50 text-sm font-bold flex items-center justify-center gap-2
                           hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400
                           disabled:opacity-30 disabled:cursor-wait transition-all">
                <RefreshCw size={14} className={refillingId === ing.id ? 'animate-spin' : ''} />
                {refillingId === ing.id ? 'Remplissage…' : 'Remplir à fond'}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── MODAL ÉDITION VOLUME + PRIX ───────────────────────────────────── */}
      {editingIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-[#161616] w-full max-w-md rounded-3xl p-8 border border-blue-500/20 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-white">{editingIngredient.name}</h2>
                <p className="text-white/30 text-sm mt-1">Volume · Prix d'achat</p>
              </div>
              <button onClick={() => setEditingIngredient(null)}
                className="p-2.5 bg-white/5 rounded-xl text-white/30 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Volume — slider tactile + input numérique synchronisés */}
              <div>
                <label className="text-white/40 text-xs font-bold uppercase tracking-widest block mb-2">
                  Volume actuel (ml)
                </label>
                <input
                  type="range"
                  min="0"
                  max={editingIngredient.max_volume_ml || 1000}
                  step="10"
                  value={tempVolume}
                  onChange={e => setTempVolume(e.target.value)}
                  className="w-full h-3 rounded-full appearance-none cursor-pointer mb-3"
                />
                <StockBar current={tempVolume} max={editingIngredient.max_volume_ml || 1000} />
                <input
                  type="number"
                  min="0"
                  max={editingIngredient.max_volume_ml || 1000}
                  value={tempVolume}
                  onChange={e => setTempVolume(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white text-xl font-black p-3 rounded-2xl text-center focus:outline-none focus:border-blue-500 transition-colors mt-3"
                />
              </div>

              {/* ✅ Nouveau : champ prix d'achat */}
              <div>
                <label className="text-white/40 text-xs font-bold uppercase tracking-widest block mb-2">
                  Prix d'achat (€ / litre)
                </label>
                <div className="relative">
                  <Euro size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ex : 12.50"
                    value={tempPrice}
                    onChange={e => setTempPrice(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white text-lg font-bold
                               pl-9 pr-4 py-3 rounded-2xl focus:outline-none focus:border-emerald-500
                               transition-colors placeholder:text-white/15"
                  />
                </div>
                <p className="text-white/20 text-xs mt-1.5">
                  Bouteille 75cl à 9 € → saisir 12.00 &nbsp;(= 9 ÷ 0.75)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button onClick={handleUnassign}
                className="py-3.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl
                           font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors">
                <Trash2 size={16} /> Déconnecter
              </button>
              <button onClick={saveVolume}
                className="py-3.5 bg-blue-600 text-white rounded-2xl font-bold flex items-center
                           justify-center gap-2 hover:bg-blue-500 transition-colors">
                <Check size={16} /> Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SCANNER ────────────────────────────────────────────────── */}
      {scanningIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className={`w-full max-w-lg rounded-3xl p-8 border shadow-2xl transition-colors duration-300
            ${showHistory
              ? 'bg-[#161616] border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.1)]'
              : scanResult
                ? 'bg-[#161616] border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.1)]'
                : 'bg-[#161616] border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.1)]'}`}>

            <div className="flex justify-between items-start mb-7">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  {showHistory ? <><BookOpen size={22} className="text-amber-400" /> Historique</>
                   : scanResult ? <><CheckCircle size={22} className="text-emerald-400" /> Produit trouvé</>
                   : <><Scan size={22} className="text-purple-400" /> Scanner</>}
                </h2>
                <p className="text-white/30 text-sm mt-1">
                  {showHistory ? 'Précédemment associés à ' : 'Associer à '}
                  <span className="text-white/60 font-bold">{scanningIngredient.name}</span>
                </p>
              </div>
              <div className="flex gap-2">
                {!scanResult && (
                  <button onClick={toggleHistory}
                    className={`p-2.5 rounded-xl transition-colors
                      ${showHistory
                        ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                        : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}>
                    {showHistory ? <Scan size={20} /> : <BookOpen size={20} />}
                  </button>
                )}
                <button onClick={() => { setScanningIngredient(null); setScanResult(null); setScanPrice(''); }}
                  className="p-2.5 bg-white/5 rounded-xl text-white/30 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Résultat scan */}
            {scanResult && !showHistory && (
              <div className="space-y-5">
                <div className="flex items-center gap-5 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
                  {scanResult.image_url && (
                    <img src={scanResult.image_url} alt=""
                      className="w-16 h-16 object-cover rounded-xl border border-white/10" />
                  )}
                  <div className="flex-1">
                    <div className="font-black text-white text-lg">
                      {scanResult.brand || scanResult.name}
                    </div>
                    <div className="text-white/40 text-sm">{scanResult.name}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-3 text-center">
                    <div className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">Alcool</div>
                    <div className="text-white font-black text-xl">{scanResult.alcohol_degree || 0}°</div>
                  </div>
                  <div className="bg-orange-500/5 border border-orange-500/15 rounded-2xl p-3 text-center">
                    <div className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-1">Calories</div>
                    <div className="text-white font-black text-xl">{Math.round(scanResult.kcal_per_100ml || 0)}</div>
                    <div className="text-white/30 text-xs">kcal/100ml</div>
                  </div>
                  <div className={`border rounded-2xl p-3 text-center
                    ${(scanResult.sugar_g_per_100ml || 0) > 15
                      ? 'bg-red-500/5 border-red-500/20' : 'bg-cyan-500/5 border-cyan-500/15'}`}>
                    <div className={`text-xs font-bold uppercase tracking-widest mb-1
                      ${(scanResult.sugar_g_per_100ml || 0) > 15 ? 'text-red-400' : 'text-cyan-400'}`}>
                      Sucres
                    </div>
                    <div className="text-white font-black text-xl">{scanResult.sugar_g_per_100ml || 0}g</div>
                    <div className="text-white/30 text-xs">/100ml</div>
                  </div>
                </div>

                {/* ✅ Nouveau : champ prix dans le modal scan, sous les infos produit */}
                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-widest block mb-2">
                    Prix d'achat (€ / litre) — optionnel
                  </label>
                  <div className="relative">
                    <Euro size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex : 12.50"
                      value={scanPrice}
                      onChange={e => setScanPrice(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 text-white text-base font-bold
                                 pl-9 pr-4 py-3 rounded-2xl focus:outline-none focus:border-emerald-500
                                 transition-colors placeholder:text-white/15"
                    />
                  </div>
                  <p className="text-white/20 text-xs mt-1.5">
                    Bouteille 75cl à 9 € → saisir 12.00 &nbsp;(= 9 ÷ 0.75)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setScanResult(null)}
                    className="py-3 bg-white/5 border border-white/10 rounded-2xl text-white/50
                               font-bold hover:bg-white/10 transition-colors">
                    Rescanner
                  </button>
                  <button onClick={confirmScan}
                    className="py-3 bg-emerald-600 text-white rounded-2xl font-bold
                               hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2">
                    <Check size={16} /> Confirmer
                  </button>
                </div>
              </div>
            )}

            {/* Historique */}
            {showHistory && (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {historyList.length === 0 ? (
                  <div className="text-center py-10">
                    <Search className="mx-auto h-8 w-8 text-white/15 mb-2" />
                    <p className="text-white/25 text-sm">Aucun historique</p>
                  </div>
                ) : historyList.map(item => (
                  <div key={item.barcode}
                    onClick={() => { setBarcodeInput(item.barcode); setShowHistory(false); }}
                    className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06]
                               rounded-xl hover:border-purple-500/40 hover:bg-purple-500/5
                               cursor-pointer transition-all group">
                    <div className="w-10 h-10 bg-black rounded-lg overflow-hidden shrink-0">
                      {item.image_url
                        ? <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                        : <span className="text-xs flex items-center justify-center h-full text-white/20">?</span>}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-bold text-white text-sm truncate">{item.brand || item.name}</div>
                      <div className="text-xs text-white/25 font-mono">{item.barcode}</div>
                    </div>
                    <ChevronRight size={14} className="text-white/20 group-hover:text-purple-400 transition-colors" />
                  </div>
                ))}
              </div>
            )}

            {/* Formulaire scan */}
            {!scanResult && !showHistory && (
              <form onSubmit={submitScan}>
                <div className="relative mb-5">
                  <Scan className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" size={18} />
                  <input type="text" autoFocus
                    placeholder="Code EAN (ex: 5449000131805)"
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white text-lg p-5 pl-12
                               rounded-2xl focus:outline-none focus:border-purple-500 transition-colors
                               font-mono tracking-wider placeholder:text-white/15" />
                </div>
                <button type="submit" disabled={!barcodeInput || scanLoading}
                  className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center
                             gap-3 transition-all ${scanLoading
                               ? 'bg-white/5 text-white/25 cursor-wait'
                               : 'bg-purple-600 text-white hover:bg-purple-500 active:scale-95'}`}>
                  {scanLoading ? "Recherche OpenFoodFacts…" : <><Scan size={20} /> SCANNER</>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
