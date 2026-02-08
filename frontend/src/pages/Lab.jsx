import React, { useState } from 'react';
import axios from 'axios';
import { FlaskConical, Play, RefreshCw, AlertCircle } from 'lucide-react';

const Lab = () => {
  const [color, setColor] = useState("#00FF00"); 
  const [volume, setVolume] = useState(50);
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState([]);

  const handleMix = async () => {
    setStatus("loading");
    setLogs([]);

    try {
      // ✅ URL CORRIGÉE (note: route déplacée dans /api/colors/mix si possible, mais sinon /cocktails/mix_color selon ton router)
      // D'après ton main.py, le ColorService est utilisé mais je n'ai pas vu la route explicite dans cocktails.py
      // HYPOTHÈSE : On va utiliser une route dédiée si tu l'as créée, sinon on garde l'ancienne mais via /api
      // Vérifie si tu as une route @router.post("/mix") dans un fichier colors.py ou similaire
      // Pour l'instant, je pointe vers une route hypothétique standardisée :
      const response = await axios.post('http://localhost:8000/api/colors/mix', {
        hex_code: color,
        volume_ml: parseInt(volume)
      });

      setStatus("success");
      setLogs([
        `Commande envoyée avec succès !`,
        `Couleur: ${color}`,
        `Volumes calculés: Cyan ${response.data.volumes.cyan_ml.toFixed(1)}ml, Magenta ${response.data.volumes.magenta_ml.toFixed(1)}ml, Jaune ${response.data.volumes.yellow_ml.toFixed(1)}ml`
      ]);

    } catch (error) {
      setStatus("error");
      console.error(error);
      setLogs([`Erreur: ${error.response?.data?.detail || "Impossible de joindre le serveur"}`]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div><h1 className="text-4xl font-bold text-accent mb-2">Laboratoire R&D</h1><p className="text-textMuted">Testez le mélangeur colorimétrique en temps réel.</p></div>
        <div className="p-3 bg-accent/10 rounded-full text-accent"><FlaskConical size={32} /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-surface p-8 rounded-2xl border border-white/5 space-y-8">
          <div className="space-y-4"><label className="text-sm font-mono text-textMuted uppercase tracking-wider">Choix de la couleur</label><div className="flex gap-4 items-center"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-20 h-20 rounded-xl cursor-pointer bg-transparent border-0" /><div className="flex flex-col"><span className="text-2xl font-mono font-bold">{color.toUpperCase()}</span><span className="text-sm text-textMuted">Format HEX</span></div></div></div>
          <div className="space-y-4"><div className="flex justify-between"><label className="text-sm font-mono text-textMuted uppercase tracking-wider">Volume total</label><span className="font-bold text-primary">{volume} ml</span></div><input type="range" min="10" max="200" step="10" value={volume} onChange={(e) => setVolume(e.target.value)} className="w-full h-2 bg-surfaceLight rounded-lg appearance-none cursor-pointer accent-primary" /></div>
          <button onClick={handleMix} disabled={status === "loading"} className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${status === "loading" ? "bg-surfaceLight text-textMuted cursor-not-allowed" : "bg-primary text-black hover:bg-amber-400 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.3)]"}`}>{status === "loading" ? <RefreshCw className="animate-spin" /> : <Play fill="currentColor" />}{status === "loading" ? "Traitement..." : "Lancer le Mélange"}</button>
        </div>
        <div className="space-y-6">
          <div className="h-48 rounded-2xl border border-white/10 flex items-center justify-center transition-colors duration-500 shadow-2xl" style={{ backgroundColor: color, boxShadow: `0 0 50px ${color}40` }}><span className="bg-black/50 backdrop-blur px-4 py-2 rounded-lg text-white font-mono text-sm">Rendu final estimé</span></div>
          <div className="bg-black/50 rounded-xl p-4 font-mono text-sm h-64 overflow-y-auto border border-white/5"><div className="text-textMuted mb-2 border-b border-white/5 pb-2">Console Système</div>{logs.length === 0 && <div className="text-white/20 italic">En attente de commande...</div>}{logs.map((log, i) => <div key={i} className="mb-2 text-green-400"><span className="opacity-50 mr-2">{'>'}</span>{log}</div>)}{status === 'error' && <div className="text-danger flex items-center gap-2 mt-2"><AlertCircle size={14} /> Échec de la communication</div>}</div>
        </div>
      </div>
    </div>
  );
};

export default Lab;