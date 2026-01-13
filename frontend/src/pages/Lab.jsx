import React, { useState } from 'react';
import axios from 'axios';
import { FlaskConical, Play, RefreshCw, AlertCircle } from 'lucide-react';

const Lab = () => {
  // États pour stocker les choix de l'utilisateur
  const [color, setColor] = useState("#00FF00"); // Vert par défaut
  const [volume, setVolume] = useState(50);      // 50ml par défaut
  const [status, setStatus] = useState("idle");  // idle, loading, success, error
  const [logs, setLogs] = useState([]);          // Pour afficher la réponse du serveur

  // Fonction qui appelle le Backend
  const handleMix = async () => {
    setStatus("loading");
    setLogs([]); // On vide les logs

    try {
      // L'appel API vers ton Python
      const response = await axios.post('http://127.0.0.1:8000/cocktails/mix_color', {
        hex_code: color,
        volume_ml: parseInt(volume)
      });

      // Si ça marche
      setStatus("success");
      setLogs([
        `Commande envoyée avec succès !`,
        `Couleur: ${color}`,
        `Volumes calculés: Cyan ${response.data.volumes.cyan_ml}ml, Magenta ${response.data.volumes.magenta_ml}ml, Jaune ${response.data.volumes.yellow_ml}ml`
      ]);

    } catch (error) {
      // Si ça plante
      setStatus("error");
      console.error(error);
      setLogs([`Erreur: ${error.response?.data?.detail || "Impossible de joindre le serveur"}`]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-accent mb-2">Laboratoire R&D</h1>
          <p className="text-textMuted">Testez le mélangeur colorimétrique en temps réel.</p>
        </div>
        <div className="p-3 bg-accent/10 rounded-full text-accent">
          <FlaskConical size={32} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* COLONNE GAUCHE : Les Contrôles */}
        <div className="bg-surface p-8 rounded-2xl border border-white/5 space-y-8">
          
          {/* 1. Sélecteur de Couleur */}
          <div className="space-y-4">
            <label className="text-sm font-mono text-textMuted uppercase tracking-wider">Choix de la couleur</label>
            <div className="flex gap-4 items-center">
              <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-20 h-20 rounded-xl cursor-pointer bg-transparent border-0"
              />
              <div className="flex flex-col">
                <span className="text-2xl font-mono font-bold">{color.toUpperCase()}</span>
                <span className="text-sm text-textMuted">Format HEX</span>
              </div>
            </div>
          </div>

          {/* 2. Slider Volume */}
          <div className="space-y-4">
            <div className="flex justify-between">
              <label className="text-sm font-mono text-textMuted uppercase tracking-wider">Volume total</label>
              <span className="font-bold text-primary">{volume} ml</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="200" 
              step="10"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="w-full h-2 bg-surfaceLight rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* 3. Bouton d'action */}
          <button 
            onClick={handleMix}
            disabled={status === "loading"}
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
              status === "loading" 
                ? "bg-surfaceLight text-textMuted cursor-not-allowed"
                : "bg-primary text-black hover:bg-amber-400 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            }`}
          >
            {status === "loading" ? (
              <RefreshCw className="animate-spin" />
            ) : (
              <Play fill="currentColor" />
            )}
            {status === "loading" ? "Traitement..." : "Lancer le Mélange"}
          </button>
        </div>

        {/* COLONNE DROITE : Feedback Visuel & Logs */}
        <div className="space-y-6">
          
          {/* Visualisation de la couleur choisie */}
          <div 
            className="h-48 rounded-2xl border border-white/10 flex items-center justify-center transition-colors duration-500 shadow-2xl"
            style={{ 
              backgroundColor: color,
              boxShadow: `0 0 50px ${color}40` // Lueur colorée
            }}
          >
            <span className="bg-black/50 backdrop-blur px-4 py-2 rounded-lg text-white font-mono text-sm">
              Rendu final estimé
            </span>
          </div>

          {/* Console de logs */}
          <div className="bg-black/50 rounded-xl p-4 font-mono text-sm h-64 overflow-y-auto border border-white/5">
            <div className="text-textMuted mb-2 border-b border-white/5 pb-2">Console Système</div>
            {logs.length === 0 && (
              <div className="text-white/20 italic">En attente de commande...</div>
            )}
            {logs.map((log, i) => (
              <div key={i} className="mb-2 text-green-400">
                <span className="opacity-50 mr-2">{'>'}</span>
                {log}
              </div>
            ))}
            {status === 'error' && (
              <div className="text-danger flex items-center gap-2 mt-2">
                <AlertCircle size={14} /> Échec de la communication
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Lab;