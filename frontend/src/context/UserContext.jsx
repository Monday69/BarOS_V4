import React, { createContext, useState, useContext } from 'react';
import axios from 'axios';

const UserContext = createContext(null);

// ✅ Fix : ADMIN_CARD_UID "DEADBEEF" supprimé — le statut admin
// vient uniquement du champ is_admin retourné par le backend.
// Aucune logique admin ne doit reposer sur un UID hardcodé côté frontend.

export const UserProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [isAdmin, setIsAdmin]     = useState(false);

  // ── Scan carte NFC ──────────────────────────────────────────────────────────
  const scanCard = async (cardUid) => {
    setLoading(true);
    try {
      const res      = await axios.post('http://localhost:8000/api/users/scan', { card_uid: cardUid });
      const userData = res.data;

      setUser(userData);
      // ✅ Fix : is_admin vient du backend — pas d'un UID hardcodé
      setIsAdmin(!!userData.is_admin);
      await loadFavorites(userData.id);
      return { success: true, user: userData };

    } catch (error) {
      if (error.response?.status === 404) {
        return { success: false, new: true };
      }
      console.error("Erreur Scan:", error.message);
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
        card_uid:  cardUid,
        name,
        gender,
        weight_kg: weight,
        age,
        preferences
      });
      setUser(res.data);
      // ✅ Fix : idem — is_admin depuis le backend
      setIsAdmin(!!res.data.is_admin);
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