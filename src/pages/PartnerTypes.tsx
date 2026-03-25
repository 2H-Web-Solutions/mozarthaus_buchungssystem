import { Users } from 'lucide-react';

export function PartnerTypes() {
  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-heading text-gray-900 font-bold flex items-center gap-3">
            <Users className="w-8 h-8 text-brand-primary" />
            Partner Typen
          </h1>
          <p className="text-gray-500 mt-1">Verwalten Sie hier die Typ-Kategorien für Ihre B2B-Partner.</p>
        </div>
      </div>
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <p className="text-gray-500">Diese Seite befindet sich im Aufbau.</p>
      </div>
    </div>
  );
}

export default PartnerTypes;
