import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext'; // Note: vérifie le chemin exact

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
import StockPage   from './pages/StockPage'; // 🆕 Réserve
import QueuePage   from './pages/QueuePage'; // 🆕 File d'attente

// 🔒 VERROU UTILISATEUR : Nécessite un badge pour accéder à la page
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useUser();
  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-[#0a0a0a] text-orange-500 font-mono animate-pulse">VÉRIFICATION BADGE...</div>;
  }
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              {/* --- Pages Publiques --- */}
              <Route index element={<Dashboard />} />
              <Route path="bar"          element={<SmartBar />} />
              <Route path="cocktail/:id" element={<CocktailPage />} />
              <Route path="lab"          element={<Lab />} />
              <Route path="queue"        element={<QueuePage />} /> {/* 🆕 Nouvelle route */}

              {/* --- Pages Protégées (Badge requis) --- */}
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

              {/* --- Pages Admin (Carte Patron requise) --- */}
              <Route path="settings" element={
                <AdminRoute><Settings /></AdminRoute>
              } />
              <Route path="test3d" element={
                <AdminRoute><TestMachine /></AdminRoute>
              } />
              <Route path="stock" element={
                <AdminRoute><StockPage /></AdminRoute>
              } />
            </Route>
          </Routes>
        </BrowserRouter>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;