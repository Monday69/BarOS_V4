import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; // N'oublie pas d'importer Navigate
import { UserProvider, useUser } from './context/UserContext'; // Import de useUser

import Layout      from './components/Layout';
import Dashboard   from './pages/Dashboard';
import Lab         from './pages/Lab';
import Settings    from './pages/Settings';
import TestMachine from './pages/TestMachine';
import SmartBar    from './pages/SmartBar';
import CocktailPage from './pages/CocktailPage';
import ProfilePage from './pages/ProfilePage';
import AdminRoute  from './components/AdminRoute';
import PaymentPage from './pages/PaymentPage';

// 🔒 NOUVEAU VERROU : Protège les pages pour qu'elles nécessitent un badge
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useUser();

  // On attend un instant que le localStorage soit lu (évite un flash de redirection)
  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-[#0a0a0a] text-orange-500 font-mono animate-pulse">VÉRIFICATION BADGE...</div>;
  }

  // Si aucun utilisateur n'est connecté, on le renvoie à l'accueil
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Si tout est bon, on affiche la page demandée
  return children;
};

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* Pages publiques (Consultation du menu) */}
            <Route index element={<Dashboard />} />
            <Route path="bar"          element={<SmartBar />} />
            <Route path="cocktail/:id" element={<CocktailPage />} />
            <Route path="lab"          element={<Lab />} />

            {/* Pages protégées — nécessitent d'être connecté avec un badge */}
            <Route path="payment" element={
              <ProtectedRoute><PaymentPage /></ProtectedRoute>
            } />
            <Route path="payment/success" element={
              <ProtectedRoute><PaymentPage /></ProtectedRoute>
            } />
            <Route path="payment/cancel" element={
              <ProtectedRoute><PaymentPage /></ProtectedRoute>
            } />
            <Route path="profile" element={
              <ProtectedRoute><ProfilePage /></ProtectedRoute>
            } />

            {/* Pages très protégées — nécessitent la carte Patron/Admin */}
            <Route path="settings" element={
              <AdminRoute><Settings /></AdminRoute>
            } />
            <Route path="test3d" element={
              <AdminRoute><TestMachine /></AdminRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;