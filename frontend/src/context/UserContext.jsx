import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading]     = useState(true); // Commencer en chargement pour vérifier le localStorage
  const [isAdmin, setIsAdmin]     = useState(false);

  // ── 🔄 Persistance de la session ─────────────────────────────────────────────
  useEffect(() => {
    const checkPersistedUser = async () => {
      const savedUser = localStorage.getItem('baros_user');
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setIsAdmin(!!userData.is_admin);
          await loadFavorites(userData.id);
        } catch (e) {
          console.error("Erreur de lecture du stockage local", e);
          localStorage.removeItem('baros_user');
        }
      }
      setLoading(false);
    };
    checkPersistedUser();
  }, []);

  // ── Scan carte NFC ──────────────────────────────────────────────────────────
  const scanCard = async (cardUid) => {
    setLoading(true);
    try {
      const res      = await axios.post('http://localhost:8000/api/users/scan', { card_uid: cardUid });
      const userData = res.data;

      setUser(userData);
      setIsAdmin(!!userData.is_admin);
      
      // ✅ Sauvegarde dans le navigateur
      localStorage.setItem('baros_user', JSON.stringify(userData));
      
      await loadFavorites(userData.id);
      return { success: true, user: userData };
    } catch (error) {
      if (error.response?.status === 404) return { success: false, new: true };
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // ── Inscription ─────────────────────────────────────────────────────────────
  const register = async (cardUid, name, gender, weight, age, preferences) => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/api/users/register', {
        card_uid: cardUid,
        name, gender, weight_kg: weight, age, preferences
      });
      const userData = res.data;
      
      setUser(userData);
      setIsAdmin(!!userData.is_admin);
      
      // ✅ Sauvegarde dans le navigateur
      localStorage.setItem('baros_user', JSON.stringify(userData));
      
      setFavorites([]);
      return true;
    } catch (error) {
      console.error("Erreur Inscription", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ── Favoris ─────────────────────────────────────────────────────────────────
  const loadFavorites = async (userId) => {
    try {
      const res = await axios.get(`http://localhost:8000/api/users/${userId}/favorites`);
      setFavorites(res.data.map(f => f.recipe.id));
    } catch (err) {
      console.error("Erreur chargement favoris", err);
    }
  };

  const toggleFavorite = async (cocktailId) => {
    if (!user) return;
    const isFav = favorites.includes(cocktailId);
    setFavorites(isFav ? favorites.filter(id => id !== cocktailId) : [...favorites, cocktailId]);
    try {
      if (isFav) {
        await axios.delete(`http://localhost:8000/api/users/${user.id}/favorites/${cocktailId}`);
      } else {
        await axios.post(`http://localhost:8000/api/users/${user.id}/favorites/${cocktailId}`);
      }
    } catch (err) {
      console.error("Erreur sync favori", err);
      loadFavorites(user.id);
    }
  };

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = () => {
    setUser(null);
    setFavorites([]);
    setIsAdmin(false);
    // ✅ On vide le stockage local
    localStorage.removeItem('baros_user');
  };

  return (
    <UserContext.Provider value={{
      user, favorites, isAdmin,
      scanCard, register, toggleFavorite, logout, loading
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);