import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Wine, Activity, Zap, Droplets, Settings as SettingsIcon,
  AlertTriangle, CheckCircle, AlertOctagon, RefreshCw, ShieldCheck, Clock,
  Users, Play, XCircle, Star, ChevronRight, Crown
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import AdminDashboard from './AdminDashboard';
import { API_BASE_URL } from '../apiConfig';

const API_MACHINE = `${API_BASE_URL}/machine`;
const API_LOGS    = `${API_BASE_URL}/logs`;
const API_QUEUE   = `${API_BASE_URL}/queue`;

// ─────────────────────────────────────────────────────────────────────────────
// QueueOverlay — bandeau fixe en bas de l'écran machine
// Affiche la file + code de confirmation en grand quand c'est le tour de qqun
// Bouton "Appeler" visible uniquement si adminKey est disponible
// ─────────────────────────────────────────────────────────────────────────────
function QueueOverlay({ adminKey }) {
  const [queueData, setQueueData] = useState(null); // { queue, ready, count, is_busy }
  const [marking,   setMarking]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [codeTimer, setCodeTimer] = useState(120);
  const timerRef = useRef(null);

  // Poll toutes les 5s
  const fetchQueue = useCallback(async () => {
    try {
      const res = await axios.get(API_QUEUE);
      setQueueData(res.data);
    } catch (e) {
      console.error('QueueOverlay poll error:', e);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, 5000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  // Timer 2 min pour le code — reset à chaque nouveau "ready"
  useEffect(() => {
    if (queueData?.ready) {
      setCodeTimer(120);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCodeTimer(t => {
          if (t <= 1) { clearInterval(timerRef.current); return 0; }
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setCodeTimer(120);
    }
    return () => clearInterval(timerRef.current);
  }, [queueData?.ready?.id]);

  const handleForceReady = async (entryId) => {
    if (!adminKey) return;
    setMarking(true);
    try {
      await axios.post(
        `${API_QUEUE}/${entryId}/ready`,
        {},
        { headers: { 'x-admin-token': adminKey } }
      );
      await fetchQueue();
    } catch (e) {
      console.error('Force ready error:', e);
    } finally {
      setMarking(false);
    }
  };

  const handleAdminCancel = async (entryId) => {
    if (!adminKey) return;
    try {
      await axios.delete(
        `${API_QUEUE}/${entryId}/admin`,
        { headers: { 'x-admin-token': adminKey } }
      );
      await fetchQueue();
    } catch (e) {
      console.error('Admin cancel error:', e);
    }
  };

  const queue   = queueData?.queue   || [];
  const ready   = queueData?.ready;
  const isBusy  = queueData?.is_busy ?? false;
  const waiting = queue.filter(e => e.status === 'waiting');
  const next    = waiting[0];

  // Masquer si file vide ET pas de code actif
  if (queue.length === 0 && !ready) return null;

  return (
    <div className={`fixed bottom-0 left-24 right-0 z-50 transition-all duration-500
                     ${collapsed ? 'translate-y-[calc(100%-3rem)]' : 'translate-y-0'}`}>

      {/* Bandeau titre — cliquable pour plier/déplier */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-6 py-3
                   bg-[#111]/95 backdrop-blur-xl border-t border-white/10
                   hover:bg-[#161616]/95 transition-colors">
        <div className="flex items-center gap-3">
          <Users size={15} className="text-purple-400" />
          <span className="text-xs font-black uppercase tracking-widest text-purple-400">
            File d'attente
          </span>
          <span className="bg-purple-500/20 border border-purple-500/30 text-purple-300
                           text-xs font-bold px-2 py-0.5 rounded-full">
            {queue.length}
          </span>
          {ready && (
            <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300
                             text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              Code actif
            </span>
          )}
          {isBusy && !ready && (
            <span className="bg-blue-500/10 border border-blue-500/20 text-blue-300
                             text-xs px-2 py-0.5 rounded-full">
              Machine occupée
            </span>
          )}
          {!isBusy && !ready && next && (
            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300
                             text-xs px-2 py-0.5 rounded-full animate-pulse">
              🤖 Auto-appel imminent…
            </span>
          )}
        </div>
        <ChevronRight
          size={14}
          className={`text-white/30 transition-transform duration-300 ${collapsed ? '-rotate-90' : 'rotate-90'}`}
        />
      </button>

      {/* Corps */}
      <div className="bg-[#0d0d0d]/98 backdrop-blur-xl border-t border-white/[0.05] px-6 py-5">
        <div className="max-w-6xl mx-auto flex gap-6 items-start">

          {/* Colonne gauche : code OU prochain à appeler */}
          {ready ? (
            /* ── Code de confirmation (priorité max) ── */
            <div className="flex-shrink-0 rounded-2xl border border-orange-500/30 bg-orange-500/5
                            px-6 py-4 text-center min-w-[320px]">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                <span className="text-orange-400 text-xs font-black uppercase tracking-widest">
                  C'est votre tour !
                </span>
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
              </div>

              <p className="text-white/60 text-sm font-bold mb-0.5">{ready.user_name}</p>
              <p className="text-white/30 text-xs mb-3">{ready.recipe_name}</p>

              {/* Code en gros — 6 cases séparées */}
              <div className="flex items-center justify-center gap-2 mb-3">
                {(ready.confirm_code || '------').split('').map((d, i) => (
                  <div key={i}
                    className="w-11 h-14 bg-black/60 border-2 border-orange-500/50 rounded-xl
                               flex items-center justify-center
                               text-3xl font-black text-orange-300 font-mono">
                    {d}
                  </div>
                ))}
              </div>

              <p className="text-white/20 text-[10px]">
                À saisir sur <span className="text-white/40 font-bold">baros.local/queue</span>
              </p>

              <div className={`mt-2 text-xs font-bold transition-colors
                               ${codeTimer < 30 ? 'text-red-400' : 'text-white/20'}`}>
                {codeTimer > 0 ? `Expire dans ${codeTimer}s` : '⚠️ Code expiré'}
              </div>
            </div>
          ) : next ? (
            /* ── Prochain cocktail + bouton Appeler ── */
            <div className="flex-shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.02]
                            px-5 py-4 min-w-[240px]">
              <div className="text-[10px] text-white/25 uppercase tracking-widest mb-3 font-bold">
                Prochain
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/30 border border-white/10 shrink-0">
                  {next.recipe_image
                    ? <img src={next.recipe_image} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-lg">🍹</div>}
                </div>
                <div className="min-w-0">
                  <div className="font-black text-white text-sm truncate">{next.recipe_name}</div>
                  <div className="text-white/30 text-xs">{next.user_name}</div>
                </div>
              </div>

              {adminKey ? (
                <button
                  onClick={() => handleForceReady(next.id)}
                  disabled={marking}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500
                             disabled:opacity-40 disabled:cursor-not-allowed
                             text-white font-black text-sm rounded-xl transition-all
                             flex items-center justify-center gap-2
                             shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  {marking
                    ? <span className="animate-spin text-base">⟳</span>
                    : <Play size={14} fill="currentColor" />}
                  {marking ? '…' : isBusy ? 'Forcer l\'appel' : 'Appeler maintenant'}
                </button>
              ) : (
                <p className="text-white/15 text-xs text-center leading-relaxed">
                  🤖 Sera appelé automatiquement dès que la machine sera libre
                </p>
              )}
            </div>
          ) : null}

          {/* Colonne droite : liste de la file */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              {queue.map((entry, i) => (
                <div key={entry.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm
                    ${entry.status === 'ready'
                      ? 'bg-orange-500/5 border-orange-500/20'
                      : entry.status === 'confirmed'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-white/[0.02] border-white/[0.06]'}`}>

                  <span className={`font-black text-sm w-4 text-center shrink-0
                    ${i === 0 && entry.status === 'waiting' ? 'text-orange-400' : 'text-white/20'}`}>
                    {i + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs truncate max-w-[110px]">
                      {entry.recipe_name}
                    </div>
                    <div className="text-white/30 text-[10px]">{entry.user_name}</div>
                  </div>

                  {entry.status === 'ready'     && <Star        size={11} className="text-orange-400 animate-pulse shrink-0" />}
                  {entry.status === 'confirmed' && <CheckCircle size={11} className="text-emerald-400 shrink-0" />}

                  {adminKey && entry.status === 'waiting' && (
                    <button
                      onClick={() => handleAdminCancel(entry.id)}
                      className="text-white/10 hover:text-red-400 transition-colors shrink-0 ml-1">
                      <XCircle size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants utilitaires
// ─────────────────────────────────────────────────────────────────────────────
function LevelBadge({ level }) {
  const map    = { critical: 'bg-red-500/15 text-red-400 border-red-500/30', warning: 'bg-orange-500/15 text-orange-400 border-orange-500/30', ok: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  const labels = { critical: 'Critique', warning: 'Bas', ok: 'OK' };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${map[level]}`}>{labels[level]}</span>;
}

function StockBar({ percent, level }) {
  const colors = { critical: 'bg-red-500', warning: 'bg-orange-400', ok: 'bg-emerald-500' };
  return (
    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${colors[level]}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useUser();
  const [alerts,        setAlerts]        = useState(null);
  const [logSummary,    setLogSummary]    = useState(null);
  const [machineStatus, setMachineStatus] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [lastRefresh,   setLastRefresh]   = useState(null);
  const [activeTab,     setActiveTab]     = useState('dashboard');

  // La clé admin est stockée dans sessionStorage par la page Settings
  // quand l'admin se connecte — on la récupère ici pour activer le bouton "Appeler"
  const adminKey = sessionStorage.getItem('baros_admin_key') || null;

  const fetchAll = useCallback(async () => {
    try {
      const [alertsRes, logsRes, statusRes] = await Promise.allSettled([
        axios.get(`${API_MACHINE}/alerts`),
        axios.get(`${API_LOGS}/summary`),
        axios.get(`${API_MACHINE}/status`),
      ]);
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data);
      if (logsRes.status   === 'fulfilled') setLogSummary(logsRes.value.data);
      if (statusRes.status === 'fulfilled') setMachineStatus(statusRes.value.data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Erreur dashboard', e);
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const summary         = alerts?.summary;
  const healthScore     = summary?.health_score ?? 100;
  const hasAlerts       = summary?.has_alerts   ?? false;
  const configuredPumps = machineStatus
    ? Object.values(machineStatus.slots || {}).filter(s => s.name && s.name !== 'Vide').length
    : null;
  const successRate = logSummary?.success_rate    ?? null;
  const totalSeq    = logSummary?.total_sequences ?? 0;
  const alertItems  = [...(alerts?.critical || []), ...(alerts?.warning || [])];

  // Onglet Patron — render early
  if (activeTab === 'patron' && user?.is_admin) {
    return (
      <>
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="flex gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1 w-fit mb-4">
            <button onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white/30 hover:text-white/60 transition-all">
              <Zap size={15} /> Dashboard
            </button>
            <button onClick={() => setActiveTab('patron')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-amber-500/20 text-amber-400">
              <Crown size={15} /> Espace Patron
            </button>
          </div>
        </div>
        <AdminDashboard />
        <QueueOverlay adminKey={adminKey} />
      </>
    );
  }

  return (
    <>
      {user?.is_admin && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="flex gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1 w-fit mb-4">
            <button onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-white/10 text-white transition-all">
              <Zap size={15} /> Dashboard
            </button>
            <button onClick={() => setActiveTab('patron')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white/30 hover:text-white/60 transition-all">
              <Crown size={15} /> Espace Patron
            </button>
          </div>
        </div>
      )}
      {/* pb-32 pour que le contenu ne soit pas masqué par l'overlay */}
      <div className="max-w-6xl mx-auto space-y-10 py-8 pb-32">

        {/* ── HÉROS ── */}
        <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-surface border border-black/5 dark:border-white/5 p-12
                        text-center md:text-left md:flex md:items-center md:justify-between shadow-xl dark:shadow-2xl transition-colors duration-300">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
          <div className="relative z-10 space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-mono uppercase tracking-widest border border-green-500/20">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Système Opérationnel
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white tracking-tight">
              BarOS <span className="text-primary">V4</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-textMuted max-w-lg leading-relaxed">
              Interface de mixologie autonome prête à servir. Sélectionnez un programme ou accédez au laboratoire manuel.
            </p>
            <div className="pt-6 flex flex-wrap gap-4">
              <Link to="/bar" className="px-8 py-4 bg-primary text-black font-bold rounded-xl hover:bg-amber-400 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95">
                <Wine size={20} /> Accéder à la Carte
              </Link>
              <Link to="/lab" className="px-8 py-4 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-all flex items-center gap-2 border border-black/5 dark:border-white/10">
                <Droplets size={20} /> Laboratoire
              </Link>
            </div>
          </div>
          <div className="hidden md:flex justify-center items-center relative w-64 h-64">
            <div className="absolute inset-0 border-4 border-black/5 dark:border-white/5 rounded-full animate-[spin_10s_linear_infinite]" />
            <div className="absolute inset-4 border-2 border-primary/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap size={64} className="text-primary animate-pulse" />
            </div>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-surface/50 p-6 rounded-2xl border border-black/5 dark:border-white/5 hover:border-primary/20 transition-colors group shadow-sm dark:shadow-none">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform"><Activity size={24} /></div>
              <span className="text-xs font-mono text-gray-400 dark:text-textMuted uppercase">Pompes</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{configuredPumps !== null ? `${configuredPumps}/12` : '—'}</div>
            <div className="text-sm text-gray-500 dark:text-textMuted mt-1">{configuredPumps !== null ? (configuredPumps === 0 ? 'Aucune configurée' : configuredPumps === 12 ? 'Configuration complète' : 'Pompes assignées') : 'Chargement…'}</div>
          </div>

          <div className="bg-white dark:bg-surface/50 p-6 rounded-2xl border border-black/5 dark:border-white/5 hover:border-primary/20 transition-colors group shadow-sm dark:shadow-none">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform"><Clock size={24} /></div>
              <span className="text-xs font-mono text-gray-400 dark:text-textMuted uppercase">Séquences</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{successRate !== null ? `${successRate}%` : '—'}</div>
            <div className="text-sm text-gray-500 dark:text-textMuted mt-1">{totalSeq > 0 ? `${totalSeq} préparation${totalSeq > 1 ? 's' : ''} · taux succès` : 'Aucune préparation encore'}</div>
          </div>

          <div className={`p-6 rounded-2xl border transition-colors group shadow-sm dark:shadow-none ${healthScore >= 75 ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20' : healthScore >= 50 ? 'bg-orange-500/5 dark:bg-orange-500/10 border-orange-500/20' : 'bg-red-500/5 dark:bg-red-500/10 border-red-500/20'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${healthScore >= 75 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : healthScore >= 50 ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}><SettingsIcon size={24} /></div>
              <span className="text-xs font-mono text-gray-400 dark:text-textMuted uppercase">Stocks</span>
            </div>
            <div className={`text-3xl font-bold ${healthScore >= 75 ? 'text-emerald-600 dark:text-emerald-400' : healthScore >= 50 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>{loadingAlerts ? '—' : `${healthScore}%`}</div>
            <div className="text-sm text-gray-500 dark:text-textMuted mt-1">{loadingAlerts ? 'Chargement…' : hasAlerts ? `${summary.critical_count} critique(s), ${summary.warning_count} bas` : 'Tous les stocks OK'}</div>
          </div>
        </div>

        {/* ── ALERTES STOCKS ── */}
        <div className="bg-white dark:bg-surface/50 rounded-3xl border border-black/5 dark:border-white/5 overflow-hidden shadow-sm dark:shadow-none transition-colors duration-300">
          <div className="flex items-center justify-between px-7 py-5 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-3">
              {hasAlerts ? <AlertTriangle size={18} className="text-orange-500 dark:text-orange-400" /> : <ShieldCheck size={18} className="text-emerald-500 dark:text-emerald-400" />}
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Alertes Stocks</h2>
              {hasAlerts && <span className="text-xs bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 dark:border-red-500/30 px-2 py-0.5 rounded-full font-bold">{alertItems.length} alerte{alertItems.length > 1 ? 's' : ''}</span>}
            </div>
            <div className="flex items-center gap-3">
              {lastRefresh && <span className="text-xs text-gray-400 dark:text-white/20">{lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
              <button onClick={fetchAll} className="text-gray-400 dark:text-white/25 hover:text-gray-900 dark:hover:text-white/60 transition-colors" title="Rafraîchir"><RefreshCw size={15} /></button>
            </div>
          </div>

          <div className="p-6">
            {loadingAlerts ? (
              <div className="text-center text-gray-400 dark:text-white/20 text-sm py-8 animate-pulse">Analyse des niveaux de stock…</div>
            ) : alertItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <CheckCircle size={36} className="text-emerald-500/50" />
                <div className="text-gray-500 dark:text-white/50 font-semibold">Tous les stocks sont au vert</div>
                <div className="text-gray-300 dark:text-white/20 text-xs">{summary?.total_pumps ?? 0} pompe{(summary?.total_pumps ?? 0) > 1 ? 's' : ''} surveillée{(summary?.total_pumps ?? 0) > 1 ? 's' : ''}</div>
              </div>
            ) : (
              <div className="space-y-3">
                {alertItems.map(item => (
                  <div key={item.id} className={`flex items-center justify-between rounded-2xl px-5 py-4 border ${item.level === 'critical' ? 'bg-red-500/5 border-red-500/10 dark:border-red-500/20' : 'bg-orange-500/5 border-orange-500/10 dark:border-orange-500/15'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.level === 'critical' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'}`}>
                        {item.level === 'critical' ? <AlertOctagon size={18} /> : <AlertTriangle size={18} />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</div>
                        <div className="text-xs text-gray-500 dark:text-white/30 mt-0.5">Pompe #{item.pump_id} · {item.current_ml} ml / {item.max_ml} ml</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end gap-1.5">
                        <StockBar percent={item.percent} level={item.level} />
                        <span className="text-xs text-gray-400 dark:text-white/30">{item.percent}%</span>
                      </div>
                      <LevelBadge level={item.level} />
                    </div>
                  </div>
                ))}
                {alerts?.ok?.length > 0 && (
                  <div className="pt-2">
                    <div className="text-xs text-gray-400 dark:text-white/20 uppercase tracking-widest mb-3 px-1">Stocks OK — {alerts.ok.length} ingrédient{alerts.ok.length > 1 ? 's' : ''}</div>
                    <div className="flex flex-wrap gap-2">
                      {alerts.ok.map(item => (
                        <div key={item.id} className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/10 dark:border-emerald-500/15 px-3 py-1.5 rounded-full text-xs text-emerald-600/70 dark:text-emerald-400/70">
                          <CheckCircle size={11} /> {item.name} <span className="text-emerald-600/40 dark:text-emerald-400/40">{item.percent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── QUEUE OVERLAY — fixé en bas de toutes les pages via Dashboard ── */}
      <QueueOverlay adminKey={adminKey} />
    </>
  );
};

export default Dashboard;