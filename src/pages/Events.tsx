import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, query, where, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, getCountFromServer, or } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Event } from '../types/schema';
import { initializeEventSeats } from '../services/bookingService';

function EventOccupancy({ eventId }: { eventId: string }) {
  const [data, setData] = useState({
    docOccupied: 0,
    docTotal: 0,
    seatsBooked: 0,
    totalSeats: 0,
    groupTickets: 0
  });

  useEffect(() => {
    // 1. Listen to event document for manual/synced counts
    const unsubEvent = onSnapshot(doc(db, `apps/${APP_ID}/events`, eventId), (snap) => {
      const d = snap.data();
      setData(prev => ({ 
        ...prev, 
        docOccupied: d?.occupied || 0, 
        docTotal: d?.totalCapacity || 0 
      }));
    });

    // 2. Listen to physical seats
    const unsubSeats = onSnapshot(collection(db, `apps/${APP_ID}/events/${eventId}/seats`), (snap) => {
      let total = 0;
      let booked = 0;
      snap.forEach(d => {
        total++;
        if (d.data().status !== 'available') booked++;
      });
      setData(prev => ({ ...prev, seatsBooked: booked, totalSeats: total }));
    });

    // 3. Listen to all related bookings (Manual & Synced)
    const q = query(
      collection(db, `apps/${APP_ID}/bookings`), 
      or(
        where('eventId', '==', eventId),
        where('eventDocId', '==', eventId)
      )
    );
    
    const unsubBookings = onSnapshot(q, (snap) => {
      let group = 0;
      snap.forEach(bDoc => {
        const b = bDoc.data();
        if (b.status === 'cancelled') return;

        if (!b.seatIds || b.seatIds.length === 0) {
          if (b.groupPersons) group += b.groupPersons;
          else if (b.tickets) b.tickets.forEach((t: any) => group += (t.quantity || 1));
          else if (b.lastPayload?.qty) group += Number(b.lastPayload.qty);
        }
      });
      setData(prev => ({ ...prev, groupTickets: group }));
    });

    return () => {
      unsubEvent();
      unsubSeats();
      unsubBookings();
    };
  }, [eventId]);

  const total = data.totalSeats || data.docTotal;
  if (total === 0) return <span className="text-gray-400 text-sm">-</span>;

  // Prioritize the highest count to ensure sync discrepancies are visible
  const booked = Math.max(data.seatsBooked + data.groupTickets, data.docOccupied);
  const percentage = Math.round((booked / total) * 100) || 0;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
        {booked} / {total}
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [docHistory, setDocHistory] = useState<QueryDocumentSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const PAGE_SIZE = 10;

  const navigate = useNavigate();

  const fetchTotalCount = async () => {
    const coll = collection(db, `apps/${APP_ID}/events`);
    const snapshot = await getCountFromServer(coll);
    setTotalEvents(snapshot.data().count);
  };

  const fetchEvents = async (direction: 'initial' | 'next' | 'prev' = 'initial') => {
    setIsLoading(true);
    try {
      let q = query(
        collection(db, `apps/${APP_ID}/events`),
        orderBy('date', 'asc'),
        limit(PAGE_SIZE)
      );

      if (direction === 'next' && lastDoc) {
        q = query(q, startAfter(lastDoc));
      } else if (direction === 'prev') {
        const prevDoc = docHistory[docHistory.length - 2] || null;
        if (prevDoc) {
          q = query(q, startAfter(prevDoc));
        }
      }

      const snap = await getDocs(q);
      const evts: Event[] = [];
      snap.forEach(d => evts.push({ id: d.id, ...d.data() } as Event));
      
      setEvents(evts);
      setLastDoc(snap.docs[snap.docs.length - 1]);
      
      if (direction === 'next') {
        setDocHistory([...docHistory, snap.docs[snap.docs.length - 1]]);
        setCurrentPage(prev => prev + 1);
      } else if (direction === 'prev') {
        setDocHistory(docHistory.slice(0, -1));
        setCurrentPage(prev => prev - 1);
      } else {
        setDocHistory([snap.docs[snap.docs.length - 1]]);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchTotalCount();
  }, []);


  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-heading text-brand-primary">Events & Konzerte</h1>
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
                <tr key={evt.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/events/${evt.id}/belegungsplan`)}>
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
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>

      {!isLoading && events.length > 0 && (
        <div className="mt-6 flex items-center justify-between bg-white px-4 py-3 sm:px-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => fetchEvents('prev')}
              disabled={currentPage === 1 || isLoading}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Zurück
            </button>
            <button
              onClick={() => fetchEvents('next')}
              disabled={events.length < PAGE_SIZE || isLoading}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Weiter
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Zeige <span className="font-medium">{(currentPage - 1) * PAGE_SIZE + 1}</span> bis{' '}
                <span className="font-medium">{(currentPage - 1) * PAGE_SIZE + events.length}</span> von{' '}
                <span className="font-medium">{totalEvents}</span> Events
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => fetchEvents('prev')}
                  disabled={currentPage === 1 || isLoading}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Zurück</span>
                  &larr;
                </button>
                <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0">
                  Seite {currentPage}
                </span>
                <button
                  onClick={() => fetchEvents('next')}
                  disabled={events.length < PAGE_SIZE || isLoading}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Weiter</span>
                  &rarr;
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
