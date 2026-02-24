import React, { useState, useEffect } from 'react';
import { X, CreditCard, UserPlus, Check, LogIn, ArrowLeft } from 'lucide-react';
import { useUser } from '../context/UserContext';

const LoginModal = ({ isOpen, onClose }) => {
  const { scanCard, register, loading } = useUser();

  const [step,      setStep]      = useState('scan'); // 'scan' | 'register'
  const [cardInput, setCardInput] = useState('');
  const [formData,  setFormData]  = useState({
    name: '', gender: 'M', weight: 70, age: 20, sugar: 5, alcohol: 5
  });
  const [error, setError] = useState(null);

  // Reset quand on ouvre
  useEffect(() => {
    if (isOpen) {
      setStep('scan');
      setCardInput('');
      setFormData({ name: '', gender: 'M', weight: 70, age: 20, sugar: 5, alcohol: 5 });
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Scan / Connexion ────────────────────────────────────────────────────────
  const handleScanSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!cardInput.trim()) return;

    const result = await scanCard(cardInput.trim().toUpperCase());

    if (result.success) {
      onClose();
    } else if (result.new) {
      setStep('register');
    } else {
      setError(result.error || "Erreur de lecture");
    }
  };

  // ── Inscription ─────────────────────────────────────────────────────────────
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!cardInput.trim())     return setError("Le numéro de carte est obligatoire");
    if (!formData.name.trim()) return setError("Ton prénom est obligatoire");

    const success = await register(
      cardInput.trim().toUpperCase(),
      formData.name,
      formData.gender,
      formData.weight,
      formData.age,
      { sugar: formData.sugar, alcohol: formData.alcohol }
    );

    if (success) onClose();
    else setError("Erreur lors de l'inscription (badge déjà utilisé ?)");
  };

  // ── Helpers formulaire ──────────────────────────────────────────────────────
  const patch = (field) => (e) => {
    const val = e.target.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value;
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] w-full max-w-md rounded-3xl p-8 shadow-2xl
                      border border-white/10 relative overflow-y-auto max-h-[90vh]">

        <button onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
          <X />
        </button>

        {/* ── ÉTAPE 1 : SCAN ─────────────────────────────────────────────── */}
        {step === 'scan' && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-blue-600/20 rounded-full flex items-center
                            justify-center animate-pulse">
              <CreditCard className="text-blue-500 w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Identification</h2>
              <p className="text-gray-400">Passez votre carte ou badge sur le lecteur.</p>
            </div>

            <form onSubmit={handleScanSubmit} className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Simulation : tapez un UID…"
                className="w-full bg-black/50 border border-white/10 text-white p-4 rounded-xl
                           focus:outline-none focus:border-blue-500 text-center font-mono
                           placeholder:text-white/20 transition-colors"
                value={cardInput}
                onChange={e => setCardInput(e.target.value)}
              />
              <button type="submit" disabled={loading || !cardInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                           text-white py-3 rounded-xl font-bold transition-colors
                           flex items-center justify-center gap-2 disabled:cursor-not-allowed">
                {loading ? "Lecture…" : <><LogIn size={18} /> Connexion</>}
              </button>
            </form>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                {error}
              </p>
            )}

            <div className="pt-4 border-t border-white/5">
              <p className="text-gray-400 text-sm">
                Nouveau membre ?{' '}
                <button type="button" onClick={() => setStep('register')}
                  className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
                  Créer un profil
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 2 : INSCRIPTION ──────────────────────────────────────── */}
        {step === 'register' && (
          <div className="space-y-6">
            <div className="text-center relative">
              <button type="button" onClick={() => setStep('scan')}
                className="absolute left-0 top-2 text-gray-400 hover:text-white transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center
                              justify-center mb-4">
                <UserPlus className="text-green-500 w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">Nouveau Profil</h2>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">

              {/* UID carte */}
              <div>
                <label className="text-gray-400 text-xs ml-1 block mb-1">
                  Numéro de Carte / Badge NFC *
                </label>
                <input
                  type="text"
                  placeholder="Ex: A1B2C3D4"
                  className="w-full bg-black/50 border border-white/10 text-white p-3 rounded-xl
                             focus:border-green-500 outline-none font-mono text-center
                             transition-colors"
                  value={cardInput}
                  onChange={e => setCardInput(e.target.value)}
                  required
                />
              </div>

              {/* Prénom */}
              <div>
                <label className="text-gray-400 text-xs ml-1 block mb-1">
                  Ton Prénom / Surnom *
                </label>
                <input
                  type="text"
                  className="w-full bg-black/50 border border-white/10 text-white p-3 rounded-xl
                             focus:border-green-500 outline-none transition-colors"
                  value={formData.name}
                  onChange={patch('name')}
                  required
                />
              </div>

              {/* Données biométriques */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-gray-400 text-xs ml-1 block mb-1">Sexe</label>
                  <select
                    className="w-full bg-black/50 border border-white/10 text-white p-3 rounded-xl
                               focus:outline-none appearance-none text-center transition-colors"
                    value={formData.gender}
                    onChange={patch('gender')}
                  >
                    <option value="M">Homme</option>
                    <option value="F">Femme</option>
                    <option value="O">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs ml-1 block mb-1">Poids (kg)</label>
                  <input type="number" min="30" max="150"
                    className="w-full bg-black/50 border border-white/10 text-white p-3 rounded-xl
                               text-center transition-colors focus:outline-none focus:border-green-500"
                    value={formData.weight}
                    onChange={patch('weight')}
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs ml-1 block mb-1">Âge</label>
                  <input type="number" min="16" max="99"
                    className="w-full bg-black/50 border border-white/10 text-white p-3 rounded-xl
                               text-center transition-colors focus:outline-none focus:border-green-500"
                    value={formData.age}
                    onChange={patch('age')}
                  />
                </div>
              </div>

              {/* Préférences */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs ml-1 block mb-1">
                    Niveau Sucre (1–10)
                  </label>
                  <input type="number" min="1" max="10"
                    className="w-full bg-black/50 border border-white/10 text-white p-3 rounded-xl
                               text-center transition-colors focus:outline-none focus:border-green-500"
                    value={formData.sugar}
                    onChange={patch('sugar')}
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs ml-1 block mb-1">
                    Niveau Alcool (1–10)
                  </label>
                  <input type="number" min="1" max="10"
                    className="w-full bg-black/50 border border-white/10 text-white p-3 rounded-xl
                               text-center transition-colors focus:outline-none focus:border-green-500"
                    value={formData.alcohol}
                    onChange={patch('alcohol')}
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl
                              border border-red-500/20 text-center">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40
                           text-white py-4 rounded-xl font-bold transition-colors
                           flex items-center justify-center gap-2 mt-2
                           disabled:cursor-not-allowed">
                {loading ? "Création…" : <><Check /> Créer mon profil</>}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoginModal;