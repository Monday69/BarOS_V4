import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Wine, ShoppingBag, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

const Menu = () => {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderingId, setOrderingId] = useState(null); // ID du cocktail en cours de préparation

  // 1. On charge les recettes au démarrage
  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/cocktails/');
      setRecipes(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Erreur chargement menu:", error);
      setLoading(false);
    }
  };

  // 2. Fonction pour commander
  const handleOrder = async (recipe) => {
    if (orderingId) return; // Déjà occupé
    setOrderingId(recipe.id);

    try {
      // Appel au backend pour lancer le cocktail
      await axios.post(`http://127.0.0.1:8000/cocktails/pour/${recipe.id}`);
      
      // On simule le temps de préparation (juste visuel pour l'instant)
      // Dans la V5, on utilisera des WebSockets pour avoir le vrai temps
      setTimeout(() => {
        setOrderingId(null);
        alert(`Votre ${recipe.name} est prêt !`);
      }, 5000); 

    } catch (error) {
      console.error("Erreur commande:", error);
      setOrderingId(null);
      alert("Erreur: Impossible de lancer la commande (Ingrédients manquants ?)");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-primary mb-2">La Carte</h1>
          <p className="text-textMuted">Sélection de nos meilleurs assemblages.</p>
        </div>
        <div className="p-3 bg-primary/10 rounded-full text-primary">
          <Wine size={32} />
        </div>
      </div>

      {/* Grille des Cocktails */}
      {loading ? (
        <div className="text-center text-textMuted py-20 animate-pulse">Chargement de la cave...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="group bg-surface border border-white/5 rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
              
              {/* Image (Placeholder stylé si pas d'image) */}
              <div className="h-48 bg-surfaceLight relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                <img 
                  src={recipe.image_url || "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80"} 
                  alt={recipe.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute bottom-4 left-4 z-20">
                  <h3 className="text-2xl font-bold text-white">{recipe.name}</h3>
                  <span className="text-primary font-mono">{recipe.price.toFixed(2)} €</span>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6">
                <button 
                  onClick={() => handleOrder(recipe)}
                  disabled={orderingId !== null}
                  className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    orderingId === recipe.id
                      ? "bg-primary/20 text-primary cursor-wait"
                      : orderingId !== null 
                        ? "bg-surfaceLight text-textMuted opacity-50 cursor-not-allowed"
                        : "bg-white/5 hover:bg-primary hover:text-black text-white"
                  }`}
                >
                  {orderingId === recipe.id ? (
                    <>
                      <Clock className="animate-spin" size={18} />
                      Préparation...
                    </>
                  ) : orderingId === null ? (
                    <>
                      <ShoppingBag size={18} />
                      Commander
                    </>
                  ) : (
                    "Machine occupée"
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Menu;