import { useState } from 'react';
import { seedRegiondoEvents } from '../../utils/seedRegiondoData';
import { Database, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

export function DataSeeder() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSeed = async () => {
    setStatus('loading');
    setMessage('Synchronisiere Regiondo Basisdaten...');
    try {
      await seedRegiondoEvents();
      setStatus('success');
      setMessage('Regiondo Daten erfolgreich in Firestore (event_templates) angelegt!');
      
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 4000);
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setMessage(error.message || 'Ein Fehler ist aufgetreten.');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 font-heading flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-400" />
            Regiondo Datenmodell synchronisieren
          </h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Importiert das statische Regiondo-Produktdatenmodell (Mozart Ensemble, Streichquartett, Preise, Varianten) über einen Seed-Vorgang fest in die FireStore Datenbank des aktiven App-Clients.
          </p>
        </div>
        <button
          onClick={handleSeed}
          disabled={status === 'loading'}
          className="bg-[#c02a2a] text-white font-bold py-2.5 px-6 rounded-lg hover:bg-red-800 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm whitespace-nowrap"
        >
          {status === 'loading' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Database className="w-5 h-5" />
          )}
          Basisdaten synchronisieren
        </button>
      </div>

      {status === 'success' && (
        <div className="mt-5 p-4 bg-green-50 text-green-800 rounded-lg flex items-center gap-2 border border-green-200 animate-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-5 p-4 bg-red-50 text-red-800 rounded-lg flex items-center gap-2 border border-red-200 animate-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}
    </div>
  );
}
