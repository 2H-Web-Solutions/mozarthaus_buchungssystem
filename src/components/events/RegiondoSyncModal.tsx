import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface RegiondoSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RegiondoSyncModal({ isOpen, onClose }: RegiondoSyncModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    setIsSyncing(true);
    
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL_REGIONDO_SYNC || 'https://n8n.2h-websolutions.de/webhook/regiondo-fetch-events';

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });

      if (!response.ok) {
        throw new Error('Netzwerk fehlerhaft');
      }

      toast.success('Regiondo Sync gestartet! Die leeren Termine werden im Hintergrund in Firebase importiert.');
      setStartDate('');
      setEndDate('');
      onClose();
    } catch (error) {
      console.error('Webhook Error:', error);
      toast.error('Fehler beim Auslösen des Regiondo-Syncs. Bitte prüfen Sie den n8n-Webhook.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6 border border-gray-100 shadow-xl">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
          <h2 className="text-xl font-heading text-brand-primary">Regiondo Synchronisation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSync} className="space-y-4 pt-2">
          <p className="text-sm text-gray-600 mb-4">
            Wähle den Zeitraum aus, für den leere Regiondo-Termine abgerufen und in Firebase importiert werden sollen.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Startdatum</label>
              <input 
                required 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enddatum</label>
              <input 
                required 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all" 
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors font-medium border border-transparent"
            >
              Abbrechen
            </button>
            <button 
              disabled={isSyncing} 
              type="submit" 
              style={{ backgroundColor: '#c02a2a' }}
              className="px-5 py-2 text-white rounded hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center min-w-[150px] font-medium shadow-sm hover:shadow"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Lädt...
                </>
              ) : 'Synchronisieren'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
