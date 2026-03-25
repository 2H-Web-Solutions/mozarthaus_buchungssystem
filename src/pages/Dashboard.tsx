import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Booking, Event } from '../types/schema';
import { Activity, CalendarDays, Ticket, Euro, ArrowRight } from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [nextEvent, setNextEvent] = useState<Event | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);

  useEffect(() => {
    // Recent Bookings & Revenue
    const unsubBookings = onSnapshot(collection(db, `apps/${APP_ID}/bookings`), snap => {
      const b: Booking[] = [];
      let revenue = 0;
      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      
      snap.forEach(doc => {
         const data = doc.data() as Booking;
         b.push({ ...data, id: doc.id });
         
         if (data.status === 'confirmed' && data.createdAt.toMillis() >= firstOfMonth) {
            revenue += data.totalAmount || 0;
         }
      });
      // Sort desc client-side
      b.sort((x, y) => y.createdAt.toMillis() - x.createdAt.toMillis());
      setRecentBookings(b.slice(0, 5));
      setMonthlyRevenue(revenue);
    });

    // Anstehende Events
    const unsubEvents = onSnapshot(collection(db, `apps/${APP_ID}/events`), snap => {
      const e: Event[] = [];
      const now = Date.now();
      snap.forEach(doc => {
         const data = doc.data() as Event;
         if (data.date.toMillis() > now && data.status === 'active') e.push({ ...data, id: doc.id });
      });
      e.sort((x, y) => x.date.toMillis() - y.date.toMillis());
      setUpcomingEvents(e);
      if (e.length > 0) setNextEvent(e[0]);
    });

    return () => {
      unsubBookings();
      unsubEvents();
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
           <h1 className="text-3xl font-heading text-brand-primary font-bold">Willkommen zurück!</h1>
           <p className="text-gray-500 font-medium mt-1">Hier ist dein zentraler Überblick für Mozarthaus.at</p>
        </div>
        {nextEvent && (
          <button 
            onClick={() => navigate('/new-booking')}
            className="flex items-center gap-2 bg-brand-primary text-white px-8 py-3.5 rounded-xl hover:bg-red-700 transition font-bold shadow-xl shadow-brand-primary/20 cursor-pointer animate-in zoom-in duration-300"
          >
            Neue Reservierung erfassen <ArrowRight className="w-5 h-5"/>
          </button>
        )}
      </div>

      {/* KPI Cards (Top Row) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-7 rounded-2xl shadow-md border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Heutige Auslastung</p>
              <h2 className="text-4xl font-bold text-gray-900 mt-2">85<span className="text-2xl text-gray-400">%</span></h2>
            </div>
            <div className="p-4 bg-red-50 text-brand-primary rounded-2xl shadow-inner"><Activity className="w-7 h-7"/></div>
          </div>
          <div className="mt-6 p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2 text-sm text-gray-600 font-medium">
             <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span> Nächstes Konzert: {nextEvent ? nextEvent.title : '-'}
          </div>
        </div>

        <div className="bg-white p-7 rounded-2xl shadow-md border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Anstehende Events</p>
              <h2 className="text-4xl font-bold text-gray-900 mt-2">{upcomingEvents.length}</h2>
            </div>
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><CalendarDays className="w-7 h-7"/></div>
          </div>
          <div className="mt-6 p-3 bg-blue-50/50 rounded-xl border border-blue-50 flex items-center gap-2 text-sm text-blue-700 font-medium h-[3.25rem]">
             Live-Kopplung aktiv
          </div>
        </div>

        <div className="bg-white p-7 rounded-2xl shadow-md border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Umsatz Monat</p>
              <h2 className="text-4xl font-bold text-gray-900 mt-2">€ {monthlyRevenue.toLocaleString('de-AT', {minimumFractionDigits: 0})}</h2>
            </div>
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner"><Euro className="w-7 h-7"/></div>
          </div>
          <div className="mt-6 p-3 bg-emerald-50/50 rounded-xl border border-emerald-50 flex items-center gap-2 text-sm text-emerald-700 font-bold h-[3.25rem]">
             ↑ Laufender Monat
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden mt-8">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-brand-primary flex items-center gap-2"><Ticket className="w-5 h-5"/> Letzte 5 Buchungen</h2>
          <button onClick={() => navigate('/bookings')} className="px-4 py-2 bg-white border border-gray-200 shadow-sm text-sm text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition">
            Alle anzeigen
          </button>
        </div>
        <div className="p-0">
          <ul className="divide-y divide-gray-100">
            {recentBookings.length === 0 ? (
               <li className="p-12 text-center text-gray-500 font-medium">Keine aktuellen Buchungen in der Datenbank.</li>
            ) : recentBookings.map(b => (
              <li key={b.id} className="p-6 hover:bg-red-50/30 flex justify-between items-center transition-colors">
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl shadow-sm border ${b.status === 'confirmed' ? 'bg-red-50 text-brand-primary border-red-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                     {b.customerData.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{b.customerData.name}</p>
                    <p className="text-sm text-gray-500 font-medium mt-1">{b.eventId.replace(/_/g, ' ')} · <span className="text-brand-primary">{b.seatIds?.length || 0} Plätze</span></p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold bg-gray-50 px-3 py-1 rounded-lg border border-gray-100 shadow-inner inline-block mb-2 ${b.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    € {b.totalAmount.toFixed(2)}
                  </p>
                  <div className="block">
                    <span className={`text-[10px] uppercase px-3 py-1 rounded-full font-bold tracking-widest border ${b.status === 'confirmed' ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {b.status === 'confirmed' ? b.source : 'storniert'}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
