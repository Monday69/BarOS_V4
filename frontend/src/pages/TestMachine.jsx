import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import { Settings, RefreshCw, Save, AlertTriangle, CheckCircle, AlertOctagon, Zap } from 'lucide-react';
import axios from 'axios';
import Machine from '../components/3d/Machine';

const API = 'http://localhost:8000/api';

// ── Couleurs ingrédients ──────────────────────────────────────────────────────
const getColorForIngredient = (name) => {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n === 'vide') return null;
  if (n.includes('ginger') || n.includes('biere'))           return "#D2B48C";
  if (n.includes('red bull'))                                return "#D4AF37";
  if (n.includes('cola') || n.includes('coca'))              return "#250202";
  if (n.includes('jagermeister') || n.includes('jager'))     return "#2F4F4F";
  if (n.includes('cyan'))                                    return "#00FFFF";
  if (n.includes('magenta'))                                 return "#FF00FF";
  if (n.includes('jaune') && n.includes('colorant'))         return "#FFFF00";
  if (n.includes('vodka') || n.includes('eau') || n.includes('tequila') ||
      n.includes('gin') || n.includes('rhum blanc'))         return "#E0FFFF";
  if (n.includes('rhum'))                                    return "#8B4513";
  if (n.includes('pastis'))                                  return "#E8E82C";
  if (n.includes('citron'))                                  return "#E0DE8C";
  if (n.includes('limonade'))                                return "#F0F8FF";
  if (n.includes('menthe') || n.includes('mojito'))          return "#00FF00";
  if (n.includes('grenadine') || n.includes('fraise') || n.includes('cranberry')) return "#FF0000";
  if (n.includes('curacao') || n.includes('bleu'))           return "#0000FF";
  if (n.includes('lait') || n.includes('coco'))             return "#FFFFFF";
  if (n.includes('orange') || n.includes('ananas') || n.includes('jus')) return "#FFA500";
  if (n.includes('whisky'))                                  return "#DAA520";
  return "#888888";
};

// ── Toast système ─────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm font-semibold
            shadow-2xl backdrop-blur-md animate-in slide-in-from-right-4 duration-300
            ${t.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : t.type === 'error'   ? 'bg-red-500/15 border-red-500/30 text-red-300'
            : 'bg-blue-500/15 border-blue-500/30 text-blue-300'}`}>
          {t.type === 'success' ? <CheckCircle size={15} />
           : t.type === 'error' ? <AlertOctagon size={15} />
           : <Zap size={15} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Mini barre de stock ───────────────────────────────────────────────────────
function MiniStockBar({ current, max }) {
  const pct        = Math.min((current / (max || 1000)) * 100, 100);
  const isCritical = pct < 10;
  const isWarning  = pct < 25 && !isCritical;
  const color = isCritical ? '#ef4444' : isWarning ? '#f97316' : '#22c55e';

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className={`text-xs font-mono tabular-nums shrink-0
        ${isCritical ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-white/30'}`}>
        {Math.round(current)}ml
      </span>
      {isCritical && <AlertTriangle size={10} className="text-red-400 shrink-0" />}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function TestMachine() {
  const [selectedPumpIndex, setSelectedPumpIndex]       = useState(null);
  const [machineConfig, setMachineConfig]               = useState({});
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [saving, setSaving]                             = useState(false);
  const [toasts, setToasts]                             = useState([]);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ✅ Fix : fetch() → axios partout (cohérence avec le reste du projet)
  const loadData = useCallback(async () => {
    try {
      const [statusRes, ingredientsRes] = await Promise.allSettled([
        axios.get(`${API}/machine/status`),
        axios.get(`${API}/ingredients`),
      ]);

      // Config machine
      if (statusRes.status === 'fulfilled') {
        const data  = statusRes.value.data;
        const slots = data.slots || {};
        const frontendSlots = {};
        Object.keys(slots).forEach(key => {
          const newKey = String(parseInt(key) - 1);
          const slot   = slots[key];
          frontendSlots[newKey] = { ...slot, color: getColorForIngredient(slot.name) };
        });
        setMachineConfig(frontendSlots);
      } else {
        toast("Erreur chargement config machine", 'error');
      }

      // Ingrédients
      if (ingredientsRes.status === 'fulfilled') {
        const data = ingredientsRes.value.data;
        if (Array.isArray(data)) {
          const formatted = data
            .map(ing => ({
              name:              ing.name,
              color:             getColorForIngredient(ing.name),
              current_volume_ml: ing.current_volume_ml ?? 0,
              max_volume_ml:     ing.max_volume_ml ?? 1000,
              pump_id:           ing.pump_id,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setAvailableIngredients([
            { name: "Vide", color: null, current_volume_ml: null, max_volume_ml: null },
            ...formatted
          ]);
        }
      } else {
        toast("Erreur chargement ingrédients", 'error');
      }
    } catch (e) {
      toast("Erreur réseau", 'error');
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Actions config ──────────────────────────────────────────────────────────
  const assignIngredient = (ingredient) => {
    if (selectedPumpIndex === null) return;
    setMachineConfig(prev => ({
      ...prev,
      [String(selectedPumpIndex)]: ingredient.name !== "Vide"
        ? { name: ingredient.name, color: ingredient.color }
        : undefined
    }));
  };

  // ✅ Fix : fetch() → axios pour la sauvegarde
  const handleSave = async () => {
    setSaving(true);
    const backendSlots = {};
    Object.keys(machineConfig).forEach(key => {
      if (machineConfig[key]) {
        backendSlots[String(parseInt(key) + 1)] = machineConfig[key];
      }
    });

    try {
      await axios.post(`${API}/machine/config`, { slots: backendSlots });
      toast("Configuration sauvegardée !");
      loadData();
    } catch {
      toast("Erreur lors de la sauvegarde", 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = () => {
    setMachineConfig({});
    setSelectedPumpIndex(null);
    toast("Configuration réinitialisée", 'info');
  };

  // ── Stats panel ─────────────────────────────────────────────────────────────
  const assignedCount = Object.values(machineConfig).filter(Boolean).length;
  const totalSlots    = 12;

  const selectedSlotData = selectedPumpIndex !== null
    ? machineConfig[String(selectedPumpIndex)] : null;
  const selectedIngData  = selectedSlotData
    ? availableIngredients.find(i => i.name === selectedSlotData.name) : null;
  const selectedPct      = selectedIngData?.current_volume_ml != null
    ? Math.round((selectedIngData.current_volume_ml / (selectedIngData.max_volume_ml || 1000)) * 100)
    : null;
  const selectedIsCritical = selectedPct !== null && selectedPct < 10;
  const selectedIsWarning  = selectedPct !== null && selectedPct < 25 && !selectedIsCritical;

  return (
    <div className="flex w-full h-full bg-[#0a0a0a] text-white overflow-hidden select-none relative">
      <Toast toasts={toasts} />

      {/* ── PANEL LATÉRAL ───────────────────────────────────────────────────── */}
      <div className="w-80 bg-[#0f0f0f] border-r border-white/[0.06] flex flex-col z-20 shadow-2xl">

        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-base font-black flex items-center gap-2 text-white">
            <Settings size={18} className="text-orange-500" /> BarOS Config
          </h2>
          <button onClick={loadData}
            className="text-white/25 hover:text-white/60 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Pompe sélectionnée */}
        <div className={`px-5 py-4 border-b transition-colors duration-300
          ${selectedIsCritical ? 'bg-red-500/10 border-red-500/20'
          : selectedIsWarning  ? 'bg-orange-500/10 border-orange-500/15'
          : 'bg-orange-500/5 border-white/[0.06]'}`}>

          <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-1">
            Cuve sélectionnée
          </div>

          {selectedPumpIndex !== null ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black font-mono text-white">
                  CUVE #{selectedPumpIndex + 1}
                </span>
                {selectedIsCritical && (
                  <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30
                                   px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <AlertTriangle size={10} /> Critique
                  </span>
                )}
                {selectedIsWarning && (
                  <span className="text-xs bg-orange-500/15 text-orange-400 border border-orange-500/25
                                   px-2 py-0.5 rounded-full font-bold">
                    Stock bas
                  </span>
                )}
              </div>

              {selectedSlotData ? (
                <div className="mt-1">
                  <div className="text-sm text-white/60 font-medium">{selectedSlotData.name}</div>
                  {selectedIngData?.current_volume_ml != null && (
                    <MiniStockBar
                      current={selectedIngData.current_volume_ml}
                      max={selectedIngData.max_volume_ml}
                    />
                  )}
                </div>
              ) : (
                <div className="text-sm text-white/25 italic mt-0.5">Vide — choisissez un ingrédient</div>
              )}
            </div>
          ) : (
            <span className="text-white/25 italic text-sm">Cliquez sur un cylindre 3D…</span>
          )}
        </div>

        {/* Liste ingrédients */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {availableIngredients.map(ing => {
            const isAssigned = selectedPumpIndex !== null &&
              machineConfig[String(selectedPumpIndex)]?.name === ing.name;
            const pct        = ing.current_volume_ml != null
              ? (ing.current_volume_ml / (ing.max_volume_ml || 1000)) * 100 : null;
            const isCritical = pct !== null && pct < 10;
            const isWarning  = pct !== null && pct < 25 && !isCritical;

            const lightColors = ['#1a1a1a','#F0F8FF','#E0FFFF','#F5F5DC','#FFFFFF','#FFFF00','#00FFFF','#FF00FF'];
            const textDark    = ing.color && lightColors.includes(ing.color) && ing.name !== 'Vide';

            return (
              <button key={ing.name}
                onClick={() => assignIngredient(ing)}
                disabled={selectedPumpIndex === null}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150
                  ${isAssigned ? 'ring-2 ring-orange-500 bg-[#1a1a1a]' : 'hover:bg-white/[0.04]'}
                  ${selectedPumpIndex === null ? 'opacity-30 pointer-events-none' : ''}`}
                style={{
                  backgroundColor: isAssigned ? '#1a1a1a'
                    : ing.name === 'Vide' ? 'transparent'
                    : ing.color || 'transparent',
                  color: textDark ? '#111' : 'white'
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm truncate">{ing.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCritical && <AlertTriangle size={11} className="text-red-400" />}
                    {isWarning  && <AlertTriangle size={11} className="text-orange-400" />}
                    {isAssigned && <div className="w-2 h-2 bg-white rounded-full opacity-80" />}
                  </div>
                </div>

                {ing.name !== 'Vide' && pct !== null && (
                  <div className="mt-1.5 h-1 w-full bg-black/20 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: isCritical ? '#ef4444' : isWarning ? '#f97316' : 'rgba(255,255,255,0.4)'
                      }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Résumé + actions */}
        <div className="border-t border-white/[0.06] bg-[#0a0a0a]">
          <div className="px-5 py-3 flex items-center justify-between border-b border-white/[0.04]">
            <span className="text-xs text-white/25">Cuves assignées</span>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({ length: totalSlots }).map((_, i) => (
                  <div key={i}
                    className={`w-2 h-2 rounded-full transition-colors duration-300
                      ${machineConfig[String(i)] ? 'bg-orange-500' : 'bg-white/10'}`} />
                ))}
              </div>
              <span className="text-xs font-bold text-white/50">{assignedCount}/{totalSlots}</span>
            </div>
          </div>

          <div className="p-3 space-y-2">
            <button onClick={handleSave} disabled={saving}
              className={`w-full py-3 rounded-xl font-black text-sm flex justify-center items-center gap-2
                transition-all ${saving
                  ? 'bg-blue-500/30 text-blue-300/50 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.25)]'}`}>
              <Save size={16} className={saving ? 'animate-pulse' : ''} />
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
            <button onClick={resetConfig}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500/70
                         hover:text-red-400 rounded-xl font-bold text-sm flex justify-center
                         items-center gap-2 transition-all border border-red-500/10">
              <RefreshCw size={14} /> Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* ── CANVAS 3D ────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative bg-gradient-to-br from-[#1a1a1a] to-black">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.3, 1.25], fov: 35 }}>
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.6} adjustCamera={false}>
              <Machine
                onBottleSelect={setSelectedPumpIndex}
                config={machineConfig}
                position={[0, 0.1, 0]}
              />
            </Stage>
          </Suspense>
          <OrbitControls
            makeDefault
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2.2}
            target={[0, -0.025, 0]}
            enableZoom={false}
            enablePan={false}
          />
        </Canvas>
      </div>
    </div>
  );
}