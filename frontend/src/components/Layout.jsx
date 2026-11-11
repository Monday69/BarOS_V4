import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Wine, FlaskConical, Settings, 
  Box, User, LogOut, Sun, Moon, Package, Users
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import LoginModal from './LoginModal';

const Layout = () => {
  const location = useLocation();
  const { user, logout } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const navigation = [
    { name: 'Dashboard',  path: '/',         icon: LayoutDashboard },
    { name: 'La Carte',   path: '/bar',      icon: Wine },
    { name: 'Labo',       path: '/lab',      icon: FlaskConical },
    { name: 'Machine 3D', path: '/test3d',   icon: Box,     adminOnly: true },
    { name: 'Réserve',    path: '/stock',    icon: Package, adminOnly: true },
    { name: 'File',       path: '/queue',    icon: Users },
    { name: 'Mon Profil', path: '/profile',  icon: User },
    { name: 'Réglages',   path: '/settings', icon: Settings, adminOnly: true },
  ];

  const isDark = theme === 'dark';

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-300 ${
      isDark ? 'bg-[#0a0a0a] text-white' : 'bg-gray-50 text-gray-900'
    }`}>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <div
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{ width: expanded ? '196px' : '72px' }}
        className={`relative hidden md:flex flex-col py-8 z-50 overflow-hidden shrink-0
          transition-[width] duration-300 ease-in-out
          ${isDark
            ? 'bg-[#1e1e1e]/50 border-white/5'
            : 'bg-white/80 border-black/5'
          } backdrop-blur-md border-r`}
      >
        {/* Logo */}
        <div className="flex items-center mb-10 px-4 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600
                          flex items-center justify-center shrink-0
                          shadow-[0_0_15px_rgba(124,58,237,0.3)]">
            <span className="font-mono font-bold text-base text-white">B4</span>
          </div>
          <span
            style={{
              opacity:    expanded ? 1 : 0,
              transform:  expanded ? 'translateX(0)' : 'translateX(-8px)',
              transition: 'opacity 150ms ease 60ms, transform 150ms ease 60ms',
            }}
            className="ml-3 font-black text-sm tracking-widest uppercase whitespace-nowrap
                       bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400"
          >
            BarOS
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto scrollbar-hide">
          {navigation.map((item) => {
            if (item.adminOnly && !user?.is_admin) return null;
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`relative flex items-center gap-3 px-2 py-3 rounded-xl
                  transition-colors duration-150 group
                  ${isActive
                    ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                    : isDark
                      ? 'text-gray-500 hover:text-white hover:bg-white/5'
                      : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50/50'
                  }`}
              >
                {/* Indicateur actif */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6
                                  bg-purple-500 rounded-r-full" />
                )}

                {/* Icône — position fixe, ne bouge jamais */}
                <span className="shrink-0 w-6 flex items-center justify-center ml-1">
                  <Icon size={20} strokeWidth={1.5} />
                </span>

                {/* Label — fade + slide depuis la gauche */}
                <span
                  style={{
                    opacity:    expanded ? 1 : 0,
                    transform:  expanded ? 'translateX(0)' : 'translateX(-6px)',
                    transition: 'opacity 150ms ease 80ms, transform 150ms ease 80ms',
                    pointerEvents: 'none',
                  }}
                  className="text-sm font-semibold whitespace-nowrap overflow-hidden"
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bouton thème */}
        <div className="px-3 mt-auto shrink-0">
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-3 w-full px-2 py-3 rounded-xl
              transition-colors duration-150
              ${isDark
                ? 'text-yellow-400 hover:bg-yellow-400/10'
                : 'text-indigo-600 hover:bg-indigo-600/10'
              }`}
          >
            <span className="shrink-0 w-6 flex items-center justify-center ml-1">
              {isDark ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
            </span>
            <span
              style={{
                opacity:    expanded ? 1 : 0,
                transform:  expanded ? 'translateX(0)' : 'translateX(-6px)',
                transition: 'opacity 150ms ease 80ms, transform 150ms ease 80ms',
                pointerEvents: 'none',
              }}
              className="text-sm font-semibold whitespace-nowrap"
            >
              {isDark ? 'Mode Clair' : 'Mode Sombre'}
            </span>
          </button>
        </div>
      </div>

      {/* ── ZONE PRINCIPALE ──────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden flex flex-col min-w-0">
        <div className={`absolute inset-0 pointer-events-none ${
          isDark
            ? 'bg-[radial-gradient(circle_at_top_right,_rgba(124,58,237,0.1),_transparent_40%)]'
            : 'bg-[radial-gradient(circle_at_top_right,_rgba(124,58,237,0.05),_transparent_40%)]'
        }`} />

        {/* Header utilisateur */}
        <div className="absolute top-4 right-4 md:top-6 md:right-8 z-50 flex items-center gap-4">
          {user ? (
            <div className={`flex items-center gap-3 backdrop-blur-md px-4 py-2 rounded-full border ${
              isDark ? 'bg-black/40 border-white/5' : 'bg-white/60 border-black/5 shadow-sm'
            }`}>
              <Link to="/profile" className={`text-sm transition-colors cursor-pointer ${
                isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-black'
              }`}>
                <span className="hidden sm:inline">Salut, </span><span className={`font-bold ${isDark ? 'text-white' : 'text-purple-600'}`}>{user.name}</span>
              </Link>
              <button
                onClick={logout}
                className="p-2 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500/20 transition-all"
                title="Déconnexion"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginOpen(true)}
              className={`flex items-center gap-2 px-5 py-3 border rounded-full transition-all
                text-sm font-bold shadow-lg backdrop-blur-md ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                  : 'bg-white border-black/5 hover:bg-gray-50 text-gray-900'
              }`}
            >
              <User size={18} /> <span className="hidden sm:inline">Connexion</span>
            </button>
          )}
        </div>

        <main className="flex-1 overflow-auto px-4 pt-20 pb-28 md:p-8 relative z-10">
          <Outlet />
        </main>

        {/* ── NAVIGATION MOBILE (barre du bas) ───────────────────────────── */}
        <nav className={`md:hidden fixed bottom-0 inset-x-0 z-50 flex items-center gap-1 px-2 py-2
          overflow-x-auto scrollbar-hide backdrop-blur-md border-t ${
          isDark ? 'bg-[#141414]/90 border-white/5' : 'bg-white/90 border-black/5'
        }`}>
          {navigation.map((item) => {
            if (item.adminOnly && !user?.is_admin) return null;
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex-1 min-w-[64px] flex flex-col items-center gap-1 py-1.5 rounded-xl text-[10px] font-semibold
                  ${isActive
                    ? 'text-purple-400 bg-purple-500/15'
                    : isDark ? 'text-gray-500' : 'text-gray-400'}`}
              >
                <Icon size={20} strokeWidth={1.5} />
                <span className="whitespace-nowrap">{item.name}</span>
              </Link>
            );
          })}
          <button
            onClick={toggleTheme}
            className={`min-w-[48px] flex flex-col items-center gap-1 py-1.5 text-[10px] font-semibold ${
              isDark ? 'text-amber-400' : 'text-purple-500'}`}
            title="Changer de thème"
          >
            {isDark ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
            <span>Thème</span>
          </button>
        </nav>
      </div>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
};

export default Layout;