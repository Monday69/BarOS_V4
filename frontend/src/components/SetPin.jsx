/**
 * BarOS V4 — SetPin.jsx
 * Chemin : src/components/SetPin.jsx
 *
 * Affiché quand un user n'a pas encore de PIN (premier badge).
 * Saisie + confirmation → POST /api/users/set-pin
 *
 * Props :
 *   userId    {number}
 *   userName  {string}
 *   onSuccess {fn}     — Appelé après définition réussie
 *   onCancel  {fn}
 */
import React, { useState, useEffect } from 'react';
import { Delete, CheckCircle2, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';

const USERS_API = `${API_BASE_URL}/users`;
const PIN_LENGTH = 6;

function MiniPad({ digits, onDigit, onDelete, disabled, dotColor }) {
  return (
    <div className="space-y-5">
      {/* Points */}
      <div className="flex justify-center gap-4">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full transition-all duration-150 ${dotColor(i, digits)}`} />
        ))}
      </div>

      {/* Clavier */}
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => onDigit(String(n))} disabled={disabled}
            className="h-14 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95
                       border border-white/[0.08] text-white text-xl font-bold
                       transition-all disabled:opacity-30 select-none">
            {n}
          </button>
        ))}
        <div /> {/* placeholder */}
        <button onClick={() => onDigit('0')} disabled={disabled}
          className="h-14 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95
                     border border-white/[0.08] text-white text-xl font-bold
                     transition-all disabled:opacity-30 select-none">
          0
        </button>
        <button onClick={onDelete} disabled={disabled || digits.length === 0}
          className="h-14 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95
                     border border-white/[0.08] text-gray-400 hover:text-white
                     flex items-center justify-center
                     transition-all disabled:opacity-30">
          <Delete size={20} />
        </button>
      </div>
    </div>
  );
}

export default function SetPin({ userId, userName, onSuccess, onCancel }) {
  const [step,    setStep]    = useState('choose');   // choose | confirm
  const [pin1,    setPin1]    = useState([]);
  const [pin2,    setPin2]    = useState([]);
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);

  const current  = step === 'choose' ? pin1 : pin2;
  const setDigits = step === 'choose' ? setPin1 : setPin2;

  // Auto-avancer quand 6 chiffres saisis
  useEffect(() => {
    if (current.length < PIN_LENGTH) return;

    if (step === 'choose') {
      // Passer à la confirmation
      setTimeout(() => setStep('confirm'), 200);
    } else {
      // Vérifier correspondance
      if (pin1.join('') !== pin2.join('')) {
        setError('Les deux PIN ne correspondent pas.');
        setTimeout(() => {
          setPin2([]);
          setError('');
        }, 1000);
      } else {
        savePin(pin1.join(''));
      }
    }
  }, [current]);

  const savePin = async (pin) => {
    setSaving(true);
    try {
      await axios.post(`${USERS_API}/set-pin`, { user_id: userId, pin });
      setDone(true);
      setTimeout(() => onSuccess(), 1200);
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Erreur lors de la sauvegarde.';
      setError(typeof msg === 'string' ? msg : 'Erreur serveur.');
      setTimeout(() => { setPin1([]); setPin2([]); setStep('choose'); setError(''); setSaving(false); }, 1500);
    }
  };

  const handleDigit = (d) => {
    if (saving || current.length >= PIN_LENGTH) return;
    setDigits(prev => [...prev, d]);
  };

  const handleDelete = () => {
    if (saving) return;
    setDigits(prev => prev.slice(0, -1));
  };

  const dotColor = (i, digits) => {
    if (error)         return i < digits.length ? 'bg-red-500 scale-110' : 'bg-white/20';
    if (done)          return 'bg-emerald-400 scale-110';
    return i < digits.length ? 'bg-white scale-110' : 'bg-white/20';
  };

  if (done) return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-6 p-6">
      <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30
                      flex items-center justify-center">
        <CheckCircle2 size={48} className="text-emerald-400" />
      </div>
      <h2 className="text-2xl font-black text-white">PIN créé !</h2>
      <p className="text-gray-500 text-sm">Connexion en cours…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600
                          flex items-center justify-center text-3xl font-black shadow-lg shadow-indigo-500/20">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <ShieldCheck size={16} className="text-violet-400" />
              <span className="text-violet-400 text-xs font-bold uppercase tracking-widest">
                {step === 'choose' ? 'Créer votre PIN' : 'Confirmer le PIN'}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">{userName}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {step === 'choose'
                ? 'Choisissez un code à 6 chiffres'
                : 'Saisissez à nouveau votre PIN'}
            </p>
          </div>
        </div>

        {/* Indicateur étape */}
        <div className="flex items-center justify-center gap-2">
          <div className={`h-1.5 w-12 rounded-full transition-all ${step === 'choose' ? 'bg-violet-500' : 'bg-violet-500/30'}`} />
          <div className={`h-1.5 w-12 rounded-full transition-all ${step === 'confirm' ? 'bg-violet-500' : 'bg-violet-500/30'}`} />
        </div>

        {/* Message erreur */}
        <div className="h-6 flex items-center justify-center">
          {error && <p className="text-red-400 text-sm font-semibold">{error}</p>}
        </div>

        {/* Pavé */}
        <MiniPad
          digits={current}
          onDigit={handleDigit}
          onDelete={handleDelete}
          disabled={saving}
          dotColor={dotColor}
        />

        {/* Retour */}
        {step === 'confirm' && (
          <button onClick={() => { setStep('choose'); setPin1([]); setPin2([]); setError(''); }}
            className="w-full py-3 text-gray-600 hover:text-gray-400 text-sm transition-colors text-center">
            ← Recommencer
          </button>
        )}
        {step === 'choose' && (
          <button onClick={onCancel}
            className="w-full py-3 text-gray-600 hover:text-gray-400 text-sm transition-colors text-center">
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}