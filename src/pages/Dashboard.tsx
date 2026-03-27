import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CalendarDays, Ticket, Euro, ArrowRight, Trash2 } from 'lucide-react';
import { getDashboardStats, DashboardStats } from '../services/firebase/dashboardService';
import { SyncControl } from '../components/dashboard/SyncControl';
import { cancelBooking } from '../services/bookingService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleCleanupBookings = async () => {
    if (!window.confirm("ACHTUNG: Willst du WIRKLICH alle Buchungen stornieren? Dies gibt alle verknüpften Sitzplätze wieder frei! (Dieser Vorgang kann ein paar Sekunden dauern)")) return;
    setIsCleaning(true);
    try {
      const bookingsRef = collection(db, `apps/${APP_ID}/bookings`);
      const snapshot = await getDocs(bookingsRef);
      const bookingIds = snapshot.docs.map(doc => doc.id);
      
      let cancelledCount = 0;
      for (const id of bookingIds) {
        try {
          // Utilizes the strict transaction cancellation block
          await cancelBooking(id);
          cancelledCount++;
        } catch (e) {
          console.error(`Failed to cancel booking ${id}`, e);
        }
      }
      alert(`Erfolgreich ${cancelledCount} Buchungen storniert und alle verknüpften Sitzplätze freigegeben.`);
      // Reload stats automatically
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error("Cleanup failed", error);
      alert("Fehler beim Cleanup.");
    } finally {
      setIsCleaning(false);
    }
  };

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!stats) return null;

  const { recentBookings, recentEvents, revenue, occupancyPercent, upcomingEventsCount } = stats;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
           <h1 className="text-3xl font-heading text-brand-primary font-bold">Willkommen zurück!</h1>
           <p className="text-gray-500 font-medium mt-1">Hier ist dein zentraler Überblick für Mozarthaus.at</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button 
            onClick={handleCleanupBookings}
            disabled={isCleaning}
            className="flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-3.5 rounded-xl hover:bg-red-100 transition font-bold disabled:opacity-50"
          >
            <Trash2 className="w-5 h-5"/> {isCleaning ? 'Lösche...' : 'Testdaten Cleanup'}
          </button>
          <button 
            onClick={() => navigate('/new-booking')}
            className="flex items-center justify-center gap-2 bg-brand-primary text-white px-8 py-3.5 rounded-xl hover:bg-red-700 transition font-bold shadow-xl shadow-brand-primary/20 animate-in zoom-in duration-300"
          >
            Neue Reservierung <ArrowRight className="w-5 h-5"/>
          </button>
        </div>
      </div>

      {/* KPI Cards (Top Row) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Umsatz aktueller Monat</p>
              <h2 className="text-4xl font-bold text-gray-900 mt-2">€ {revenue.toLocaleString('de-AT', {minimumFractionDigits: 0})}</h2>
            </div>
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner"><Euro className="w-7 h-7"/></div>
          </div>
        </div>

        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Anstehende Events (7 Tage)</p>
              <h2 className="text-4xl font-bold text-gray-900 mt-2">{upcomingEventsCount}</h2>
            </div>
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><CalendarDays className="w-7 h-7"/></div>
          </div>
        </div>

        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Auslastung</p>
              <h2 className="text-4xl font-bold text-gray-900 mt-2">{occupancyPercent}<span className="text-2xl text-gray-400">%</span></h2>
            </div>
            <div className="p-4 bg-red-50 text-brand-primary rounded-2xl shadow-inner"><Activity className="w-7 h-7"/></div>
          </div>
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Next 5 Events */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-brand-primary"/> Nächste 5 Events
            </h2>
            <button onClick={() => navigate('/events')} className="px-4 py-2 bg-white border border-gray-200 shadow-sm text-xs text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition">
              Alle Events
            </button>
          </div>
          <div className="flex-1 p-0">
            <ul className="divide-y divide-gray-100">
              {recentEvents.length === 0 ? (
                 <li className="p-8 text-center text-gray-500 text-sm">Keine anstehenden Events.</li>
              ) : recentEvents.map(e => (
                <li key={e.id} className="p-4 hover:bg-gray-50 flex justify-between items-center transition-colors">
                  <div>
                    <p className="font-bold text-gray-900">{e.title || 'Ohne Titel'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {e.date ? new Date((e.date as any)?.toDate ? (e.date as any).toDate() : e.date).toLocaleDateString('de-AT', { day: '2-digit', month: 'short' }) : 'Kein Datum'} {e.time ? `• ${e.time}` : ''}
                    </p>
                  </div>
                  <button 
                    onClick={() => navigate(`/events/${e.id}/belegungsplan`)}
                    className="text-brand-primary text-sm font-bold hover:underline"
                  >
                    Belegungsplan
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Sync Control */}
        <div>
          <SyncControl />
        </div>
      </div>

      {/* Bottom Row: Recent Bookings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-8">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Ticket className="w-5 h-5 text-brand-primary"/> Letzte 10 Buchungen</h2>
          <button onClick={() => navigate('/bookings')} className="px-4 py-2 bg-white border border-gray-200 shadow-sm text-sm text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition">
            Alle anzeigen
          </button>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white">
              <tr className="text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200 text-xs">
                <th className="p-4 border-r border-gray-100">Kunde</th>
                <th className="p-4 border-r border-gray-100">Datum / Event</th>
                <th className="p-4 text-center border-r border-gray-100">Status</th>
                <th className="p-4 text-right">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentBookings.length === 0 ? (
                 <tr><td colSpan={4} className="p-8 text-center text-gray-500 font-medium">Keine aktuellen Buchungen in der Datenbank.</td></tr>
              ) : recentBookings.map(b => (
                <tr key={b.id} className="hover:bg-red-50/30 transition-colors">
                  <td className="p-4 font-bold text-gray-900">{b.customerData.name}</td>
                  <td className="p-4 text-gray-600">
                    {b.eventDate ? new Date(b.eventDate).toLocaleDateString('de-AT', { day: '2-digit', month: 'short' }) + ' · ' : ''}
                    {b.eventTitle || b.eventId.replace(/_/g, ' ')}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block text-[10px] uppercase px-2.5 py-1 rounded-full font-bold tracking-widest ${
                      b.status === 'paid' ? 'bg-green-100 text-green-700' :
                      b.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                      b.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold text-gray-900 border-l border-gray-100">
                    € {b.totalAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
