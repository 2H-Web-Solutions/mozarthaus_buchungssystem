import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, query, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, getCountFromServer, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Event } from '../types/schema';

function EventOccupancy({ eventId }: { eventId: string }) {
  const [data, setData] = useState({
    occupied: 0,
    total: 0
  });

  useEffect(() => {
    // Listen to event document for the seating map and capacity
    const unsubEvent = onSnapshot(doc(db, `apps/${APP_ID}/events`, eventId), (snap) => {
      const d = snap.data();
      if (!d) return;

      const seating = d.seating || {};
      const occupiedPhysical = Object.values(seating).filter((s: any) => !!s.bookingId).length;
      
      setData({ 
        occupied: occupiedPhysical, 
        total: d.totalCapacity || Object.keys(seating).length || 67
      });
    });

    return () => unsubEvent();
  }, [eventId]);

  if (data.total === 0) return <span className="text-gray-400 text-sm">-</span>;

  const percentage = Math.round((data.occupied / data.total) * 100) || 0;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
        {data.occupied} / {data.total}
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
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<any, any> | null>(null);
  const [docHistory, setDocHistory] = useState<QueryDocumentSnapshot<any, any>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [filterType, setFilterType] = useState<'all' | 'privat' | 'regiondo'>('all');
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchTotalCount = async () => {
    try {
      let coll = collection(db, `apps/${APP_ID}/events`);
      let q: any = coll;
      
      if (filterType === 'privat') {
        q = query(coll, where('is_private', '==', true));
      } else if (filterType === 'regiondo') {
        q = query(coll, where('is_private', '!=', true));
      }

      const snapshot = await getCountFromServer(q);
      setTotalEvents(snapshot.data().count);
    } catch (err) {
      console.error("Error fetching count:", err);
    }
  };

  const fetchEvents = async (direction: 'initial' | 'next' | 'prev' = 'initial') => {
    setIsLoading(true);
    setError(null);
    if (direction === 'initial') {
      setEvents([]); // Clear current events to trigger the loading state UI immediately
    }
    try {
      const baseColl = collection(db, `apps/${APP_ID}/events`);

      if (filterType === 'all') {
        // --- Server-side Paginated Path ---
        let q = query(baseColl, orderBy('date', 'asc'), limit(pageSize));
        
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
        } else if (direction === 'prev') {
          setDocHistory(docHistory.slice(0, -1));
        } else {
          setDocHistory([snap.docs[snap.docs.length - 1]]);
          fetchTotalCount(); // Get fresh total count on initial load
        }
      } else {
        // --- Client-side Filtered Path ---
        // Fetch up to 1000 events to ensure we cover a reasonable range without complex indexes
        let q = query(baseColl, orderBy('date', 'asc'), limit(1000));
        const snap = await getDocs(q);
        const fetchedEvents: Event[] = [];
        snap.forEach(d => fetchedEvents.push({ id: d.id, ...d.data() } as Event));
        
        // Filter in JS
        const filtered = fetchedEvents.filter(evt => {
          if (filterType === 'privat') return evt.is_private === true;
          if (filterType === 'regiondo') return !evt.is_private;
          return true;
        });

        // Set total count for the filtered view
        setTotalEvents(filtered.length);

        // Sub-paginate the filtered results
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        setEvents(filtered.slice(start, end));
        
        setLastDoc(null); 
      }
    } catch (err: any) {
      console.error('Error fetching events:', err);
      setError('Fehler beim Laden der Events.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (direction: 'next' | 'prev') => {
    if (filterType === 'all') {
      fetchEvents(direction);
      setCurrentPage(prev => direction === 'next' ? prev + 1 : prev - 1);
    } else {
      setCurrentPage(prev => direction === 'next' ? prev + 1 : prev - 1);
    }
  };

  // Trigger data load when filter or page size changes
  useEffect(() => {
    setCurrentPage(1);
    fetchEvents('initial');
  }, [filterType, pageSize]);

  // Handle local pagination for filtered views
  useEffect(() => {
    if (filterType !== 'all') {
      fetchEvents('initial');
    }
  }, [currentPage]);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-heading text-brand-primary font-bold tracking-tight">Events & Konzerte</h1>
          <p className="text-slate-500 mt-1">Verwalten Sie Ihre Buchungen und Event-Auslastungen.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
            <button 
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${filterType === 'all' ? 'bg-white text-brand-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Alle
            </button>
            <button 
              onClick={() => setFilterType('privat')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${filterType === 'privat' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Privat
            </button>
            <button 
              onClick={() => setFilterType('regiondo')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${filterType === 'regiondo' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Regiondo
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Limit:</span>
            <select 
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all cursor-pointer shadow-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {error && (
          <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center gap-3 text-amber-800">
            <span className="text-xl">⚠️</span>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-widest">
                <th className="p-4 pl-6">Datum & Zeit</th>
                <th className="p-4">Event Titel</th>
                <th className="p-4">Typ / Status</th>
                <th className="p-4">Auslastung</th>
                <th className="p-4 pr-6 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {isLoading && events.length === 0 ? (
                 <>
                   {[...Array(5)].map((_, i) => (
                     <tr key={`skeleton-${i}`} className="animate-pulse">
                       <td className="p-4 pl-6">
                         <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                         <div className="h-3 bg-gray-100 rounded w-16"></div>
                       </td>
                       <td className="p-4">
                         <div className="h-4 bg-gray-200 rounded w-48"></div>
                       </td>
                       <td className="p-4">
                         <div className="flex gap-2">
                           <div className="h-5 bg-gray-200 rounded-lg w-12"></div>
                           <div className="h-5 bg-gray-200 rounded-lg w-16"></div>
                         </div>
                       </td>
                       <td className="p-4">
                         <div className="h-4 bg-gray-200 rounded w-20"></div>
                       </td>
                       <td className="p-4 pr-6 text-right">
                         <div className="h-8 bg-gray-100 rounded-xl w-24 ml-auto"></div>
                       </td>
                     </tr>
                   ))}
                 </>
               ) : events.length === 0 ? (
                 <tr>
                   <td colSpan={5} className="p-12 text-center">
                     <div className="max-w-xs mx-auto">
                        <p className="text-lg font-bold text-gray-900">Keine Events gefunden</p>
                        <p className="text-sm text-gray-500 mt-1">Versuchen Sie es mit einem anderen Filter oder passen Sie Ihre Suche an.</p>
                     </div>
                   </td>
                 </tr>
                ) : events.map(evt => (
                  <tr 
                    key={evt.id} 
                    className="group hover:bg-slate-50/80 cursor-pointer transition-colors" 
                    onClick={() => navigate(`/events/${evt.id}/belegungsplan`)}
                  >
                   <td className="p-4 pl-6 whitespace-nowrap">
                     <div className="flex flex-col">
                       <span className="text-sm font-bold text-gray-900">
                         {!evt.date ? 'Datum fehlt' : (
                           evt.time && typeof evt.date !== 'string' && (evt.date as any)?.toDate 
                             ? (evt.date as any).toDate().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
                             : (evt.date as any)?.toDate 
                               ? (evt.date as any).toDate().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
                               : evt.date
                         )}
                       </span>
                       <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                         {evt.time || (typeof evt.date !== 'string' && (evt.date as any)?.toDate ? (evt.date as any).toDate().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit'}) : '')}
                       </span>
                     </div>
                   </td>
                   <td className="p-4">
                     <div className="flex flex-col gap-1">
                       <span className="font-bold text-gray-900 line-clamp-1">{evt.title || 'Ohne Titel'}</span>
                       {evt.regiondoId && (
                         <span className="text-[10px] text-slate-400 font-mono">ID: {evt.regiondoId}</span>
                       )}
                     </div>
                   </td>
                   <td className="p-4">
                     <div className="flex flex-wrap gap-2">
                       {evt.is_private ? (
                         <span className="px-2 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded-lg font-bold uppercase tracking-wider border border-purple-200">
                           Privat
                         </span>
                       ) : (
                         <span className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded-lg font-bold uppercase tracking-wider border border-blue-100">
                           Regiondo
                         </span>
                       )}
                       <span className={`px-2 py-0.5 text-[10px] rounded-lg font-bold uppercase tracking-wider border ${evt.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                         {evt.status ? evt.status : 'IMPORTED'}
                       </span>
                     </div>
                   </td>
                   <td className="p-4">
                     <EventOccupancy eventId={evt.id} />
                   </td>
                   <td className="p-4 pr-6 text-right">
                     <button 
                       onClick={(e) => { e.stopPropagation(); navigate(`/events/${evt.id}/belegungsplan`); }}
                       className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-white hover:bg-brand-primary hover:text-white text-brand-primary rounded-xl transition-all border border-brand-primary/20 font-bold text-xs shadow-sm shadow-brand-primary/5"
                     >
                       Belegungsplan
                     </button>
                   </td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && events.length > 0 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm font-medium text-slate-500">
            Zeige <span className="text-gray-900 font-bold">{(currentPage - 1) * pageSize + 1}</span> bis <span className="text-gray-900 font-bold">{Math.min(currentPage * pageSize, totalEvents)}</span> von <span className="text-gray-900 font-bold">{totalEvents}</span> Events
          </p>
          
          <nav className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-gray-200 shadow-sm" aria-label="Pagination">
            <button
              onClick={() => handlePageChange('prev')}
              disabled={currentPage === 1 || isLoading}
              className="p-2.5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <span className="sr-only">Zurück</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            
            <div className="px-4 text-sm font-bold text-gray-900">
              Seite {currentPage}
            </div>
            
            <button
              onClick={() => handlePageChange('next')}
              disabled={(filterType === 'all' ? events.length < pageSize : (currentPage * pageSize) >= totalEvents) || isLoading}
              className="p-2.5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <span className="sr-only">Weiter</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
