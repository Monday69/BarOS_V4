import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Settings as SettingsIcon, Zap, RefreshCw, Server, AlertTriangle, Edit3, X, Check, Trash2 } from 'lucide-react';

const Settings = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refillingId, setRefillingId] = useState(null);

  // État pour la fenêtre tactile (Modal)
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [tempVolume, setTempVolume] = useState(0);

  // --- 1. CHARGEMENT INTELLIGENT ---
  const fetchIngredients = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/cocktails/ingredients');
      const allIngredients = response.data;
      
      // On ne garde que ceux qui sont assignés à une pompe
      const activeIngredients = allIngredients.filter(ing => ing.pump_id !== null);
      activeIngredients.sort((a, b) => a.pump_id - b.pump_id);

      setIngredients(activeIngredients);
      setLoading(false);
    } catch (error) {
      console.error("Erreur chargement stocks:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
    const interval = setInterval(fetchIngredients, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- 2. COULEUR FLUIDE ---
  const getFluidColor = (current, max) => {
    const percentage = (current / max) * 100;
    const hue = Math.min(120, Math.max(0, percentage * 1.2)); 
    return `hsl(${hue}, 100%, 45%)`; 
  };

  // --- 3. ACTIONS ---
  const handleRefill = async (id) => {
    setRefillingId(id);
    try {
      await axios.put(`http://127.0.0.1:8000/cocktails/ingredients/${id}/refill`);
      await fetchIngredients();
    } catch (error) {
      alert("Erreur lors du remplissage");
    } finally {
      setRefillingId(null);
    }
  };

  // Ouvrir le modal
  const openEditModal = (ing) => {
    setEditingIngredient(ing);
    setTempVolume(ing.current_volume_ml);
  };

  // Sauvegarder le volume
  const saveVolume = async () => {
    if (!editingIngredient) return;
    try {
      await axios.put(`http://127.0.0.1:8000/cocktails/ingredients/${editingIngredient.id}/set_volume`, {
        volume_ml: tempVolume
      });
      setEditingIngredient(null);
      fetchIngredients();
    } catch (error) {
      alert("Erreur sauvegarde volume");
    }
  };

  // --- NOUVEAU : DÉCONNECTER (SUPPRIMER DE LA MACHINE) ---
  const handleUnassign = async () => {
    if (!editingIngredient) return;
    
    if (confirm(`Voulez-vous vraiment retirer la bouteille de "${editingIngredient.name}" de la machine ?`)) {
        try {
            await axios.put(`http://127.0.0.1:8000/cocktails/ingredients/${editingIngredient.id}/unassign`);
            setEditingIngredient(null); // Fermer le modal
            fetchIngredients(); // Rafraîchir la liste (la carte va disparaître)
        } catch (error) {
            console.error(error);
            alert("Erreur lors de la déconnexion");
        }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6 pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Maintenance</h1>
          <p className="text-gray-400">Gestion des stocks et des cuves.</p>
        </div>
        <div className="p-4 bg-white/5 rounded-full text-gray-400">
          <SettingsIcon size={40} />
        </div>
      </div>

      {/* GRILLE DES RÉSERVOIRS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {loading ? (
           <div className="col-span-2 text-center py-20 text-gray-500 animate-pulse">Chargement des niveaux...</div>
        ) : ingredients.length === 0 ? (
           <div className="col-span-2 text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
             <AlertTriangle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
             <p className="text-2xl text-gray-400 font-bold">Machine Vide</p>
             <p className="text-gray-500 mt-2">Aucune bouteille n'est assignée.</p>
           </div>
        ) : (
          ingredients.map((ing) => {
            const pct = (ing.current_volume_ml / ing.max_volume_ml) * 100;
            const fluidColor = getFluidColor(ing.current_volume_ml, ing.max_volume_ml);

            return (
              <div key={ing.id} className="bg-[#1e1e1e] border border-white/10 rounded-3xl p-8 relative shadow-2xl flex flex-col justify-between min-h-[220px]">
                
                {/* En-tête Carte */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-3xl font-bold text-white tracking-tight">{ing.name}</h3>
                    <div className="text-sm font-mono text-gray-400 mt-2 flex items-center gap-2 bg-black/30 w-fit px-3 py-1 rounded-full">
                      <Zap size={14} className="text-yellow-500" /> POMPE #{ing.pump_id}
                    </div>
                  </div>
                  <div className="text-4xl font-mono font-bold" style={{ color: fluidColor }}>
                    {Math.round(pct)}%
                  </div>
                </div>

                {/* Barre de Progression */}
                <div className="h-6 w-full bg-black/50 rounded-full overflow-hidden mb-6 border border-white/5 shadow-inner">
                  <div 
                    className="h-full transition-all duration-1000 ease-out relative shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                    style={{ width: `${pct}%`, backgroundColor: fluidColor }}
                  >
                    <div className="absolute top-0 right-0 bottom-0 w-[2px] bg-white/40" />
                  </div>
                </div>

                {/* Boutons */}
                <div className="grid grid-cols-4 gap-4">
                    <button
                        onClick={() => handleRefill(ing.id)}
                        disabled={refillingId === ing.id}
                        className="col-span-3 py-4 bg-white/5 active:bg-green-600 active:scale-95 border border-white/10 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-3 text-gray-300 hover:bg-white/10"
                    >
                        <RefreshCw size={20} className={refillingId === ing.id ? "animate-spin" : ""} />
                        {refillingId === ing.id ? "Remplissage..." : "REMPLIR (MAX)"}
                    </button>
                    
                    <button
                        onClick={() => openEditModal(ing)}
                        className="col-span-1 py-4 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl flex items-center justify-center active:bg-blue-600 active:text-white transition-colors"
                    >
                        <Edit3 size={24} />
                    </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- MODAL TACTILE --- */}
      {editingIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#2a2a2a] w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl border border-white/10 transform transition-all scale-100">
                
                {/* Header Modal */}
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h2 className="text-4xl font-bold text-white mb-2">{editingIngredient.name}</h2>
                        <p className="text-gray-400 text-xl">Modifier le volume ou retirer</p>
                    </div>
                    <button 
                        onClick={() => setEditingIngredient(null)}
                        className="p-4 bg-white/5 rounded-full hover:bg-white/10 text-white transition-colors"
                    >
                        <X size={40} />
                    </button>
                </div>

                {/* Affichage Volume */}
                <div className="text-center mb-12">
                    <span className="text-8xl font-bold text-blue-400 font-mono">
                        {Math.round(tempVolume)}
                    </span>
                    <span className="text-3xl text-gray-500 ml-4">ml</span>
                </div>

                {/* Slider */}
                <div className="mb-12 px-4">
                    <input 
                        type="range" 
                        min="0" 
                        max={editingIngredient.max_volume_ml} 
                        value={tempVolume} 
                        onChange={(e) => setTempVolume(Number(e.target.value))}
                        className="w-full h-8 bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                    />
                </div>

                {/* Boutons Actions */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <button onClick={() => setTempVolume(prev => Math.max(0, prev - 50))} className="py-6 rounded-3xl bg-white/5 text-white font-bold text-2xl active:bg-white/10">- 50 ml</button>
                    <button onClick={() => setTempVolume(prev => Math.min(editingIngredient.max_volume_ml, prev + 50))} className="py-6 rounded-3xl bg-white/5 text-white font-bold text-2xl active:bg-white/10">+ 50 ml</button>
                </div>

                {/* VALIDATION & SUPPRESSION */}
                <div className="grid grid-cols-3 gap-6">
                     {/* NOUVEAU BOUTON : DÉCONNECTER (ROUGE) */}
                    <button 
                        onClick={handleUnassign} 
                        className="col-span-1 py-6 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/30 rounded-3xl font-bold text-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                        title="Retirer cette bouteille"
                    >
                        <Trash2 size={28} />
                    </button>

                    <button 
                        onClick={saveVolume} 
                        className="col-span-2 py-6 bg-blue-600 text-white rounded-3xl font-bold text-2xl shadow-lg shadow-blue-900/50 active:scale-95 transition-transform flex items-center justify-center gap-4"
                    >
                        <Check size={32} /> SAUVEGARDER
                    </button>
                </div>

            </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 p-6 bg-black/20 rounded-3xl border border-white/5 flex items-center justify-center gap-4 text-gray-500">
        <Server size={20} />
        <span>BarOS Touch v4.0 • System Ready</span>
      </div>

    </div>
  );
};

export default Settings;