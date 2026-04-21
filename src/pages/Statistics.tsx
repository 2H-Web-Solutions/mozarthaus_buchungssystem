import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Booking, Event } from '../types/schema';
import { BarChart, Ticket, TrendingUp, Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import { getBookingDisplayData } from '../utils/bookingMapper';

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

  // Filter States
  const [partners, setPartners] = useState<{id: string, name: string, typeId?: string}[]>([]);
  const [partnerTypes, setPartnerTypes] = useState<{id: string, name: string}[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [selectedPartnerTypes, setSelectedPartnerTypes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

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

    const fetchFilterData = async () => {
      try {
        const pSnap = await getDocs(collection(db, `apps/${APP_ID}/partners`));
        const ptSnap = await getDocs(collection(db, `apps/${APP_ID}/partner_types`));
        setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        setPartnerTypes(ptSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      } catch (error) {
        console.error("Fehler beim Laden der Filterdaten:", error);
      }
    };
    fetchFilterData();

    return () => {
      unsubBookings();
      unsubEvents();
    };
  }, []);

  const parseEventDate = (dateVal: any) => {
      if (!dateVal) return new Date(0);
      if (dateVal.toDate) return dateVal.toDate();
      if (typeof dateVal === 'string') {
          const datePart = dateVal.split(' ')[0];
          if (datePart.includes('.')) {
              const [d, m, y] = datePart.split('.');
              return new Date(`${y}-${m}-${d}T00:00:00`);
          }
          return new Date(dateVal);
      }
      return new Date(0);
  };

  const { filteredBookings, totalRevenue, paidRevenue, totalTickets, occupancyRate } = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const validEvents = events.filter(e => {
        const d = parseEventDate(e.date);
        return d >= start && d <= end;
    });
    const validEventIds = validEvents.map(e => e.id);

    let fBookings = bookings.filter(b => {
        let isDateValid = false;
        const bDateStr = b.lastPayload?.event_date_time || b.eventDate || b.dateTime;

        if (b.eventId && validEventIds.includes(b.eventId)) {
            isDateValid = true;
        } else if (bDateStr) {
            const parsed = parseEventDate(bDateStr);
            isDateValid = parsed.getTime() > 0 && parsed >= start && parsed <= end;
        } else {
            const bDate = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as any);
            isDateValid = bDate >= start && bDate <= end;
        }
        if (!isDateValid) return false;

        if (selectedPartners.length > 0) {
            const bPartnerId = b.partnerId || 'direct';
            if (!selectedPartners.includes(bPartnerId)) return false;
        }

        if (selectedPartnerTypes.length > 0) {
            const partner = partners.find(p => p.id === b.partnerId);
            const pType = partner?.typeId || 'none';
            if (!selectedPartnerTypes.includes(pType)) return false;
        }

        return true;
    });
    
    let tRevenue = 0;
    let pRevenue = 0;
    let tTickets = 0;

    fBookings.forEach(b => {
      const display = getBookingDisplayData(b);
      // Regiondo statuses can vary (e.g. "cancelled", "storniert", etc.) but usually contain 'cancel' if we look for the english label
      if (!display.status.includes('cancel')) {
        tRevenue += display.totalAmount || 0;
        if (display.status.includes('paid') || display.status.includes('bezahlt') || display.status === 'confirmed') {
          pRevenue += display.totalAmount || 0;
        }
        tTickets += display.quantity || 0;
      }
    });

    // Calculate total capacity based on the number of events (67 seats per event)
    const totalCapacity = validEvents.reduce((acc, e) => acc + (e.totalCapacity || 67), 0);
    
    // Sum up the recorded 'occupied' counts from the events in this range
    const totalOccurrencesCount = validEvents.reduce((acc, e) => acc + (e.occupied || 0), 0);
    
    // We use the higher count between direct bookings and the event-level occupancy field
    // to ensure we capture all attendees.
    const effectiveBooked = Math.max(tTickets, totalOccurrencesCount);
    
    const occRate = totalCapacity > 0 ? Math.round((effectiveBooked / totalCapacity) * 100) : 0;


    const enrichedBookings = fBookings.map(b => {
       let resolvedEventDateString = '';
       let resolvedEventDateObject: Date | null = null;

       if (b.eventId && events.some(ev => ev.id === b.eventId)) {
         const e = events.find(ev => ev.id === b.eventId);
         if (e && e.date) {
           const d = parseEventDate(e.date);
           resolvedEventDateObject = d;
           resolvedEventDateString = `${d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${e.time || ''}`;
         }
       } else {
         const bDateStr = b.lastPayload?.event_date_time || b.eventDate || b.dateTime;
         if (bDateStr) {
             const d = parseEventDate(bDateStr);
             resolvedEventDateObject = d;
             resolvedEventDateString = d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
         } else {
             const createdDate = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as any);
             resolvedEventDateObject = createdDate;
             resolvedEventDateString = createdDate.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + createdDate.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
         }
       }

       return {
           ...b,
           resolvedEventDate: resolvedEventDateObject,
           resolvedEventDateString: resolvedEventDateString
       };
    }).sort((a, b) => (b.resolvedEventDate?.getTime() || 0) - (a.resolvedEventDate?.getTime() || 0));

    return {
      filteredBookings: enrichedBookings,
      totalRevenue: tRevenue,
      paidRevenue: pRevenue,
      totalTickets: tTickets,
      occupancyRate: occRate
    };
  }, [startDate, endDate, bookings, events, selectedPartners, selectedPartnerTypes, partners]);

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold animate-pulse">Lade Statistiken...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-heading text-brand-primary font-bold">Statistiken & Übersicht</h1>
          <p className="text-gray-500 mt-1 font-medium">Auswertung Ihrer Verkäufe & Auslastung nach Event-Zeitraum</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-colors border ${showFilters || selectedPartners.length > 0 || selectedPartnerTypes.length > 0 ? 'bg-brand-primary text-white border-brand-primary shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >
            <Filter className="w-4 h-4" />
            Filter {(selectedPartners.length > 0 || selectedPartnerTypes.length > 0) && `(${(selectedPartners.length > 0 ? 1 : 0) + (selectedPartnerTypes.length > 0 ? 1 : 0)})`}
          </button>
          <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-200">
            <CalendarIcon className="w-5 h-5 text-gray-400 ml-2" />
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent border-none font-bold text-gray-700 focus:ring-0 outline-none cursor-pointer"
            />
            <span className="text-gray-400 font-bold">-</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent border-none font-bold text-gray-700 focus:ring-0 outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 animate-in slide-in-from-top-2">
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-2">Nach Partner filtern</label>
            <select 
              multiple 
              className="w-full p-3 border border-gray-200 rounded-xl text-sm h-32 focus:ring-2 focus:ring-brand-primary outline-none font-medium bg-gray-50"
              value={selectedPartners}
              onChange={(e) => setSelectedPartners(Array.from(e.target.selectedOptions, option => option.value))}
            >
              <option value="direct" className="p-1">Direktbuchungen (Kein Partner)</option>
              {partners.map(p => <option key={p.id} value={p.id} className="p-1">{p.name}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-2 font-medium">Strg/Cmd gedrückt halten für Mehrfachauswahl</p>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-2">Nach Partner-Typ filtern</label>
            <select 
              multiple 
              className="w-full p-3 border border-gray-200 rounded-xl text-sm h-32 focus:ring-2 focus:ring-brand-primary outline-none font-medium bg-gray-50"
              value={selectedPartnerTypes}
              onChange={(e) => setSelectedPartnerTypes(Array.from(e.target.selectedOptions, option => option.value))}
            >
              <option value="none" className="p-1">Ohne Typ</option>
              {partnerTypes.map(pt => <option key={pt.id} value={pt.id} className="p-1">{pt.name}</option>)}
            </select>
          </div>
          {(selectedPartners.length > 0 || selectedPartnerTypes.length > 0) && (
            <div className="flex items-end pb-6">
              <button 
                onClick={() => { setSelectedPartners([]); setSelectedPartnerTypes([]); }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-bold transition-colors border border-red-100"
              >
                <X className="w-4 h-4" /> Filter zurücksetzen
              </button>
            </div>
          )}
        </div>
      )}

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
             <div className="text-sm font-bold text-green-600 bg-green-50 w-max px-3 py-1 rounded-lg border border-green-100">
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
             <div className="text-sm font-bold text-gray-500 bg-gray-50 w-max px-3 py-1 rounded-lg border border-gray-100">
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
             <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
                <div className="bg-brand-primary h-3 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, occupancyRate)}%` }}></div>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
           <h2 className="text-lg font-bold text-gray-900">Transaktionen im Zeitraum</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="p-4 font-bold">Kunde / Name</th>
                <th className="p-4 font-bold">Event-Datum</th>
                <th className="p-4 font-bold">Partner</th>
                <th className="p-4 font-bold">Tickets</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold text-right">Summe</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-500 font-medium">
                    Keine Buchungen für diesen Zeitraum und diese Filter gefunden.
                  </td>
                </tr>
              ) : (
                filteredBookings.map(b => {
                  const partnerName = b.partnerId ? partners.find(p => p.id === b.partnerId)?.name : 'Direkt';
                  const display = getBookingDisplayData(b);
                  return (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-red-50/30 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-900 text-base">{display.customerName}</div>
                        <div className="text-sm text-gray-500 font-medium">{display.customerEmail}</div>
                        {b.isB2B && <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded">B2B</span>}
                      </td>
                      <td className="p-4 text-gray-700 font-bold">
                        {b.resolvedEventDateString}
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                          {partnerName || 'Unbekannt'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-700 font-bold">
                         {display.quantity} Plätze
                      </td>
                      <td className="p-4">
                         <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                           display.status.includes('paid') || display.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' :
                           display.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                           'bg-yellow-50 text-yellow-700 border-yellow-200'
                         }`}>
                           {display.status}
                         </span>
                      </td>
                      <td className="p-4 text-right font-black text-gray-900 text-lg">
                        € {display.totalAmount.toLocaleString('de-AT', {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
