import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Droplets, Clock, Info, Loader2 } from 'lucide-react'; // Ajout de Loader2
import axios from 'axios'; // <--- INDISPENSABLE pour parler au backend

export default function CocktailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cocktail, setCocktail] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Nouvel état pour gérer le chargement du bouton (Force Majeure)
  const [isPouring, setIsPouring] = useState(false);

  // Simulation de description
  const getDescription = (name) => {
    if (name.includes('Mojito')) return "L'incontournable star cubaine. Une alliance parfaite entre la fraîcheur de la menthe, l'acidité du citron vert et la puissance du rhum.";
    if (name.includes('Cosmo')) return "Le cocktail glamour par excellence. Un équilibre subtil entre la douceur de la canneberge et le peps du citron vert.";
    if (name.includes('Mule')) return "Une explosion épicée grâce au gingembre, adoucie par la vodka. Servi traditionnellement dans une tasse en cuivre.";
    return "Une création originale de votre BarOS, équilibrée et savoureuse, préparée avec une précision millimétrique.";
  };

  useEffect(() => {
    fetch('http://localhost:8000/cocktails/')
      .then(res => res.json())
      .then(data => {
        const found = data.find(c => c.id === parseInt(id));
        setCocktail(found);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, [id]);

  // --- LA SEULE VRAIE MODIF : LA LOGIQUE DE COMMANDE ---
  const handleOrder = async () => {
    if (!cocktail) return;
    
    setIsPouring(true); // On verrouille le bouton
    
    try {
        // 1. Appel au Cerveau (Backend)
        // C'est ici que ça vérifie les pompes et utilise fluid_physics.py
        const response = await axios.post(`http://localhost:8000/cocktails/pour/${cocktail.id}`);
        
        // 2. Succès : On affiche le temps calculé par la physique
        const temps = response.data.total_time_seconds;
        alert(`✅ Commande lancée !\nTemps de préparation calculé : ${temps} secondes.`);
        
    } catch (error) {
        // 3. Erreur (Pompe vide, débranchée, etc.)
        const msg = error.response?.data?.detail || "Erreur de connexion au serveur.";
        alert(`❌ Impossible de lancer : ${msg}`);
    }
    
    setIsPouring(false); // On déverrouille
  };

  if (loading) return <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center text-orange-500 font-mono animate-pulse">CHARGEMENT...</div>;
  if (!cocktail) return <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center text-white">Cocktail introuvable</div>;

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white font-sans relative overflow-hidden flex flex-col md:flex-row">
      
      {/* STYLE POUR L'ANIMATION DE FLOTTEMENT */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }
      `}</style>

      {/* BOUTON RETOUR */}
      <button 
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 z-50 p-3 bg-black/20 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/10 transition-all group"
      >
        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
      </button>

      {/* --- PARTIE GAUCHE : VISUEL FLOTTANT --- */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-screen relative flex items-center justify-center overflow-hidden">
        
        {/* Fond d'ambiance */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 blur-[50px] scale-150"
          style={{ backgroundImage: `url(${cocktail.image_url})` }}
        />
        <div className="absolute inset-0 bg-black/30" />

        {/* Spotlight */}
        <div className="absolute w-[500px] h-[500px] bg-gradient-to-tr from-white/20 to-transparent rounded-full blur-[80px] animate-pulse" />
        
        {/* L'IMAGE DÉTOURÉE (TAILLE NORMALE X1) */}
        <div className="relative z-10 w-full h-full flex items-center justify-center p-8">
            <img 
                src={cocktail.image_url} 
                alt={cocktail.name} 
                style={{ animation: 'float 6s ease-in-out infinite' }}
                className="h-full w-full object-contain scale-100 drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)]"
            />
        </div>
      </div>

      {/* --- PARTIE DROITE : INFO & COMMANDE --- */}
      <div className="w-full md:w-1/2 h-auto md:h-screen bg-[#0f0f0f]/90 backdrop-blur-xl border-l border-white/5 flex flex-col justify-center p-8 md:p-16 relative z-20">
        
        <div className="space-y-6 max-w-lg mx-auto">
            {/* Titre & Prix */}
            <div>
                <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 mb-2">
                    {cocktail.name}
                </h1>
                <div className="flex items-center gap-4">
                    <span className="text-2xl text-orange-500 font-mono font-bold">{cocktail.price.toFixed(2)} €</span>
                    <span className="px-3 py-1 bg-white/10 rounded-full text-xs uppercase tracking-wider text-gray-400">Signature</span>
                </div>
            </div>

            {/* Description */}
            <p className="text-gray-400 text-lg leading-relaxed italic border-l-2 border-orange-500 pl-4">
                "{getDescription(cocktail.name)}"
            </p>

            {/* Infos techniques */}
            <div className="grid grid-cols-2 gap-4 py-4">
                <div className="bg-white/5 p-4 rounded-xl flex items-center gap-3 border border-white/5">
                    <Clock className="text-orange-500" />
                    <div>
                        <div className="text-xs text-gray-500 uppercase">Temps estimé</div>
                        <div className="font-bold">~12 secondes</div>
                    </div>
                </div>
                <div className="bg-white/5 p-4 rounded-xl flex items-center gap-3 border border-white/5">
                    <Droplets className="text-blue-400" />
                    <div>
                        <div className="text-xs text-gray-500 uppercase">Volume Total</div>
                        <div className="font-bold">{cocktail.ingredients.reduce((acc, ing) => acc + ing.volume, 0)} ml</div>
                    </div>
                </div>
            </div>

            {/* Liste Ingrédients */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Info size={14}/> Composition
                </h3>
                <div className="space-y-2">
                    {cocktail.ingredients.map((ing, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 hover:bg-white/5 px-2 rounded transition-colors">
                            <span className="font-medium text-gray-200">{ing.name}</span>
                            <span className="font-mono text-gray-400">{ing.volume} ml</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* BOUTON D'ACTION CONNECTÉ AU BACKEND */}
            <div className="pt-8">
                <button 
                    onClick={handleOrder}
                    disabled={isPouring} // Désactivé pendant le calcul
                    className={`w-full py-5 rounded-2xl font-bold text-xl text-white flex items-center justify-center gap-3 transition-all
                        ${isPouring 
                            ? 'bg-gray-700 cursor-wait' 
                            : 'bg-gradient-to-r from-orange-500 to-red-600 shadow-[0_0_30px_rgba(249,115,22,0.4)] hover:shadow-[0_0_50px_rgba(249,115,22,0.6)] hover:scale-[1.02] active:scale-95'
                        }`}
                >
                    {isPouring ? (
                        <> <Loader2 className="animate-spin" /> CALCUL EN COURS... </>
                    ) : (
                        <> <Play fill="currentColor" /> LANCER LA PRÉPARATION </>
                    )}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}