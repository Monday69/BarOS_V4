import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Wine, Activity, Zap, ArrowRight, Droplets } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalCocktails: 0,
    systemHealth: 100,
    lastRefill: 'Aujourd\'hui'
  });

  // Petit effet de "ping" serveur au démarrage
  useEffect(() => {
    // Ici on pourrait charger de vraies stats depuis le backend plus tard
    // Pour l'instant on simule des données vivantes
    const timer = setInterval(() => {
      setStats(prev => ({
        ...prev,
        systemHealth: Math.floor(Math.random() * (100 - 98 + 1) + 98) // Oscille entre 98% et 100%
      }));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8">
      
      {/* SECTION HÉROS : Le message de bienvenue */}
      <div className="relative rounded-3xl overflow-hidden bg-surface border border-white/5 p-12 text-center md:text-left md:flex md:items-center md:justify-between shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
        
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-mono uppercase tracking-widest border border-green-500/20">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Système Opérationnel
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">
            BarOS <span className="text-primary">V4</span>
          </h1>
          <p className="text-xl text-textMuted max-w-lg leading-relaxed">
            Interface de mixologie autonome prête à servir. Sélectionnez un programme ou accédez au laboratoire manuel.
          </p>
          
          <div className="pt-6 flex flex-wrap gap-4">
            <Link to="/menu" className="px-8 py-4 bg-primary text-black font-bold rounded-xl hover:bg-amber-400 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95">
              <Wine size={20} />
              Accéder à la Carte
            </Link>
            <Link to="/lab" className="px-8 py-4 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 border border-white/10">
              <Droplets size={20} />
              Mode Manuel
            </Link>
          </div>
        </div>

        {/* Décoration visuelle à droite (Cercle animé) */}
        <div className="hidden md:flex justify-center items-center relative w-64 h-64">
          <div className="absolute inset-0 border-4 border-white/5 rounded-full animate-[spin_10s_linear_infinite]" />
          <div className="absolute inset-4 border-2 border-primary/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap size={64} className="text-primary animate-pulse" />
          </div>
        </div>
      </div>

      {/* SECTION STATS RAPIDES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Stat 1 */}
        <div className="bg-surface/50 p-6 rounded-2xl border border-white/5 hover:border-primary/20 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
              <Activity size={24} />
            </div>
            <span className="text-xs font-mono text-textMuted uppercase">CPU Load</span>
          </div>
          <div className="text-3xl font-bold text-white">4.2%</div>
          <div className="text-sm text-textMuted mt-1">Stabilité optimale</div>
        </div>

        {/* Stat 2 */}
        <div className="bg-surface/50 p-6 rounded-2xl border border-white/5 hover:border-primary/20 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 group-hover:scale-110 transition-transform">
              <Wine size={24} />
            </div>
            <span className="text-xs font-mono text-textMuted uppercase">Service</span>
          </div>
          <div className="text-3xl font-bold text-white">Prêt</div>
          <div className="text-sm text-textMuted mt-1">Pompes calibrées</div>
        </div>

        {/* Stat 3 */}
        <div className="bg-surface/50 p-6 rounded-2xl border border-white/5 hover:border-primary/20 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform">
              <SettingsIcon size={24} /> {/* Note: Assure-toi d'importer Settings as SettingsIcon si besoin, ou utilise Zap */}
            </div>
            <span className="text-xs font-mono text-textMuted uppercase">Intégrité</span>
          </div>
          <div className="text-3xl font-bold text-white">{stats.systemHealth}%</div>
          <div className="text-sm text-textMuted mt-1">Système nominal</div>
        </div>

      </div>
    </div>
  );
};

// Petit fix pour l'icône si SettingsIcon n'est pas importé
import { Settings as SettingsIcon } from 'lucide-react';

export default Dashboard;