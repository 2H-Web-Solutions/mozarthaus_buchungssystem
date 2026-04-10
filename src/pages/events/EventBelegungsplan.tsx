import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where, or } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { Event, Booking } from '../../types/schema';
import type { Musiker } from '../../services/firebase/musikerService';
import { SeatingChartVisual } from '../../components/events/SeatingChartVisual';
import { EventMusikerAssignment } from '../../components/events/EventMusikerAssignment';
import { EventBookingTable } from '../../components/events/EventBookingTable';
import { ArrowLeft, FileText, Printer, Users, Music } from 'lucide-react';

export function EventBelegungsplan() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [musikerList, setMusikerList] = useState<Musiker[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    // 1. Fetch Event Document
    const unsubEvent = onSnapshot(doc(db, `apps/${APP_ID}/events`, eventId), (snap) => {
      if (snap.exists()) {
        setEvent({ id: snap.id, ...snap.data() } as Event);
      } else {
        alert("Event nicht gefunden.");
        navigate('/events');
      }
    });

    // 2. Fetch all Musiker
    const unsubMusiker = onSnapshot(collection(db, `apps/${APP_ID}/musiker`), (snap) => {
      const list: Musiker[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Musiker));
      list.sort((a, b) => a.nachname.localeCompare(b.nachname));
      setMusikerList(list);
    });

    // 3. Fetch all Bookings for this Event (Handling both manual and synced field names)
    const q = query(
      collection(db, `apps/${APP_ID}/bookings`), 
      or(
        where('eventId', '==', eventId),
        where('eventDocId', '==', eventId)
      )
    );
    
    const unsubBookings = onSnapshot(q, (snap) => {
      const bList: Booking[] = [];
      snap.forEach(d => bList.push({ id: d.id, ...d.data() } as Booking));
      setBookings(bList);
      setIsLoading(false);
    });

    return () => {
      unsubEvent();
      unsubMusiker();
      unsubBookings();
    };
  }, [eventId, navigate]);

  if (isLoading || !event) {
    return (
      <div className="flex flex-col gap-4 animate-pulse pt-10 px-8">
        <div className="h-10 bg-gray-200 rounded w-1/4"></div>
        <div className="flex gap-6 mt-6">
           <div className="h-96 bg-gray-200 rounded-xl w-1/2"></div>
           <div className="h-96 bg-gray-200 rounded-xl w-1/2"></div>
        </div>
        <div className="h-64 bg-gray-200 rounded-xl w-full mt-6"></div>
      </div>
    );
  }

  // Calculate stats for visuals
    

  const eventDateStr = typeof event.date !== 'string' && (event.date as any)?.toDate 
    ? (event.date as any).toDate().toLocaleDateString('de-AT', { dateStyle: 'full' }) 
    : String(event.date);

  console.log("DEBUG: Bookings for this event:", bookings);

  return (
    <div className="max-w-[1400px] mx-auto pb-12 print:pb-0 print:max-w-none px-4 md:px-8">
      
      {/* Print-Only Header */}
      <div className="hidden print:block mb-8 border-b-2 border-black pb-4">
        <h1 className="text-3xl font-bold font-heading text-black m-0 mb-1">{event.title}</h1>
        <p className="text-xl text-black font-medium m-0">
          {eventDateStr} | {event.time || ''} Uhr
        </p>
        <h2 className="text-xl font-bold mt-2 uppercase tracking-widest text-gray-500">Belegungs- & Abendkassenplan</h2>
      </div>

      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden pt-8">
        <div>
          <button 
            onClick={() => navigate('/events')}
            className="flex items-center gap-2 text-gray-400 hover:text-brand-primary font-bold text-xs uppercase tracking-widest mb-4 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Zurück zu Events
          </button>
          <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
            <FileText className="w-10 h-10 text-brand-red opacity-90" />
            Belegungsplan
          </h1>
          <p className="text-slate-500 font-bold mt-2 text-lg">
            {event.title} <span className="text-slate-300 mx-3">|</span> {eventDateStr} {event.time || ''} Uhr
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="px-6 py-3 bg-slate-900 text-white font-black rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 transform active:scale-95"
          >
            <Printer className="w-5 h-5" />
            DRUCKEN
          </button>
          <button 
            onClick={() => navigate(`/events/${event.id}`)}
            className="px-6 py-3 bg-white text-slate-700 font-black border-2 border-slate-100 rounded-xl shadow-sm hover:border-brand-red/30 hover:bg-slate-50 transition-all transform active:scale-95"
          >
             KASSE ÖFFNEN
          </button>
        </div>
      </div>

      {/* restored Seating Chart and Musician sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 mt-8 print:block print:w-full print:mt-2 print:mb-4">
        {/* Left: Visueller Saalplan */}
        <div className="flex flex-col gap-3 print:mb-8 print:w-1/2 print:mx-auto">
          <h2 className="text-xl font-heading font-bold text-gray-900 flex items-center justify-between px-2 print:hidden mb-2">
            <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                Saalplan
            </div>
            <span className="text-sm font-bold bg-brand-red text-white px-3 py-1 rounded-full shadow-lg shadow-brand-red/10 animate-pulse">
                {Object.values(event.seating || {}).filter(s => !!s.bookingId).length} / {event.totalCapacity || 67} Belegt
            </span>
          </h2>
          <div className="glass-card p-4">
            <SeatingChartVisual eventId={eventId!} seating={event.seating} readOnly={true} />
          </div>
        </div>
        
        {/* Right: Musiker & Dienstplan */}
        <div className="flex flex-col gap-3 print:hidden">
          <h2 className="text-xl font-heading font-bold text-gray-900 flex items-center gap-2 px-2 mb-2">
            <Music className="w-5 h-5 text-gray-400" />
            Dienstplan
          </h2>
          <EventMusikerAssignment event={event} musikerList={musikerList} />
        </div>
      </div>

      {/* Main Content: Booking Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Detaillierte Teilnehmerliste</h2>
        </div>
        <EventBookingTable bookings={bookings} seating={event.seating || {}} />
      </div>

      <div className="mt-8 p-6 bg-amber-50 rounded-2xl border border-amber-100/50 print:hidden">
        <p className="text-xs font-bold text-amber-700 flex items-center gap-2">
            💡 TIPP: Klicken Sie auf "DRUCKEN" um eine physische Liste für den Einlass zu generieren. Erstattete Buchungen erscheinen hier nicht.
        </p>
      </div>
    </div>
  );
}
