import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FlaskConical, Play, RefreshCw, AlertCircle, Palette, Beaker,
  Plus, Minus, Trash2, CheckCircle, Flame, Droplets, Wine,
  AlertTriangle, ChevronDown, Send, Euro
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { API_BASE_URL } from '../apiConfig';

// ── Helpers nutrition & Prix ──────────────────────────────────────────────────
function calcNutrition(steps, ingredientMap) {
  let kcal = 0, sugar = 0, alcGrams = 0, cost = 0;
  
  for (const s of steps) {
    const ing = ingredientMap[s.ingredient_id];
    if (!ing) continue;
    
    kcal      += (ing.kcal_per_100ml    * s.volume_ml) / 100;
    sugar     += (ing.sugar_g_per_100ml * s.volume_ml) / 100;
    
    if (ing.alcohol_degree > 0) {
      alcGrams += s.volume_ml * (ing.alcohol_degree / 100) * 0.789;
    }
    
    // NOUVEAU : Calcul du coût de revient
    if (ing.purchase_price_per_liter > 0) {
      cost += ing.purchase_price_per_liter * (s.volume_ml / 1000);
    }
  }
  
  const totalVol = steps.reduce((a, s) => a + s.volume_ml, 0);
  const alcDeg   = totalVol > 0
    ? ((alcGrams / 0.789) / totalVol) * 100
    : 0;
    
  return {
    kcal:     Math.round(kcal),
    sugar:    Math.round(sugar * 10) / 10,
    alcGrams: Math.round(alcGrams * 10) / 10,
    alcDeg:   Math.round(alcDeg * 10) / 10,
    cost:     Math.round(cost * 100) / 100, // Arrondi à 2 décimales
    totalVol,
  };
}

// ── Toast ─────────────────────────────────────────────────────────────────────
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
           : t.type === 'error' ? <AlertCircle size={15} />
           : <FlaskConical size={15} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Pill stat ─────────────────────────────────────────────────────────────────
function StatPill({ icon, value, unit, warn, highlightClass }) {
  return (
    <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold
      ${warn ? 'bg-red-500/10 border-red-500/20 text-red-400'
             : highlightClass ? highlightClass 
             : 'bg-white/[0.04] border-white/[0.07] text-white/70'}`}>
      {icon}
      <span>{value}</span>
      <span className={highlightClass ? "opacity-70 font-normal" : "text-white/30 font-normal"}>{unit}</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
const Lab = () => {
  const { user } = useUser();
  const [tab, setTab] = useState('recipe'); // 'recipe' | 'color'

  // ── Toasts ──────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 1 : RECETTE CUSTOM
  // ══════════════════════════════════════════════════════════════════════════
  const [ingredients, setIngredients]     = useState([]);
  const [ingredientMap, setIngredientMap] = useState({});
  const [steps, setSteps]                 = useState([]);
  const [recipeName, setRecipeName]       = useState('');
  const [selectedIngId, setSelectedIngId] = useState('');
  const [pouring, setPouring]             = useState(false);
  const [saveLoading, setSaveLoading]     = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/ingredients?limit=100`)
      .then(res => {
        const available = res.data.filter(i => i.pump_id !== null && i.is_available);
        setIngredients(available);
        const map = {};
        available.forEach(i => { map[i.id] = i; });
        setIngredientMap(map);
        if (available.length > 0) setSelectedIngId(String(available[0].id));
      })
      .catch(() => toast("Impossible de charger les ingrédients", 'error'));
  }, [toast]);

  const addStep = () => {
    if (!selectedIngId) return;
    const id = parseInt(selectedIngId);
    const existing = steps.findIndex(s => s.ingredient_id === id);
    if (existing >= 0) {
      const updated = [...steps];
      updated[existing].volume_ml += 30;
      setSteps(updated);
    } else {
      setSteps(p => [...p, { ingredient_id: id, volume_ml: 30 }]);
    }
  };

  const updateVolume = (idx, delta) => {
    const updated = [...steps];
    updated[idx].volume_ml = Math.max(10, updated[idx].volume_ml + delta);
    setSteps(updated);
  };

  const removeStep = (idx) => setSteps(p => p.filter((_, i) => i !== idx));

  const nutrition = calcNutrition(steps, ingredientMap);

  const handlePour = async () => {
    if (steps.length === 0) return toast("Ajoutez au moins un ingrédient", 'error');
    if (nutrition.totalVol > 300) return toast("Le verre va déborder (>300ml)", 'error');
    
    setPouring(true);
    try {
      const recipeRes = await axios.post(`${API_BASE_URL}/cocktails/custom`, {
        name:        recipeName || "Cocktail Lab",
        ingredients: steps.map(s => ({
          ingredient_id: s.ingredient_id,
          volume_ml:     s.volume_ml
        })),
        user_id: user?.id || null
      });
      toast(`🍹 Préparation lancée — ${recipeRes.data.sequence_id}`, 'success');
    } catch (err) {
      const msg = err.response?.data?.detail || "Erreur préparation";
      toast(msg, 'error');
    } finally {
      setPouring(false);
    }
  };

  const handleSave = async () => {
    if (!recipeName.trim()) return toast("Donnez un nom à votre recette", 'error');
    if (steps.length === 0)  return toast("Ajoutez au moins un ingrédient", 'error');
    setSaveLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/cocktails/`, {
        name:        recipeName,
        description: "Créé depuis le Lab",
        category:    "Custom",
        price:       nutrition.cost, // On sauvegarde le prix calculé !
        ingredients: steps.map((s, idx) => ({
          ingredient_id: s.ingredient_id,
          volume_ml:     s.volume_ml,
          order:         idx
        }))
      });
      toast(`✅ "${recipeName}" sauvegardée dans le catalogue !`);
      setSteps([]);
      setRecipeName('');
    } catch (err) {
      toast(err.response?.data?.detail || "Erreur sauvegarde", 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 2 : MODE COULEUR
  // ══════════════════════════════════════════════════════════════════════════
  const [color, setColor]           = useState("#00FF00");
  const [volume, setVolume]         = useState(50);
  const [colorStatus, setColorStatus] = useState("idle");
  const [colorLogs, setColorLogs]   = useState([]);
  const [colorResult, setColorResult] = useState(null);

  const handleMix = async () => {
    setColorStatus("loading");
    setColorLogs([]);
    setColorResult(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/colors/mix`, {
        hex_code:  color,
        volume_ml: parseInt(volume)
      });

      const v   = res.data.volumes;
      const rgb = res.data.rgb_result ?? res.data.rgb_requested;

      setColorStatus("success");
      setColorResult(rgb);

      setColorLogs([
        `Couleur demandée : ${color.toUpperCase()}`,
        `Couleur produite : rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
        `─────────────────────────`,
        `Cyan     : ${v.cyan_ml?.toFixed(1) ?? 0} ml`,
        `Magenta  : ${v.magenta_ml?.toFixed(1) ?? 0} ml`,
        `Jaune    : ${v.yellow_ml?.toFixed(1) ?? 0} ml`,
        v.water_ml > 0 ? `Eau      : ${v.water_ml?.toFixed(1)} ml` : null,
        `─────────────────────────`,
        `Saturation    : ${((v.saturation ?? 0) * 100).toFixed(0)}%`,
        `Temps estimé  : ${res.data.estimated_time?.toFixed(1)}s`,
      ].filter(Boolean));

      toast("Mélange lancé !");
    } catch (err) {
      setColorStatus("error");
      const msg = err.response?.data?.detail || "Serveur inaccessible";
      setColorLogs([`Erreur : ${msg}`]);
      toast(msg, 'error');
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 px-6 pt-10">
      <Toast toasts={toasts} />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-black text-white mb-1 flex items-center gap-3">
            <FlaskConical size={32} className="text-amber-500" />
            Laboratoire
          </h1>
          <p className="text-white/30 text-sm">
            Créez vos recettes custom ou testez le mélangeur colorimétrique
          </p>
        </div>
      </div>

      {/* ── ONGLETS ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.07] p-1 rounded-2xl w-fit">
        {[
          { id: 'recipe', label: 'Recette Custom', icon: <Beaker size={15} /> },
          { id: 'color',  label: 'Mode Couleur',   icon: <Palette size={15} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold
              transition-all duration-200
              ${tab === t.id
                ? 'bg-white/10 text-white border border-white/15 shadow'
                : 'text-white/30 hover:text-white/60'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB : RECETTE CUSTOM
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'recipe' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Panneau gauche : composition ──────────────────────────────── */}
          <div className="lg:col-span-3 space-y-4">

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <label className="text-xs text-white/30 uppercase tracking-widest font-bold mb-3 block">
                Nom de la recette
              </label>
              <input
                type="text"
                placeholder="Ex: Mon Mojito Spécial…"
                value={recipeName}
                onChange={e => setRecipeName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 text-white px-4 py-3
                           rounded-xl focus:outline-none focus:border-amber-500/50 transition-colors
                           placeholder:text-white/15 text-sm"
              />
            </div>

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <label className="text-xs text-white/30 uppercase tracking-widest font-bold mb-3 block">
                Ajouter un ingrédient
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedIngId}
                    onChange={e => setSelectedIngId(e.target.value)}
                    className="w-full appearance-none bg-black/40 border border-white/10 text-white
                               px-4 py-3 pr-10 rounded-xl focus:outline-none focus:border-amber-500/50
                               transition-colors text-sm cursor-pointer"
                  >
                    {ingredients.length === 0 && (
                      <option disabled>Aucune pompe connectée</option>
                    )}
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} — Pompe #{ing.pump_id}
                        {ing.alcohol_degree > 0 ? ` (${ing.alcohol_degree}°)` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
                <button onClick={addStep}
                  className="px-5 py-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400
                             border border-amber-500/25 rounded-xl font-bold transition-all
                             flex items-center gap-2 text-sm">
                  <Plus size={16} /> Ajouter
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {steps.length === 0 ? (
                <div className="bg-white/[0.02] border border-dashed border-white/[0.07]
                               rounded-2xl p-8 text-center text-white/20 text-sm">
                  Ajoutez des ingrédients pour composer votre recette
                </div>
              ) : steps.map((step, idx) => {
                const ing = ingredientMap[step.ingredient_id];
                if (!ing) return null;
                const stockPct  = (ing.current_volume_ml / ing.max_volume_ml) * 100;
                const notEnough = ing.current_volume_ml < step.volume_ml;

                return (
                  <div key={idx}
                    className={`flex items-center gap-4 bg-white/[0.03] border rounded-2xl px-5 py-4
                      transition-all duration-200
                      ${notEnough ? 'border-red-500/25 bg-red-500/5' : 'border-white/[0.07]'}`}>

                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm truncate">{ing.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${Math.min(stockPct, 100)}%` }} />
                        </div>
                        <span className="text-xs text-white/25">
                          {Math.round(ing.current_volume_ml)}ml dispo
                        </span>
                        {notEnough && (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle size={10} /> Stock insuffisant
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateVolume(idx, -10)}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/50
                                   hover:text-white flex items-center justify-center transition-all">
                        <Minus size={14} />
                      </button>
                      <span className="text-white font-black font-mono w-12 text-center text-sm">
                        {step.volume_ml}ml
                      </span>
                      <button onClick={() => updateVolume(idx, 10)}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/50
                                   hover:text-white flex items-center justify-center transition-all">
                        <Plus size={14} />
                      </button>
                    </div>

                    <button onClick={() => removeStep(idx)}
                      className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/60
                                 hover:text-red-400 flex items-center justify-center transition-all shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Panneau droit : preview + actions ─────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 space-y-4">
              <div className="text-xs text-white/30 uppercase tracking-widest font-bold">
                Aperçu nutritionnel
              </div>

              {steps.length === 0 ? (
                <div className="text-white/15 text-sm text-center py-4">
                  Composez votre recette…
                </div>
              ) : (
                <>
                  <div className="text-center py-2">
                    <div className={`text-4xl font-black ${nutrition.totalVol > 300 ? 'text-red-400' : 'text-white'}`}>
                      {nutrition.totalVol}
                    </div>
                    <div className="text-xs text-white/30 mt-1">ml au total</div>
                    {nutrition.totalVol > 300 && (
                      <div className="text-xs font-bold text-red-500 mt-2 bg-red-500/10 inline-block px-3 py-1 rounded-md">
                        ⚠️ Verre trop plein !
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <StatPill icon={<Wine size={13} />}       value={nutrition.alcDeg}   unit="°"        />
                    <StatPill icon={<Flame size={13} />}      value={nutrition.kcal}     unit="kcal"     />
                    <StatPill icon={<Droplets size={13} />}   value={nutrition.sugar}    unit="g" warn={nutrition.sugar > 25}    />
                    <StatPill icon={<Euro size={13} />}       value={nutrition.cost} unit="€" highlightClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-400" />
                  </div>

                  {nutrition.sugar > 25 && (
                    <div className="flex items-center gap-2 text-xs text-red-400
                                   bg-red-500/5 border border-red-500/15 rounded-xl px-3 py-2">
                      <AlertTriangle size={12} /> Sucres élevés (&gt; 25g)
                    </div>
                  )}
                  {nutrition.alcDeg > 15 && (
                    <div className="flex items-center gap-2 text-xs text-orange-400
                                   bg-orange-500/5 border border-orange-500/15 rounded-xl px-3 py-2">
                      <AlertTriangle size={12} /> Cocktail corsé ({nutrition.alcDeg}°)
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <button onClick={handlePour}
                disabled={pouring || steps.length === 0 || nutrition.totalVol > 300}
                className={`w-full py-4 rounded-2xl font-black text-sm flex items-center
                           justify-center gap-2 transition-all
                           ${pouring || steps.length === 0 || nutrition.totalVol > 300
                             ? 'bg-white/5 text-white/25 cursor-not-allowed'
                             : 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_25px_rgba(245,158,11,0.3)] active:scale-95'}`}>
                {pouring
                  ? <><RefreshCw size={16} className="animate-spin" /> Préparation…</>
                  : <><Play size={16} fill="currentColor" /> Préparer maintenant</>}
              </button>

              <button onClick={handleSave}
                disabled={saveLoading || steps.length === 0 || !recipeName.trim()}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center
                           justify-center gap-2 transition-all border
                           ${saveLoading || steps.length === 0 || !recipeName.trim()
                             ? 'bg-white/[0.03] border-white/[0.06] text-white/20 cursor-not-allowed'
                             : 'bg-white/[0.05] border-white/[0.12] text-white hover:bg-white/[0.08] active:scale-95'}`}>
                {saveLoading
                  ? <><RefreshCw size={14} className="animate-spin" /> Sauvegarde…</>
                  : <><Send size={14} /> Sauvegarder dans le catalogue</>}
              </button>

              {!recipeName.trim() && steps.length > 0 && (
                <p className="text-xs text-white/20 text-center">
                  Donnez un nom pour pouvoir sauvegarder
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB : MODE COULEUR
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'color' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Panneau contrôle */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-8 space-y-8">
            <div className="space-y-4">
              <label className="text-xs text-white/30 uppercase tracking-widest font-bold block">
                Choix de la couleur
              </label>
              <div className="flex gap-4 items-center">
                <input type="color" value={color}
                  onChange={e => { setColor(e.target.value); setColorResult(null); }}
                  className="w-20 h-20 rounded-xl cursor-pointer bg-transparent border-0" />
                <div>
                  <div className="text-2xl font-mono font-black text-white">{color.toUpperCase()}</div>
                  <div className="text-sm text-white/30">Format HEX</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-xs text-white/30 uppercase tracking-widest font-bold">
                  Volume total
                </label>
                <span className="font-black text-amber-400 text-sm">{volume} ml</span>
              </div>
              <input type="range" min="10" max="200" step="10" value={volume}
                onChange={e => setVolume(e.target.value)}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500" />
            </div>

            <button onClick={handleMix} disabled={colorStatus === "loading"}
              className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm
                flex items-center justify-center gap-3 transition-all
                ${colorStatus === "loading"
                  ? 'bg-white/5 text-white/25 cursor-wait'
                  : 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)] active:scale-95'}`}>
              {colorStatus === "loading"
                ? <><RefreshCw size={16} className="animate-spin" /> Traitement…</>
                : <><Play size={16} fill="currentColor" /> Lancer le mélange</>}
            </button>
          </div>

          {/* Panneau visualisation */}
          <div className="space-y-5">

            <div className="grid grid-cols-2 gap-3">
              <div className="h-36 rounded-2xl border border-white/10 flex flex-col items-center
                             justify-center transition-all duration-500 gap-2"
                style={{ backgroundColor: color, boxShadow: `0 0 40px ${color}40` }}>
                <span className="bg-black/50 backdrop-blur px-3 py-1 rounded-xl
                                 text-white font-mono text-xs border border-white/10">
                  Demandée
                </span>
              </div>
              <div className="h-36 rounded-2xl border border-white/10 flex flex-col items-center
                             justify-center transition-all duration-500 gap-2 relative overflow-hidden"
                style={colorResult
                  ? { backgroundColor: `rgb(${colorResult[0]},${colorResult[1]},${colorResult[2]})`,
                      boxShadow: `0 0 40px rgba(${colorResult[0]},${colorResult[1]},${colorResult[2]},0.4)` }
                  : { backgroundColor: '#1a1a1a' }}>
                <span className="bg-black/50 backdrop-blur px-3 py-1 rounded-xl
                                 text-white font-mono text-xs border border-white/10">
                  Produite
                </span>
                {!colorResult && (
                  <span className="text-white/20 text-xs">en attente…</span>
                )}
              </div>
            </div>

            {/* Console */}
            <div className="bg-black/60 border border-white/[0.06] rounded-2xl p-5
                           font-mono text-sm h-52 overflow-y-auto">
              <div className="text-white/20 text-xs mb-3 pb-2 border-b border-white/5 uppercase tracking-widest">
                Console système
              </div>
              {colorLogs.length === 0 && (
                <div className="text-white/15 italic text-xs">En attente de commande…</div>
              )}
              {colorLogs.map((log, i) => (
                <div key={i} className={`mb-1.5 text-xs
                  ${log.startsWith('─')      ? 'text-white/15'
                  : colorStatus === 'error'  ? 'text-red-400'
                  : log.startsWith('Couleur produite') ? 'text-amber-400'
                  : 'text-emerald-400'}`}>
                  {!log.startsWith('─') && <span className="text-white/20 mr-2">›</span>}
                  {log}
                </div>
              ))}
              {colorStatus === 'error' && (
                <div className="text-red-400 flex items-center gap-2 mt-2 text-xs">
                  <AlertCircle size={12} /> Échec de la communication
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lab;