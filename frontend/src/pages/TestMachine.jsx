import React, { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import { Settings, RefreshCw, Save, AlertTriangle, CheckCircle,
         AlertOctagon, Zap, Search, ScanLine } from 'lucide-react';
import axios from 'axios';
import Machine from '../components/3d/Machine';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';

// ── Catégories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',     label: 'Tout',    emoji: '🍶' },
  { key: 'alcool',  label: 'Alcools', emoji: '🥃' },
  { key: 'liqueur', label: 'Liqueurs',emoji: '🍸' },
  { key: 'sirop',   label: 'Sirops',  emoji: '🍯' },
  { key: 'jus',     label: 'Jus',     emoji: '🍊' },
  { key: 'soft',    label: 'Softs',   emoji: '🥤' },
  { key: 'eau',     label: 'Eaux',    emoji: '💧' },
  { key: 'autre',   label: 'Autres',  emoji: '🍾' },
];

const inferCategory = (name, dbType) => {
  if (dbType) {
    const t = dbType.toLowerCase();
    if (t.includes('alcool') || t.includes('spirit') || t.includes('whisky') ||
        t.includes('vodka')  || t.includes('gin')    || t.includes('rhum') ||
        t.includes('tequila')|| t.includes('rum'))                            return 'alcool';
    if (t.includes('liqueur') || t.includes('cordial'))                        return 'liqueur';
    if (t.includes('sirop')   || t.includes('syrup'))                          return 'sirop';
    if (t.includes('jus')     || t.includes('juice'))                          return 'jus';
    if (t.includes('soft')    || t.includes('soda') || t.includes('cola'))     return 'soft';
    if (t.includes('eau')     || t.includes('water')|| t.includes('tonic'))    return 'eau';
  }
  if (!name) return 'autre';
  const n = name.toLowerCase();
  if (n.includes('vodka')  || n.includes('gin')     || n.includes('rhum') ||
      n.includes('rum')    || n.includes('tequila')  || n.includes('whisky') ||
      n.includes('whiskey')|| n.includes('bourbon')  || n.includes('cognac') ||
      n.includes('brandy') || n.includes('armagnac') || n.includes('calvados') ||
      n.includes('pastis') || n.includes('absinthe') || n.includes('mezcal'))   return 'alcool';
  if (n.includes('triple sec') || n.includes('cointreau') || n.includes('grand marnier') ||
      n.includes('baileys') || n.includes('kahlua')  || n.includes('amaretto') ||
      n.includes('chambord')|| n.includes('chartreuse')|| n.includes('midori') ||
      n.includes('curacao') || n.includes('jagermeister')|| n.includes('jäger')||
      n.includes('schnapps')|| n.includes('malibu')  || n.includes('aperol') ||
      n.includes('campari') || n.includes('limoncello')|| n.includes('liqueur')||
      n.includes('creme de'))                                                    return 'liqueur';
  if (n.includes('sirop')  || n.includes('grenadine')|| n.includes('orgeat') ||
      n.includes('gomme')  || n.includes('caramel')  || n.includes('lavande') ||
      n.includes('vanille')|| n.includes('fraise')   || n.includes('framboise')||
      n.includes('passion')|| n.includes('menthe')   || n.includes('syrup'))    return 'sirop';
  if (n.includes('jus')    || n.includes('juice')    || n.includes('citron') ||
      n.includes('orange') || n.includes('ananas')   || n.includes('pamplemousse')||
      n.includes('cranberry')|| n.includes('tomate') || n.includes('raisin') ||
      n.includes('pomme')  || n.includes('mangue')   || n.includes('goyave'))   return 'jus';
  if (n.includes('cola')   || n.includes('coca')     || n.includes('pepsi') ||
      n.includes('sprite') || n.includes('fanta')    || n.includes('limonade')||
      n.includes('soda')   || n.includes('ginger beer')|| n.includes('red bull')||
      n.includes('energy') || n.includes('schweppes')|| n.includes('bitter lemon')) return 'soft';
  if (n.includes('eau')    || n.includes('water')    || n.includes('tonic') ||
      n.includes('perrier')|| n.includes('evian')    || n.includes('san pellegrino')) return 'eau';
  return 'autre';
};

const getColorForIngredient = (name) => {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n === 'vide') return null;
  if (n.includes('ginger') || n.includes('biere'))                    return "#D2B48C";
  if (n.includes('red bull'))                                         return "#D4AF37";
  if (n.includes('cola') || n.includes('coca'))                       return "#250202";
  if (n.includes('jagermeister') || n.includes('jager'))              return "#2F4F4F";
  if (n.includes('cyan'))                                             return "#00FFFF";
  if (n.includes('magenta'))                                          return "#FF00FF";
  if (n.includes('jaune') && n.includes('colorant'))                  return "#FFFF00";
  if (n.includes('vodka') || n.includes('eau') || n.includes('tequila') ||
      n.includes('gin')   || n.includes('rhum blanc'))                return "#E0FFFF";
  if (n.includes('rhum'))                                             return "#8B4513";
  if (n.includes('pastis'))                                           return "#E8E82C";
  if (n.includes('citron'))                                           return "#E0DE8C";
  if (n.includes('limonade'))                                         return "#F0F8FF";
  if (n.includes('menthe') || n.includes('mojito'))                   return "#00FF00";
  if (n.includes('grenadine') || n.includes('fraise') ||
      n.includes('cranberry'))                                        return "#FF0000";
  if (n.includes('curacao') || n.includes('bleu'))                    return "#0000FF";
  if (n.includes('lait') || n.includes('coco'))                       return "#FFFFFF";
  if (n.includes('orange') || n.includes('ananas') ||
      n.includes('jus'))                                              return "#FFA500";
  if (n.includes('whisky'))                                           return "#DAA520";
  return "#888888";
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm font-semibold
            shadow-2xl backdrop-blur-md
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

// ── Mini barre stock ──────────────────────────────────────────────────────────
function MiniStockBar({ current, max }) {
  const pct        = Math.min((current / (max || 1000)) * 100, 100);
  const isCritical = pct < 10;
  const isWarning  = pct < 25 && !isCritical;
  const color      = isCritical ? '#ef4444' : isWarning ? '#f97316' : '#22c55e';
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

// ── Carte ingrédient ──────────────────────────────────────────────────────────
function IngredientCard({ ing, isAssigned, isDisabled, isHovered, onHover, onLeave, onClick }) {
  const [imgError, setImgError] = useState(false);
  const pct        = ing.current_volume_ml != null
    ? (ing.current_volume_ml / (ing.max_volume_ml || 1000)) * 100 : null;
  const isCritical = pct !== null && pct < 10;
  const isWarning  = pct !== null && pct < 25 && !isCritical;
  const cat        = CATEGORIES.find(c => c.key === ing.category);

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      disabled={isDisabled}
      className={`w-full text-left rounded-xl transition-all duration-150 overflow-hidden border group
        ${isAssigned
          ? 'ring-2 ring-orange-500 border-orange-500/40 bg-white/5'
          : isHovered
            ? 'border-orange-500/50 bg-orange-500/5'
            : 'border-white/[0.06] hover:border-white/20 hover:bg-white/[0.04]'}
        ${isDisabled ? 'opacity-30 pointer-events-none' : ''}
        ${isCritical && !isAssigned && !isHovered ? 'border-red-500/20' : ''}`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Image ou emoji */}
        <div className="w-10 h-10 rounded-lg shrink-0 overflow-hidden flex items-center justify-center
                        bg-white/5 border border-white/10">
          {ing.image_url && !imgError ? (
            <img src={ing.image_url} alt={ing.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl leading-none select-none">
              {ing.name === 'Vide' ? '✕' : (cat?.emoji ?? '🍾')}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className={`font-semibold text-sm truncate transition-colors
              ${isHovered ? 'text-orange-300' : 'text-white'}`}>
              {ing.name}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {isCritical && <AlertTriangle size={10} className="text-red-400" />}
              {isWarning  && <AlertTriangle size={10} className="text-orange-400" />}
              {isAssigned && <div className="w-2 h-2 bg-orange-400 rounded-full" />}
              {/* Petit éclair si survolé et cuve sélectionnée */}
              {isHovered && !isDisabled && (
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
          {ing.name !== 'Vide' && pct !== null && (
            <MiniStockBar current={ing.current_volume_ml} max={ing.max_volume_ml} />
          )}
        </div>
      </div>
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ category, onGoScan }) {
  const cat = CATEGORIES.find(c => c.key === category);
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-4">
      <span className="text-4xl">{cat?.emoji ?? '🍾'}</span>
      <div>
        <p className="text-white/40 text-sm font-semibold">
          Aucun {cat?.label.toLowerCase() ?? 'ingrédient'} en base
        </p>
        <p className="text-white/20 text-xs mt-1">
          Scanne une bouteille pour l'ajouter automatiquement
        </p>
      </div>
      <button
        onClick={onGoScan}
        className="flex items-center gap-2 px-4 py-2.5 bg-orange-500/15 hover:bg-orange-500/25
                   border border-orange-500/30 text-orange-400 rounded-xl text-sm font-bold
                   transition-all"
      >
        <ScanLine size={15} /> Scanner un ingrédient
      </button>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function TestMachine() {
  const navigate = useNavigate();

  const [selectedPumpIndex, setSelectedPumpIndex]       = useState(null);
  const [hoveredIngredientIndex, setHoveredIngredientIndex] = useState(null);
  const [machineConfig, setMachineConfig]               = useState({});
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [saving, setSaving]                             = useState(false);
  const [toasts, setToasts]                             = useState([]);
  const [activeCategory, setActiveCategory]             = useState('all');
  const [search, setSearch]                             = useState('');

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [statusRes, ingredientsRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/machine/status`),
        axios.get(`${API_BASE_URL}/ingredients`),
      ]);
      if (statusRes.status === 'fulfilled') {
        const slots = statusRes.value.data.slots || {};
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
      if (ingredientsRes.status === 'fulfilled') {
        const data = ingredientsRes.value.data;
        if (Array.isArray(data)) {
          const formatted = data
            .map(ing => ({
              name:              ing.name,
              color:             getColorForIngredient(ing.name),
              image_url:         ing.image_url ?? null,
              current_volume_ml: ing.current_volume_ml ?? 0,
              max_volume_ml:     ing.max_volume_ml ?? 1000,
              pump_id:           ing.pump_id,
              category:          inferCategory(ing.name, ing.type),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setAvailableIngredients([
            { name: "Vide", color: null, image_url: null,
              current_volume_ml: null, max_volume_ml: null, category: 'autre' },
            ...formatted,
          ]);
        }
      } else {
        toast("Erreur chargement ingrédients", 'error');
      }
    } catch {
      toast("Erreur réseau", 'error');
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Hover : calcule l'index de la cuve vers laquelle cet ingrédient irait
  // Si une cuve est sélectionnée → on highlight cette cuve
  // Sinon → on cherche si cet ingrédient est déjà assigné quelque part
  const getHoverSlot = useCallback((ingName) => {
    if (ingName === 'Vide') return null;
    if (selectedPumpIndex !== null) return selectedPumpIndex;
    // Cherche si déjà assigné à une cuve
    const entry = Object.entries(machineConfig).find(([, v]) => v?.name === ingName);
    return entry ? parseInt(entry[0]) : null;
  }, [selectedPumpIndex, machineConfig]);

  // ── Filtrage ──────────────────────────────────────────────────────────────
  const filteredIngredients = useMemo(() => {
    return availableIngredients.filter(ing => {
      if (ing.name === 'Vide') return true;
      const matchCat    = activeCategory === 'all' || ing.category === activeCategory;
      const matchSearch = !search || ing.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [availableIngredients, activeCategory, search]);

  // Liste sans "Vide" pour l'empty state
  const filteredWithoutVide = filteredIngredients.filter(i => i.name !== 'Vide');

  const categoryCounts = useMemo(() => {
    const counts = {};
    availableIngredients.forEach(ing => {
      if (ing.name === 'Vide') return;
      counts[ing.category] = (counts[ing.category] ?? 0) + 1;
    });
    return counts;
  }, [availableIngredients]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const assignIngredient = (ingredient) => {
    if (selectedPumpIndex === null) return;
    setMachineConfig(prev => ({
      ...prev,
      [String(selectedPumpIndex)]: ingredient.name !== "Vide"
        ? { name: ingredient.name, color: ingredient.color }
        : undefined,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const backendSlots = {};
    Object.keys(machineConfig).forEach(key => {
      if (machineConfig[key]) {
        backendSlots[String(parseInt(key) + 1)] = machineConfig[key];
      }
    });
    try {
      const adminKey = sessionStorage.getItem('baros_admin_key') || '';
      await axios.post(
        `${API_BASE_URL}/machine/config`,
        { slots: backendSlots },
        { headers: { 'x-admin-token': adminKey } }
      );
      toast("Configuration sauvegardée !");
      loadData();
    } catch (err) {
      if (err?.response?.status === 403) {
        toast("Clé admin requise : déverrouillez d'abord la page Réglages", 'error');
      } else {
        toast("Erreur lors de la sauvegarde", 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = () => {
    setMachineConfig({});
    setSelectedPumpIndex(null);
    toast("Configuration réinitialisée", 'info');
  };

  // ── Données slot sélectionné ──────────────────────────────────────────────
  const assignedCount    = Object.values(machineConfig).filter(Boolean).length;
  const selectedSlotData = selectedPumpIndex !== null ? machineConfig[String(selectedPumpIndex)] : null;
  const selectedIngData  = selectedSlotData
    ? availableIngredients.find(i => i.name === selectedSlotData.name) : null;
  const selectedPct      = selectedIngData?.current_volume_ml != null
    ? Math.round((selectedIngData.current_volume_ml / (selectedIngData.max_volume_ml || 1000)) * 100) : null;
  const selectedIsCritical = selectedPct !== null && selectedPct < 10;
  const selectedIsWarning  = selectedPct !== null && selectedPct < 25 && !selectedIsCritical;

  return (
    <div className="flex w-full h-full bg-[#0a0a0a] text-white overflow-hidden select-none relative">
      <Toast toasts={toasts} />

      {/* ── PANEL LATÉRAL ─────────────────────────────────────────────────── */}
      <div className="w-80 bg-[#0f0f0f] border-r border-white/[0.06] flex flex-col z-20 shadow-2xl">

        {/* Header */}
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <h2 className="text-base font-black flex items-center gap-2 text-white">
            <Settings size={18} className="text-orange-500" /> BarOS Config
          </h2>
          <button onClick={loadData} className="text-white/25 hover:text-white/60 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Cuve sélectionnée */}
        <div className={`px-5 py-4 border-b shrink-0 transition-colors duration-300
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
                                   px-2 py-0.5 rounded-full font-bold">Stock bas</span>
                )}
              </div>
              {selectedSlotData ? (
                <div className="mt-1 flex items-center gap-2">
                  {selectedIngData?.image_url && (
                    <img src={selectedIngData.image_url} alt=""
                      className="w-7 h-7 rounded-md object-cover border border-white/10" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm text-white/70 font-medium">{selectedSlotData.name}</div>
                    {selectedIngData?.current_volume_ml != null && (
                      <MiniStockBar
                        current={selectedIngData.current_volume_ml}
                        max={selectedIngData.max_volume_ml}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-white/25 italic mt-0.5">
                  {hoveredIngredientIndex !== null
                    ? <span className="text-orange-400/70 not-italic">
                        ← Survolez pour prévisualiser
                      </span>
                    : 'Vide — choisissez un ingrédient'}
                </div>
              )}
            </div>
          ) : (
            <span className="text-white/25 italic text-sm">Cliquez sur un cylindre 3D…</span>
          )}
        </div>

        {/* Barre de recherche */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveCategory('all'); }}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2
                         text-sm text-white placeholder-white/25 outline-none
                         focus:border-orange-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Onglets catégories */}
        <div className="px-3 pb-2 shrink-0">
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map(cat => {
              const count = cat.key === 'all'
                ? availableIngredients.length - 1
                : (categoryCounts[cat.key] ?? 0);
              if (cat.key !== 'all' && count === 0) return null;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => { setActiveCategory(cat.key); setSearch(''); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold
                    transition-all duration-150 border
                    ${isActive
                      ? 'bg-orange-500 border-orange-400 text-white'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white hover:border-white/20'}`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                  <span className={`ml-0.5 ${isActive ? 'text-orange-100' : 'text-white/25'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Liste ingrédients */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 scrollbar-hide">
          {/* Toujours "Vide" en premier */}
          {filteredIngredients.filter(i => i.name === 'Vide').map(ing => (
            <IngredientCard
              key="Vide"
              ing={ing}
              isAssigned={selectedPumpIndex !== null && machineConfig[String(selectedPumpIndex)] === undefined}
              isDisabled={selectedPumpIndex === null}
              isHovered={false}
              onHover={() => {}}
              onLeave={() => {}}
              onClick={() => assignIngredient(ing)}
            />
          ))}

          {/* Empty state si aucun résultat hors Vide */}
          {filteredWithoutVide.length === 0 && (activeCategory !== 'all' || search) ? (
            <EmptyState
              category={activeCategory}
              onGoScan={() => navigate('/lab')}
            />
          ) : (
            filteredWithoutVide.map(ing => {
              const hoverSlot = getHoverSlot(ing.name);
              return (
                <IngredientCard
                  key={ing.name}
                  ing={ing}
                  isAssigned={
                    selectedPumpIndex !== null &&
                    machineConfig[String(selectedPumpIndex)]?.name === ing.name
                  }
                  isDisabled={selectedPumpIndex === null}
                  isHovered={hoveredIngredientIndex === ing.name}
                  onHover={() => setHoveredIngredientIndex(ing.name)}
                  onLeave={() => setHoveredIngredientIndex(null)}
                  onClick={() => assignIngredient(ing)}
                />
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] bg-[#0a0a0a] shrink-0">
          <div className="px-5 py-3 flex items-center justify-between border-b border-white/[0.04]">
            <span className="text-xs text-white/25">Cuves assignées</span>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i}
                    className={`w-2 h-2 rounded-full transition-colors duration-300
                      ${machineConfig[String(i)] ? 'bg-orange-500' : 'bg-white/10'}`} />
                ))}
              </div>
              <span className="text-xs font-bold text-white/50">{assignedCount}/12</span>
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

      {/* ── CANVAS 3D ─────────────────────────────────────────────────────── */}
      <div className="flex-1 relative bg-gradient-to-br from-[#1a1a1a] to-black">
        <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 2]} camera={{ position: [0, 0.3, 1.25], fov: 35 }}>
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.6} adjustCamera={false}>
              <Machine
                onBottleSelect={setSelectedPumpIndex}
                config={machineConfig}
                // L'index de la cuve à faire briller — calculé depuis l'ingrédient survolé
                hoveredSlot={
                  hoveredIngredientIndex !== null
                    ? getHoverSlot(hoveredIngredientIndex)
                    : null
                }
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