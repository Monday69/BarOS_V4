import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Wine, Activity, Zap, Droplets, Settings as SettingsIcon,
  AlertTriangle, CheckCircle, AlertOctagon, RefreshCw, ShieldCheck, Clock
} from 'lucide-react';

const API_MACHINE = 'http://localhost:8000/api/machine';
const API_LOGS    = 'http://localhost:8000/api/logs';

// ── Composant badge niveau ────────────────────────────────────────────────────
function LevelBadge({ level }) {
  const map = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    warning:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
    ok:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  };
  const labels = { critical: 'Critique', warning: 'Bas', ok: 'OK' };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${map[level]}`}>
      {labels[level]}
    </span>
  );
}

// ── Barre de stock ────────────────────────────────────────────────────────────
function StockBar({ percent, level }) {
  const colors = { critical: 'bg-red-500', warning: 'bg-orange-400', ok: 'bg-emerald-500' };
  return (
    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colors[level]}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

// ── Carte stat ────────────────────────────────────────────────────────────────
function QuickStatCard({ icon, label, value, sub, colorClass, bgClass }) {
  return (
    <div className={`p-6 rounded-2xl border transition-colors group ${bgClass}`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${bgClass}`}>
          {icon}
        </div>
        <span className="text-xs font-mono text-textMuted uppercase">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${colorClass}`}>{value}</div>
      {sub && <div className="text-sm text-textMuted mt-1">{sub}</div>}
    </div>
  );
}

const Dashboard = () => {
  const [alerts, setAlerts]         = useState(null);
  const [logSummary, setLogSummary] = useState(null);
  const [machineStatus, setMachineStatus] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [lastRefresh, setLastRefresh]     = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      // ✅ Fix : toutes les stats sont réelles — plus de valeurs hardcodées
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
      console.error('Erreur chargement dashboard', e);
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const summary     = alerts?.summary;
  const healthScore = summary?.health_score ?? 100;
  const hasAlerts   = summary?.has_alerts   ?? false;

  // Pompes configurées (slots avec un ingrédient assigné)
  const configuredPumps = machineStatus
    ? Object.values(machineStatus.slots || {}).filter(s => s.name && s.name !== 'Vide').length
    : null;

  // Taux de succès des séquences
  const successRate = logSummary?.success_rate ?? null;
  const totalSeq    = logSummary?.total_sequences ?? 0;

  const healthColor = healthScore >= 75 ? 'text-emerald-400'
    : healthScore >= 50 ? 'text-orange-400' : 'text-red-400';
  const healthBg    = healthScore >= 75 ? 'bg-emerald-500/10 border-emerald-500/20'
    : healthScore >= 50 ? 'bg-orange-500/10 border-orange-500/20'
    : 'bg-red-500/10 border-red-500/20';

  const alertItems = [
    ...(alerts?.critical || []),
    ...(alerts?.warning  || []),
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-8">

      {/* ── HÉROS ──────────────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden bg-surface border border-white/5 p-12
                      text-center md:text-left md:flex md:items-center md:justify-between shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                          bg-green-500/10 text-green-400 text-xs font-mono uppercase
                          tracking-widest border border-green-500/20">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Système Opérationnel
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">
            BarOS <span className="text-primary">V4</span>
          </h1>
          <p className="text-xl text-textMuted max-w-lg leading-relaxed">
            Interface de mixologie autonome prête à servir. Sélectionnez un programme
            ou accédez au laboratoire manuel.
          </p>
          <div className="pt-6 flex flex-wrap gap-4">
            <Link to="/bar"
              className="px-8 py-4 bg-primary text-black font-bold rounded-xl
                         hover:bg-amber-400 transition-all flex items-center gap-2
                         shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95">
              <Wine size={20} /> Accéder à la Carte
            </Link>
            <Link to="/lab"
              className="px-8 py-4 bg-white/5 text-white font-bold rounded-xl
                         hover:bg-white/10 transition-all flex items-center gap-2
                         border border-white/10">
              <Droplets size={20} /> Laboratoire
            </Link>
          </div>
        </div>

        {/* Cercle animé déco */}
        <div className="hidden md:flex justify-center items-center relative w-64 h-64">
          <div className="absolute inset-0 border-4 border-white/5 rounded-full animate-[spin_10s_linear_infinite]" />
          <div className="absolute inset-4 border-2 border-primary/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap size={64} className="text-primary animate-pulse" />
          </div>
        </div>
      </div>

      {/* ── STATS DYNAMIQUES ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Pompes configurées — données réelles */}
        <div className="bg-surface/50 p-6 rounded-2xl border border-white/5
                        hover:border-primary/20 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400
                            group-hover:scale-110 transition-transform">
              <Activity size={24} />
            </div>
            <span className="text-xs font-mono text-textMuted uppercase">Pompes</span>
          </div>
          <div className="text-3xl font-bold text-white">
            {configuredPumps !== null ? `${configuredPumps}/12` : '—'}
          </div>
          <div className="text-sm text-textMuted mt-1">
            {configuredPumps !== null
              ? configuredPumps === 0 ? 'Aucune configurée'
              : configuredPumps === 12 ? 'Configuration complète'
              : 'Pompes assignées'
              : 'Chargement…'}
          </div>
        </div>

        {/* Taux de succès séquences — données réelles */}
        <div className="bg-surface/50 p-6 rounded-2xl border border-white/5
                        hover:border-primary/20 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400
                            group-hover:scale-110 transition-transform">
              <Clock size={24} />
            </div>
            <span className="text-xs font-mono text-textMuted uppercase">Séquences</span>
          </div>
          <div className="text-3xl font-bold text-white">
            {successRate !== null ? `${successRate}%` : '—'}
          </div>
          <div className="text-sm text-textMuted mt-1">
            {totalSeq > 0
              ? `${totalSeq} préparation${totalSeq > 1 ? 's' : ''} · taux succès`
              : 'Aucune préparation encore'}
          </div>
        </div>

        {/* Intégrité stocks — données réelles */}
        <div className={`p-6 rounded-2xl border transition-colors group ${healthBg}`}>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform
              ${healthScore >= 75 ? 'bg-emerald-500/10 text-emerald-400'
              : healthScore >= 50 ? 'bg-orange-500/10 text-orange-400'
              : 'bg-red-500/10 text-red-400'}`}>
              <SettingsIcon size={24} />
            </div>
            <span className="text-xs font-mono text-textMuted uppercase">Stocks</span>
          </div>
          <div className={`text-3xl font-bold ${healthColor}`}>
            {loadingAlerts ? '—' : `${healthScore}%`}
          </div>
          <div className="text-sm text-textMuted mt-1">
            {loadingAlerts ? 'Chargement…'
              : hasAlerts
                ? `${summary.critical_count} critique(s), ${summary.warning_count} bas`
                : 'Tous les stocks OK'}
          </div>
        </div>
      </div>

      {/* ── PANEL ALERTES STOCKS ───────────────────────────────────────────── */}
      <div className="bg-surface/50 rounded-3xl border border-white/5 overflow-hidden">

        <div className="flex items-center justify-between px-7 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            {hasAlerts
              ? <AlertTriangle size={18} className="text-orange-400" />
              : <ShieldCheck   size={18} className="text-emerald-400" />}
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">
              Alertes Stocks
            </h2>
            {hasAlerts && (
              <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30
                               px-2 py-0.5 rounded-full font-bold">
                {alertItems.length} alerte{alertItems.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-white/20">
                {lastRefresh.toLocaleTimeString('fr-FR', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                })}
              </span>
            )}
            <button onClick={fetchAll}
              className="text-white/25 hover:text-white/60 transition-colors" title="Rafraîchir">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loadingAlerts ? (
            <div className="text-center text-white/20 text-sm py-8 animate-pulse">
              Analyse des niveaux de stock…
            </div>
          ) : alertItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <CheckCircle size={36} className="text-emerald-500/50" />
              <div className="text-white/50 font-semibold">Tous les stocks sont au vert</div>
              <div className="text-white/20 text-xs">
                {summary?.total_pumps ?? 0} pompe{(summary?.total_pumps ?? 0) > 1 ? 's' : ''} surveillée{(summary?.total_pumps ?? 0) > 1 ? 's' : ''}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {alertItems.map(item => (
                <div key={item.id}
                  className={`flex items-center justify-between rounded-2xl px-5 py-4 border
                    ${item.level === 'critical'
                      ? 'bg-red-500/5 border-red-500/20'
                      : 'bg-orange-500/5 border-orange-500/15'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                      ${item.level === 'critical'
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-orange-500/15 text-orange-400'}`}>
                      {item.level === 'critical'
                        ? <AlertOctagon size={18} />
                        : <AlertTriangle size={18} />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{item.name}</div>
                      <div className="text-xs text-white/30 mt-0.5">
                        Pompe #{item.pump_id} · {item.current_ml} ml / {item.max_ml} ml
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end gap-1.5">
                      <StockBar percent={item.percent} level={item.level} />
                      <span className="text-xs text-white/30">{item.percent}%</span>
                    </div>
                    <LevelBadge level={item.level} />
                  </div>
                </div>
              ))}

              {alerts?.ok?.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-white/20 uppercase tracking-widest mb-3 px-1">
                    Stocks OK — {alerts.ok.length} ingrédient{alerts.ok.length > 1 ? 's' : ''}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {alerts.ok.map(item => (
                      <div key={item.id}
                        className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15
                                   px-3 py-1.5 rounded-full text-xs text-emerald-400/70">
                        <CheckCircle size={11} />
                        {item.name}
                        <span className="text-emerald-400/40">{item.percent}%</span>
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
  );
};

export default Dashboard;