import { User } from 'lucide-react';

export function Header() {
  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-brand-sidebar border-b border-gray-400 flex items-center justify-between px-8 z-10">
      <h2 className="text-lg font-heading text-gray-900 font-medium">Übersicht</h2>
      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full bg-white/50 hover:bg-white/80 transition-colors">
          <User className="w-5 h-5 text-gray-800" />
        </button>
      </div>
    </header>
  );
}
