import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Wine, ArrowLeft, Sparkles, GlassWater, ArrowRight,
  AlertCircle, Shuffle, Star, SlidersHorizontal, Eye, EyeOff,
  TrendingUp, ArrowUpAZ, Euro, XCircle, Heart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { API_BASE_URL } from '../apiConfig';

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23151515'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23333' font-size='48'%3E🍹%3C/text%3E%3C/svg%3E";

const ingName = (ing) => (typeof ing === 'string' ? ing : ing?.name ?? '');

const SORT_OPTIONS = [
  { key: 'availability', label: 'Disponibilité', icon: GlassWater },
  { key: 'favorites',    label: 'Mes favoris',   icon: Heart       },
  { key: 'rating',       label: 'Note',          icon: Star        },
  { key: 'popularity',   label: 'Popularité',    icon: TrendingUp  },
  { key: 'price',        label: 'Prix',          icon: Euro        },
  { key: 'alpha',        label: 'A → Z',         icon: ArrowUpAZ   },
];

export default function SmartBar() {
  const navigate = useNavigate();
  const { user, favorites } = useUser();

  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [recipes, setRecipes]                           = useState([]);
  const [allRatings, setAllRatings]                     = useState({});
  const [orderCounts, setOrderCounts]                   = useState({});
  const [loading, setLoading]                           = useState(true);
  const [error, setError]                               = useState(null);
  const [selectedBase, setSelectedBase]                 = useState(null);
  const [surpriseId, setSurpriseId]                     = useState(null);
  const [sortBy, setSortBy]                             = useState('availability');
  const [sortDesc, setSortDesc]                         = useState(true);
  const [showUnavailable, setShowUnavailable]           = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly]       = useState(false);
  const [showFilters, setShowFilters]                   = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configRes, recipesRes, ratingsRes, ordersRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/machine/status`),
          axios.get(`${API_BASE_URL}/cocktails/?available_only=false&limit=200`),
          axios.get(`${API_BASE_URL}/cocktails/ratings/all`),
          axios.get(`${API_BASE_URL}/cocktails/order-counts`).catch(() => ({ data: {} })),
        ]);

        const machineStock = Object.values(configRes.data.slots || {})
          .map(slot => slot.name)
          .filter(name => name && name !== "Vide");

        setAvailableIngredients([...new Set(machineStock)]);
        setRecipes(recipesRes.data);
        setAllRatings(ratingsRes.data);
        setOrderCounts(ordersRes.data);
      } catch (err) {
        console.error("Erreur chargement Bar:", err);
        setError("Impossible de charger les données. L'API est-elle démarrée ?");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getIngredientStatus = (recipe) => {
    const ings = recipe.ingredients || [];
    if (!ings.length) return { doable: false, present: [], missing: [], pct: 0 };
    const present = ings.filter(ing => availableIngredients.includes(ingName(ing)));
    const missing = ings.filter(ing => !availableIngredients.includes(ingName(ing)));
    return {
      doable: missing.length === 0,
      present,
      missing,
      pct: Math.round((present.length / ings.length) * 100),
    };
  };

  const isRecipeDoable = (recipe) => getIngredientStatus(recipe).doable;

  const doableRecipes = useMemo(
    () => recipes.filter(isRecipeDoable),
    [recipes, availableIngredients]
  );

  // ── Suggestions du Chef — favoris de l'user boostés en priorité ──────────
  const featuredRecipes = useMemo(() => {
    if (!doableRecipes.length) return [];
    return [...doableRecipes]
      .sort((a, b) => {
        const aIsFav = favorites.includes(a.id) ? 1 : 0;
        const bIsFav = favorites.includes(b.id) ? 1 : 0;
        if (bIsFav !== aIsFav) return bIsFav - aIsFav; // favoris en tête
        const rA = allRatings[a.id]?.average ?? 0;
        const rB = allRatings[b.id]?.average ?? 0;
        if (rB !== rA) return rB - rA;
        return (a.id * 9301 + 49297) % 233280 - (b.id * 9301 + 49297) % 233280;
      })
      .slice(0, 3);
  }, [doableRecipes, allRatings, favorites]);

  const filteredAndSorted = useMemo(() => {
    if (!selectedBase) return [];
    let list = recipes.filter(r => r.ingredients?.some(ing => ingName(ing) === selectedBase));
    if (!showUnavailable) list = list.filter(r => isRecipeDoable(r));
    if (showFavoritesOnly) list = list.filter(r => favorites.includes(r.id));

    const m = sortDesc ? 1 : -1;

    return [...list].sort((a, b) => {
      const sA = getIngredientStatus(a);
      const sB = getIngredientStatus(b);
      const rA = allRatings[a.id]?.average ?? 0;
      const rB = allRatings[b.id]?.average ?? 0;
      const aFav = favorites.includes(a.id) ? 1 : 0;
      const bFav = favorites.includes(b.id) ? 1 : 0;

      switch (sortBy) {
        case 'availability': return m * (sB.pct !== sA.pct ? sB.pct - sA.pct : rB - rA);
        case 'favorites':    return m * (bFav - aFav || rB - rA);
        case 'rating':       return m * (rB - rA);
        case 'popularity':   return m * ((orderCounts[b.id] ?? 0) - (orderCounts[a.id] ?? 0));
        case 'price':        return m * ((a.price ?? 0) - (b.price ?? 0));
        case 'alpha':        return m * a.name.localeCompare(b.name, 'fr');
        default:             return 0;
      }
    });
  }, [selectedBase, recipes, availableIngredients, showUnavailable, showFavoritesOnly, sortBy, sortDesc, allRatings, orderCounts, favorites]);

  const handleSurprise = () => {
    if (!doableRecipes.length) return;
    // Surprise : pioche dans les favoris dispo en priorité
    const pool = doableRecipes.filter(r => favorites.includes(r.id));
    const pick = (pool.length ? pool : doableRecipes)[Math.floor(Math.random() * (pool.length || doableRecipes.length))];
    setSurpriseId(pick.id);
    setTimeout(() => navigate(`/cocktail/${pick.id}`), 600);
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center dark:text-white text-gray-900">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto" />
        <p className="dark:text-gray-400 text-gray-600 animate-pulse font-medium">Ouverture du Bar…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="h-screen flex items-center justify-center dark:text-white text-gray-900">
      <div className="text-center space-y-3 max-w-sm">
        <AlertCircle size={40} className="text-red-500 mx-auto" />
        <p className="text-red-500 font-semibold">{error}</p>
      </div>
    </div>
  );

  const favCount = recipes.filter(r => favorites.includes(r.id)).length;

  return (
    <div className="min-h-screen bg-transparent dark:text-white text-gray-900 p-6 pb-24 overflow-y-auto transition-colors duration-300">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">BarOS</span>
            <span className="dark:text-white text-gray-900 transition-colors">Lounge</span>
          </h1>
          <p className="dark:text-gray-400 text-gray-600 text-sm mt-1 font-medium transition-colors">
            {availableIngredients.length} bouteilles connectées · {doableRecipes.length} recettes disponibles
            {user && favCount > 0 && (
              <span className="text-red-400 ml-2">· {favCount} ❤️</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {doableRecipes.length > 0 && (
            <button
              onClick={handleSurprise}
              className={`group flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all duration-300 border
                ${surpriseId
                  ? 'bg-orange-500 border-orange-400 text-white scale-95'
                  : 'bg-orange-500/10 border-orange-500/30 text-orange-500 hover:bg-orange-500 hover:text-white hover:border-orange-500 hover:scale-105'}`}
            >
              <Shuffle size={17} className={`transition-transform duration-500 ${surpriseId ? 'animate-spin' : 'group-hover:rotate-180'}`} />
              {surpriseId ? 'Choix en cours…' : 'Surprise !'}
            </button>
          )}
          <div className="p-3 bg-white dark:bg-white/5 shadow-sm rounded-full border border-black/5 dark:border-white/5">
            <Wine size={28} className="text-orange-500" />
          </div>
        </div>
      </div>

      {!selectedBase ? (
        <div className="space-y-12">

          {/* ── Suggestions (boostées par favoris) ── */}
          {featuredRecipes.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="text-yellow-500 dark:text-yellow-400" size={20} />
                <h2 className="text-xl font-bold dark:text-gray-200 text-gray-800">
                  {user && favorites.length > 0 ? 'Pour toi ce soir' : 'Suggestions du Chef'}
                </h2>
                {user && favorites.length > 0 && (
                  <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">
                    ❤️ basé sur tes favoris
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredRecipes.map(recipe => (
                  <CocktailCard
                    key={recipe.id}
                    recipe={recipe}
                    status={getIngredientStatus(recipe)}
                    rating={allRatings[recipe.id]}
                    isFavorite={favorites.includes(recipe.id)}
                    highlighted={recipe.id === surpriseId}
                    onClick={() => navigate(`/cocktail/${recipe.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Grille bouteilles ── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <GlassWater className="text-blue-500 dark:text-blue-400" size={20} />
              <h2 className="text-xl font-bold dark:text-gray-200 text-gray-800">Quelle est votre envie ?</h2>
            </div>
            {availableIngredients.length === 0 ? (
              <div className="p-8 border border-dashed border-black/10 dark:border-white/10 rounded-2xl text-center text-gray-400">
                <AlertCircle className="mx-auto mb-2" />
                Aucune bouteille connectée. Configurez la machine d'abord.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {availableIngredients.map(name => (
                  <button
                    key={name}
                    onClick={() => setSelectedBase(name)}
                    className="group relative h-32 rounded-2xl bg-white dark:bg-[#151515] border border-black/5 dark:border-white/5
                               hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-white/5 transition-all
                               flex flex-col items-center justify-center gap-3 overflow-hidden shadow-sm"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/[0.02] dark:to-black/50" />
                    <div className="relative z-10 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-500 group-hover:scale-110 transition-transform">
                      <GlassWater size={20} />
                    </div>
                    <span className="relative z-10 font-bold text-sm text-center px-2 dark:text-white text-gray-800">{name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

      ) : (
        <div>
          <button
            onClick={() => setSelectedBase(null)}
            className="mb-6 flex items-center gap-2 dark:text-gray-400 text-gray-500 dark:hover:text-white hover:text-black transition-colors font-medium"
          >
            <ArrowLeft size={20} /> Retour aux choix
          </button>

          {/* Titre + contrôles */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-3xl font-bold dark:text-white text-gray-900">
              Cocktails à base de{' '}
              <span className="text-orange-500 underline decoration-orange-500/30">{selectedBase}</span>
            </h2>

            <div className="flex items-center gap-2">
              {/* Toggle favoris seulement — visible uniquement si user connecté avec favoris */}
              {user && favCount > 0 && (
                <button
                  onClick={() => setShowFavoritesOnly(v => !v)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all
                    ${showFavoritesOnly
                      ? 'bg-red-500/20 border-red-500/40 text-red-400'
                      : 'bg-white/5 border-white/10 dark:text-gray-300 text-gray-600 hover:border-red-500/30'}`}
                >
                  <Heart size={14} className={showFavoritesOnly ? 'fill-red-400' : ''} />
                  Favoris
                </button>
              )}

              {/* Toggle dispo */}
              <button
                onClick={() => setShowUnavailable(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all
                  ${!showUnavailable
                    ? 'bg-orange-500/10 border-orange-500/40 text-orange-500'
                    : 'bg-white/5 border-white/10 dark:text-gray-300 text-gray-600 hover:border-orange-500/40'}`}
              >
                {showUnavailable ? <Eye size={15} /> : <EyeOff size={15} />}
                {showUnavailable ? 'Tous' : 'Dispo'}
              </button>

              {/* Toggle panneau tri */}
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all
                  ${showFilters
                    ? 'bg-orange-500 border-orange-400 text-white'
                    : 'bg-white/5 border-white/10 dark:text-gray-300 text-gray-600 hover:border-orange-500/40'}`}
              >
                <SlidersHorizontal size={15} /> Trier
              </button>

              {/* Inversion ordre */}
              <button
                onClick={() => setSortDesc(v => !v)}
                title={sortDesc ? 'Passer en ordre croissant' : 'Passer en ordre décroissant'}
                className="flex items-center justify-center w-10 h-10 rounded-xl border bg-white/5 border-white/10 dark:text-gray-300 text-gray-600 hover:border-orange-500/40 hover:text-orange-500 transition-all text-lg font-bold"
              >
                {sortDesc ? '↓' : '↑'}
              </button>
            </div>
          </div>

          {/* Panneau tri */}
          {showFilters && (
            <div className="mb-5 flex flex-wrap gap-2 p-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
              {SORT_OPTIONS
                // Masquer "Mes favoris" si pas connecté
                .filter(opt => opt.key !== 'favorites' || (user && favorites.length > 0))
                .map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => { setSortBy(opt.key); setSortDesc(true); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border
                        ${sortBy === opt.key
                          ? opt.key === 'favorites'
                            ? 'bg-red-500/30 border-red-400 text-red-300'
                            : 'bg-orange-500 border-orange-400 text-white'
                          : 'bg-white/5 border-white/10 dark:text-gray-400 text-gray-500 hover:text-white hover:border-orange-500/40'}`}
                    >
                      <Icon size={14} /> {opt.label}
                    </button>
                  );
              })}
            </div>
          )}

          {/* Compteur */}
          <p className="text-xs dark:text-gray-500 text-gray-400 mb-4 font-medium">
            {filteredAndSorted.length} cocktail{filteredAndSorted.length > 1 ? 's' : ''}
            {!showUnavailable ? ' disponibles' : ''}
            {showFavoritesOnly ? ' · ❤️ favoris seulement' : ''}
            {' · '}trié par{' '}
            <span className="text-orange-400">{SORT_OPTIONS.find(o => o.key === sortBy)?.label}</span>
            {' '}{sortDesc ? '↓' : '↑'}
          </p>

          {filteredAndSorted.length === 0 ? (
            <div className="text-center py-20 text-gray-400 dark:text-gray-500 font-medium">
              {showFavoritesOnly
                ? "Aucun favori à base de cet ingrédient."
                : "Aucune recette connue n'utilise cet ingrédient."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSorted.map(recipe => (
                <CocktailCard
                  key={recipe.id}
                  recipe={recipe}
                  status={getIngredientStatus(recipe)}
                  rating={allRatings[recipe.id]}
                  isFavorite={favorites.includes(recipe.id)}
                  orderCount={orderCounts[recipe.id] ?? 0}
                  onClick={() => navigate(`/cocktail/${recipe.id}`)}
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

function CocktailCard({ recipe, status, onClick, highlighted = false, rating = null, orderCount = 0, isFavorite = false }) {
  const [imgError, setImgError] = useState(false);
  const { doable, present, missing, pct } = status;

  return (
    <div
      onClick={doable ? onClick : undefined}
      className={`group relative bg-white dark:bg-[#151515] rounded-3xl overflow-hidden border
                  transition-all duration-300 shadow-sm dark:shadow-none
                  ${highlighted ? 'border-orange-500 scale-[1.02] shadow-xl shadow-orange-500/20' : ''}
                  ${isFavorite && !highlighted ? 'border-red-500/20' : ''}
                  ${doable
                    ? 'cursor-pointer border-black/5 dark:border-white/5 hover:border-orange-500/50 hover:shadow-xl hover:-translate-y-1'
                    : 'cursor-default border-red-500/10'}`}
    >
      {/* Image */}
      <div className={`h-48 bg-gray-100 dark:bg-[#1a1a1a] relative ${!doable ? 'grayscale opacity-60' : ''}`}>
        <img
          src={imgError || !recipe.image_url ? FALLBACK_IMG : recipe.image_url}
          alt={recipe.name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-[#151515] to-transparent" />

        <div className="absolute bottom-4 left-6">
          <h3 className="text-2xl font-bold dark:text-white text-gray-900">{recipe.name}</h3>
          {recipe.sale_price != null
            ? <p className="text-orange-600 dark:text-orange-400 font-mono font-bold">{recipe.sale_price.toFixed(2)} €</p>
            : recipe.price > 0
              ? <p className="text-orange-600 dark:text-orange-400 font-mono font-bold">{recipe.price.toFixed(2)} €</p>
              : null}
        </div>

        {/* Badge dispo + cœur favori */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {/* Badge cœur — visible si favori */}
          {isFavorite && (
            <div className="bg-red-500/20 backdrop-blur-md border border-red-500/20 p-1.5 rounded-full">
              <Heart size={13} className="text-red-400 fill-red-400" />
            </div>
          )}
          {doable
            ? <div className="bg-green-500/20 text-green-600 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border border-green-500/10">DISPO</div>
            : <div className="bg-red-500/20 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border border-red-500/10">{pct}% dispo</div>
          }
        </div>

        {/* Barre progression */}
        {!doable && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* Corps */}
      <div className="px-6 py-4">

        {/* Badges ingrédients */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {recipe.ingredients.map(ing => {
            const name = ingName(ing);
            const ok   = present.some(p => ingName(p) === name);
            return (
              <span
                key={name}
                className={`text-xs px-2 py-1 rounded-md border flex items-center gap-1
                  ${ok
                    ? 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 border-black/5 dark:border-white/5'
                    : 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'}`}
              >
                {!ok && <XCircle size={9} className="shrink-0" />}
                {name}
              </span>
            );
          })}
        </div>

        {/* Résumé manquants */}
        {!doable && missing.length > 0 && (
          <p className="text-xs text-red-400 font-medium mb-3">
            {missing.length === 1
              ? `Manque : ${ingName(missing[0])}`
              : `Manque ${missing.length} ingrédients`}
          </p>
        )}

        {/* Note + popularité */}
        <div className="flex items-center gap-1.5 mb-4 h-4">
          {rating?.average ? (
            <>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} size={11}
                    className={n <= Math.round(rating.average)
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-gray-300 dark:text-gray-700'} />
                ))}
              </div>
              <span className="text-amber-500 dark:text-amber-400 text-xs font-bold">{rating.average}</span>
              <span className="text-gray-400 dark:text-gray-600 text-xs">({rating.count})</span>
              {orderCount > 0 && (
                <span className="ml-auto text-gray-400 dark:text-gray-600 text-xs">{orderCount}x</span>
              )}
            </>
          ) : (
            <span className="text-gray-400 dark:text-gray-600 text-[10px] uppercase tracking-tighter">Nouveau</span>
          )}
        </div>

        {/* Bouton */}
        <button
          className={`w-full py-4 rounded-xl font-bold text-sm tracking-widest transition-all
                      flex items-center justify-center gap-2
                      ${!doable
                        ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'bg-gray-900 dark:bg-white text-white dark:text-black group-hover:bg-orange-500 group-hover:text-white'}`}
        >
          {!doable
            ? `MANQUE ${missing.length} INGRÉDIENT${missing.length > 1 ? 'S' : ''}`
            : <><span>DÉCOUVRIR</span><ArrowRight size={16} /></>
          }
        </button>
      </div>
    </div>
  );
}