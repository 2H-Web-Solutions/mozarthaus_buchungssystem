import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Event } from '../types/schema';
import { CalendarPlus } from 'lucide-react';
import { initializeEventSeats } from '../services/bookingService';

export function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `apps/${APP_ID}/events`), snap => {
      const evts: Event[] = [];
      snap.forEach(d => evts.push({ id: d.id, ...d.data() } as Event));
      evts.sort((a,b) => a.date.toMillis() - b.date.toMillis());
      setEvents(evts);
    });
    return () => unsub();
  }, []);

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle || !newEventDate) return;
    setIsCreating(true);
    
    // Create robust slug matching rule #1
    const dateObj = new Date(newEventDate);
    const dateStr = dateObj.toISOString().split('T')[0].replace(/-/g, '_');
    const titleSlug = newEventTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const eventId = `${titleSlug}_${dateStr}`;
    
    try {
      // Close modal instantly for optimistic feedback
      setIsModalOpen(false);

      const batch = writeBatch(db);
      
      batch.set(doc(db, `apps/${APP_ID}/events`, eventId), {
        title: newEventTitle,
        date: Timestamp.fromDate(dateObj),
        status: 'active'
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
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-red-700 transition"
        >
          <CalendarPlus className="w-5 h-5"/> Neuer Event
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-500 uppercase tracking-wider">
              <th className="p-4">Datum</th>
              <th className="p-4">Titel</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
             {events.length === 0 ? (
               <tr><td colSpan={4} className="p-8 text-center text-gray-500">Keine Events vorhanden.</td></tr>
             ) : events.map(evt => (
               <tr key={evt.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/events/${evt.id}`)}>
                 <td className="p-4 whitespace-nowrap">{evt.date.toDate().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' })}</td>
                 <td className="p-4 font-medium text-gray-900">{evt.title}</td>
                 <td className="p-4">
                   <span className={`px-2 py-1 text-xs rounded-full ${evt.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                     {evt.status.toUpperCase()}
                   </span>
                 </td>
                 <td className="p-4 text-right text-brand-primary text-sm font-medium">
                   Saalplan öffnen &rarr;
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
    </div>
  );
}
