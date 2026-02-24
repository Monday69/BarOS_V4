import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wine, FlaskConical, Settings, Box, User, LogOut } from 'lucide-react';
import { useUser } from '../context/UserContext'; // 👈 Import du Context
import LoginModal from './LoginModal'; // 👈 Import du Modal

const Layout = () => {
  const location = useLocation();
  const { user, logout } = useUser(); // 👈 On récupère l'user
  const [isLoginOpen, setIsLoginOpen] = useState(false); // 👈 État du modal

  const navigation = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'La Carte', path: '/bar', icon: Wine },
    { name: 'Labo', path: '/lab', icon: FlaskConical },
    { name: 'Machine 3D', path: '/test3d', icon: Box },
    { name: 'Mon Profil', path: '/profile', icon: User },
    { name: 'Réglages', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden font-sans">
      
      {/* --- SIDEBAR (Menu Gauche) --- */}
      <div className="w-24 flex flex-col items-center py-8 bg-[#1e1e1e]/50 backdrop-blur-md border-r border-white/5 z-50">
        
        {/* Logo */}
        <div className="mb-12">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.3)]">
            <span className="font-mono font-bold text-xl text-white">B4</span>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 flex flex-col gap-8 w-full px-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.name} 
                to={item.path}
                className={`relative group flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={24} strokeWidth={1.5} />
                
                {/* Tooltip au survol */}
                <span className="absolute left-14 bg-[#2a2a2a] border border-white/10 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  {item.name}
                </span>

                {/* Barre active */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-500 rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* --- ZONE DE CONTENU PRINCIPALE (Droite) --- */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Effet de fond global */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(124,58,237,0.1),_transparent_40%)] pointer-events-none" />
        
        {/* HEADER DU HAUT (Pour le Login) */}
        <div className="absolute top-6 right-8 z-50 flex items-center gap-4">
             {user ? (
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
                    <Link to="/profile" className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer">
                        Salut, <span className="font-bold text-white">{user.name}</span>
                    </Link>
                    <button onClick={logout} className="p-2 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500/20 transition-all" title="Déconnexion">
                        <LogOut size={16} />
                    </button>
                </div>
            ) : (
                <button 
                    onClick={() => setIsLoginOpen(true)} 
                    className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all text-sm font-bold shadow-lg backdrop-blur-md"
                >
                    <User size={18} /> <span>Connexion</span>
                </button>
            )}
        </div>

        {/* Le contenu des pages change ici */}
        <main className="flex-1 overflow-auto p-8 relative z-10">
          <Outlet />
        </main>
      </div>

      {/* --- MODAL DE CONNEXION --- */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

    </div>
  );
};

export default Layout;