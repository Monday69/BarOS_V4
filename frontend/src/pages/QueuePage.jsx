/**
 * BarOS V4 — QueuePage.jsx
 * Chemin : src/pages/QueuePage.jsx
 *
 * Page mobile-first accessible sur /queue.
 * Installable en PWA (start_url dans vite.config.js).
 *
 * Features :
 *   - S'identifier avec son UID + PIN (si pas déjà connecté)
 *   - Voir la carte des cocktails et mettre en file
 *   - Suivre sa position en temps réel (polling 5s)
 *   - Activer les notifications PWA
 *   - Saisir le code de confirmation affiché sur la machine
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Wine, Clock, Users, Bell, BellOff, CheckCircle2, XCircle,
  Loader2, ChevronRight, Star, AlertCircle, Ticket,
  ArrowLeft, RefreshCw, Shield
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { API_BASE_URL } from '../apiConfig';

// WebSocket configuration (still needs hostname:port for WS connection)
const WS_HOST = `${window.location.hostname}:8000`;
const WS_URL = `ws://${WS_HOST}/api/queue/ws`;

// ── Hook : WebSocket temps-reel + fallback polling ────────────────────────────
// 1. Connexion WS au demarrage — le serveur pousse "queue_updated" a chaque
//    changement (join, confirm, cancel, auto-caller).
// 2. Si WS mort → fallback polling 5s + reconnexion automatique toutes les 5s.
function useQueue(userId, interval = 5000) {
  const [myEntry,  setMyEntry]  = useState(null);
  const [queue,    setQueue]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);
  const pollingRef   = useRef(null);

  const fetch = useCallback(async () => {
    try {
      const [queueRes, myRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/queue`),
        userId
          ? axios.get(`${API_BASE_URL}/queue/my/${userId}`).catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ]);
      setQueue(queueRes.data.queue || []);
      setMyEntry(myRes.data?.status !== 'not_in_queue' ? myRes.data : null);
    } catch (e) {
      console.error('Erreur queue:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const connectWS = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === 0 || wsRef.current.readyState === 1)) {
        return;
    }
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket connecté");
        if (pollingRef.current)   { clearInterval(pollingRef.current);  pollingRef.current = null;   }
        if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
      };

      ws.onmessage = (e) => {
        try {
          const { event } = JSON.parse(e.data);
          if (event === 'queue_updated' || event === 'queue_snapshot') fetch();
        } catch {}
      };

      ws.onclose = () => {
        if (!pollingRef.current)   pollingRef.current   = setInterval(fetch, interval);
        if (!reconnectRef.current) reconnectRef.current = setTimeout(connectWS, 5000);
      };

      ws.onerror = () => ws.close();
    } catch {
      if (!pollingRef.current) pollingRef.current = setInterval(fetch, interval);
    }
  }, [fetch, interval]);

  useEffect(() => {
    fetch();
    connectWS();
    return () => {
      wsRef.current?.close();
      if (pollingRef.current)   clearInterval(pollingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [fetch, connectWS]);

  return { myEntry, queue, loading, refetch: fetch };
}

// ── Hook : push notifications ─────────────────────────────────────────────────
function usePush(userId) {
  const [subscribed, setSubscribed] = useState(false);
  const [supported,  setSupported]  = useState(false);

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window);
    if (!userId) return;
    axios.get(`${API_BASE_URL}/push/status/${userId}`)
         .then(r => setSubscribed(r.data.subscribed))
         .catch(() => {});
  }, [userId]);

  const subscribe = async () => {
    try {
      const keyRes = await axios.get(`${API_BASE_URL}/push/vapid-public-key`);
      const vapidKey = keyRes.data.public_key;

      const reg  = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: vapidKey,
      });

      const json = sub.toJSON();
      await axios.post(`${API_BASE_URL}/push/subscribe`, {
        user_id:  userId,
        endpoint: json.endpoint,
        p256dh:   json.keys.p256dh,
        auth:     json.keys.auth,
      });

      setSubscribed(true);
      return true;
    } catch (e) {
      console.error('Push subscribe error:', e);
      return false;
    }
  };

  const unsubscribe = async () => {
    await axios.delete(`${API_BASE_URL}/push/unsubscribe/${userId}`);
    setSubscribed(false);
  };

  return { subscribed, supported, subscribe, unsubscribe };
}

// ── Composant : carte cocktail pour commander ─────────────────────────────────
function CocktailCard({ recipe, onOrder, disabled }) {
  return (
    <button
      onClick={() => onOrder(recipe)}
      disabled={disabled}
      className="flex items-center gap-4 w-full bg-white/[0.04] border border-white/[0.08]
                 rounded-2xl p-4 hover:bg-white/[0.07] hover:border-white/[0.15]
                 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left">
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/30 border border-white/10 shrink-0">
        {recipe.image_url
          ? <img src={recipe.image_url} alt={recipe.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-2xl">🍹</div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-black text-white truncate">{recipe.name}</div>
        <div className="text-white/40 text-xs mt-0.5">
          {recipe.ingredients?.slice(0, 3).join(', ')}
          {recipe.ingredients?.length > 3 ? '…' : ''}
        </div>
        {recipe.price > 0 && (
          <div className="text-orange-400 text-xs font-bold mt-1">{recipe.price.toFixed(2)} €</div>
        )}
      </div>
      <ChevronRight size={18} className="text-white/20 shrink-0" />
    </button>
  );
}

// ── Composant : ma position dans la file ─────────────────────────────────────
function MyQueueCard({ entry, onCancel, onConfirmCode }) {
  const [code,        setCode]        = useState('');
  const [confirming,  setConfirming]  = useState(false);
  const [codeError,   setCodeError]   = useState(false);
  const [showInput,   setShowInput]   = useState(false);

  const statusConfig = {
    waiting:   { color: 'border-blue-500/30 bg-blue-500/5',   icon: <Clock size={20} className="text-blue-400" />,         label: 'En attente' },
    ready:     { color: 'border-orange-500/30 bg-orange-500/5', icon: <Star size={20} className="text-orange-400 animate-pulse" />, label: "C'est votre tour !" },
    confirmed: { color: 'border-emerald-500/30 bg-emerald-500/5', icon: <CheckCircle2 size={20} className="text-emerald-400" />, label: 'Confirmé — En préparation' },
  };

  const cfg = statusConfig[entry.status] || statusConfig.waiting;

  const handleConfirm = async () => {
    if (code.length !== 6) { setCodeError(true); return; }
    setConfirming(true);
    setCodeError(false);
    try {
      await onConfirmCode(entry.id, code);
    } catch {
      setCodeError(true);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className={`rounded-3xl border p-5 space-y-4 ${cfg.color}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {cfg.icon}
          <div>
            <div className="font-black text-white text-sm">{cfg.label}</div>
            <div className="text-white/40 text-xs">{entry.recipe_name}</div>
          </div>
        </div>
        {entry.status === 'waiting' && (
          <button onClick={onCancel}
            className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400
                       hover:bg-red-500/20 transition-all">
            <XCircle size={16} />
          </button>
        )}
      </div>

      {/* Position */}
      {entry.status === 'waiting' && (
        <div className="flex items-center justify-between bg-black/20 rounded-2xl p-4">
          <div className="text-center">
            <div className="text-4xl font-black text-white">{entry.position}</div>
            <div className="text-white/30 text-xs mt-1">Position</div>
          </div>
          <div className="h-12 w-px bg-white/10" />
          <div className="text-center">
            <div className="text-4xl font-black text-white">{Math.round(entry.wait_minutes)}</div>
            <div className="text-white/30 text-xs mt-1">min estimées</div>
          </div>
          <div className="h-12 w-px bg-white/10" />
          <div className="text-center">
            <div className="text-4xl font-black text-blue-400">~</div>
            <div className="text-white/30 text-xs mt-1">en direct</div>
          </div>
        </div>
      )}

      {/* Zone confirmation code */}
      {entry.status === 'ready' && (
        <div className="space-y-3">
          <p className="text-orange-300 text-sm font-bold text-center">
            🎉 La machine vous attend ! Saisissez le code affiché à l'écran.
          </p>
          {!showInput ? (
            <button onClick={() => setShowInput(true)}
              className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-black font-black
                         rounded-2xl transition-all flex items-center justify-center gap-2">
              <Ticket size={18} /> Saisir le code
            </button>
          ) : (
            <div className="space-y-3">
              {/* Input 6 chiffres style PIN */}
              <input
                type="number"
                maxLength={6}
                placeholder="_ _ _ _ _ _"
                value={code}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(v);
                  setCodeError(false);
                }}
                className={`w-full bg-black/40 border text-white text-3xl font-black
                            py-4 px-6 rounded-2xl text-center tracking-[0.5em] focus:outline-none
                            transition-colors
                            ${codeError
                              ? 'border-red-500/60 focus:border-red-500'
                              : 'border-white/20 focus:border-orange-500'}`}
              />
              {codeError && (
                <p className="text-red-400 text-xs text-center">Code incorrect — réessayez</p>
              )}
              <button onClick={handleConfirm} disabled={confirming || code.length !== 6}
                className="w-full py-4 bg-orange-500 hover:bg-orange-400 disabled:opacity-40
                           text-black font-black rounded-2xl transition-all flex items-center
                           justify-center gap-2">
                {confirming ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                {confirming ? 'Vérification…' : 'Valider'}
              </button>
            </div>
          )}
        </div>
      )}

      {entry.status === 'confirmed' && (
        <div className="text-center py-4">
          <div className="text-5xl mb-3">🍹</div>
          <p className="text-emerald-400 font-black">Préparation en cours !</p>
          <p className="text-white/30 text-xs mt-1">Votre cocktail arrive dans quelques instants.</p>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function QueuePage() {
  const { user } = useUser();
  const { myEntry, queue, loading, refetch } = useQueue(user?.id);
  const { subscribed, supported, subscribe, unsubscribe } = usePush(user?.id);

  const [cocktails,   setCocktails]   = useState([]);
  const [view,        setView]        = useState('queue');   // queue | order
  const [ordering,    setOrdering]    = useState(false);
  const [toast,       setToast]       = useState(null);
  const [pushLoading, setPushLoading] = useState(false);

  // Charger les cocktails
  useEffect(() => {
    axios.get(`${API_BASE_URL}/cocktails/`)
      .then(r => setCocktails(r.data))
      .catch(console.error);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOrder = async (recipe) => {
    if (!user) { showToast('Connectez-vous pour commander', 'error'); return; }
    setOrdering(true);
    try {
      await axios.post(`${API_BASE_URL}/queue`, {
        user_id:   user.id,
        recipe_id: recipe.id,
      });
      showToast(`✅ ${recipe.name} ajouté en file !`);
      setView('queue');
      refetch();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail?.message : detail;
      showToast(msg || 'Erreur', 'error');
    } finally {
      setOrdering(false);
    }
  };

  const handleCancel = async () => {
    if (!myEntry) return;
    try {
      await axios.delete(`${API_BASE_URL}/queue/${myEntry.id}?user_id=${user.id}`);
      showToast('Commande annulée');
      refetch();
    } catch { showToast('Erreur annulation', 'error'); }
  };

  const handleConfirmCode = async (entryId, code) => {
    // user_id requis par le backend depuis v3 (vérification ownership)
    const res = await axios.post(`${API_BASE_URL}/queue/${entryId}/confirm`, {
      code,
      user_id: user.id,
    });
    showToast(`🍹 ${res.data.recipe_name} — Préparation lancée !`);
    refetch();
  };

  const handlePushToggle = async () => {
    setPushLoading(true);
    if (subscribed) {
      await unsubscribe();
      showToast('Notifications désactivées', 'info');
    } else {
      const ok = await subscribe();
      showToast(ok ? '🔔 Notifications activées !' : 'Permission refusée', ok ? 'success' : 'error');
    }
    setPushLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl
                         text-sm font-bold shadow-2xl border backdrop-blur-xl
                         ${toast.type === 'error'
                           ? 'bg-red-950/90 border-red-500/30 text-red-300'
                           : toast.type === 'info'
                             ? 'bg-blue-950/90 border-blue-500/30 text-blue-300'
                             : 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600
                            flex items-center justify-center">
              <span className="font-mono font-black text-sm text-white">B4</span>
            </div>
            <div>
              <div className="font-black text-white text-sm leading-tight">BarOS</div>
              <div className="text-white/30 text-xs">File d'attente</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifs */}
            {supported && user && (
              <button onClick={handlePushToggle} disabled={pushLoading}
                className={`p-2.5 rounded-xl border transition-all
                  ${subscribed
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-white/[0.04] border-white/[0.08] text-white/30'}`}
                title={subscribed ? 'Désactiver les notifications' : 'Activer les notifications'}>
                {pushLoading
                  ? <Loader2 size={16} className="animate-spin" />
                  : subscribed ? <Bell size={16} /> : <BellOff size={16} />}
              </button>
            )}
            <button onClick={refetch}
              className="p-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl
                         text-white/30 hover:text-white/60 transition-colors">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">

        {/* ── Non connecté ── */}
        {!user && (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 mx-auto bg-purple-500/10 border border-purple-500/20
                            rounded-3xl flex items-center justify-center">
              <Shield size={28} className="text-purple-400" />
            </div>
            <p className="text-white font-black text-lg">Connectez-vous d'abord</p>
            <p className="text-white/30 text-sm">
              Scannez votre badge NFC sur la machine principale pour vous connecter,
              puis revenez ici pour commander.
            </p>
          </div>
        )}

        {/* ── Ma commande en cours ── */}
        {user && myEntry && (
          <section>
            <h2 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">
              Ma commande
            </h2>
            <MyQueueCard
              entry={myEntry}
              onCancel={handleCancel}
              onConfirmCode={handleConfirmCode}
            />
          </section>
        )}

        {/* ── État de la file ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-white/30 uppercase tracking-widest">
              File d'attente
            </h2>
            <span className="text-xs font-bold text-white/50 bg-white/[0.04] px-2.5 py-1 rounded-full">
              {queue.length} en attente
            </span>
          </div>

          {loading ? (
            <div className="text-center py-8 text-white/20 text-sm animate-pulse">
              Chargement…
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-10 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
              <Wine size={32} className="mx-auto text-white/10 mb-3" />
              <p className="text-white/30 text-sm font-bold">File vide — Commandez maintenant !</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((entry, i) => (
                <div key={entry.id}
                  className={`flex items-center gap-4 px-4 py-3 rounded-2xl border
                    ${entry.status === 'ready'
                      ? 'bg-orange-500/5 border-orange-500/20'
                      : 'bg-white/[0.02] border-white/[0.06]'}`}>
                  <span className={`text-2xl font-black w-8 text-center shrink-0
                    ${i === 0 ? 'text-orange-400' : 'text-white/20'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm truncate">{entry.recipe_name}</div>
                    <div className="text-white/30 text-xs">{entry.user_name}</div>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    {entry.status === 'ready' ? (
                      <span className="text-orange-400 font-bold animate-pulse">En cours</span>
                    ) : (
                      <span className="text-white/25">~{Math.round(entry.wait_minutes)} min</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Commander ── */}
        {user && !myEntry && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-white/30 uppercase tracking-widest">
                {view === 'order' ? 'Choisir un cocktail' : 'Passer commande'}
              </h2>
              {view === 'order' && (
                <button onClick={() => setView('queue')}
                  className="flex items-center gap-1 text-white/40 hover:text-white/60 text-xs">
                  <ArrowLeft size={12} /> Retour
                </button>
              )}
            </div>

            {view === 'queue' ? (
              <button onClick={() => setView('order')}
                className="w-full py-5 bg-gradient-to-r from-orange-500 to-red-600
                           rounded-2xl font-black text-white text-lg
                           shadow-[0_0_30px_rgba(249,115,22,0.3)]
                           hover:shadow-[0_0_40px_rgba(249,115,22,0.5)]
                           active:scale-95 transition-all flex items-center justify-center gap-3">
                <Wine size={20} /> Commander un cocktail
              </button>
            ) : (
              <div className="space-y-3">
                {cocktails.map(recipe => (
                  <CocktailCard
                    key={recipe.id}
                    recipe={recipe}
                    onOrder={handleOrder}
                    disabled={ordering}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Statut notifs (si pas encore activé) ── */}
        {user && supported && !subscribed && (
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-2xl p-4 flex items-center gap-4">
            <Bell size={20} className="text-blue-400 shrink-0" />
            <div className="flex-1">
              <p className="text-white text-sm font-bold">Activez les notifications</p>
              <p className="text-white/30 text-xs mt-0.5">
                On vous prévient quand c'est votre tour
              </p>
            </div>
            <button onClick={handlePushToggle}
              className="px-3 py-2 bg-blue-500 hover:bg-blue-400 text-white text-xs
                         font-bold rounded-xl transition-all shrink-0">
              Activer
            </button>
          </div>
        )}

        {/* ── Pied de page ── */}
        <div className="text-center text-white/10 text-xs pb-4">
          BarOS V4 · Mis à jour automatiquement
        </div>
      </div>
    </div>
  );
}