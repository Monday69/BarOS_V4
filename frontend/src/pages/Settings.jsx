import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Settings as SettingsIcon, Zap, RefreshCw, Server, AlertTriangle, Edit3, X, Check, Trash2 } from 'lucide-react';

const Settings = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refillingId, setRefillingId] = useState(null);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [tempVolume, setTempVolume] = useState(0);

  const fetchIngredients = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/ingredients');
      // On filtre pour n'afficher que ce qui est assigné à une pompe
      const activeIngredients = response.data.filter(ing => ing.pump_id !== null);
      activeIngredients.sort((a, b) => a.pump_id - b.pump_id);
      setIngredients(activeIngredients);
      setLoading(false);
    } catch (error) {
      console.error("Erreur stocks:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
    const interval = setInterval(fetchIngredients, 5000);
    return () => clearInterval(interval);
  }, []);

  const getFluidColor = (current, max) => {
    const percentage = (current / max) * 100;
    const hue = Math.min(120, Math.max(0, percentage * 1.2)); 
    return `hsl(${hue}, 100%, 45%)`; 
  };

  const handleRefill = async (id) => {
    setRefillingId(id);
    try {
      // ✅ FIX: On envoie 1000 (1L) explicitement
      await axios.put(`http://localhost:8000/api/ingredients/${id}`, { current_volume_ml: 1000.0 });
      await fetchIngredients();
    } catch (error) {
      alert("Erreur remplissage");
    } finally {
      setRefillingId(null);
    }
  };

  const openEditModal = (ing) => {
    setEditingIngredient(ing);
    setTempVolume(ing.current_volume_ml);
  };

  const saveVolume = async () => {
    if (!editingIngredient) return;
    try {
      await axios.put(`http://localhost:8000/api/ingredients/${editingIngredient.id}`, {
        current_volume_ml: parseFloat(tempVolume) // ✅ FIX: On s'assure que c'est un nombre
      });
      setEditingIngredient(null);
      fetchIngredients();
    } catch (error) {
      alert("Erreur sauvegarde volume");
    }
  };

  const handleUnassign = async () => {
    if (!editingIngredient) return;
    if (confirm(`Retirer la bouteille de "${editingIngredient.name}" ?`)) {
        try {
            await axios.put(`http://localhost:8000/api/ingredients/${editingIngredient.id}`, { pump_id: null });
            setEditingIngredient(null);
            fetchIngredients(); 
        } catch (error) { alert("Erreur déconnexion"); }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6 pb-20">
      <div className="flex items-center justify-between">
        <div><h1 className="text-4xl font-bold text-white mb-2">Maintenance</h1><p className="text-gray-400">Gestion des stocks.</p></div>
        <div className="p-4 bg-white/5 rounded-full text-gray-400"><SettingsIcon size={40} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {loading ? ( <div className="col-span-2 text-center py-20 text-gray-500 animate-pulse">Chargement...</div> ) : ingredients.length === 0 ? (
           <div className="col-span-2 text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10"><AlertTriangle className="mx-auto h-16 w-16 text-yellow-500 mb-4" /><p className="text-2xl text-gray-400 font-bold">Machine Vide</p></div>
        ) : (
          ingredients.map((ing) => {
            const maxVol = ing.max_volume_ml || 1000; // ✅ FIX: Défaut 1000 si null
            const pct = (ing.current_volume_ml / maxVol) * 100;
            const fluidColor = getFluidColor(ing.current_volume_ml, maxVol);
            return (
              <div key={ing.id} className="bg-[#1e1e1e] border border-white/10 rounded-3xl p-8 relative shadow-2xl flex flex-col justify-between min-h-[220px]">
                <div className="flex justify-between items-start mb-6">
                  <div><h3 className="text-3xl font-bold text-white tracking-tight">{ing.name}</h3><div className="text-sm font-mono text-gray-400 mt-2 flex items-center gap-2 bg-black/30 w-fit px-3 py-1 rounded-full"><Zap size={14} className="text-yellow-500" /> POMPE #{ing.pump_id}</div></div>
                  <div className="text-4xl font-mono font-bold" style={{ color: fluidColor }}>{Math.round(pct)}%</div>
                </div>
                <div className="h-6 w-full bg-black/50 rounded-full overflow-hidden mb-6 border border-white/5 shadow-inner">
                  <div className="h-full transition-all duration-1000 ease-out relative shadow-[0_0_15px_rgba(0,0,0,0.5)]" style={{ width: `${pct}%`, backgroundColor: fluidColor }}><div className="absolute top-0 right-0 bottom-0 w-[2px] bg-white/40" /></div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                    <button onClick={() => handleRefill(ing.id)} disabled={refillingId === ing.id} className="col-span-3 py-4 bg-white/5 active:bg-green-600 active:scale-95 border border-white/10 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-3 text-gray-300 hover:bg-white/10"><RefreshCw size={20} className={refillingId === ing.id ? "animate-spin" : ""} /> {refillingId === ing.id ? "..." : "REMPLIR (1L)"}</button>
                    <button onClick={() => openEditModal(ing)} className="col-span-1 py-4 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl flex items-center justify-center active:bg-blue-600 active:text-white transition-colors"><Edit3 size={24} /></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editingIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#2a2a2a] w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl border border-white/10 transform transition-all scale-100">
                <div className="flex justify-between items-center mb-10">
                    <div><h2 className="text-4xl font-bold text-white mb-2">{editingIngredient.name}</h2><p className="text-gray-400 text-xl">Modifier le volume</p></div>
                    <button onClick={() => setEditingIngredient(null)} className="p-4 bg-white/5 rounded-full hover:bg-white/10 text-white transition-colors"><X size={40} /></button>
                </div>
                <div className="text-center mb-12"><span className="text-8xl font-bold text-blue-400 font-mono">{Math.round(tempVolume)}</span><span className="text-3xl text-gray-500 ml-4">ml</span></div>
                {/* ✅ FIX: Slider qui prend max_volume_ml correctement */}
                <div className="mb-12 px-4"><input type="range" min="0" max={editingIngredient.max_volume_ml || 1000} value={tempVolume} onChange={(e) => setTempVolume(Number(e.target.value))} className="w-full h-8 bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400" /></div>
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <button onClick={() => setTempVolume(prev => Math.max(0, prev - 50))} className="py-6 rounded-3xl bg-white/5 text-white font-bold text-2xl active:bg-white/10">- 50 ml</button>
                    <button onClick={() => setTempVolume(prev => Math.min(editingIngredient.max_volume_ml || 1000, prev + 50))} className="py-6 rounded-3xl bg-white/5 text-white font-bold text-2xl active:bg-white/10">+ 50 ml</button>
                </div>
                <div className="grid grid-cols-3 gap-6">
                    <button onClick={handleUnassign} className="col-span-1 py-6 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/30 rounded-3xl font-bold text-xl flex items-center justify-center gap-2 transition-all active:scale-95"><Trash2 size={28} /></button>
                    <button onClick={saveVolume} className="col-span-2 py-6 bg-blue-600 text-white rounded-3xl font-bold text-2xl shadow-lg shadow-blue-900/50 active:scale-95 transition-transform flex items-center justify-center gap-4"><Check size={32} /> SAUVEGARDER</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;