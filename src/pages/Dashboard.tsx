import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CalendarDays, Ticket, Euro, ArrowRight } from 'lucide-react';
import { getDashboardStats, DashboardStats } from '../services/firebase/dashboardService';
import { getBookingDisplayData } from '../utils/bookingMapper';

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-red"></div>
      </div>
    );
  }

  if (!stats) return null;

  const { recentBookings, recentEvents, revenue, occupancyPercent, upcomingEventsCount } = stats;

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <h1 className="text-4xl font-black text-slate-900 tracking-tight">Übersicht</h1>
           <p className="text-slate-500 font-medium mt-1">Willkommen im Mozarthaus Buchungssystem</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/new-booking')}
            className="btn-primary flex items-center gap-2 group"
          >
            Neue Reservierung 
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card glass-card-hover border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-start">
             <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Umsatz Monat</p>
              <h2 className="text-3xl font-black text-slate-900 mt-2">€ {revenue.toLocaleString('de-AT', {minimumFractionDigits: 0})}</h2>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Euro className="w-6 h-6"/></div>
          </div>
        </div>

        <div className="glass-card glass-card-hover border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Anstehende Events</p>
              <h2 className="text-3xl font-black text-slate-900 mt-2">{upcomingEventsCount}</h2>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><CalendarDays className="w-6 h-6"/></div>
          </div>
        </div>

        <div className="glass-card glass-card-hover border-l-4 border-l-brand-red">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Auslastung</p>
              <h2 className="text-3xl font-black text-slate-900 mt-2">{occupancyPercent}<span className="text-xl text-slate-400">%</span></h2>
            </div>
            <div className="p-3 bg-red-50 text-brand-red rounded-xl"><Activity className="w-6 h-6"/></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Next Events */}
        <div className="lg:col-span-1 glass-card p-0 overflow-hidden flex flex-col h-full">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-brand-red"/> Nächste Events
            </h3>
            <button onClick={() => navigate('/events')} className="text-xs font-bold text-brand-red hover:underline">
              Alle
            </button>
          </div>
          <div className="p-2">
            {recentEvents.length === 0 ? (
               <div className="p-8 text-center text-slate-400 text-sm">Keine Events.</div>
            ) : recentEvents.map(e => (
              <div key={e.id} className="p-4 rounded-xl hover:bg-slate-50 flex justify-between items-center transition-colors group">
                <div className="overflow-hidden">
                  <p className="font-bold text-slate-900 truncate">{e.title || 'Ohne Titel'}</p>
                  <p className="text-[11px] text-slate-500 mt-1 uppercase font-semibold">
                    {e.date ? new Date((e.date as any)?.toDate ? (e.date as any).toDate() : e.date).toLocaleDateString('de-AT', { day: '2-digit', month: 'short' }) : 'Kein Datum'} {e.time ? `• ${e.time}` : ''}
                  </p>
                </div>
                <button 
                  onClick={() => navigate(`/events/${e.id}/belegungsplan`)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-brand-red hover:bg-red-50 rounded-lg"
                >
                  <ArrowRight className="w-4 h-4"/>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="lg:col-span-2 glass-card p-0 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Ticket className="w-4 h-4 text-brand-red"/> Letzte Buchungen
            </h3>
            <button onClick={() => navigate('/bookings')} className="text-xs font-bold text-brand-red hover:underline">
              Alle anzeigen
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-50">
                  <th className="px-6 py-4">Kunde / Quelle</th>
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentBookings.length === 0 ? (
                   <tr><td colSpan={4} className="p-12 text-center text-slate-400 font-medium italic">Keine aktuellen Buchungen.</td></tr>
                ) : recentBookings.map(b => {
                  const display = getBookingDisplayData(b);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{display.customerName}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold uppercase">{display.sourceLabel}</span>
                          {display.bookingNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-600 max-w-[180px] truncate">{display.eventTitle}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-bold">
                          {(() => {
                            if (!display.eventDateTime) return '-';
                            const parts = display.eventDateTime.split(' ');
                            const datePart = parts[0].split('-').reverse().join('.');
                            const timePart = parts[1] ? parts[1].substring(0, 5) : '';
                            return timePart ? `${datePart}, ${timePart}` : datePart;
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`status-badge ${
                          display.status.includes('paid') || display.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          display.status === 'cancelled' || display.status === 'sent' ? 'bg-slate-50 text-slate-500 border-slate-100' :
                          'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {display.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-900">
                        € {display.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
