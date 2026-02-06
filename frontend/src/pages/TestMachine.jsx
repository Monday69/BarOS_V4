import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import { Settings, RefreshCw, Save, Box, AlertTriangle } from 'lucide-react';
import Machine from '../components/3d/Machine';

// --- FONCTION MAGIQUE POUR LA COULEUR ---
// --- FONCTION MAGIQUE POUR LA COULEUR ---
const getColorForIngredient = (name) => {
  const n = name.toLowerCase();
  if (n === 'vide') return null;

  // --- 1. PRIORITÉ HAUTE (Les exceptions) ---
  // Il faut mettre Ginger Beer AVANT Gin, sinon "Ginger" est détecté comme "Gin" !
  if (n.includes('ginger beer') || n.includes('gingembre')) return "#D2B48C"; // Brun clair
  if (n.includes('red bull')) return "#D4AF37"; // Doré
  if (n.includes('cola') || n.includes('coca')) return "#250202"; // Noir/Marron foncé
  if (n.includes('jägermeister') || n.includes('jager')) return "#2F4F4F"; // Vert très foncé

  // --- 2. COULEURS CMY (Labo) ---
  if (n.includes('cyan')) return "#00FFFF";
  if (n.includes('magenta')) return "#FF00FF";
  if (n.includes('jaune') && n.includes('colorant')) return "#FFFF00";

  // --- 3. LES ALCOOLS & LIQUIDES CLAIRS ---
  // Cette ligne capture "Gin" (et donc Ginger s'il n'est pas traité avant), Vodka, Eau, Tequila...
  if (n.includes('vodka') || n.includes('eau') || n.includes('tequila') || n.includes('gin') || n.includes('rhum blanc')) return "#E0FFFF";

  // --- 4. LE RESTE ---
  if (n.includes('rhum')) return "#8B4513"; // Rhum ambré/vieux (si pas capté par blanc avant)
  if (n.includes('pastis')) return "#E8E82C"; 
  if (n.includes('citron')) return "#E0DE8C"; 
  if (n.includes('limonade')) return "#8eba7f "; // Un blanc un peu vert/jaune très pâle
  if (n.includes('menthe') || n.includes('mojito')) return "#00FF00";
  if (n.includes('grenadine') || n.includes('fraise') || n.includes('cranberry')) return "#FF0000";
  if (n.includes('curacao') || n.includes('bleu')) return "#0000FF";
  if (n.includes('lait') || n.includes('coco')) return "#FFFFFF";
  if (n.includes('orange') || n.includes('ananas') || n.includes('jus')) return "#FFA500";
  if (n.includes('whisky')) return "#DAA520";
  
  return "#888888"; // Gris par défaut
};

export default function TestMachine() {
  const [selectedPumpIndex, setSelectedPumpIndex] = useState(null);
  const [machineConfig, setMachineConfig] = useState({}); 
  
  // NOUVEAU : On stocke la liste qui vient du serveur ici
  const [availableIngredients, setAvailableIngredients] = useState([]);

  // 1. CHARGEMENT AU DÉMARRAGE
  useEffect(() => {
    // A. Charger la config des pompes
    fetch('http://localhost:8000/machine_config')
      .then(res => res.json())
      .then(data => {
        console.log("📥 Config chargée:", data);
        setMachineConfig(data);
      })
      .catch(err => console.error("Erreur chargement config:", err));

    // B. Charger la liste des ingrédients depuis le Backend (JSON)
    fetch('http://localhost:8000/cocktails/ingredients')
      .then(res => res.json())
      .then(data => {
        // On transforme les données brutes pour ajouter la couleur
        const formattedList = data.map(ing => ({
            name: ing.name,
            color: getColorForIngredient(ing.name)
        }));
        
        // On trie par ordre alphabétique
        formattedList.sort((a, b) => a.name.localeCompare(b.name));

        // On ajoute l'option "Vide" au début
        setAvailableIngredients([{ name: "Vide", color: null }, ...formattedList]);
      })
      .catch(err => console.error("Erreur chargement ingrédients:", err));
  }, []);

  const handleBottleSelect = (index) => {
      setSelectedPumpIndex(index);
  };

  const assignIngredient = (ingredient) => {
    if (selectedPumpIndex === null) return;
    
    // Mise à jour visuelle locale uniquement (pas encore de sauvegarde)
    setMachineConfig((prev) => ({
      ...prev,
      [selectedPumpIndex]: ingredient.color ? { name: ingredient.name, color: ingredient.color } : undefined
    }));
  };

  // --- FONCTION DU BOUTON SAUVEGARDER ---
  const handleSave = () => {
    fetch('http://localhost:8000/save_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: machineConfig })
    })
    .then(res => res.json())
    .then(() => alert("✅ Configuration sauvegardée avec succès !"))
    .catch(err => alert("❌ Erreur lors de la sauvegarde"));
  };

  const resetConfig = () => {
      if(confirm("Attention : Cela va tout effacer. Continuer ?")) {
          fetch('http://localhost:8000/reset_config', { method: 'POST' })
            .then(() => {
                setMachineConfig({});
                setSelectedPumpIndex(null);
            });
      }
  }

  return (
    <div className="flex w-full h-full bg-[#0a0a0a] text-white overflow-hidden font-sans select-none relative">      {/* --- MENU LATÉRAL --- */}
      <div className="w-80 bg-[#111] border-r border-white/5 flex flex-col z-20 shadow-2xl">
        <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-200">
                <Settings size={20} className="text-orange-500" />
                BarOS Config
            </h2>
            <p className="text-xs text-gray-500 mt-1">Glissez-déposez virtuel</p>
        </div>
        
        <div className="p-4 bg-orange-500/10 border-b border-orange-500/20">
             <div className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">
                 Pompe sélectionnée
             </div>
             {selectedPumpIndex !== null ? (
                 <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"/>
                     <span className="text-lg font-mono font-bold text-white">
                        CUVE #{selectedPumpIndex + 1}
                     </span>
                 </div>
             ) : (
                 <span className="text-gray-500 italic text-sm">Cliquez sur un cylindre 3D...</span>
             )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <div className="text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Ingrédients disponibles</div>
          
          {/* C'est ici que la magie opère : on utilise availableIngredients au lieu de INGREDIENTS */}
          {availableIngredients.length === 0 && (
             <div className="text-sm text-yellow-500 flex items-center gap-2 p-2 border border-yellow-500/20 rounded">
                <AlertTriangle size={16}/> Chargement...
             </div>
          )}

          {availableIngredients.map((ing) => {
             const hasSelection = selectedPumpIndex !== null;
             const isAssigned = hasSelection && machineConfig[selectedPumpIndex]?.name === ing.name;

             return (
                <button
                  key={ing.name}
                  onClick={() => assignIngredient(ing)}
                  disabled={!hasSelection}
                  className={`
                    w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-between group
                    ${!hasSelection ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:scale-[1.02] active:scale-95 cursor-pointer'} 
                    ${isAssigned ? 'ring-2 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'hover:bg-white/5'}
                  `}
                  style={{
                      backgroundColor: isAssigned ? '#1a1a1a' : (ing.name === 'Vide' ? '#1a1a1a' : ing.color),
                      color: ['#1a1a1a', '#F0F8FF', '#E0FFFF', '#F5F5DC', '#FFFFFF', null, '#FFFFFF'].includes(ing.color) ? 'black' : 'white'
                  }}
                >
                  <span className="font-bold">{ing.name}</span>
                  {isAssigned && <div className="w-2 h-2 bg-white rounded-full shadow-lg"/>}
                </button>
             );
          })}
        </div>

        {/* --- ZONE DES BOUTONS --- */}
        <div className="p-4 border-t border-white/5 bg-[#0f0f0f] space-y-3">
            
            <button 
                onClick={handleSave} 
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
            >
                <Save size={18} />
                SAUVEGARDER CONFIG
            </button>

            <button 
                onClick={resetConfig} 
                className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all font-bold text-sm flex items-center justify-center gap-2"
            >
                <RefreshCw size={16} />
                RÉINITIALISER
            </button>
        </div>
      </div>

      {/* --- SCÈNE 3D --- */}
      <div className="flex-1 relative bg-gradient-to-br from-[#1a1a1a] to-black">
        <div className="absolute top-6 right-6 z-10 pointer-events-none">
             <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs text-gray-400 flex items-center gap-2">
                 <Box size={14} />
                 <span>Mode Édition 3D</span>
             </div>
        </div>

        <Canvas 
            shadows 
            dpr={[1, 2]} 
            camera={{ position: [0, 0.3, 1.25], fov: 35 }} 
        >
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.6} adjustCamera={false}>
              <Machine 
                onBottleSelect={handleBottleSelect} 
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