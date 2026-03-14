/**
 * BarOS V4 — QueueMachine.jsx
 * Chemin : src/components/QueueMachine.jsx
 *
 * Composant affiché sur l'écran de la machine.
 * Montre la file d'attente en temps réel + le code de confirmation
 * quand c'est le tour de quelqu'un.
 *
 * Usage dans une page admin :
 *   <QueueMachine adminKey="..." />
 *
 * L'admin marque "prêt" depuis ce composant → génère le code → user confirme.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Users, Clock, CheckCircle2, Play, XCircle,
  Wine, Loader2, Star, RefreshCw, ChevronRight
} from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

const API_QUEUE = `${API_BASE_URL}/queue`;

// ── Affichage grand code de confirmation ──────────────────────────────────────
function ConfirmCodeDisplay({ entry }) {
  const [secondsLeft, setSecondsLeft] = useState(120);  // 2 min pour confirmer

  useEffect(() => {
    if (!entry?.confirm_code) return;
    setSecondsLeft(120);
    const id = setInterval(() => {
      setSecondsLeft(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [entry?.confirm_code]);

  if (!entry?.confirm_code) return null;

  const digits = entry.confirm_code.split('');

  return (
    <div className="rounded-3xl border border-orange-500/30 bg-orange-500/5
                    p-8 text-center space-y-6">
      {/* Animation pulse */}
      <div className="flex items-center justify-center gap-3">
        <div className="w-3 h-3 rounded-full bg-orange-500 animate-ping" />
        <span className="text-orange-400 font-black text-sm uppercase tracking-widest">
          C'est votre tour !
        </span>
        <div className="w-3 h-3 rounded-full bg-orange-500 animate-ping" />
      </div>

      <div>
        <p className="text-white/50 text-sm mb-2">
          {entry.user_name}, scannez le QR ou saisissez ce code sur votre téléphone
        </p>
        <p className="text-white/30 text-xs">baros.local/queue</p>
      </div>

      {/* Code en gros */}
      <div className="flex items-center justify-center gap-3">
        {digits.map((d, i) => (
          <div key={i}
            className="w-16 h-20 bg-black/50 border-2 border-orange-500/40 rounded-2xl
                       flex items-center justify-center
                       text-5xl font-black text-orange-300 font-mono">
            {d}
          </div>
        ))}
      </div>

      {/* Cocktail commandé */}
      <div className="flex items-center justify-center gap-3 text-white/60">
        <Wine size={16} />
        <span className="font-bold">{entry.recipe_name}</span>
      </div>

      {/* Timer */}
      <div className={`text-sm font-bold ${secondsLeft < 30 ? 'text-red-400' : 'text-white/30'}`}>
        {secondsLeft > 0
          ? `Code valide encore ${secondsLeft}s`
          : 'Code expiré — relancez'}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function QueueMachine({ adminKey }) {
  const [queue,       setQueue]       = useState([]);
  const [readyEntry,  setReadyEntry]  = useState(null);  // entrée avec code affiché
  const [loading,     setLoading]     = useState(true);
  const [marking,     setMarking]     = useState(false);

  const headers = { 'x-admin-token': adminKey };

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axios.get(`${API_QUEUE}`);
      const entries = res.data.queue || [];
      setQueue(entries);
      // Garder en mémoire l'entrée "ready" avec son code
      const ready = entries.find(e => e.status === 'ready');
      if (ready?.confirm_code) setReadyEntry(ready);
      else if (!ready)         setReadyEntry(null);
    } catch (e) {
      console.error('Erreur queue machine:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, 4000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  const markReady = async (entryId) => {
    setMarking(true);
    try {
      const res = await axios.post(`${API_QUEUE}/${entryId}/ready`, {}, { headers });
      // Mettre à jour localement avec le code reçu
      setReadyEntry({ ...res.data });
      fetchQueue();
    } catch (e) {
      console.error('Erreur mark ready:', e);
    } finally {
      setMarking(false);
    }
  };

  const adminCancel = async (entryId) => {
    try {
      await axios.delete(`${API_QUEUE}/${entryId}/admin`, { headers });
      fetchQueue();
    } catch (e) {
      console.error('Erreur annulation:', e);
    }
  };

  const waiting = queue.filter(e => e.status === 'waiting');
  const next    = waiting[0];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-purple-400" />
          <h2 className="font-black text-white text-lg">File d'Attente</h2>
          <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400
                           text-xs font-bold px-2.5 py-1 rounded-full">
            {queue.length} cocktail{queue.length > 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={fetchQueue}
          className="p-2 text-white/20 hover:text-white/50 transition-colors">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* ── Code de confirmation (s'affiche en grand) ── */}
      {readyEntry && <ConfirmCodeDisplay entry={readyEntry} />}

      {/* ── Bouton "Lancer le suivant" ── */}
      {next && !readyEntry && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/30 border border-white/10 shrink-0">
              {next.recipe_image
                ? <img src={next.recipe_image} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xl">🍹</div>}
            </div>
            <div className="flex-1">
              <div className="font-black text-white">{next.recipe_name}</div>
              <div className="text-white/40 text-xs">{next.user_name}</div>
            </div>
            <button
              onClick={() => markReady(next.id)}
              disabled={marking}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40
                         text-white font-black rounded-xl transition-all flex items-center gap-2
                         shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              {marking
                ? <Loader2 size={16} className="animate-spin" />
                : <Play size={16} fill="currentColor" />}
              {marking ? '…' : 'Appeler'}
            </button>
          </div>
        </div>
      )}

      {/* ── Liste de la file ── */}
      {loading ? (
        <div className="text-center py-8 text-white/20 text-sm animate-pulse">Chargement…</div>
      ) : queue.length === 0 ? (
        <div className="text-center py-10 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
          <Wine className="mx-auto h-8 w-8 text-white/10 mb-2" />
          <p className="text-white/20 text-sm">File vide</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((entry, i) => (
            <div key={entry.id}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all
                ${entry.status === 'ready'
                  ? 'bg-orange-500/5 border-orange-500/20'
                  : entry.status === 'confirmed'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-white/[0.02] border-white/[0.06]'}`}>

              {/* Position */}
              <span className={`text-xl font-black w-7 text-center shrink-0
                ${i === 0 ? 'text-orange-400' : 'text-white/20'}`}>
                {i + 1}
              </span>

              {/* Image */}
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/30 border border-white/10 shrink-0">
                {entry.recipe_image
                  ? <img src={entry.recipe_image} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-base">🍹</div>}
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm truncate">{entry.recipe_name}</div>
                <div className="text-white/30 text-xs">{entry.user_name}</div>
              </div>

              {/* Statut */}
              <div className="shrink-0">
                {entry.status === 'ready' ? (
                  <span className="flex items-center gap-1 text-orange-400 text-xs font-bold">
                    <Star size={12} className="animate-pulse" /> Appelé
                  </span>
                ) : entry.status === 'confirmed' ? (
                  <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 size={12} /> Confirmé
                  </span>
                ) : (
                  <span className="text-white/20 text-xs flex items-center gap-1">
                    <Clock size={11} /> ~{Math.round(entry.wait_minutes)} min
                  </span>
                )}
              </div>

              {/* Annuler (admin) */}
              {entry.status === 'waiting' && (
                <button onClick={() => adminCancel(entry.id)}
                  className="p-1.5 text-white/15 hover:text-red-400 transition-colors shrink-0">
                  <XCircle size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}