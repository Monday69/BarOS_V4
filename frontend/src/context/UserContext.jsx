import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';

const UserContext = createContext(null);
const USERS_API = `${API_BASE_URL}/users`;

// 🕒 Durée de la session : 12 heures (en millisecondes)
const SESSION_DURATION = 12 * 60 * 60 * 1000;

export const UserProvider = ({ children }) => {
  const [user,        setUser]        = useState(null);
  const [favorites,   setFavorites]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  // ── Restaurer la session avec vérification d'expiration ───────────────────
  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem('baros_user');
      if (saved) {
        try {
          const sessionData = JSON.parse(saved);
          
          // 🚨 Vérifier si la session a expiré
          const now = Date.now();
          if (sessionData.expiresAt && now > sessionData.expiresAt) {
            console.log("⌛ Session BarOS expirée. Déconnexion automatique.");
            localStorage.removeItem('baros_user');
            setUser(null);
          } else {
            // Session valide, on restaure
            const userData = sessionData.user;
            setUser(userData);
            setIsAdmin(!!userData.is_admin);
            await loadFavorites(userData.id);
          }
        } catch (error) {
          console.error('Erreur restauration session:', error);
          localStorage.removeItem('baros_user');
        }
      }
      setLoading(false);
    };
    restore();
  }, []);

  // ── Badge NFC → retourne les infos sans connecter (PIN requis) ───────────
  const scanCard = async (cardUid) => {
    setLoading(true);
    try {
      const res      = await axios.post(`${USERS_API}/scan`, { card_uid: cardUid });
      const userData = res.data;
      setPendingUser(userData);
      return {
        success:      true,
        requires_pin: true,
        has_pin:      userData.has_pin,
        user:         userData,
      };
    } catch (error) {
      if (error.response?.status === 404) return { success: false, new: true };
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // ── PIN correct → finaliser la connexion avec date d'expiration ──────────
  const confirmPin = async (verifiedUser) => {
    // On calcule la date d'expiration
    const expiry = Date.now() + SESSION_DURATION;
    
    // On prépare l'objet de stockage
    const sessionData = {
      user: verifiedUser,
      expiresAt: expiry
    };

    setUser(verifiedUser);
    setIsAdmin(!!verifiedUser.is_admin);
    setPendingUser(null);
    
    // On sauvegarde l'objet complet (user + expiration)
    localStorage.setItem('baros_user', JSON.stringify(sessionData)); 
    await loadFavorites(verifiedUser.id);
  };

  const cancelPin = () => setPendingUser(null);

  // ── Inscription ───────────────────────────────────────────────────────────
  const register = async (cardUid, name, gender, weight, age, preferences) => {
    setLoading(true);
    try {
      const res = await axios.post(`${USERS_API}/register`, {
        card_uid: cardUid, name, gender,
        weight_kg: weight, age, preferences,
      });
      setPendingUser({ ...res.data, has_pin: false });
      return true;
    } catch (error) {
      console.error('Erreur Inscription', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ── Favoris ───────────────────────────────────────────────────────────────
  const loadFavorites = async (userId) => {
    try {
      const res = await axios.get(`${USERS_API}/${userId}/favorites`);
      setFavorites(res.data.map(f => f.recipe.id));
    } catch (err) {
      console.error('Erreur chargement favoris', err);
    }
  };

  const toggleFavorite = async (cocktailId) => {
    if (!user) return;
    const isFav = favorites.includes(cocktailId);
    setFavorites(isFav ? favorites.filter(id => id !== cocktailId) : [...favorites, cocktailId]);
    try {
      if (isFav) {
        await axios.delete(`${USERS_API}/${user.id}/favorites/${cocktailId}`);
      } else {
        await axios.post(`${USERS_API}/${user.id}/favorites/${cocktailId}`);
      }
    } catch {
      loadFavorites(user.id);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    setUser(null);
    setFavorites([]);
    setIsAdmin(false);
    setPendingUser(null);
    localStorage.removeItem('baros_user');
  };

  return (
    <UserContext.Provider value={{
      user, pendingUser, favorites, isAdmin, loading,
      scanCard, confirmPin, cancelPin, register, toggleFavorite, logout,
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);