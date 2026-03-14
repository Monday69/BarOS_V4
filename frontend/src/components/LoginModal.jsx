import React, { useState, useEffect } from 'react';
import { X, CreditCard, UserPlus, Check, LogIn, ArrowLeft } from 'lucide-react';
import { useUser } from '../context/UserContext';
import PinPad from './PinPad';
import SetPin from './SetPin';

const LoginModal = ({ isOpen, onClose }) => {
  const { scanCard, register, confirmPin, cancelPin, pendingUser, loading } = useUser();

  const [step,      setStep]      = useState('scan'); // scan | register | pin | setpin
  const [cardInput, setCardInput] = useState('');
  const [formData,  setFormData]  = useState({
    name: '', gender: 'M', weight: 70, age: 20, sugar: 5, alcohol: 5,
  });
  const [error, setError] = useState(null);

  // Quand pendingUser change → PIN ou SetPin
  useEffect(() => {
    if (!pendingUser) return;
    setStep(pendingUser.has_pin ? 'pin' : 'setpin');
  }, [pendingUser]);

  // Reset à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setStep('scan');
      setCardInput('');
      setFormData({ name: '', gender: 'M', weight: 70, age: 20, sugar: 5, alcohol: 5 });
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleScanSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!cardInput.trim()) return;
    const result = await scanCard(cardInput.trim().toUpperCase());
    if (!result.success && result.new) setStep('register');
    else if (!result.success)          setError(result.error || 'Erreur de lecture');
    // Si success → useEffect sur pendingUser gère la suite
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!cardInput.trim())     return setError('Le numéro de carte est obligatoire');
    if (!formData.name.trim()) return setError('Ton prénom est obligatoire');
    const success = await register(
      cardInput.trim().toUpperCase(),
      formData.name, formData.gender, formData.weight,
      formData.age, { sugar: formData.sugar, alcohol: formData.alcohol }
    );
    if (!success) setError("Erreur lors de l'inscription (badge déjà utilisé ?)");
    // Si success → pendingUser set → useEffect → setpin
  };

  const handlePinSuccess = async (verifiedUser) => {
    await confirmPin(verifiedUser);
    onClose();
  };

  const handlePinCancel = () => {
    cancelPin();
    setStep('scan');
    setCardInput('');
  };

  const handleSetPinSuccess = async () => {
    if (pendingUser) await confirmPin({ ...pendingUser, has_pin: true });
    onClose();
  };

  const patch = (field) => (e) => {
    const val = e.target.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value;
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  // ── PinPad et SetPin prennent tout l'écran ────────────────────────────────
  if (step === 'pin' && pendingUser) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a]">
        <PinPad
          userId={pendingUser.id}
          userName={pendingUser.name}
          hasPin={pendingUser.has_pin}
          onSuccess={handlePinSuccess}
          onCancel={handlePinCancel}
          onNeedSetPin={() => setStep('setpin')}
        />
      </div>
    );
  }

  if (step === 'setpin' && pendingUser) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a]">
        <SetPin
          userId={pendingUser.id}
          userName={pendingUser.name}
          onSuccess={handleSetPinSuccess}
          onCancel={handlePinCancel}
        />
      </div>
    );
  }

  // ── Modal standard ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-md rounded-3xl p-8 shadow-2xl
                      border border-black/5 dark:border-white/10 relative overflow-y-auto max-h-[90vh] transition-colors duration-300">
        <button onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <X />
        </button>

        {/* SCAN */}
        {step === 'scan' && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-blue-600/10 dark:bg-blue-600/20 rounded-full flex items-center
                            justify-center animate-pulse">
              <CreditCard className="text-blue-600 dark:text-blue-500 w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Identification</h2>
              <p className="text-gray-500 dark:text-gray-400">Passez votre carte ou badge sur le lecteur.</p>
            </div>
            <form onSubmit={handleScanSubmit} className="space-y-3">
              <input
                type="text" autoFocus placeholder="Simulation : tapez un UID…"
                className="w-full bg-gray-50 dark:bg-black/50 border border-black/10 dark:border-white/10 text-gray-900 dark:text-white p-4 rounded-xl
                           focus:outline-none focus:border-blue-500 text-center font-mono
                           placeholder:text-gray-400 dark:placeholder:text-white/20 transition-colors"
                value={cardInput} onChange={e => setCardInput(e.target.value)}
              />
              <button type="submit" disabled={loading || !cardInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white
                           py-3 rounded-xl font-bold transition-colors flex items-center
                           justify-center gap-2 disabled:cursor-not-allowed">
                {loading ? 'Lecture…' : <><LogIn size={18} /> Connexion</>}
              </button>
            </form>
            {error && (
              <p className="text-red-500 dark:text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                {error}
              </p>
            )}
            <div className="pt-4 border-t border-black/5 dark:border-white/5">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Nouveau membre ?{' '}
                <button type="button" onClick={() => setStep('register')}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-bold transition-colors">
                  Créer un profil
                </button>
              </p>
            </div>
          </div>
        )}

        {/* INSCRIPTION */}
        {step === 'register' && (
          <div className="space-y-6">
            <div className="text-center relative">
              <button type="button" onClick={() => setStep('scan')}
                className="absolute left-0 top-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div className="mx-auto w-16 h-16 bg-green-500/10 dark:bg-green-500/20 rounded-full flex items-center
                              justify-center mb-4">
                <UserPlus className="text-green-600 dark:text-green-500 w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Nouveau Profil</h2>
            </div>
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs ml-1 block mb-1">Numéro de Carte / Badge NFC *</label>
                <input type="text" placeholder="Ex: A1B2C3D4" required
                  className="w-full bg-gray-50 dark:bg-black/50 border border-black/10 dark:border-white/10 text-gray-900 dark:text-white p-3 rounded-xl
                             focus:border-green-500 outline-none font-mono text-center transition-colors"
                  value={cardInput} onChange={e => setCardInput(e.target.value)} />
              </div>
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs ml-1 block mb-1">Ton Prénom / Surnom *</label>
                <input type="text" required
                  className="w-full bg-gray-50 dark:bg-black/50 border border-black/10 dark:border-white/10 text-gray-900 dark:text-white p-3 rounded-xl
                             focus:border-green-500 outline-none transition-colors"
                  value={formData.name} onChange={patch('name')} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Sexe', field: 'gender', type: 'select',
                    options: [['M','Homme'],['F','Femme'],['O','Autre']] },
                  { label: 'Poids (kg)', field: 'weight', type: 'number', min: 30, max: 150 },
                  { label: 'Âge',        field: 'age',    type: 'number', min: 16, max: 99  },
                ].map(({ label, field, type, options, min, max }) => (
                  <div key={field}>
                    <label className="text-gray-500 dark:text-gray-400 text-xs ml-1 block mb-1">{label}</label>
                    {type === 'select' ? (
                      <select className="w-full bg-gray-50 dark:bg-black/50 border border-black/10 dark:border-white/10 text-gray-900 dark:text-white p-3
                                         rounded-xl focus:outline-none appearance-none text-center"
                        value={formData[field]} onChange={patch(field)}>
                        {options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    ) : (
                      <input type="number" min={min} max={max}
                        className="w-full bg-gray-50 dark:bg-black/50 border border-black/10 dark:border-white/10 text-gray-900 dark:text-white p-3
                                   rounded-xl text-center focus:outline-none focus:border-green-500"
                        value={formData[field]} onChange={patch(field)} />
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Niveau Sucre (1–10)',  field: 'sugar' },
                  { label: 'Niveau Alcool (1–10)', field: 'alcohol' },
                ].map(({ label, field }) => (
                  <div key={field}>
                    <label className="text-gray-500 dark:text-gray-400 text-xs ml-1 block mb-1">{label}</label>
                    <input type="number" min="1" max="10"
                      className="w-full bg-gray-50 dark:bg-black/50 border border-black/10 dark:border-white/10 text-gray-900 dark:text-white p-3
                                 rounded-xl text-center focus:outline-none focus:border-green-500"
                      value={formData[field]} onChange={patch(field)} />
                  </div>
                ))}
              </div>
              {error && (
                <p className="text-red-500 dark:text-red-400 text-sm bg-red-500/10 p-3 rounded-xl
                              border border-red-500/20 text-center">{error}</p>
              )}
              <button type="submit" disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white
                           py-4 rounded-xl font-bold transition-colors flex items-center
                           justify-center gap-2 disabled:cursor-not-allowed">
                {loading ? 'Création…' : <><Check /> Créer mon profil</>}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoginModal;