import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Settings as SettingsIcon, Zap, RefreshCw, AlertTriangle, Edit3, X, Check, Trash2, Scan, Search, Filter, BookOpen, ChevronRight } from 'lucide-react';

const Settings = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refillingId, setRefillingId] = useState(null);
  
  // États pour l'édition manuelle (Volume)
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [tempVolume, setTempVolume] = useState(0);

  // États pour le SCANNER & HISTORIQUE
  const [scanningIngredient, setScanningIngredient] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);

  // État pour le filtre (False = On voit que les pompes / True = On voit tout)
  const [showAll, setShowAll] = useState(false); 

  // 🔐 CLÉ ADMIN
  const ADMIN_KEY = "BarOS_Admin_Secret"; 

  const fetchIngredients = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/ingredients');
      const allIngredients = response.data;
      allIngredients.sort((a, b) => {
        if (a.pump_id && !b.pump_id) return -1;
        if (!a.pump_id && b.pump_id) return 1;
        return (a.pump_id || 999) - (b.pump_id || 999);
      });
      setIngredients(allIngredients);
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

  const displayedIngredients = showAll 
    ? ingredients 
    : ingredients.filter(i => i.pump_id !== null);

  const getFluidColor = (current, max) => {
    const percentage = (current / max) * 100;
    const hue = Math.min(120, Math.max(0, percentage * 1.2)); 
    return `hsl(${hue}, 100%, 45%)`; 
  };

  // --- ACTIONS ---

  const handleRefill = async (id) => {
    setRefillingId(id);
    try {
      await axios.put(
        `http://localhost:8000/api/ingredients/${id}`, 
        { current_volume_ml: 1000.0 },
        { headers: { 'x-admin-token': ADMIN_KEY } }
      );
      await fetchIngredients();
    } catch (error) {
      alert("⛔ Erreur Remplissage");
    } finally {
      setRefillingId(null);
    }
  };

  const saveVolume = async () => {
    if (!editingIngredient) return;
    try {
      await axios.put(
        `http://localhost:8000/api/ingredients/${editingIngredient.id}`, 
        { current_volume_ml: parseFloat(tempVolume) },
        { headers: { 'x-admin-token': ADMIN_KEY } }
      );
      setEditingIngredient(null);
      fetchIngredients();
    } catch (error) {
      alert("⛔ Erreur Sauvegarde");
    }
  };

  const handleUnassign = async () => {
    if (!editingIngredient) return;
    if (confirm(`Retirer la bouteille de "${editingIngredient.name}" ?`)) {
        try {
            await axios.put(
                `http://localhost:8000/api/ingredients/${editingIngredient.id}`, 
                { pump_id: null },
                { headers: { 'x-admin-token': ADMIN_KEY } }
            );
            setEditingIngredient(null);
            fetchIngredients(); 
        } catch (error) { alert("Erreur"); }
    }
  };

  // --- LOGIQUE SCANNER & HISTORIQUE ---

  const openScanModal = (ing) => {
    setEditingIngredient(null);
    setScanningIngredient(ing);
    setBarcodeInput(""); 
    setShowHistory(false); 
  };

  const openEditModal = (ing) => {
    setScanningIngredient(null);
    setEditingIngredient(ing);
    setTempVolume(ing.current_volume_ml);
  };

  const toggleHistory = async () => {
    if (showHistory) {
        setShowHistory(false);
    } else {
        if (!scanningIngredient) return;
        try {
            const res = await axios.get(
                `http://localhost:8000/api/ingredients/${scanningIngredient.id}/history`,
                { headers: { 'x-admin-token': ADMIN_KEY } }
            );
            setHistoryList(res.data);
            setShowHistory(true);
        } catch (err) {
            console.error("Erreur historique", err);
        }
    }
  };

  const selectFromHistory = (barcode) => {
      setBarcodeInput(barcode);
      setShowHistory(false);
  };

  const submitScan = async (e) => {
    e.preventDefault();
    if (!barcodeInput) return;
    setScanLoading(true);

    try {
        const res = await axios.post(
            `http://localhost:8000/api/ingredients/${scanningIngredient.id}/scan?barcode=${barcodeInput}`,
            {}, 
            { headers: { 'x-admin-token': ADMIN_KEY } }
        );

        alert(`✅ ${res.data.brand} identifié !`);
        setScanningIngredient(null);
        fetchIngredients(); 

    } catch (error) {
        console.error(error);
        const msg = error.response?.data?.detail || "Erreur inconnue";
        alert(`❌ ÉCHEC DU SCAN\n${msg}`);
    } finally {
        setScanLoading(false);
    }
  };

  // --- RENDER ---

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6 pb-20">
      
      {/* HEADER AVEC BOUTON FILTRE */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
            <h1 className="text-4xl font-bold text-white mb-2">Maintenance</h1>
            <p className="text-gray-400">Gestion des stocks & Identification.</p>
        </div>
        
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setShowAll(!showAll)}
                className={`px-4 py-3 rounded-xl border flex items-center gap-2 font-bold transition-all ${
                    showAll 
                    ? "bg-white/10 border-white/20 text-white" 
                    : "bg-blue-600 border-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                }`}
            >
                <Filter size={20} />
                {showAll ? "Mode: Tout Afficher" : "Mode: Pompes Actives"}
            </button>

            <div className="p-4 bg-white/5 rounded-full text-gray-400">
                <SettingsIcon size={40} />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {loading ? ( <div className="col-span-2 text-center py-20 text-gray-500 animate-pulse">Chargement...</div> ) : displayedIngredients.length === 0 ? (
           <div className="col-span-2 text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
               {showAll ? (
                   <>
                       <AlertTriangle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
                       <p className="text-2xl text-gray-400 font-bold">Aucun ingrédient dans la base</p>
                   </>
               ) : (
                   <>
                       <Zap className="mx-auto h-16 w-16 text-gray-600 mb-4" />
                       <p className="text-2xl text-gray-400 font-bold">Aucune pompe connectée</p>
                       <button onClick={() => setShowAll(true)} className="mt-4 text-blue-400 hover:text-blue-300 underline">Afficher tout le stock</button>
                   </>
               )}
           </div>
        ) : (
          displayedIngredients.map((ing) => {
            const maxVol = ing.max_volume_ml || 1000;
            const pct = (ing.current_volume_ml / maxVol) * 100;
            const fluidColor = getFluidColor(ing.current_volume_ml, maxVol);
            
            return (
              <div key={ing.id} className="bg-[#1e1e1e] border border-white/10 rounded-3xl p-8 relative shadow-2xl flex flex-col justify-between min-h-[240px]">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                      <div className="h-16 w-16 bg-white/5 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center relative">
                          {ing.image_url ? (
                              <img 
                                src={ing.image_url} 
                                alt={ing.brand} 
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                    e.target.onerror = null; 
                                    e.target.style.display = 'none'; 
                                    e.target.parentElement.innerHTML = '<span class="text-xs text-gray-500">❌</span>'; 
                                }}
                              />
                          ) : (
                              <span className="text-2xl text-gray-600">?</span>
                          )}
                          {ing.barcode && <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-black" title="Produit identifié"></div>}
                      </div>
                      <div>
                          <h3 className="text-2xl font-bold text-white tracking-tight">{ing.name}</h3>
                          {ing.brand && <div className="text-sm text-purple-400 font-bold uppercase tracking-wider">{ing.brand}</div>}
                          {ing.pump_id !== null ? (
                              <div className="text-xs font-mono text-gray-400 mt-1 flex items-center gap-2 bg-black/30 w-fit px-2 py-1 rounded-full"><Zap size={10} className="text-yellow-500" /> POMPE #{ing.pump_id}</div>
                          ) : (
                              <div className="text-xs font-mono text-gray-500 mt-1 italic">Non assigné</div>
                          )}
                      </div>
                  </div>
                  <div className="text-4xl font-mono font-bold" style={{ color: fluidColor }}>{Math.round(pct)}%</div>
                </div>

                <div className="h-6 w-full bg-black/50 rounded-full overflow-hidden mb-6 border border-white/5 shadow-inner">
                  <div className="h-full transition-all duration-1000 ease-out relative" style={{ width: `${pct}%`, backgroundColor: fluidColor }}></div>
                </div>

                <div className="grid grid-cols-5 gap-3">
                    <button onClick={() => handleRefill(ing.id)} disabled={refillingId === ing.id} className="col-span-3 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 flex items-center justify-center gap-2 transition-colors">
                        <RefreshCw size={16} className={refillingId === ing.id ? "animate-spin" : ""} /> {refillingId === ing.id ? "..." : "Remplir"}
                    </button>
                    <button onClick={() => openEditModal(ing)} className="col-span-1 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center hover:bg-blue-500/20 transition-colors">
                        <Edit3 size={20} />
                    </button>
                    <button onClick={() => openScanModal(ing)} className="col-span-1 py-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl flex items-center justify-center hover:bg-purple-500/20 transition-colors">
                        <Scan size={20} />
                    </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL ÉDITION VOLUME */}
      {editingIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#2a2a2a] w-full max-w-xl rounded-3xl p-8 shadow-2xl border border-white/10">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-white">Volume</h2>
                    <button onClick={() => setEditingIngredient(null)}><X size={32} className="text-gray-400" /></button>
                </div>
                <div className="text-center mb-8"><span className="text-7xl font-bold text-blue-400 font-mono">{Math.round(tempVolume)}</span><span className="text-2xl text-gray-500 ml-2">ml</span></div>
                <input type="range" min="0" max={editingIngredient.max_volume_ml || 1000} value={tempVolume} onChange={(e) => setTempVolume(Number(e.target.value))} className="w-full h-4 bg-gray-700 rounded-full mb-8 accent-blue-500" />
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={handleUnassign} className="py-4 bg-red-500/20 text-red-500 rounded-2xl font-bold flex items-center justify-center gap-2"><Trash2 /> Déconnecter</button>
                    <button onClick={saveVolume} className="py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2"><Check /> Sauvegarder</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL SCANNER & HISTORIQUE (Le Final) */}
      {scanningIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in zoom-in-95 duration-200">
            <div className={`w-full max-w-lg rounded-3xl p-8 border transition-colors duration-300 ${showHistory ? 'bg-[#1a1a1a] border-yellow-500/30 shadow-[0_0_50px_rgba(234,179,8,0.2)]' : 'bg-[#1a1a1a] border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.2)]'}`}>
                
                <div className="flex justify-between items-center mb-8">
                    <div>
                        {/* TITRE DYNAMIQUE */}
                        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                            {showHistory ? (
                                <> <BookOpen className="text-yellow-500" size={32} /> Historique </>
                            ) : (
                                <> <Scan className="text-purple-400" size={32} /> Scanner </>
                            )}
                        </h2>
                        <p className="text-gray-400 mt-1">
                            {showHistory ? "Précédemment associés à " : "Associer "}
                            <span className={showHistory ? "text-yellow-500 font-bold" : "text-purple-400 font-bold"}>
                                {scanningIngredient.name}
                            </span>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {/* BOUTON TOGGLE DYNAMIQUE */}
                        <button 
                            onClick={toggleHistory} 
                            className={`p-3 rounded-xl transition-all ${
                                showHistory 
                                ? "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20" 
                                : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
                            }`}
                            title={showHistory ? "Retour au scanner" : "Voir l'historique"}
                        >
                            {showHistory ? <Scan size={24} /> : <BookOpen size={24} />}
                        </button>
                        <button onClick={() => setScanningIngredient(null)} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 text-gray-400">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {showHistory ? (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar animate-in slide-in-from-right-4 duration-300">
                        {historyList.length === 0 ? (
                            <div className="text-center py-8">
                                <Search className="mx-auto h-8 w-8 text-gray-600 mb-2" />
                                <p className="text-gray-500 italic">Aucun historique pertinent.</p>
                            </div>
                        ) : (
                            historyList.map((item) => (
                                <div key={item.barcode} onClick={() => selectFromHistory(item.barcode)} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-purple-500/20 cursor-pointer border border-transparent hover:border-purple-500/50 transition-all group">
                                    <div className="h-10 w-10 bg-black rounded-lg overflow-hidden flex-shrink-0">
                                        {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs flex items-center justify-center h-full text-gray-500">?</span>}
                                    </div>
                                    <div className="overflow-hidden flex-1">
                                        <div className="font-bold text-white truncate">{item.brand || item.name}</div>
                                        <div className="text-xs text-gray-500 font-mono">{item.barcode}</div>
                                    </div>
                                    <ChevronRight className="text-gray-600 group-hover:text-purple-400" size={16} />
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <form onSubmit={submitScan} className="animate-in slide-in-from-left-4 duration-300">
                        <div className="relative mb-8">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Scan className="text-gray-500" /></div>
                            <input 
                                type="text" 
                                autoFocus
                                placeholder="Code EAN (ex: 544900...)" 
                                value={barcodeInput}
                                onChange={(e) => setBarcodeInput(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 text-white text-xl p-6 pl-14 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono tracking-wider"
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={!barcodeInput || scanLoading}
                            className={`w-full py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition-all ${scanLoading ? 'bg-gray-800 text-gray-500 cursor-wait' : 'bg-purple-600 text-white hover:bg-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] active:scale-95'}`}
                        >
                            {scanLoading ? "Recherche..." : <>VALIDER <Check size={24} /></>}
                        </button>
                    </form>
                )}
            </div>
        </div>
      )}

    </div>
  );
};

export default Settings;