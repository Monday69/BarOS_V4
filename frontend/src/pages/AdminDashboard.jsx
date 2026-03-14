/**
 * BarOS V4 — AdminDashboard.jsx
 * Chemin : src/pages/AdminDashboard.jsx
 *
 * Vue Patron :
 *   KPIs revenus/marge/cocktails/cout
 *   Graphe revenus par jour (recharts)
 *   Top cocktails + Top clients
 *   Alertes stock + Export CSV
 *
 * Endpoints backend a creer dans admin.py :
 *   GET /admin/revenue-by-day?days=
 *   GET /admin/top-cocktails?days=&limit=
 *   GET /admin/top-users?days=&limit=
 */
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";
import {
  TrendingUp, Euro, Wine, Users, AlertTriangle,
  RefreshCw, Download, Crown, Flame
} from "lucide-react";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from '../apiConfig';
const fmt  = (n, d = 2) => n == null ? "—" : Number(n).toFixed(d);
const fmtE = (n)        => n == null ? "—" : Number(n).toFixed(2) + " €";

// KPI Card
function KpiCard({ label, value, sub, icon: Icon, color }) {
  const p = {
    amber:   { wrap: "bg-amber-500/10 border-amber-500/20",   ico: "bg-amber-500/15",   txt: "text-amber-400"   },
    emerald: { wrap: "bg-emerald-500/10 border-emerald-500/20", ico: "bg-emerald-500/15", txt: "text-emerald-400" },
    blue:    { wrap: "bg-blue-500/10 border-blue-500/20",     ico: "bg-blue-500/15",    txt: "text-blue-400"    },
    red:     { wrap: "bg-red-500/10 border-red-500/20",       ico: "bg-red-500/15",     txt: "text-red-400"     },
  }[color] || {};
  return (
    <div className={"rounded-2xl border p-5 flex flex-col gap-3 " + p.wrap}>
      <div className={"w-10 h-10 rounded-xl flex items-center justify-center " + p.ico}>
        <Icon size={20} className={p.txt} />
      </div>
      <div>
        <div className={"text-3xl font-black " + p.txt}>{value}</div>
        <div className="text-white/50 text-xs font-bold uppercase tracking-widest mt-1">{label}</div>
        {sub && <div className="text-white/25 text-xs mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// Tooltip recharts
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <div className="text-white/40 text-xs mb-2">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm font-bold">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/50 text-xs">{p.name}</span>
          <span className="text-white">{Number(p.value).toFixed(2)} €</span>
        </div>
      ))}
    </div>
  );
}

// Barre horizontale
function HBar({ label, value, max, count, color, rank }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={"text-xs font-black w-6 text-center shrink-0 " +
        (rank === 0 ? "text-amber-400" : rank === 1 ? "text-white/40" : "text-white/20")}>
        {rank === 0 ? <Crown size={12} className="mx-auto" /> : rank + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white text-sm font-bold truncate">{label}</span>
          <span className="text-white/30 text-xs font-mono shrink-0 ml-2">{count}x</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div className={"h-full rounded-full transition-all duration-700 " + color}
               style={{ width: pct + "%" }} />
        </div>
      </div>
      <span className="text-white/30 text-xs font-mono shrink-0 w-16 text-right">{fmtE(value)}</span>
    </div>
  );
}

// Page principale
export default function AdminDashboard() {
  const { user } = useUser();
  const adminKey = sessionStorage.getItem("baros_admin_key") || "";
  const authH    = { headers: { "x-admin-token": adminKey } };

  const [stats,        setStats]        = useState(null);
  const [daily,        setDaily]        = useState([]);
  const [topCocktails, setTopCocktails] = useState([]);
  const [topUsers,     setTopUsers]     = useState([]);
  const [alerts,       setAlerts]       = useState(null);
  const [period,       setPeriod]       = useState(30);
  const [loading,      setLoading]      = useState(true);
  const [lastRefresh,  setLastRefresh]  = useState(null);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await Promise.allSettled([
        axios.get(API_BASE_URL + "/users/" + user.id + "/admin-stats", authH),
        axios.get(API_BASE_URL + "/machine/alerts"),
        axios.get(API_BASE_URL + "/admin/revenue-by-day?days=" + period, authH),
        axios.get(API_BASE_URL + "/admin/top-cocktails?days=" + period + "&limit=8", authH),
        axios.get(API_BASE_URL + "/admin/top-users?days=" + period + "&limit=8", authH),
      ]);
      if (res[0].status === "fulfilled") setStats(res[0].value.data);
      if (res[1].status === "fulfilled") setAlerts(res[1].value.data);
      if (res[2].status === "fulfilled") setDaily(res[2].value.data || []);
      if (res[3].status === "fulfilled") setTopCocktails(res[3].value.data || []);
      if (res[4].status === "fulfilled") setTopUsers(res[4].value.data || []);
      setLastRefresh(new Date());
    } catch (e) { console.error("Admin dashboard:", e); }
    finally { setLoading(false); }
  }, [user?.id, period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const exportCSV = () => {
    if (!daily.length) return;
    const rows = ["Date,Revenu,Commandes,Marge",
      ...daily.map(d => d.date + "," + (d.revenue||0) + "," + (d.orders||0) + "," + (d.margin||0))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
      href: url, download: "baros-" + period + "j-" + new Date().toISOString().slice(0,10) + ".csv"
    });
    a.click(); URL.revokeObjectURL(url);
  };

  if (!user?.is_admin) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <Crown size={40} className="mx-auto text-amber-500/30" />
        <p className="text-white/30 font-bold">Accès réservé aux administrateurs</p>
      </div>
    </div>
  );

  const critAlerts = [...(alerts?.critical || []), ...(alerts?.warning || [])];
  const maxC = Math.max(...topCocktails.map(c => c.revenue || c.count || 0), 1);
  const maxU = Math.max(...topUsers.map(u => u.total_spent || 0), 1);

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-8 px-4 pb-32">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <Crown size={16} className="text-amber-400" />
            </div>
            <h1 className="text-3xl font-black text-white">Espace Patron</h1>
          </div>
          <p className="text-white/30 text-sm">
            {lastRefresh ? "Mis à jour " + lastRefresh.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit", second:"2-digit" }) : "Chargement…"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-xl p-1 gap-1">
            {[7,30,90].map(d => (
              <button key={d} onClick={() => setPeriod(d)}
                className={"px-4 py-2 rounded-lg text-xs font-black transition-all " +
                  (period === d ? "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]" : "text-white/30 hover:text-white/60")}>
                {d}j
              </button>
            ))}
          </div>
          <button onClick={exportCSV} disabled={!daily.length}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white/40 hover:text-white/70 text-xs font-bold disabled:opacity-20 transition-all">
            <Download size={14} /> CSV
          </button>
          <button onClick={fetchAll}
            className="p-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white/30 hover:text-white/60 transition-colors">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ALERTES */}
      {critAlerts.length > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 flex items-center gap-4 flex-wrap">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <span className="text-red-400 text-xs font-black uppercase tracking-widest">
            {critAlerts.length} alerte{critAlerts.length > 1 ? "s" : ""} stock
          </span>
          <div className="flex flex-wrap gap-2">
            {critAlerts.map(a => (
              <span key={a.id} className="text-xs px-2 py-1 rounded-full border font-bold bg-red-500/10 border-red-500/20 text-red-300">
                {a.name} — {a.percent}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Revenu"    value={fmtE(stats?.total_revenue)} sub={period + " jours"}   icon={Euro}      color="amber"   />
        <KpiCard label="Marge"     value={fmtE(stats?.total_margin)}
          sub={stats?.total_revenue > 0 ? fmt((stats.total_margin/stats.total_revenue)*100,1)+"% du CA" : "—"}
          icon={TrendingUp} color="emerald" />
        <KpiCard label="Cocktails" value={stats?.total_orders ?? "—"} sub="préparations"        icon={Wine}      color="blue"    />
        <KpiCard label="Coût mat." value={fmtE(stats?.total_cost)}    sub="ingrédients"         icon={Flame}     color="red"     />
      </div>

      {/* GRAPHE */}
      <div className="bg-[#111] border border-white/[0.06] rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-black text-base">Revenus par jour</h2>
            <p className="text-white/25 text-xs mt-0.5">{period} derniers jours</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/30">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-500 rounded inline-block" /> CA</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 rounded inline-block" /> Marge</span>
          </div>
        </div>
        {daily.length === 0 ? (
          <div className="h-48 flex items-center justify-center flex-col gap-2">
            <p className="text-white/20 text-sm">{loading ? "Chargement…" : "Aucune donnée"}</p>
            {!loading && <p className="text-white/10 text-xs">Créez GET /admin/revenue-by-day dans admin.py</p>}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={daily} margin={{ top:5, right:5, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gMar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill:"rgba(255,255,255,0.2)", fontSize:10 }} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fill:"rgba(255,255,255,0.2)", fontSize:10 }} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="revenue" name="CA"    stroke="#f59e0b" strokeWidth={2} fill="url(#gRev)" />
              <Area type="monotone" dataKey="margin"  name="Marge" stroke="#10b981" strokeWidth={2} fill="url(#gMar)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* TOP COCKTAILS + TOP CLIENTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#111] border border-white/[0.06] rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Wine size={16} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-base">Top Cocktails</h2>
              <p className="text-white/25 text-xs">{period} derniers jours</p>
            </div>
          </div>
          {topCocktails.length === 0
            ? <div className="text-center py-8 text-white/20 text-sm">{loading ? "Chargement…" : "Aucune donnée"}</div>
            : <div className="space-y-4">
                {topCocktails.map((c, i) => (
                  <HBar key={c.name||i} label={c.name} value={c.revenue ?? c.count ?? 0}
                    max={maxC} count={c.count ?? 0} color="bg-blue-500" rank={i} />
                ))}
              </div>
          }
        </div>

        <div className="bg-[#111] border border-white/[0.06] rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Users size={16} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-base">Top Clients</h2>
              <p className="text-white/25 text-xs">par dépenses · {period} jours</p>
            </div>
          </div>
          {topUsers.length === 0
            ? <div className="text-center py-8 text-white/20 text-sm">{loading ? "Chargement…" : "Aucune donnée"}</div>
            : <div className="space-y-4">
                {topUsers.map((u, i) => (
                  <HBar key={u.user_id||i} label={u.name} value={u.total_spent ?? 0}
                    max={maxU} count={u.orders ?? 0} color="bg-purple-500" rank={i} />
                ))}
              </div>
          }
        </div>
      </div>

    </div>
  );
}