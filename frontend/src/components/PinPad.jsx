/**
 * BarOS V4 — PinPad.jsx
 * Chemin : src/components/PinPad.jsx
 *
 * Pavé numérique 6 chiffres affiché après le badge NFC.
 * Gère : saisie, effacement, tentatives restantes, compte à rebours de blocage.
 *
 * Props :
 *   userId       {number}   — ID du user badgé
 *   userName     {string}   — Prénom affiché en haut
 *   hasPin       {boolean}  — False = premier login → rediriger vers SetPin
 *   onSuccess    {fn(user)} — Appelé avec le profil complet si PIN correct
 *   onCancel     {fn}       — Bouton "Annuler" (retour à l'accueil)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Delete, LogIn, ShieldAlert, Lock } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';

const USERS_API = `${API_BASE_URL}/users`;
const PIN_LENGTH   = 6;
const DOTS_FILLED  = 'bg-white scale-110';
const DOTS_EMPTY   = 'bg-white/20';
const DOTS_ERROR   = 'bg-red-500 scale-110';
const DOTS_SUCCESS = 'bg-emerald-400 scale-110';

export default function PinPad({ userId, userName, hasPin, onSuccess, onCancel, onNeedSetPin }) {
  const [digits,       setDigits]       = useState([]);
  const [status,       setStatus]       = useState('idle');   // idle | checking | error | locked | success
  const [errorMsg,     setErrorMsg]     = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [lockTimer,    setLockTimer]    = useState(0);

  // ── Compte à rebours de blocage ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Si c'est un chiffre entre 0 et 9
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      }
      // Si c'est la touche Effacer (Backspace)
      else if (e.key === 'Backspace') {
        handleDelete();
      }
      // Si c'est Entrée (optionnel, car ton code valide déjà auto à 6 chiffres)
      else if (e.key === 'Enter' && digits.length === PIN_LENGTH) {
        submitPin(digits.join(''));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [digits, status]); // On ré-écoute quand digits change

  // ── Rediriger vers SetPin si pas encore de PIN ────────────────────────────
  useEffect(() => {
    if (!hasPin && onNeedSetPin) onNeedSetPin();
  }, [hasPin]);

  // ── Soumission automatique quand 6 chiffres ────────────────────────────────
  useEffect(() => {
    if (digits.length === PIN_LENGTH && status === 'idle') {
      submitPin(digits.join(''));
    }
  }, [digits]);

  const submitPin = useCallback(async (pin) => {
    setStatus('checking');
    try {
      const r = await axios.post(`${USERS_API}/verify-pin`, { user_id: userId, pin });
      setStatus('success');
      setTimeout(() => onSuccess(r.data), 500);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const code   = typeof detail === 'object' ? detail?.code : null;

      if (code === 'LOCKED') {
        setStatus('locked');
        setLockTimer(detail.remaining ?? 60);
        setErrorMsg(detail.message ?? 'Compte bloqué temporairement.');
      } else {
        setStatus('error');
        setAttemptsLeft(detail?.attempts_left ?? attemptsLeft - 1);
        setErrorMsg('PIN incorrect');
        // Shake puis reset
        setTimeout(() => {
          setDigits([]);
          setStatus('idle');
          setErrorMsg('');
        }, 900);
      }
    }
  }, [userId, attemptsLeft, onSuccess]);

  const handleDigit = (d) => {
    if (status !== 'idle' || digits.length >= PIN_LENGTH) return;
    setDigits(prev => [...prev, d]);
  };

  const handleDelete = () => {
    if (status !== 'idle') return;
    setDigits(prev => prev.slice(0, -1));
  };

  // ── Couleur des points ────────────────────────────────────────────────────
  const dotColor = (i) => {
    if (status === 'success') return DOTS_SUCCESS;
    if (status === 'error')   return i < digits.length ? DOTS_ERROR : DOTS_EMPTY;
    return i < digits.length ? DOTS_FILLED : DOTS_EMPTY;
  };

  const isLocked  = status === 'locked';
  const isChecking = status === 'checking' || status === 'success';

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-8">

        {/* Avatar + nom */}
        <div className="text-center space-y-3">
          <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-3xl font-black shadow-lg
                          ${isLocked
                            ? 'bg-red-500/20 border-2 border-red-500/40'
                            : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/20'}`}>
            {isLocked ? <Lock size={32} className="text-red-400" /> : userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{userName}</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {isLocked ? 'Compte temporairement bloqué' : 'Entrez votre PIN'}
            </p>
          </div>
        </div>

        {/* Points */}
        <div className={`flex justify-center gap-4 ${status === 'error' ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-full transition-all duration-150 ${dotColor(i)}`} />
          ))}
        </div>

        {/* Message erreur / blocage */}
        <div className="h-8 flex items-center justify-center">
          {isLocked && (
            <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
              <ShieldAlert size={16} />
              Réessayez dans <span className="font-black text-red-300 tabular-nums">{lockTimer}s</span>
            </div>
          )}
          {status === 'error' && (
            <p className="text-red-400 text-sm font-semibold">
              {errorMsg} — {attemptsLeft} essai{attemptsLeft > 1 ? 's' : ''} restant{attemptsLeft > 1 ? 's' : ''}
            </p>
          )}
          {status === 'success' && (
            <p className="text-emerald-400 text-sm font-semibold">✅ Accès autorisé</p>
          )}
        </div>

        {/* Clavier numérique */}
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handleDigit(String(n))}
              disabled={isLocked || isChecking}
              className="h-16 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95
                         border border-white/[0.08] text-white text-2xl font-bold
                         transition-all disabled:opacity-30 disabled:cursor-not-allowed
                         select-none">
              {n}
            </button>
          ))}

          {/* Ligne du bas : annuler / 0 / effacer */}
          <button onClick={onCancel}
            className="h-16 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] active:scale-95
                       border border-white/[0.05] text-gray-500 text-xs font-bold
                       transition-all select-none">
            Annuler
          </button>

          <button onClick={() => handleDigit('0')}
            disabled={isLocked || isChecking}
            className="h-16 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95
                       border border-white/[0.08] text-white text-2xl font-bold
                       transition-all disabled:opacity-30 disabled:cursor-not-allowed
                       select-none">
            0
          </button>

          <button onClick={handleDelete}
            disabled={isLocked || isChecking || digits.length === 0}
            className="h-16 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95
                       border border-white/[0.08] text-gray-400 hover:text-white
                       flex items-center justify-center
                       transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            <Delete size={22} />
          </button>
        </div>

      </div>

      {/* Animation shake en CSS pur */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}