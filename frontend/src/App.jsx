import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Lab from './pages/Lab';
import Settings from './pages/Settings';
import TestMachine from './pages/TestMachine';
import SmartBar from './pages/SmartBar'; 
import CocktailPage from './pages/CocktailPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="lab" element={<Lab />} />
          <Route path="settings" element={<Settings />} />
          <Route path="/test3d" element={<TestMachine />} />
          <Route path="bar" element={<SmartBar />} />
          <Route path="/cocktail/:id" element={<CocktailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;