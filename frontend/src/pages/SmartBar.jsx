import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Wine, ArrowLeft, Sparkles, GlassWater, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = 'http://localhost:8000/api';

// ✅ Fix : image fallback inline SVG en base64 — pas de requête réseau
const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23151515'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23333' font-size='48'%3E🍹%3C/text%3E%3C/svg%3E";

// ── Helper : extrait le nom d'un ingrédient qu'il soit string ou objet ─────────
// ✅ Fix : robuste que ingredients soit string[] ou {name: string}[]
const ingName = (ing) => (typeof ing === 'string' ? ing : ing?.name ?? '');

export default function SmartBar() {
  const navigate = useNavigate();
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [recipes, setRecipes]                           = useState([]);
  const [loading, setLoading]                           = useState(true);
  const [error, setError]                               = useState(null);
  const [selectedBase, setSelectedBase]                 = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configRes, recipesRes] = await Promise.all([
          axios.get(`${API}/machine/status`),
          axios.get(`${API}/cocktails/`)
        ]);

        const machineStock = Object.values(configRes.data.slots || {})
          .map(slot => slot.name)
          .filter(name => name && name !== "Vide");

        setAvailableIngredients([...new Set(machineStock)]);
        setRecipes(recipesRes.data);
      } catch (err) {
        console.error("Erreur chargement Bar:", err);
        setError("Impossible de charger les données. L'API est-elle démarrée ?");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ✅ Fix : logique de disponibilité centralisée + robuste aux deux formats d'ingrédients
  const isRecipeDoable = (recipe) => {
    if (!recipe.ingredients?.length) return false;
    return recipe.ingredients.every(ing =>
      availableIngredients.includes(ingName(ing))
    );
  };

  const doableRecipes = useMemo(
    () => recipes.filter(isRecipeDoable),
    [recipes, availableIngredients]
  );

  // ✅ Fix : featuredRecipes stable — calculé une seule fois au chargement,
  // pas à chaque re-render. On utilise useMemo avec seed fixe.
  const featuredRecipes = useMemo(() => {
    if (!doableRecipes.length) return [];
    // Shuffle déterministe basé sur les IDs (stable entre renders)
    return [...doableRecipes]
      .sort((a, b) => (a.id * 9301 + 49297) % 233280 - (b.id * 9301 + 49297) % 233280)
      .slice(0, 3);
  }, [doableRecipes]);

  // ✅ Fix : filtre par base robuste aux deux formats d'ingrédients
  const filteredRecipes = useMemo(() =>
    selectedBase
      ? recipes.filter(r => r.ingredients?.some(ing => ingName(ing) === selectedBase))
      : [],
    [recipes, selectedBase]
  );

  const handleCardClick = (recipeId) => navigate(`/cocktail/${recipeId}`);

  if (loading) return (
    <div className="h-screen flex items-center justify-center text-white">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 animate-pulse">Ouverture du Bar…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="h-screen flex items-center justify-center text-white">
      <div className="text-center space-y-3 max-w-sm">
        <AlertCircle size={40} className="text-red-400 mx-auto" />
        <p className="text-red-400 font-semibold">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 pb-24 overflow-y-auto">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">
              BarOS
            </span>
            <span className="text-white">Lounge</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {availableIngredients.length} bouteilles connectées · {doableRecipes.length} recettes disponibles
          </p>
        </div>
        <div className="p-3 bg-white/5 rounded-full">
          <Wine size={28} className="text-orange-500" />
        </div>
      </div>

      {/* ── VUE PRINCIPALE ─────────────────────────────────────────────────── */}
      {!selectedBase ? (
        <div className="space-y-12">

          {/* Suggestions */}
          {featuredRecipes.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="text-yellow-400" size={20} />
                <h2 className="text-xl font-bold text-gray-200">Suggestions du Chef</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredRecipes.map(recipe => (
                  <CocktailCard
                    key={recipe.id}
                    recipe={recipe}
                    isDoable={true}
                    onClick={() => handleCardClick(recipe.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Sélecteur par ingrédient */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <GlassWater className="text-blue-400" size={20} />
              <h2 className="text-xl font-bold text-gray-200">Quelle est votre envie ?</h2>
            </div>
            {availableIngredients.length === 0 ? (
              <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center text-gray-500">
                <AlertCircle className="mx-auto mb-2" />
                Aucune bouteille connectée. Configurez la machine d'abord.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {availableIngredients.map(name => (
                  <button
                    key={name}
                    onClick={() => setSelectedBase(name)}
                    className="group relative h-32 rounded-2xl bg-[#151515] border border-white/5
                               hover:border-orange-500 hover:bg-white/5 transition-all
                               flex flex-col items-center justify-center gap-3 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/50" />
                    <div className="relative z-10 w-10 h-10 rounded-full bg-orange-500/10
                                    flex items-center justify-center text-orange-500
                                    group-hover:scale-110 transition-transform">
                      <GlassWater size={20} />
                    </div>
                    <span className="relative z-10 font-bold text-sm text-center px-2">{name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

      ) : (
        /* ── VUE FILTRÉE PAR INGRÉDIENT ─────────────────────────────────── */
        <div>
          <button
            onClick={() => setSelectedBase(null)}
            className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} /> Retour aux choix
          </button>

          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            Cocktails à base de{' '}
            <span className="text-orange-500 underline decoration-orange-500/30">{selectedBase}</span>
          </h2>

          {filteredRecipes.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              Aucune recette connue n'utilise cet ingrédient.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRecipes.map(recipe => (
                <CocktailCard
                  key={recipe.id}
                  recipe={recipe}
                  isDoable={isRecipeDoable(recipe)}
                  onClick={() => handleCardClick(recipe.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── CocktailCard ──────────────────────────────────────────────────────────────

function CocktailCard({ recipe, isDoable, onClick }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={isDoable ? onClick : undefined}
      className={`group relative bg-[#151515] rounded-3xl overflow-hidden border
                  transition-all duration-300
                  ${isDoable
                    ? 'cursor-pointer border-white/5 hover:border-orange-500/50 hover:shadow-2xl hover:-translate-y-1'
                    : 'cursor-not-allowed border-red-500/10 opacity-70 grayscale'}`}
    >
      <div className="h-48 bg-[#1a1a1a] relative">
        {/* ✅ Fix : onError bascule sur fallback SVG inline — zéro 404 */}
        <img
          src={imgError || !recipe.image_url ? FALLBACK_IMG : recipe.image_url}
          alt={recipe.name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#151515] to-transparent" />
        <div className="absolute bottom-4 left-6">
          <h3 className="text-2xl font-bold text-white">{recipe.name}</h3>
          {recipe.sale_price != null
            ? <p className="text-orange-400 font-mono font-bold">{recipe.sale_price.toFixed(2)} €</p>
            : recipe.price > 0
              ? <p className="text-orange-400 font-mono font-bold">{recipe.price.toFixed(2)} €</p>
              : null}
        </div>
        <div className="absolute top-4 right-4">
          {isDoable
            ? <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">DISPO</div>
            : <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">MANQUANT</div>
          }
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="flex flex-wrap gap-2 mb-6">
          {recipe.ingredients.slice(0, 3).map(ing => (
            <span
              key={ingName(ing)}
              className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-md border border-white/5"
            >
              {ingName(ing)}
            </span>
          ))}
        </div>
        <button
          className={`w-full py-4 rounded-xl font-bold text-sm tracking-widest transition-all
                      flex items-center justify-center gap-2
                      ${!isDoable
                        ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                        : 'bg-white text-black group-hover:bg-orange-500 group-hover:text-white'}`}
        >
          {!isDoable
            ? "INGRÉDIENTS MANQUANTS"
            : <><span>DÉCOUVRIR</span><ArrowRight size={16} /></>
          }
        </button>
      </div>
    </div>
  );
}