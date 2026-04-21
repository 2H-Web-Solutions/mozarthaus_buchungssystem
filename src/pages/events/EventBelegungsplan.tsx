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
import { ArrowLeft, FileText, Printer, Users, Music, AlertTriangle, X, Mail } from 'lucide-react';

export function EventBelegungsplan() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [musikerList, setMusikerList] = useState<Musiker[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [partners, setPartners] = useState<{name: string, email: string}[]>([]);
  const [isStopSalesModalOpen, setIsStopSalesModalOpen] = useState(false);
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

    // 3. Fetch all Bookings for this Event (Handling both collections)
    const bookingsQ = query(
      collection(db, `apps/${APP_ID}/bookings`), 
      or(where('eventId', '==', eventId), where('eventDocId', '==', eventId))
    );
    const privateQ = query(
      collection(db, `apps/${APP_ID}/privatebooking`),
      or(where('eventId', '==', eventId), where('eventDocId', '==', eventId))
    );
    
    let b1: Booking[] = [];
    let b2: Booking[] = [];

    const updateBookingsList = () => {
      setBookings([...b1, ...b2]);
      setIsLoading(false);
    };

    const unsubB1 = onSnapshot(bookingsQ, (snap) => {
      b1 = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
      updateBookingsList();
    });

    const unsubB2 = onSnapshot(privateQ, (snap) => {
      b2 = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
      updateBookingsList();
    });

    // 4. Fetch Partners for Stop-Sales
    const unsubPartners = onSnapshot(collection(db, `apps/${APP_ID}/partners`), (snap) => {
      const pList: {name: string, email: string}[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.email) {
          pList.push({ name: data.name || data.companyName, email: data.email });
        }
      });
      setPartners(pList);
    });

    return () => {
      unsubEvent();
      unsubMusiker();
      unsubB1();
      unsubB2();
      unsubPartners();
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
  const bookedCount = Object.values(event.seating || {}).filter(s => !!s.bookingId).length;
  const capacity = event.totalCapacity || 67;
  const occupancyRate = bookedCount / capacity;

  const eventDateStr = typeof event.date !== 'string' && (event.date as any)?.toDate 
    ? (event.date as any).toDate().toLocaleDateString('de-AT', { dateStyle: 'full' }) 
    : String(event.date);

  console.log("DEBUG: Bookings for this event:", bookings);

  return (
    <div className="max-w-[1400px] mx-auto pb-12 print:pb-0 print:max-w-none print:w-full print:mx-0 print:px-0 print:py-0 px-4 md:px-8">
      
      {/* Print-Only Header */}
      <div className="hidden print:block mb-10 border-b-4 border-black pb-6 w-full">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-4xl font-black font-heading text-black m-0 mb-1">MOZARTHAUS VIENNA</h1>
            <p className="text-2xl text-black font-bold m-0 uppercase tracking-tighter italic">Konzertsaal im Figaro-Haus</p>
          </div>
          <div className="text-right">
             <h2 className="text-2xl font-black text-black uppercase tracking-widest border-2 border-black px-4 py-1">SEATING LIST</h2>
             <p className="text-sm font-bold mt-1 text-gray-600">Stand: {new Date().toLocaleString('de-AT')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mt-6">
          <div className="space-y-2">
            <p className="text-lg text-black font-medium border-l-4 border-black pl-3">
              <span className="text-gray-400 font-black uppercase text-xs block tracking-widest">EVENT</span>
              {event.title}
            </p>
            <p className="text-lg text-black font-medium border-l-4 border-black pl-3">
              <span className="text-gray-400 font-black uppercase text-xs block tracking-widest">DATUM & UHRZEIT</span>
              {eventDateStr} | {event.time || ''} Uhr
            </p>
          </div>
          
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 p-4 rounded-xl flex items-center justify-around">
            <div className="text-center">
              <span className="text-[10px] font-black uppercase text-gray-500 block">Belegung</span>
              <p className="text-2xl font-black text-black">
                {Math.round((Object.values(event.seating || {}).filter(s => !!s.bookingId).length / (event.totalCapacity || 67)) * 100)}%
              </p>
            </div>
            <div className="w-px h-10 bg-gray-200"></div>
            <div className="text-center">
              <span className="text-[10px] font-black uppercase text-gray-500 block">Teilnehmer</span>
              <p className="text-2xl font-black text-black">
                {bookedCount} / {capacity}
              </p>
            </div>
            <div className="w-px h-10 bg-gray-200"></div>
            <div className="text-center">
               <span className="text-[10px] font-black uppercase text-gray-500 block">Tickets</span>
               <div className="flex gap-2 text-xs font-bold text-gray-600 mt-1">
                 <span>A: {Object.values(event.seating || {}).filter(s => s.category === 'A' && !!s.bookingId).length}</span>
                 <span>B: {Object.values(event.seating || {}).filter(s => s.category === 'B' && !!s.bookingId).length}</span>
                 <span className="text-green-700">S: {Object.values(event.seating || {}).filter(s => s.category === 'STUDENT' && !!s.bookingId).length}</span>
               </div>
            </div>
          </div>
        </div>
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
          <div className="flex items-center gap-3 mt-2">
            <p className="text-slate-500 font-bold text-lg">
              <span>{event.title}</span> <span className="text-slate-300 mx-3">|</span> <span>{eventDateStr}</span> <span>{event.time || ''} Uhr</span>
            </p>
            {event.is_private && (
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-amber-200">
                Privat-Event
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="px-6 py-3 bg-slate-900 text-white font-black rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 transform active:scale-95"
          >
            <Printer className="w-5 h-5" />
            DRUCKEN
          </button>
        </div>
      </div>

      {/* Stop-Sales Banner */}
      {occupancyRate >= 0.8 && (
        <div className="mb-6 bg-red-100 text-red-800 border border-red-300 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between print:hidden shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <AlertTriangle className="w-8 h-8 text-brand-red flex-shrink-0" />
            <div>
              <p className="font-bold text-lg">Achtung: Kapazitätsgrenze erreicht ({(occupancyRate * 100).toFixed(0)}%)</p>
              <p className="text-sm opacity-90">Bitte benachrichtigen Sie die B2B Partner um Überbuchungen zu vermeiden.</p>
            </div>
          </div>
          <button 
            onClick={() => setIsStopSalesModalOpen(true)}
            className="px-5 py-2.5 bg-brand-red text-white font-bold rounded-lg hover:bg-red-800 transition shadow-md flex items-center gap-2 whitespace-nowrap"
          >
             <Mail className="w-5 h-5" /> Stop-Sales an Partner senden
          </button>
        </div>
      )}

      {/* Page 1: Seating Chart & Musicians (Stacked in print) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 mt-8 print:flex print:flex-col print:gap-8 print:w-full print:mt-2 print:mb-0">
        {/* Left/Top: Visueller Saalplan */}
        <div className="flex flex-col gap-3 print:w-full print:items-center">
          <h2 className="text-xl font-heading font-bold text-gray-900 flex items-center justify-between px-2 print:hidden mb-2">
            <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                Saalplan
            </div>
            <span className="text-sm font-bold bg-brand-red text-white px-3 py-1 rounded-full shadow-lg shadow-brand-red/10 animate-pulse">
                {bookedCount} / {capacity} Belegt
            </span>
          </h2>
          <div className="glass-card p-4 print:p-0 print:border-none print:shadow-none print:w-full">
            <SeatingChartVisual eventId={eventId!} seating={event.seating} bookings={bookings} readOnly={true} />
          </div>
        </div>
        
        {/* Right/Bottom: Musiker & Dienstplan */}
        <div className="flex flex-col gap-3 print:w-full print:mt-4">
          <h2 className="text-xl font-heading font-bold text-gray-900 flex items-center gap-2 px-2 mb-2 print:text-black print:uppercase print:tracking-widest print:text-sm print:font-black print:border-b-2 print:border-black print:pb-1">
            <Music className="w-5 h-5 text-gray-400 print:hidden" />
            Ensemble & Musiker Gagen
          </h2>
          <EventMusikerAssignment event={event} musikerList={musikerList} />
        </div>
      </div>

      {/* Page 2: Participant List */}
      <div className="glass-card overflow-hidden print:break-before print:mt-0 mt-8">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between print:bg-white print:border-b-2 print:border-black print:py-4">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest print:text-black print:text-lg">Detaillierte Teilnehmerliste</h2>
        </div>
        <EventBookingTable bookings={bookings} seating={event.seating || {}} />
      </div>

      <div className="mt-8 p-6 bg-amber-50 rounded-2xl border border-amber-100/50 print:hidden">
        <p className="text-xs font-bold text-amber-700 flex items-center gap-2">
            💡 TIPP: Klicken Sie auf "DRUCKEN" um eine physische Liste für den Einlass zu generieren. Erstattete Buchungen erscheinen hier nicht.
        </p>
      </div>

      {/* Stop-Sales Modal */}
      {isStopSalesModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[80vh] animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
               <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900">
                  <AlertTriangle className="text-brand-red w-6 h-6" /> Stop-Sales Benachrichtigung
               </h3>
               <button onClick={() => setIsStopSalesModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5"/>
               </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
               <p className="text-slate-600 mb-4 text-sm">
                 Folgende Partner haben eine hinterlegte E-Mail-Adresse und werden ins <span className="font-bold text-slate-800">BCC (Blindkopie)</span> gesetzt:
               </p>
               <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4 max-h-64 overflow-y-auto">
                 {partners.length === 0 ? (
                   <p className="text-red-500 italic text-sm font-medium">Keine Partner mit E-Mail-Adresse im System gefunden.</p>
                 ) : (
                   <ul className="space-y-3">
                     {partners.map((p, i) => (
                       <li key={i} className="flex justify-between items-center text-sm border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                         <span className="font-bold text-slate-700">{p.name || 'Unbenannt'}</span>
                         <span className="text-slate-500 bg-white px-2 py-1 rounded border border-slate-100">{p.email}</span>
                       </li>
                     ))}
                   </ul>
                 )}
               </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50 rounded-b-2xl">
               <button 
                 onClick={() => setIsStopSalesModalOpen(false)}
                 className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-colors"
               >
                 Abbrechen
               </button>
               {partners.length > 0 && (
                 <a 
                   href={`mailto:?bcc=${partners.map(p => p.email).join(',')}&subject=${encodeURIComponent(`Stop Sales: Mozarthaus Konzert am ${eventDateStr}`)}&body=${encodeURIComponent(`Sehr geehrte Partner,\n\nbitte stoppen Sie ab sofort den Ticketverkauf für das Konzert am ${eventDateStr}, da wir die Kapazitätsgrenze erreicht haben.\n\nVielen Dank.`)}`}
                   className="px-5 py-2.5 bg-brand-red text-white font-bold rounded-lg hover:bg-red-800 transition shadow-md flex items-center gap-2"
                   onClick={() => setIsStopSalesModalOpen(false)}
                 >
                   E-Mail Programm öffnen
                 </a>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
