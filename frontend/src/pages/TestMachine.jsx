import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import { Settings, RefreshCw, Save, Box, AlertTriangle } from 'lucide-react';
import Machine from '../components/3d/Machine';

// --- FONCTION COULEUR (Toujours là) ---
const getColorForIngredient = (name) => {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n === 'vide') return null;

  if (n.includes('ginger') || n.includes('biere')) return "#D2B48C"; 
  if (n.includes('red bull')) return "#D4AF37"; 
  if (n.includes('cola') || n.includes('coca')) return "#250202"; 
  if (n.includes('jagermeister') || n.includes('jager')) return "#2F4F4F"; 
  if (n.includes('cyan')) return "#00FFFF";
  if (n.includes('magenta')) return "#FF00FF";
  if (n.includes('jaune') && n.includes('colorant')) return "#FFFF00";
  if (n.includes('vodka') || n.includes('eau') || n.includes('tequila') || n.includes('gin') || n.includes('rhum blanc')) return "#E0FFFF";
  if (n.includes('rhum')) return "#8B4513"; 
  if (n.includes('pastis')) return "#E8E82C"; 
  if (n.includes('citron')) return "#E0DE8C"; 
  if (n.includes('limonade')) return "#F0F8FF"; 
  if (n.includes('menthe') || n.includes('mojito')) return "#00FF00";
  if (n.includes('grenadine') || n.includes('fraise') || n.includes('cranberry')) return "#FF0000";
  if (n.includes('curacao') || n.includes('bleu')) return "#0000FF";
  if (n.includes('lait') || n.includes('coco')) return "#FFFFFF";
  if (n.includes('orange') || n.includes('ananas') || n.includes('jus')) return "#FFA500";
  if (n.includes('whisky')) return "#DAA520";
  
  return "#888888"; 
};

export default function TestMachine() {
  const [selectedPumpIndex, setSelectedPumpIndex] = useState(null);
  const [machineConfig, setMachineConfig] = useState({}); 
  const [availableIngredients, setAvailableIngredients] = useState([]);

  // 1. CHARGEMENT
  useEffect(() => {
    // A. Charger la config et APPLIQUER LES COULEURS
    fetch('http://localhost:8000/api/machine/status')
      .then(res => res.json())
      .then(data => {
        console.log("📥 Status chargé:", data);
        
        if (data.slots) {
            const frontendSlots = {};
            Object.keys(data.slots).forEach(key => {
                const newKey = String(parseInt(key) - 1);
                const slotData = data.slots[key];
                
                // 👇 ICI LE FIX : On recalcule la couleur si elle manque
                frontendSlots[newKey] = {
                    ...slotData,
                    color: getColorForIngredient(slotData.name)
                };
            });
            setMachineConfig(frontendSlots);
        } else {
            setMachineConfig({});
        }
      })
      .catch(err => console.error("Erreur config:", err));

    // B. Charger les ingrédients
    fetch('http://localhost:8000/api/ingredients')
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const formattedList = data.map(ing => ({
            name: ing.name,
            color: getColorForIngredient(ing.name)
        }));
        formattedList.sort((a, b) => a.name.localeCompare(b.name));
        setAvailableIngredients([{ name: "Vide", color: null }, ...formattedList]);
      })
      .catch(err => console.error("Erreur ingrédients:", err));
  }, []);

  const handleBottleSelect = (index) => { setSelectedPumpIndex(index); };

  const assignIngredient = (ingredient) => {
    if (selectedPumpIndex === null) return;
    setMachineConfig((prev) => ({
      ...prev,
      [String(selectedPumpIndex)]: ingredient.name !== "Vide" 
        ? { name: ingredient.name, color: ingredient.color } 
        : undefined
    }));
  };

  const handleSave = () => {
    const backendSlots = {};
    Object.keys(machineConfig).forEach(key => {
        const newKey = String(parseInt(key) + 1);
        backendSlots[newKey] = machineConfig[key];
    });

    fetch('http://localhost:8000/api/machine/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: backendSlots })
    })
    .then(async (res) => {
        if (!res.ok) throw new Error("Erreur");
        alert("✅ Configuration sauvegardée !");
    })
    .catch(err => alert("❌ Erreur sauvegarde"));
  };

  const resetConfig = () => {
      if(confirm("Tout effacer ?")) {
          setMachineConfig({});
          setSelectedPumpIndex(null);
      }
  }

  return (
    <div className="flex w-full h-full bg-[#0a0a0a] text-white overflow-hidden font-sans select-none relative">
      <div className="w-80 bg-[#111] border-r border-white/5 flex flex-col z-20 shadow-2xl">
        <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-200"><Settings size={20} className="text-orange-500" /> BarOS Config</h2>
        </div>
        <div className="p-4 bg-orange-500/10 border-b border-orange-500/20">
             <div className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Pompe sélectionnée</div>
             {selectedPumpIndex !== null ? (
                 <span className="text-lg font-mono font-bold text-white">CUVE #{selectedPumpIndex + 1}</span>
             ) : ( <span className="text-gray-500 italic text-sm">Cliquez sur un cylindre 3D...</span> )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {availableIngredients.map((ing) => {
             const hasSelection = selectedPumpIndex !== null;
             const currentSlot = machineConfig[String(selectedPumpIndex)];
             const isAssigned = hasSelection && currentSlot?.name === ing.name;
             return (
                <button key={ing.name} onClick={() => assignIngredient(ing)} disabled={!hasSelection}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all flex justify-between ${isAssigned ? 'ring-2 ring-orange-500 bg-[#1a1a1a]' : 'hover:bg-white/5'} ${!hasSelection && 'opacity-40 grayscale'}`}
                  style={{ color: ['#1a1a1a', '#F0F8FF', '#E0FFFF', '#F5F5DC', '#FFFFFF', null, '#FFFFFF'].includes(ing.color) && ing.name !== 'Vide' ? 'black' : 'white', backgroundColor: isAssigned ? '#1a1a1a' : (ing.name === 'Vide' ? '#1a1a1a' : ing.color) }}>
                  <span className="font-bold">{ing.name}</span>
                  {isAssigned && <div className="w-2 h-2 bg-white rounded-full"/>}
                </button>
             );
          })}
        </div>
        <div className="p-4 border-t border-white/5 bg-[#0f0f0f] space-y-3">
            <button onClick={handleSave} className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-sm flex justify-center gap-2"><Save size={18} /> SAUVEGARDER</button>
            <button onClick={resetConfig} className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-500 rounded-xl font-bold text-sm flex justify-center gap-2"><RefreshCw size={16} /> RESET</button>
        </div>
      </div>
      <div className="flex-1 relative bg-gradient-to-br from-[#1a1a1a] to-black">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.3, 1.25], fov: 35 }}>
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.6} adjustCamera={false}>
              <Machine onBottleSelect={handleBottleSelect} config={machineConfig} position={[0, 0.1, 0]} />
            </Stage>
          </Suspense>
          <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.2} target={[0, -0.025, 0]} enableZoom={false} enablePan={false} />
        </Canvas>
      </div>
    </div>
  );
}