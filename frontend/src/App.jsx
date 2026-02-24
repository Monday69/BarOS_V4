import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';

import Layout      from './components/Layout';
import Dashboard   from './pages/Dashboard';
import Lab         from './pages/Lab';
import Settings    from './pages/Settings';
import TestMachine from './pages/TestMachine';
import SmartBar    from './pages/SmartBar';
import CocktailPage from './pages/CocktailPage';
import ProfilePage from './pages/ProfilePage';
import AdminRoute  from './components/AdminRoute';

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="bar"          element={<SmartBar />} />
            <Route path="cocktail/:id" element={<CocktailPage />} />
            <Route path="profile"      element={<ProfilePage />} />
            <Route path="lab"          element={<Lab />} />

            {/* Pages protégées — nécessitent la carte admin */}
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