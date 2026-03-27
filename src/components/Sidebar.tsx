import { useState, useEffect } from 'react';
import { CalendarDays, Calendar, Users, Settings as SettingsIcon, LayoutDashboard, Ticket, Columns, ChevronDown, ChevronRight, BarChart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { useN8nActions } from '../hooks/useN8nActions';
import { logout } from '../services/firebase/authService';
import { LogOut } from 'lucide-react';

export function Sidebar() {
  const location = useLocation();
  const { isSyncing } = useN8nActions();
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [isStammdatenOpen, setIsStammdatenOpen] = useState(false);

  useEffect(() => {
    if (location.pathname.startsWith('/stammdaten')) {
      setIsStammdatenOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const docRef = doc(db, `apps/${APP_ID}/settings`, 'general');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.logoBase64) setLogoBase64(data.logoBase64);
        else setLogoBase64(null);

        // Update favicon dynamically
        if (data.faviconBase64) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.faviconBase64;
        }
      } else {
        setLogoBase64(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Neue Reservierung', path: '/new-booking', icon: Ticket },
    { name: 'Events / Termine', path: '/events', icon: CalendarDays },
    { name: 'Status', path: '/kanban', icon: Columns },
    { name: 'Transaktions-Log', path: '/bookings', icon: Calendar },
    { name: 'Statistiken', path: '/statistics', icon: BarChart },
    { 
      name: 'Stammdaten', 
      icon: Users,
      subItems: [
        { name: 'Partner', path: '/stammdaten/partner' },
        { name: 'Partner Typen', path: '/stammdaten/partner-types' },
        { name: 'Musiker', path: '/stammdaten/musiker' },
        { name: 'Mitarbeiter', path: '/stammdaten/mitarbeiter' },
        { name: 'Preise & Kategorien', path: '/stammdaten/pricing' }
      ]
    },
    // { name: 'Tasks', path: '/tasks', icon: undefined }, // Hidden for now
    { name: 'Einstellungen', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-brand-sidebar border-r border-gray-400 flex flex-col z-20">
      {/* Top Area */}
      <div className="p-6 flex flex-col gap-4">
        {logoBase64 ? (
          <img 
            src={logoBase64} 
            alt="Konzerte im Mozarthaus Logo" 
            className="w-full object-contain mb-2"
          />
        ) : (
          <div className="h-10 w-10 bg-brand-primary rounded-md flex items-center justify-center text-white font-bold text-xl">
            MH
          </div>
        )}
      </div>
      
      <div className="border-t border-gray-400 mx-4"></div>

      {/* Middle Area */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          
          if (item.subItems) {
            const isActive = item.subItems.some(sub => location.pathname === sub.path);
            return (
              <div key={item.name} className="space-y-1">
                <button
                  onClick={() => setIsStammdatenOpen(!isStammdatenOpen)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                    isActive 
                      ? 'bg-white/50 text-brand-primary font-medium' 
                      : 'text-gray-800 hover:text-brand-primary hover:bg-white/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </div>
                  {isStammdatenOpen ? <ChevronDown className="w-4 h-4 text-brand-primary" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </button>
                
                {isStammdatenOpen && (
                  <div className="ml-9 space-y-1 mt-1">
                    {item.subItems.map(subItem => {
                      const isSubActive = location.pathname === subItem.path;
                      return (
                        <Link
                          key={subItem.name}
                          to={subItem.path}
                          className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                            isSubActive 
                              ? 'text-brand-primary font-bold bg-white/60' 
                              : 'text-gray-600 hover:text-brand-primary hover:bg-white/30'
                          }`}
                        >
                          {subItem.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive 
                  ? 'bg-white/50 text-brand-primary font-medium' 
                  : 'text-gray-800 hover:text-brand-primary hover:bg-white/30'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Area */}
      <div className="border-t border-gray-400 mx-4"></div>
      <div className="p-4 flex flex-col gap-3">
        {/* Core System Status */}
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse ring-2 ring-green-500/30"></div>
          <span className="text-sm font-medium text-gray-700 tracking-tight">System Online</span>
        </div>
        
        {/* n8n Automations Sync Pulse */}
        <div className={`flex items-center gap-2 transition-opacity duration-300 ${isSyncing ? 'opacity-100' : 'opacity-40'}`}>
          <div className={`w-2.5 h-2.5 rounded-full ${isSyncing ? 'bg-blue-500 animate-ping' : 'bg-gray-400'}`}></div>
          <span className={`text-xs font-bold ${isSyncing ? 'text-blue-700' : 'text-gray-500'}`}>
            {isSyncing ? 'n8n Sync Active' : 'n8n Sync Idle'}
          </span>
        </div>

        {/* Logout Button */}
        <button
          onClick={async () => {
            try {
              await logout();
            } catch (err) {
              console.error('Logout failed:', err);
            }
          }}
          className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-white/50 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-md transition-colors text-sm font-bold border border-gray-200 hover:border-red-200"
        >
          <LogOut className="w-4 h-4" />
          Abmelden
        </button>
      </div>
    </div>
  );
}
