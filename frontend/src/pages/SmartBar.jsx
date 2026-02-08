import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Wine, ArrowLeft, Sparkles, GlassWater, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SmartBar() {
  const navigate = useNavigate();
  const [availableIngredients, setAvailableIngredients] = useState([]); 
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBase, setSelectedBase] = useState(null); 

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ✅ URL CORRIGÉE
        const configRes = await axios.get('http://localhost:8000/api/machine/status');
        const machineStock = Object.values(configRes.data.slots || {})
            .map(slot => slot.name)
            .filter(name => name && name !== "Vide");
        
        const uniqueStock = [...new Set(machineStock)];
        setAvailableIngredients(uniqueStock);

        // ✅ URL CORRIGÉE
        const recipesRes = await axios.get('http://localhost:8000/api/cocktails/');
        setRecipes(recipesRes.data);

        setLoading(false);
      } catch (err) {
        console.error("Erreur chargement Bar:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const isRecipeDoable = (recipe) => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return false;
    // Note : recipe.ingredients est une liste de strings dans le modèle Pydantic actuel
    // Si c'est une liste d'objets, il faudrait adapter
    return recipe.ingredients.every(ing => availableIngredients.includes(typeof ing === 'string' ? ing : ing.name));
  };

  const doableRecipes = recipes.filter(isRecipeDoable);
  const featuredRecipes = doableRecipes.sort(() => 0.5 - Math.random()).slice(0, 3);
  const filteredRecipes = selectedBase
    ? recipes.filter(r => r.ingredients.includes(selectedBase))
    : [];

  const handleCardClick = (recipeId) => {
      navigate(`/cocktail/${recipeId}`);
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-white animate-pulse">Ouverture du Bar...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 pb-24 overflow-y-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-4xl font-bold flex items-center gap-3"><span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">BarOS</span><span className="text-white">Lounge</span></h1>
           <p className="text-gray-400 text-sm mt-1">{availableIngredients.length} bouteilles connectées • {doableRecipes.length} recettes disponibles</p>
        </div>
        <div className="p-3 bg-white/5 rounded-full"><Wine size={28} className="text-orange-500" /></div>
      </div>

      {!selectedBase && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {featuredRecipes.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4"><Sparkles className="text-yellow-400" size={20} /><h2 className="text-xl font-bold text-gray-200">Suggestions du Chef</h2></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredRecipes.map(recipe => (
                  <CocktailCard key={recipe.id} recipe={recipe} isDoable={true} onClick={() => handleCardClick(recipe.id)} />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center gap-2 mb-4"><GlassWater className="text-blue-400" size={20} /><h2 className="text-xl font-bold text-gray-200">Quelle est votre envie ?</h2></div>
            {availableIngredients.length === 0 ? (
                <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center text-gray-500"><AlertCircle className="mx-auto mb-2" />Aucune bouteille connectée. Configurez la machine d'abord.</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {availableIngredients.map(ingName => (
                        <button key={ingName} onClick={() => setSelectedBase(ingName)} className="group relative h-32 rounded-2xl bg-[#151515] border border-white/5 hover:border-orange-500 hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-3 overflow-hidden cursor-pointer">
                            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/50" />
                            <div className="relative z-10 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform"><GlassWater size={20} /></div>
                            <span className="relative z-10 font-bold text-sm text-center px-2">{ingName}</span>
                        </button>
                    ))}
                </div>
            )}
          </section>
        </div>
      )}

      {selectedBase && (
        <div className="animate-in slide-in-from-right-8 duration-300">
            <button onClick={() => setSelectedBase(null)} className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"><ArrowLeft size={20} /> Retour aux choix</button>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">Cocktails à base de <span className="text-orange-500 underline decoration-orange-500/30">{selectedBase}</span></h2>
            {filteredRecipes.length === 0 ? (
                <div className="text-center py-20 text-gray-500">Aucune recette connue n'utilise cet ingrédient pour le moment.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRecipes.map(recipe => (
                        <CocktailCard key={recipe.id} recipe={recipe} isDoable={isRecipeDoable(recipe)} onClick={() => handleCardClick(recipe.id)} />
                    ))}
                </div>
            )}
        </div>
      )}
    </div>
  );
}

function CocktailCard({ recipe, isDoable, onClick }) {
    return (
        <div onClick={isDoable ? onClick : null} className={`group relative bg-[#151515] rounded-3xl overflow-hidden border transition-all duration-300 ${isDoable ? 'cursor-pointer border-white/5 hover:border-orange-500/50 hover:shadow-2xl hover:-translate-y-1' : 'cursor-not-allowed border-red-500/10 opacity-70 grayscale'}`}>
            <div className="h-48 bg-gray-800 relative">
                 <img src={recipe.image_url || "/api/placeholder/400/300"} alt={recipe.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                 <div className="absolute inset-0 bg-gradient-to-t from-[#151515] to-transparent" />
                 <div className="absolute bottom-4 left-6"><h3 className="text-2xl font-bold text-white">{recipe.name}</h3><p className="text-orange-400 font-mono font-bold">{recipe.price} €</p></div>
                 <div className="absolute top-4 right-4">{isDoable ? (<div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-md">DISPO</div>) : (<div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-md">MANQUANT</div>)}</div>
            </div>
            <div className="px-6 py-4">
                <div className="flex flex-wrap gap-2 mb-6">
                    {recipe.ingredients.slice(0, 3).map(ing => <span key={typeof ing === 'string' ? ing : ing.name} className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-md border border-white/5">{typeof ing === 'string' ? ing : ing.name}</span>)}
                </div>
                <button className={`w-full py-4 rounded-xl font-bold text-sm tracking-widest transition-all flex items-center justify-center gap-2 ${!isDoable ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-white text-black group-hover:bg-orange-500 group-hover:text-white'}`}>{!isDoable ? "INGRÉDIENTS MANQUANTS" : <> DÉCOUVRIR <ArrowRight size={16} /> </>}</button>
            </div>
        </div>
    );
}