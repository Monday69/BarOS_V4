/**
 * BarOS V4 — StockPage.jsx
 * Chemin : src/pages/StockPage.jsx
 *
 * Arrière-boutique : visualiser et gérer les stocks de réserve.
 * - Vue d'ensemble avec alertes
 * - Ajouter du stock (livraison)
 * - Transférer réserve → machine
 * - Configurer format bouteille / seuil d'alerte / notes
 *
 * Accessible via : /stock (AdminRoute)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Package, ArrowDownToLine, ArrowRightLeft, AlertTriangle,
  AlertOctagon, CheckCircle2, RefreshCw, X, Plus, Minus,
  Wine, Warehouse, ChevronDown, ChevronUp, SlidersHorizontal,
  Lock, ShieldCheck, Info, Flame
} from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

// ── Déverrouillage admin (même pattern que Settings) ─────────────────────────
function AdminUnlock({ onUnlock }) {
  const [key, setKey]       = useState('');
  const [error, setError]   = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key.trim()) { setError(true); return; }
    setLoading(true);
    try {
      await axios.get(`${API_BASE_URL}/stock`, { headers: { 'x-admin-token': key.trim() } });
      onUnlock(key.trim());
    } catch (err) {
      if (err.response?.status === 403) { setError(true); setLoading(false); }
      else onUnlock(key.trim()); // erreur réseau → on laisse passer
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20
                          flex items-center justify-center">
            <Lock size={36} className="text-amber-400" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black text-white mb-2">Arrière-Boutique</h2>
          <p className="text-white/30 text-sm">Clé admin requise pour accéder aux stocks.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="password" autoFocus placeholder="Clé administrateur…"
            value={key} onChange={e => { setKey(e.target.value); setError(false); }}
            className={`w-full bg-white/[0.04] border text-white px-5 py-4 rounded-2xl
                        font-mono text-sm focus:outline-none transition-colors placeholder:text-white/15
                        ${error ? 'border-red-500/50' : 'border-white/[0.08] focus:border-amber-500/50'}`} />
          {error && <p className="text-red-400 text-xs text-left">Clé admin incorrecte</p>}
          <button type="submit" disabled={!key.trim() || loading}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-30
                       text-black font-black rounded-2xl transition-all text-sm
                       flex items-center justify-center gap-2">
            {loading ? <span className="animate-pulse">Vérification…</span>
                     : <><ShieldCheck size={18} /> Accéder au stock</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm font-semibold
                      shadow-2xl backdrop-blur-md
                      ${t.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : t.type === 'error'   ? 'bg-red-500/15 border-red-500/30 text-red-300'
                      : 'bg-blue-500/15 border-blue-500/30 text-blue-300'}`}>
          {t.type === 'success' ? <CheckCircle2 size={16} />
           : t.type === 'error' ? <AlertOctagon size={16} />
           : <Info size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Barre de niveau ───────────────────────────────────────────────────────────
function LevelBar({ value, max, colorClass, label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs text-white/30 font-mono">
          <span>{label}</span>
          <span>{Math.round(value)} / {Math.round(max)} ml</span>
        </div>
      )}
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
             style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Carte ingrédient ──────────────────────────────────────────────────────────
function IngredientCard({ item, adminKey, onRefresh, toast }) {
  const [expanded,      setExpanded]      = useState(false);
  const [transferMode,  setTransferMode]  = useState(false);
  const [addMode,       setAddMode]       = useState(false);
  const [configMode,    setConfigMode]    = useState(false);
  const [transferVol,   setTransferVol]   = useState('');
  const [addBottles,    setAddBottles]    = useState(1);
  const [addVolume,     setAddVolume]     = useState('');
  const [addMode2,      setAddMode2]      = useState('bottles'); // 'bottles' | 'ml'
  const [configData,    setConfigData]    = useState({
    bottle_size_ml:     item.bottle_size_ml,
    alert_threshold_ml: item.alert_threshold_ml,
    notes:              item.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const headers = { 'x-admin-token': adminKey };

  const alertColor = item.alert === 'critical' ? 'border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.05)]'
                   : item.alert === 'warning'  ? 'border-orange-500/20'
                   : 'border-white/[0.07]';

  const machinePctColor = item.machine_pct >= 50 ? 'bg-emerald-500'
                        : item.machine_pct >= 25 ? 'bg-orange-400'
                        : 'bg-red-500';

  const reservePctOfThreshold = item.alert_threshold_ml > 0
    ? (item.reserve_ml / item.alert_threshold_ml) * 100 : 100;
  const reserveColor = item.reserve_empty ? 'bg-red-500/50'
                     : item.reserve_low   ? 'bg-orange-400'
                     : 'bg-violet-400';

  const doTransfer = async () => {
    const vol = parseFloat(transferVol);
    if (!vol || vol <= 0) return;
    setSaving(true);
    try {
      const r = await axios.post(`${API_BASE_URL}/stock/${item.id}/transfer`,
        { volume_ml: vol }, { headers });
      toast(`✅ ${r.data.transferred_ml.toFixed(0)} ml → machine`);
      setTransferMode(false);
      setTransferVol('');
      onRefresh();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg    = typeof detail === 'object' ? detail?.message : detail;
      toast(msg || 'Erreur transfert', 'error');
    } finally { setSaving(false); }
  };

  const doAdd = async () => {
    setSaving(true);
    try {
      const body = addMode2 === 'bottles'
        ? { bottles: addBottles }
        : { volume_ml: parseFloat(addVolume) };
      const r = await axios.post(`${API_BASE_URL}/stock/${item.id}/add`, body, { headers });
      toast(`✅ +${r.data.added_ml.toFixed(0)} ml en réserve`);
      setAddMode(false);
      onRefresh();
    } catch (err) {
      toast(err.response?.data?.detail || 'Erreur ajout', 'error');
    } finally { setSaving(false); }
  };

  const doConfig = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/stock/${item.id}`, {
        bottle_size_ml:     parseFloat(configData.bottle_size_ml),
        alert_threshold_ml: parseFloat(configData.alert_threshold_ml),
        notes:              configData.notes || null,
      }, { headers });
      toast('✅ Configuration sauvegardée');
      setConfigMode(false);
      onRefresh();
    } catch { toast('Erreur configuration', 'error'); }
    finally { setSaving(false); }
  };

  const fillMachine = async () => {
    const space = item.machine_max_ml - item.machine_volume_ml;
    const vol   = Math.min(space, item.reserve_ml);
    if (vol <= 0) { toast('Réserve vide ou machine pleine', 'error'); return; }
    setSaving(true);
    try {
      const r = await axios.post(`${API_BASE_URL}/stock/${item.id}/transfer`,
        { volume_ml: vol }, { headers });
      toast(`✅ Machine remplie — ${r.data.transferred_ml.toFixed(0)} ml transférés`);
      onRefresh();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast(typeof detail === 'object' ? detail?.message : detail || 'Erreur', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className={`bg-[#141414] border rounded-3xl overflow-hidden transition-all duration-300 ${alertColor}`}>
      {/* ── Header carte ── */}
      <div className="p-5 flex items-start gap-4">
        {/* Image */}
        <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-black/30 shrink-0">
          {item.image_url
            ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center">
                <Wine size={22} className="text-white/20" />
              </div>}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-white text-base leading-tight">{item.name}</span>
            {item.pump_id && (
              <span className="text-xs font-bold bg-blue-500/10 border border-blue-500/20
                               text-blue-400 px-2 py-0.5 rounded-full shrink-0">
                Pompe {item.pump_id}
              </span>
            )}
            {item.alcohol_degree > 0 && (
              <span className="text-xs font-bold bg-amber-500/10 border border-amber-500/15
                               text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                <Flame size={9} /> {item.alcohol_degree}°
              </span>
            )}
            {/* Badge alerte */}
            {item.alert === 'critical' && (
              <span className="text-xs font-bold bg-red-500/15 border border-red-500/30
                               text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                <AlertOctagon size={9} /> Critique
              </span>
            )}
            {item.alert === 'warning' && (
              <span className="text-xs font-bold bg-orange-500/10 border border-orange-500/20
                               text-orange-400 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                <AlertTriangle size={9} /> Attention
              </span>
            )}
          </div>
          {item.brand && (
            <div className="text-white/30 text-xs mt-0.5 font-mono truncate">{item.brand}</div>
          )}

          {/* Niveaux compacts */}
          <div className="mt-3 space-y-2">
            <LevelBar
              value={item.machine_volume_ml}
              max={item.machine_max_ml}
              colorClass={machinePctColor}
              label="Machine"
            />
            <LevelBar
              value={Math.min(item.reserve_ml, item.alert_threshold_ml * 1.5)}
              max={item.alert_threshold_ml * 1.5 || 3000}
              colorClass={reserveColor}
              label={`Réserve (≈ ${item.bottles_approx} bouteilles)`}
            />
          </div>
        </div>

        {/* Toggle expand */}
        <button onClick={() => setExpanded(!expanded)}
          className="p-2 bg-white/5 rounded-xl text-white/30 hover:text-white/60 transition-colors shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* ── Actions rapides (toujours visibles) ── */}
      <div className="px-5 pb-4 flex gap-2 flex-wrap">
        <button onClick={() => { setAddMode(true); setExpanded(true); setTransferMode(false); setConfigMode(false); }}
          className="flex-1 min-w-[100px] py-2 bg-violet-500/10 border border-violet-500/20
                     text-violet-400 rounded-xl text-xs font-bold hover:bg-violet-500/20
                     transition-all flex items-center justify-center gap-1.5">
          <Plus size={13} /> Réceptionner
        </button>
        <button
          onClick={() => { setTransferMode(true); setExpanded(true); setAddMode(false); setConfigMode(false); setTransferVol(String(Math.min(item.reserve_ml, item.machine_max_ml - item.machine_volume_ml))); }}
          disabled={item.reserve_empty}
          className="flex-1 min-w-[100px] py-2 bg-emerald-500/10 border border-emerald-500/20
                     text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/20
                     transition-all flex items-center justify-center gap-1.5
                     disabled:opacity-30 disabled:cursor-not-allowed">
          <ArrowRightLeft size={13} /> Remplir machine
        </button>
      </div>

      {/* ── Zone expandée ── */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-5 py-5 space-y-5">

          {/* RÉCEPTION STOCK */}
          {addMode && (
            <div className="bg-violet-500/5 border border-violet-500/15 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-violet-400 text-sm font-black flex items-center gap-2">
                  <Package size={15} /> Réceptionner stock
                </span>
                <button onClick={() => setAddMode(false)} className="text-white/20 hover:text-white/50">
                  <X size={16} />
                </button>
              </div>

              {/* Toggle bouteilles / ml */}
              <div className="flex gap-2">
                <button onClick={() => setAddMode2('bottles')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
                    ${addMode2 === 'bottles' ? 'bg-violet-500 text-white' : 'bg-white/5 text-white/40'}`}>
                  Bouteilles
                </button>
                <button onClick={() => setAddMode2('ml')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
                    ${addMode2 === 'ml' ? 'bg-violet-500 text-white' : 'bg-white/5 text-white/40'}`}>
                  Volume ml
                </button>
              </div>

              {addMode2 === 'bottles' ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => setAddBottles(Math.max(1, addBottles - 1))}
                    className="w-11 h-11 bg-white/5 rounded-xl flex items-center justify-center
                               text-white/50 hover:bg-white/10 transition-colors">
                    <Minus size={16} />
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-4xl font-black text-white">{addBottles}</span>
                    <span className="text-white/30 text-sm ml-2">
                      × {item.bottle_size_ml}ml
                      = {(addBottles * item.bottle_size_ml).toFixed(0)} ml
                    </span>
                  </div>
                  <button onClick={() => setAddBottles(addBottles + 1)}
                    className="w-11 h-11 bg-white/5 rounded-xl flex items-center justify-center
                               text-white/50 hover:bg-white/10 transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
              ) : (
                <input type="number" min="1" placeholder="Volume en ml"
                  value={addVolume} onChange={e => setAddVolume(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white p-3 rounded-xl
                             text-center text-xl font-black focus:outline-none focus:border-violet-500" />
              )}

              <button onClick={doAdd} disabled={saving}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-30
                           text-white font-black rounded-xl transition-all flex items-center
                           justify-center gap-2">
                <Package size={16} /> {saving ? 'Enregistrement…' : 'Confirmer réception'}
              </button>
            </div>
          )}

          {/* TRANSFERT VERS MACHINE */}
          {transferMode && (
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 text-sm font-black flex items-center gap-2">
                  <ArrowRightLeft size={15} /> Transférer vers machine
                </span>
                <button onClick={() => setTransferMode(false)} className="text-white/20 hover:text-white/50">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-white/30 bg-white/[0.02] rounded-xl p-3">
                <div>Réserve dispo : <span className="text-white/60 font-bold">{item.reserve_ml.toFixed(0)} ml</span></div>
                <div>Place machine : <span className="text-white/60 font-bold">{(item.machine_max_ml - item.machine_volume_ml).toFixed(0)} ml</span></div>
              </div>

              <div className="space-y-2">
                <input type="range" min="0" max={Math.min(item.reserve_ml, item.machine_max_ml - item.machine_volume_ml)}
                  step="10" value={transferVol || 0}
                  onChange={e => setTransferVol(e.target.value)}
                  className="w-full h-3 rounded-full appearance-none cursor-pointer" />
                <input type="number" min="0"
                  max={Math.min(item.reserve_ml, item.machine_max_ml - item.machine_volume_ml)}
                  value={transferVol} onChange={e => setTransferVol(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white p-3 rounded-xl
                             text-center text-xl font-black focus:outline-none focus:border-emerald-500" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={fillMachine} disabled={saving || item.reserve_empty}
                  className="py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400
                             rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all
                             flex items-center justify-center gap-1.5">
                  <ArrowDownToLine size={13} /> Remplir à fond
                </button>
                <button onClick={doTransfer} disabled={saving || !transferVol}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30
                             text-white rounded-xl text-xs font-bold transition-all
                             flex items-center justify-center gap-1.5">
                  <ArrowRightLeft size={13} /> {saving ? '…' : 'Transférer'}
                </button>
              </div>
            </div>
          )}

          {/* CONFIGURATION */}
          <div className="space-y-3">
            <button onClick={() => setConfigMode(!configMode)}
              className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs font-bold
                         transition-colors w-full">
              <SlidersHorizontal size={13} />
              Paramètres avancés
              {configMode ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
            </button>

            {configMode && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/30 text-xs font-bold block mb-1.5">Format bouteille (ml)</label>
                    <input type="number" min="100"
                      value={configData.bottle_size_ml}
                      onChange={e => setConfigData(p => ({ ...p, bottle_size_ml: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 text-white p-2.5 rounded-xl
                                 text-center font-bold focus:outline-none focus:border-white/30 text-sm" />
                  </div>
                  <div>
                    <label className="text-white/30 text-xs font-bold block mb-1.5">Seuil alerte (ml)</label>
                    <input type="number" min="0"
                      value={configData.alert_threshold_ml}
                      onChange={e => setConfigData(p => ({ ...p, alert_threshold_ml: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 text-white p-2.5 rounded-xl
                                 text-center font-bold focus:outline-none focus:border-white/30 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-white/30 text-xs font-bold block mb-1.5">Notes</label>
                  <textarea rows={2}
                    placeholder="Fournisseur, numéro de lot, date d'achat…"
                    value={configData.notes}
                    onChange={e => setConfigData(p => ({ ...p, notes: e.target.value }))}
                    className="w-full bg-black/40 border border-white/10 text-white p-2.5 rounded-xl
                               focus:outline-none focus:border-white/30 text-sm resize-none
                               placeholder:text-white/10" />
                </div>
                {configData.notes && (
                  <p className="text-white/25 text-xs px-1">{configData.notes}</p>
                )}
                <button onClick={doConfig} disabled={saving}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10
                             text-white/60 hover:text-white rounded-xl text-xs font-bold transition-all">
                  {saving ? 'Sauvegarde…' : '💾 Sauvegarder configuration'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
const StockPage = () => {
  const adminKeyRef = useRef(null);
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <AdminUnlock onUnlock={key => { adminKeyRef.current = key; setUnlocked(true); }} />;
  }
  return <StockContent adminKey={adminKeyRef.current} />;
};

const StockContent = ({ adminKey }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all'); // all | critical | warning | ok
  const [search,  setSearch]  = useState('');
  const [toasts,  setToasts]  = useState([]);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stock`, {
        headers: { 'x-admin-token': adminKey }
      });
      setData(res.data);
    } catch {
      toast('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const items = data?.items ?? [];
  const summary = data?.summary;

  const filtered = items
    .filter(i => filter === 'all' || i.alert === filter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase())
                         || (i.brand || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6 pb-24">
      <Toast toasts={toasts} />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Warehouse size={28} className="text-violet-400" />
            <h1 className="text-4xl font-black text-white">Arrière-Boutique</h1>
          </div>
          <p className="text-white/30 text-sm">
            Gérez vos stocks de réserve et remplissez la machine
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl
                          bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">Session active</span>
          </div>
          <button onClick={fetchData}
            className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/40
                       hover:text-white/70 transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Stats résumé ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Ingrédients',     value: summary.total,          color: 'text-white',        bg: 'bg-white/[0.03]',        border: 'border-white/[0.07]' },
            { label: 'Critiques',       value: summary.critical,       color: 'text-red-400',       bg: 'bg-red-500/5',            border: 'border-red-500/15' },
            { label: 'Alertes',         value: summary.warning,        color: 'text-orange-400',    bg: 'bg-orange-500/5',         border: 'border-orange-500/15' },
            { label: 'Total réserve',   value: `${summary.total_reserve_l} L`, color: 'text-violet-400', bg: 'bg-violet-500/5', border: 'border-violet-500/15' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} className={`${bg} border ${border} rounded-2xl p-4 text-center`}>
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-white/30 text-xs mt-0.5 uppercase tracking-widest">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtres + recherche ── */}
      <div className="flex gap-3 flex-wrap items-center">
        <input type="text" placeholder="Rechercher…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] text-white px-4 py-2.5 rounded-xl
                     text-sm focus:outline-none focus:border-white/20 placeholder:text-white/15
                     flex-1 min-w-[200px]" />
        {['all', 'critical', 'warning', 'ok'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border
              ${filter === f
                ? f === 'critical' ? 'bg-red-500/20 border-red-500/40 text-red-300'
                : f === 'warning'  ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                : f === 'ok'       ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-white/10 border-white/20 text-white'
                : 'bg-white/[0.03] border-white/[0.06] text-white/30 hover:bg-white/[0.06]'}`}>
            {f === 'all' ? 'Tout' : f === 'critical' ? '🔴 Critique' : f === 'warning' ? '🟠 Alerte' : '✅ OK'}
            {summary && f !== 'all' && (
              <span className="ml-1.5 opacity-60">
                ({f === 'critical' ? summary.critical : f === 'warning' ? summary.warning : summary.ok})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Grille ── */}
      {loading ? (
        <div className="text-center py-20 text-white/20 animate-pulse text-sm">
          Chargement des stocks…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
          <Package className="mx-auto h-12 w-12 text-white/10 mb-4" />
          <p className="text-white/30 font-bold">Aucun ingrédient trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map(item => (
            <IngredientCard
              key={item.id}
              item={item}
              adminKey={adminKey}
              onRefresh={fetchData}
              toast={toast}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default StockPage;