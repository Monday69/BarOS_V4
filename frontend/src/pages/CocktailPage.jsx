import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Droplets, Clock, Info, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function CocktailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cocktail, setCocktail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPouring, setIsPouring] = useState(false);

  useEffect(() => {
    // ✅ URL CORRIGÉE
    fetch(`http://localhost:8000/api/cocktails/${id}`)
      .then(res => res.json())
      .then(data => {
        setCocktail(data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, [id]);

  const handleOrder = async () => {
    if (!cocktail) return;
    setIsPouring(true);
    try {
        // ✅ URL CORRIGÉE
        const response = await axios.post(`http://localhost:8000/api/cocktails/${cocktail.id}/pour`);
        const temps = response.data.estimated_time;
        alert(`✅ Commande lancée !\nTemps de préparation estimé : ${temps} secondes.`);
    } catch (error) {
        const msg = error.response?.data?.detail || "Erreur de connexion au serveur.";
        alert(`❌ Impossible de lancer : ${JSON.stringify(msg)}`);
    }
    setIsPouring(false);
  };

  if (loading) return <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center text-orange-500 font-mono animate-pulse">CHARGEMENT...</div>;
  if (!cocktail) return <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center text-white">Cocktail introuvable</div>;

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white font-sans relative overflow-hidden flex flex-col md:flex-row">
      <style>{`@keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-20px); } 100% { transform: translateY(0px); } }`}</style>
      <button onClick={() => navigate(-1)} className="absolute top-6 left-6 z-50 p-3 bg-black/20 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/10 transition-all group"><ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" /></button>
      <div className="w-full md:w-1/2 h-[50vh] md:h-screen relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-40 blur-[50px] scale-150" style={{ backgroundImage: `url(${cocktail.image_url})` }} />
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 w-full h-full flex items-center justify-center p-8">
            <img src={cocktail.image_url} alt={cocktail.name} style={{ animation: 'float 6s ease-in-out infinite' }} className="h-full w-full object-contain scale-100 drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)]" />
        </div>
      </div>
      <div className="w-full md:w-1/2 h-auto md:h-screen bg-[#0f0f0f]/90 backdrop-blur-xl border-l border-white/5 flex flex-col justify-center p-8 md:p-16 relative z-20">
        <div className="space-y-6 max-w-lg mx-auto">
            <div>
                <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 mb-2">{cocktail.name}</h1>
                <div className="flex items-center gap-4"><span className="text-2xl text-orange-500 font-mono font-bold">{cocktail.price.toFixed(2)} €</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4 py-4">
                <div className="bg-white/5 p-4 rounded-xl flex items-center gap-3 border border-white/5"><Clock className="text-orange-500" /><div><div className="text-xs text-gray-500 uppercase">Temps estimé</div><div className="font-bold">~{cocktail.estimated_time || 12} s</div></div></div>
                <div className="bg-white/5 p-4 rounded-xl flex items-center gap-3 border border-white/5"><Droplets className="text-blue-400" /><div><div className="text-xs text-gray-500 uppercase">Volume Total</div><div className="font-bold">{cocktail.total_volume_ml || 0} ml</div></div></div>
            </div>
            <div className="pt-8">
                <button onClick={handleOrder} disabled={!cocktail.compatible_with_stock || isPouring} className={`w-full py-5 rounded-2xl font-bold text-xl text-white flex items-center justify-center gap-3 transition-all ${isPouring ? 'bg-gray-700 cursor-wait' : (!cocktail.compatible_with_stock ? 'bg-red-900/50 cursor-not-allowed border border-red-500/50' : 'bg-gradient-to-r from-orange-500 to-red-600 shadow-[0_0_30px_rgba(249,115,22,0.4)] hover:shadow-[0_0_50px_rgba(249,115,22,0.6)] hover:scale-[1.02] active:scale-95')}`}>
                    {isPouring ? (<> <Loader2 className="animate-spin" /> PRÉPARATION... </>) : (!cocktail.compatible_with_stock ? "STOCK INSUFFISANT" : <> <Play fill="currentColor" /> LANCER LA PRÉPARATION </>)}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}