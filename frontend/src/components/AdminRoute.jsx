import React, { useState } from 'react';
import { ShieldAlert, Wifi, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useUser } from '../context/UserContext';

/**
 * AdminRoute — Guard de route NFC
 *
 * Wrape n'importe quelle page protégée.
 * Si l'user connecté est admin → affiche la page normalement.
 * Sinon → écran de scan NFC.
 *
 * ✅ isAdmin est déterminé par le backend (champ is_admin dans UserContext).
 *    Aucune comparaison de UID côté client.
 *
 * En production physique : l'input sera remplacé par l'événement du lecteur RC522
 * qui enverra directement l'UID via websocket ou polling.
 */
export default function AdminRoute({ children }) {
  const { isAdmin, scanCard, loading } = useUser();

  const [input,    setInput]    = useState('');
  const [status,   setStatus]   = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  // Accès autorisé → on rend la page directement
  if (isAdmin) return children;

  const handleScan = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setStatus('loading');
    setErrorMsg('');

    const result = await scanCard(input.trim().toUpperCase());

    if (result.success && result.user?.is_admin) {
      // ✅ Fix : plus de comparaison DEADBEEF — le backend expose is_admin
      setStatus('success');
      // isAdmin sera true via context → re-render automatique
    } else if (result.new) {
      setStatus('error');
      setErrorMsg('Carte inconnue du système');
    } else if (result.success) {
      // Carte valide mais pas admin
      setStatus('error');
      setErrorMsg('Accès refusé — droits insuffisants');
    } else {
      setStatus('error');
      setErrorMsg(result.error || 'Erreur de lecture');
    }

    setInput('');
    // ✅ Fix : setTimeout avec valeur locale, pas depuis le state stale
    setTimeout(() => setStatus('idle'), 2500);
  };

  return (
    <div className="min-h-screen w-full bg-[#080808] flex items-center justify-center p-6">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                         w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 transition-colors duration-700
                         ${status === 'error'   ? 'bg-red-600'
                         : status === 'success' ? 'bg-emerald-600'
                         : 'bg-blue-900'}`} />
      </div>

      <div className="relative z-10 w-full max-w-sm text-center space-y-8">

        {/* Icône centrale animée */}
        <div className="flex justify-center">
          <div className={`relative w-24 h-24 rounded-3xl flex items-center justify-center
                           border transition-all duration-500
                           ${status === 'error'   ? 'bg-red-500/10 border-red-500/30'
                           : status === 'success' ? 'bg-emerald-500/10 border-emerald-500/30'
                           : status === 'loading' ? 'bg-blue-500/10 border-blue-500/30'
                           : 'bg-white/[0.04] border-white/[0.08]'}`}>

            {status === 'loading' && <Loader size={40} className="text-blue-400 animate-spin" />}
            {status === 'success' && <CheckCircle size={40} className="text-emerald-400" />}
            {status === 'error'   && <XCircle size={40} className="text-red-400" />}
            {status === 'idle'    && (
              <>
                <ShieldAlert size={40} className="text-white/30" />
                <div className="absolute inset-0 rounded-3xl border border-blue-500/20 animate-ping" />
              </>
            )}
          </div>
        </div>

        {/* Texte */}
        <div>
          <h1 className="text-2xl font-black text-white mb-2">
            {status === 'error'   ? 'Accès refusé'
            : status === 'success' ? 'Accès autorisé'
            : 'Zone restreinte'}
          </h1>
          <p className={`text-sm transition-colors duration-300
            ${status === 'error'   ? 'text-red-400'
            : status === 'success' ? 'text-emerald-400'
            : 'text-white/30'}`}>
            {status === 'error'   ? errorMsg
            : status === 'success' ? 'Redirection en cours…'
            : 'Badgez votre carte administrateur pour accéder à cette page'}
          </p>
        </div>

        {/* Zone NFC — input de saisie pour la démo */}
        {(status === 'idle' || status === 'error') && (
          <form onSubmit={handleScan} className="space-y-3">
            <div className="relative">
              <Wifi size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                autoFocus
                placeholder="UID carte NFC…"
                value={input}
                onChange={e => setInput(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] text-white
                           text-sm px-5 py-4 pl-10 rounded-2xl font-mono tracking-widest
                           focus:outline-none focus:border-blue-500/50 transition-colors
                           placeholder:text-white/15"
              />
            </div>
            <button type="submit" disabled={!input.trim() || loading}
              className="w-full py-3.5 bg-blue-600/80 hover:bg-blue-600 disabled:opacity-30
                         text-white font-bold rounded-2xl transition-all text-sm
                         border border-blue-500/30 disabled:cursor-not-allowed">
              {loading ? 'Vérification…' : 'Valider'}
            </button>
          </form>
        )}

        {/* ✅ Fix : hint de démo supprimé — n'affiche plus DEADBEEF en clair dans l'UI */}
      </div>
    </div>
  );
}