import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wine, FlaskConical, Settings, Power } from 'lucide-react';

const Layout = () => {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'La Carte', path: '/menu', icon: Wine },
    { name: 'Labo', path: '/lab', icon: FlaskConical },
    { name: 'Réglages', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background text-textMain overflow-hidden font-sans">
      
      {/* SIDEBAR (Gauche) */}
      <div className="w-24 flex flex-col items-center py-8 bg-surface/50 backdrop-blur-md border-r border-white/5 z-50">
        
        {/* Logo */}
        <div className="mb-12">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-amber-700 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            <span className="font-mono font-bold text-xl text-black">B4</span>
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
                    ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(245,158,11,0.1)]' 
                    : 'text-textMuted hover:text-textMain hover:bg-white/5'
                }`}
              >
                <Icon size={24} strokeWidth={1.5} />
                
                {/* Tooltip au survol */}
                <span className="absolute left-14 bg-surface border border-white/10 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {item.name}
                </span>

                {/* Barre active */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bouton Power (Bas) */}
        <button className="mt-auto p-4 text-danger/70 hover:text-danger hover:bg-danger/10 rounded-xl transition-colors">
          <Power size={24} />
        </button>
      </div>

      {/* ZONE DE CONTENU PRINCIPALE (Droite) */}
      <div className="flex-1 relative overflow-auto">
        {/* Effet de fond global */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.05),_transparent_40%)] pointer-events-none" />
        
        <main className="p-8 h-full">
          {/* C'est ici que les pages vont changer */}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;