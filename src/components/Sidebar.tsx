import { useState, useEffect } from 'react';
import { Home, CalendarDays, Calendar, Users, Settings as SettingsIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';

export function Sidebar() {
  const location = useLocation();
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [caption, setCaption] = useState('Buchungssystem Mozarthaus');
  const [fontSize, setFontSize] = useState('text-xl');

  useEffect(() => {
    const docRef = doc(db, `apps/${APP_ID}/settings`, 'general');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.logoBase64) setLogoBase64(data.logoBase64);
        else setLogoBase64(null);

        if (data.sidebarCaption !== undefined) setCaption(data.sidebarCaption);
        if (data.sidebarFontSize !== undefined) setFontSize(data.sidebarFontSize);
      } else {
        setLogoBase64(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Events', path: '/events', icon: CalendarDays },
    { name: 'Buchungen', path: '/bookings', icon: Calendar },
    { name: 'Partner', path: '/partners', icon: Users },
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
        <h1 className={`font-heading text-brand-primary ${fontSize} font-bold leading-tight`}>
          {caption}
        </h1>
      </div>
      
      <div className="border-t border-gray-400 mx-4"></div>

      {/* Middle Area */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
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
      <div className="p-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500"></div>
        <span className="text-xs text-gray-700">System Online</span>
      </div>
    </div>
  );
}
