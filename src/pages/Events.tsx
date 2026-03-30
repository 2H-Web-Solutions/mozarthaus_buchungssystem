import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, writeBatch, Timestamp, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Event } from '../types/schema';
import { BulkEventGenerator } from '../components/BulkEventGenerator';
import { RegiondoSyncModal } from '../components/events/RegiondoSyncModal';
import { CalendarPlus, RefreshCw, Trash2, CloudDownload } from 'lucide-react';
import { syncMissingEvents } from '../utils/syncEventsFromBookings';
import { deleteAllEvents } from '../utils/deleteAllEvents';
import { initializeEventSeats } from '../services/bookingService';

function EventOccupancy({ eventId }: { eventId: string }) {
  const [occupancy, setOccupancy] = useState({ booked: 0, total: 0 });

  useEffect(() => {
    // 1. Physische Sitze laden
    const unsubSeats = onSnapshot(collection(db, `apps/${APP_ID}/events/${eventId}/seats`), (snap) => {
      let total = 0;
      let seatsBooked = 0;
      snap.forEach(doc => {
        total++;
        if (doc.data().status !== 'available') {
          seatsBooked++;
        }
      });
      
      // 2. Gruppenbuchungen (ohne feste Sitze) laden und addieren
      const q = query(collection(db, `apps/${APP_ID}/bookings`), where('eventId', '==', eventId), where('status', '==', 'confirmed'));
      const unsubBookings = onSnapshot(q, (bookingSnap) => {
         let groupTickets = 0;
         bookingSnap.forEach(bDoc => {
            const b = bDoc.data();
            if (!b.seatIds || b.seatIds.length === 0) {
               if (b.groupPersons) {
                 groupTickets += b.groupPersons;
               } else if (b.tickets) {
                 b.tickets.forEach((t: any) => groupTickets += (t.quantity || 1));
               }
            }
         });
         setOccupancy({ booked: seatsBooked + groupTickets, total });
      });
      
      return () => unsubBookings();
    });
    return () => unsubSeats();
  }, [eventId]);

  if (occupancy.total === 0) return <span className="text-gray-400 text-sm">-</span>;

  const percentage = Math.round((occupancy.booked / occupancy.total) * 100) || 0;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
        {occupancy.booked} / {occupancy.total}
      </span>
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden hidden sm:block">
        <div 
          className={`h-full transition-all duration-500 ${percentage > 90 ? 'bg-red-500' : percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newRegiondoId, setNewRegiondoId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isRegiondoSyncModalOpen, setIsRegiondoSyncModalOpen] = useState(false);

  const handleDeleteAll = async () => {
    const confirm1 = window.confirm('ACHTUNG: Möchtest du wirklich ALLE Events und Sitzpläne löschen? (Buchungen bleiben erhalten)');
    if (!confirm1) return;
    
    const confirm2 = window.confirm('Bist du GANZ SICHER? Dies kann nicht rückgängig gemacht werden.');
    if (!confirm2) return;

    setIsDeletingAll(true);
    try {
      const count = await deleteAllEvents();
      alert(`${count} Events inkl. Sitzpläne wurden erfolgreich gelöscht!`);
      window.location.reload(); // Seite neu laden, um leere Liste zu zeigen
    } catch (error) {
      console.error(error);
      alert('Fehler beim Löschen der Events.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleSync = async () => {
    if (!window.confirm('Möchtest du die Datenbank prüfen und fehlende Sitzpläne für importierte Events generieren? (Es werden keine Duplikate erstellt)')) return;
    setIsSyncing(true);
    try {
      const { createdCount, initializedSeatsCount } = await syncMissingEvents();
      alert(`Sync erfolgreich!\n\nNeu erstellte Events: ${createdCount}\nReparierte Sitzpläne (Auslastung jetzt sichtbar): ${initializedSeatsCount}`);
    } catch (error) {
      console.error(error);
      alert('Fehler beim Synchronisieren.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `apps/${APP_ID}/events`), snap => {
      const evts: Event[] = [];
      snap.forEach(d => evts.push({ id: d.id, ...d.data() } as Event));
      evts.sort((a,b) => {
        const timeA = (a.date as any)?.toMillis ? (a.date as any).toMillis() : (a.date ? new Date(a.date as string).getTime() : 0);
        const timeB = (b.date as any)?.toMillis ? (b.date as any).toMillis() : (b.date ? new Date(b.date as string).getTime() : 0);
        return timeA - timeB;
      });
      setEvents(evts);
    });
    return () => unsub();
  }, []);

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle || !newEventDate) return;
    setIsCreating(true);
    
    // Zeitzonen-sicheres ID-Matching (exakt wie n8n)
    const dateObj = new Date(newEventDate);
    // newEventDate kommt als "YYYY-MM-DDTHH:mm" aus dem Input. Wir nehmen exakt dieses Datum ohne UTC-Shift!
    const dateStr = newEventDate.split('T')[0].replace(/-/g, '_');
    const titleSlug = newEventTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const eventId = `${titleSlug}_${dateStr}`;
    
    try {
      // Close modal instantly for optimistic feedback
      setIsModalOpen(false);

      const batch = writeBatch(db);
      
      batch.set(doc(db, `apps/${APP_ID}/events`, eventId), {
        title: newEventTitle,
        date: Timestamp.fromDate(dateObj),
        status: 'active',
        ...(newRegiondoId ? { regiondoId: newRegiondoId.trim() } : {})
      });
      
      await batch.commit();
      
      // Initialize the seat subcollection utilizing the new standard service
      await initializeEventSeats(eventId);
      
      navigate(`/events/${eventId}`);
    } catch(err) {
      console.error(err);
      alert('Event konnte nicht erstellt werden.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-heading text-brand-primary">Events & Konzerte</h1>
        <div className="flex gap-3">
          <button 
            onClick={handleDeleteAll}
            disabled={isDeletingAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
          >
            <Trash2 className={`w-5 h-5 ${isDeletingAll ? 'animate-pulse' : ''}`}/> 
            {isDeletingAll ? 'Lösche...' : 'Alle Events löschen'}
          </button>
          <button 
            onClick={() => setIsRegiondoSyncModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
          >
            <CloudDownload className="w-5 h-5"/> Regiondo Termine synchronisieren
          </button>
          <BulkEventGenerator onComplete={() => {}} />
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`}/> 
            {isSyncing ? 'Sync...' : 'Fehlende Events generieren'}
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-red-700 transition"
          >
            <CalendarPlus className="w-5 h-5"/> Neuer Event
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-500 uppercase tracking-wider">
              <th className="p-4">Datum</th>
              <th className="p-4">Titel</th>
              <th className="p-4">Status</th>
              <th className="p-4">Auslastung</th>
              <th className="p-4 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
             {events.length === 0 ? (
               <tr><td colSpan={5} className="p-8 text-center text-gray-500">Keine Events vorhanden.</td></tr>
              ) : events.map(evt => (
               <tr key={evt.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/events/${evt.id}`)}>
                 <td className="p-4 whitespace-nowrap">
                   {!evt.date ? <span className="text-red-500 font-bold">FEHLT</span> : (
                     evt.time && typeof evt.date !== 'string' && (evt.date as any)?.toDate 
                       ? `${(evt.date as any).toDate().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric'})}, ${evt.time}` 
                       : (evt.date as any)?.toDate 
                         ? (evt.date as any).toDate().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' }) 
                         : `${evt.date} ${evt.time || ''}`
                   )}
                 </td>
                 <td className="p-4 font-medium text-gray-900">{evt.title || 'Ohne Titel'}</td>
                 <td className="p-4">
                   <span className={`px-2 py-1 text-xs rounded-full ${evt.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                     {evt.status ? evt.status.toUpperCase() : 'IMPORTED'}
                   </span>
                 </td>
                 <td className="p-4">
                   <EventOccupancy eventId={evt.id} />
                 </td>
                 <td className="p-4 text-right flex items-center justify-end gap-3 text-sm font-medium">
                   <button 
                     onClick={(e) => { e.stopPropagation(); navigate(`/events/${evt.id}/belegungsplan`); }}
                     className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors border border-gray-200"
                   >
                     Belegungsplan
                   </button>
                   <span className="text-brand-primary">Saalplan öffnen &rarr;</span>
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white p-6 rounded-lg w-full max-w-md">
             <h2 className="text-xl font-heading text-brand-primary mb-4">Neuen Event erstellen</h2>
             <form onSubmit={createEvent} className="space-y-4">
               <div>
                  <label className="block text-sm text-gray-700 mb-1">Titel</label>
                  <input autoFocus required type="text" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="z.B. Mozart Ensemble" />
               </div>
               <div>
                  <label className="block text-sm text-gray-700 mb-1">Datum & Uhrzeit</label>
                  <input required type="datetime-local" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>
               <div>
                  <label htmlFor="regiondoId" className="block text-sm text-gray-700 mb-1">
                    Regiondo Produkt/Event-ID (Optional)
                  </label>
                  <input
                    type="text"
                    id="regiondoId"
                    value={newRegiondoId}
                    onChange={e => setNewRegiondoId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                    placeholder="z.B. 123456"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Wird benötigt, um Ticketverkäufe aus Regiondo diesem Event zuzuordnen.
                  </p>
               </div>
               <div className="flex gap-3 justify-end mt-6">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Abbrechen</button>
                 <button disabled={isCreating} type="submit" className="px-4 py-2 bg-brand-primary text-white rounded hover:bg-red-700 disabled:opacity-50">
                   {isCreating ? 'Wird erstellt...' : 'Event erstellen'}
                 </button>
               </div>
             </form>
           </div>
        </div>
      )}

      <RegiondoSyncModal 
        isOpen={isRegiondoSyncModalOpen} 
        onClose={() => setIsRegiondoSyncModalOpen(false)} 
      />
    </div>
  );
}
