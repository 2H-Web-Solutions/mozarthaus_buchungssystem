import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Booking, Event } from '../types/schema';
import { BarChart, Ticket, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';

export function Statistics() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const formatDate = (d: Date) => {
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(formatDate(firstDay));
  const [endDate, setEndDate] = useState(formatDate(lastDay));
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubBookings = onSnapshot(query(collection(db, `apps/${APP_ID}/bookings`), orderBy('createdAt', 'desc')), snap => {
      const b: Booking[] = [];
      snap.forEach(d => b.push({ id: d.id, ...d.data() } as Booking));
      setBookings(b);
    });

    const unsubEvents = onSnapshot(collection(db, `apps/${APP_ID}/events`), snap => {
      const e: Event[] = [];
      snap.forEach(d => e.push({ id: d.id, ...d.data() } as Event));
      setEvents(e);
      setLoading(false);
    });

    return () => {
      unsubBookings();
      unsubEvents();
    };
  }, []);

  const { filteredBookings, totalRevenue, paidRevenue, totalTickets, occupancyRate } = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const validEvents = events.filter(e => {
        const d = typeof e.date === 'string' ? new Date(e.date) : e.date.toDate();
        return d >= start && d <= end;
    });
    const validEventIds = validEvents.map(e => e.id);

    let fBookings = bookings.filter(b => validEventIds.includes(b.eventId));
    
    let tRevenue = 0;
    let pRevenue = 0;
    let tTickets = 0;

    fBookings.forEach(b => {
      if (b.status !== 'cancelled') {
        tRevenue += b.totalAmount || 0;
        if (b.status === 'paid') {
          pRevenue += b.totalAmount || 0;
        }
        tTickets += b.seatIds ? b.seatIds.length : (b.tickets?.reduce((acc, t) => acc + t.quantity, 0) || 0);
      }
    });

    const totalCapacity = validEvents.length * 60;
    const occRate = totalCapacity > 0 ? Math.round((tTickets / totalCapacity) * 100) : 0;

    const enrichedBookings = fBookings.map(b => {
       let resolvedEventDateString = '';
       let resolvedEventDateObject: Date | null = null;

       if (b.eventId !== 'manual') {
         const e = events.find(ev => ev.id === b.eventId);
         if (e && e.date) {
           if ((e.date as any)?.toDate) { // Check if it's a Firestore Timestamp
             const d = (e.date as any).toDate();
             resolvedEventDateObject = d;
             resolvedEventDateString = d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
           } else { // Assume it's a string date
             const d = new Date(e.date as string);
             resolvedEventDateObject = d;
             resolvedEventDateString = `${d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${e.time || ''}`;
           }
         }
       } else {
         const createdDate = b.createdAt.toDate();
         resolvedEventDateObject = createdDate;
         resolvedEventDateString = createdDate.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + createdDate.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
       }

       return {
           ...b,
           resolvedEventDate: resolvedEventDateObject, // Keep Date object for sorting
           resolvedEventDateString: resolvedEventDateString // Add formatted string for display
       };
    }).sort((a, b) => (b.resolvedEventDate?.getTime() || 0) - (a.resolvedEventDate?.getTime() || 0));

    return {
      filteredBookings: enrichedBookings,
      totalRevenue: tRevenue,
      paidRevenue: pRevenue,
      totalTickets: tTickets,
      occupancyRate: occRate
    };
  }, [startDate, endDate, bookings, events]);

  if (loading) return <div className="p-8 text-center text-gray-500">Lade Statistiken...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-heading text-brand-primary font-bold">Statistiken & Übersicht</h1>
          <p className="text-gray-500 mt-1">Auswertung Ihrer Verkäufe & Auslastung nach Event-Zeitraum</p>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-200">
          <CalendarIcon className="w-5 h-5 text-gray-400 ml-2" />
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="bg-transparent border-none font-medium text-gray-700 focus:ring-0 outline-none cursor-pointer"
          />
          <span className="text-gray-400">-</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="bg-transparent border-none font-medium text-gray-700 focus:ring-0 outline-none cursor-pointer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-[50px] pointer-events-none -mt-10 -mr-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
             <h3 className="text-gray-500 font-bold uppercase tracking-wider text-sm">Gesamtumsatz</h3>
             <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
               <TrendingUp className="w-5 h-5" />
             </div>
          </div>
          <div className="relative z-10">
             <div className="text-4xl font-heading font-black text-gray-900 mb-2">€ {totalRevenue.toLocaleString('de-AT', {minimumFractionDigits: 2})}</div>
             <div className="text-sm font-medium text-green-600 bg-green-50 w-max px-2 py-1 rounded">
                Davon bezahlt: € {paidRevenue.toLocaleString('de-AT', {minimumFractionDigits: 2})}
             </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[50px] pointer-events-none -mt-10 -mr-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
             <h3 className="text-gray-500 font-bold uppercase tracking-wider text-sm">Verkaufte Tickets</h3>
             <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
               <Ticket className="w-5 h-5" />
             </div>
          </div>
          <div className="relative z-10">
             <div className="text-4xl font-heading font-black text-gray-900 mb-2">{totalTickets}</div>
             <div className="text-sm font-medium text-gray-500">
                Im gewählten Zeitraum
             </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-[50px] pointer-events-none -mt-10 -mr-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
             <h3 className="text-gray-500 font-bold uppercase tracking-wider text-sm">Ø Auslastung</h3>
             <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
               <BarChart className="w-5 h-5" />
             </div>
          </div>
          <div className="relative z-10">
             <div className="text-4xl font-heading font-black text-brand-primary mb-4">{occupancyRate}%</div>
             <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-brand-primary h-2.5 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, occupancyRate)}%` }}></div>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
           <h2 className="text-lg font-bold text-gray-900">Transaktionen im Zeitraum</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                <th className="p-4 font-bold">Kunde / Name</th>
                <th className="p-4 font-bold">Event-Datum</th>
                <th className="p-4 font-bold">Tickets</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold text-right">Summe</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 text-sm">
                    Keine Buchungen für diesen Zeitraum gefunden.
                  </td>
                </tr>
              ) : (
                filteredBookings.map(b => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{b.customerData.name}</div>
                      <div className="text-sm text-gray-500">{b.customerData.email}</div>
                      {b.isB2B && <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">B2B</span>}
                    </td>
                    <td className="p-4 text-gray-600 font-medium">
                      {b.resolvedEventDate?.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-gray-600 font-medium">
                       {b.seatIds ? b.seatIds.length : (b.tickets?.reduce((acc, t) => acc + t.quantity, 0) || 0)} Plätze
                    </td>
                    <td className="p-4">
                       <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                         b.status === 'paid' ? 'bg-green-100 text-green-700' :
                         b.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                         b.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                         'bg-yellow-100 text-yellow-700'
                       }`}>
                         {b.status.toUpperCase()}
                       </span>
                    </td>
                    <td className="p-4 text-right font-bold text-gray-900">
                      € {b.totalAmount?.toLocaleString('de-AT', {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
