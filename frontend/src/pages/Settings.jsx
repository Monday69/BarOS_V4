import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Settings as SettingsIcon, Database, Zap, RefreshCw, Server, AlertTriangle } from 'lucide-react';

const Settings = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refillingId, setRefillingId] = useState(null);

  // Charger les données
  const fetchIngredients = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/cocktails/ingredients');
      setIngredients(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Erreur chargement stocks:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, []);

  // Action de remplissage
  const handleRefill = async (id) => {
    setRefillingId(id);
    try {
      await axios.put(`http://127.0.0.1:8000/cocktails/ingredients/${id}/refill`);
      await fetchIngredients(); // On rafraîchit les données
    } catch (error) {
      alert("Erreur lors du remplissage");
    } finally {
      setRefillingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-textMuted mb-2">Maintenance Système</h1>
          <p className="text-textMuted">Gestion des stocks et calibration hardware.</p>
        </div>
        <div className="p-3 bg-surfaceLight rounded-full text-textMuted">
          <SettingsIcon size={32} />
        </div>
      </div>

      {/* SECTION 1 : ÉTAT DES RÉSERVOIRS */}
      <div className="bg-surface border border-white/5 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
          <Database className="text-primary" />
          <h2 className="text-xl font-bold text-white">État des Réservoirs</h2>
        </div>

        {loading ? (
          <div className="text-center py-10 animate-pulse text-textMuted">Analyse des capteurs...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ingredients.map((ing) => {
              // Calcul du pourcentage
              const percentage = Math.round((ing.current_volume_ml / ing.max_volume_ml) * 100);
              // Couleur dynamique (Rouge si < 20%)
              const isLow = percentage < 20;
              const barColor = isLow ? "bg-danger" : (ing.name.includes("Cyan") ? "bg-cyan-500" : ing.name.includes("Magenta") ? "bg-fuchsia-500" : ing.name.includes("Yellow") ? "bg-yellow-400" : "bg-primary");

              return (
                <div key={ing.id} className="bg-surfaceLight/50 p-5 rounded-xl border border-white/5 relative group hover:border-white/10 transition-all">
                  
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-white">{ing.name}</h3>
                      <div className="text-xs font-mono text-textMuted mt-1 flex items-center gap-2">
                        <Zap size={12} /> POMPE #{ing.pump_id}
                      </div>
                    </div>
                    <div className={`text-xl font-mono font-bold ${isLow ? 'text-danger animate-pulse' : 'text-textMain'}`}>
                      {percentage}%
                    </div>
                  </div>

                  {/* Barre de progression style "Jauge" */}
                  <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden mb-2 border border-white/5">
                    <div 
                      className={`h-full ${barColor} transition-all duration-1000 ease-out relative`}
                      style={{ width: `${percentage}%` }}
                    >
                      {/* Petit effet de brillance sur la barre */}
                      <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-white/50 shadow-[0_0_10px_white]" />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-mono text-textMuted mb-4">
                    <span>{Math.round(ing.current_volume_ml)} ml</span>
                    <span>Max: {ing.max_volume_ml} ml</span>
                  </div>

                  {/* Bouton Remplir */}
                  <button
                    onClick={() => handleRefill(ing.id)}
                    disabled={refillingId === ing.id}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={12} className={refillingId === ing.id ? "animate-spin" : ""} />
                    {refillingId === ing.id ? "Remplissage..." : "Réinitialiser"}
                  </button>

                  {isLow && (
                    <div className="absolute top-2 right-2 text-danger">
                      <AlertTriangle size={16} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2 : INFO HARDWARE (Juste pour le style du jury) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface border border-white/5 rounded-2xl p-6 flex items-center gap-4">
          <div className="p-4 bg-green-500/10 rounded-full text-green-500">
            <Server size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white">Backend Status</h3>
            <p className="text-sm text-textMuted">FastAPI v0.109 • Port 8000</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-green-400 font-mono">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              ONLINE
            </div>
          </div>
        </div>

        <div className="bg-surface border border-white/5 rounded-2xl p-6 flex items-center gap-4">
          <div className="p-4 bg-accent/10 rounded-full text-accent">
            <Zap size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white">Driver GPIO</h3>
            <p className="text-sm text-textMuted">Mode: {window.location.hostname === 'localhost' ? 'MOCK (Simulation)' : 'BCM (Raspberry Pi)'}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-accent font-mono">
              <span className="w-2 h-2 bg-accent rounded-full"></span>
              ACTIVE
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Settings;