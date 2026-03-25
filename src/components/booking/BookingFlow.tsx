import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { useNavigate } from 'react-router-dom';
import { executeBookingTransaction } from '../../services/transactionService';
import { Event } from '../../types/schema';
import { SeatMap } from './SeatMap';
import { CalendarDays, Ticket, Building2, ChevronRight, CheckCircle2 } from 'lucide-react';

export function BookingFlow() {
  const navigate = useNavigate();
  // Section 1
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  
  // Section 2
  const [partners, setPartners] = useState<{id: string, name: string, type: string}[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  
  // Section 3
  const [catA, setCatA] = useState(0); 
  const [catB, setCatB] = useState(0); 
  const [student, setStudent] = useState(0); 
  
  // Realtime Pricing State
  const [priceCatA, setPriceCatA] = useState(69);
  const [priceCatB, setPriceCatB] = useState(59);
  const [priceStudent, setPriceStudent] = useState(42);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending');
  
  // Section 4
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const derivedEventId = selectedEventId;
  const variant = selectedEventId.split('_')[0] || '';

  // Fix 1: Reset seats when event/date changes to prevent ghost bookings
  useEffect(() => {
    setSelectedSeats([]);
  }, [derivedEventId]);

  // Fix 2: Truncate seats if ticket count is reduced below selected seats
  useEffect(() => {
    const total = catA + catB + student;
    if (selectedSeats.length > total) {
      setSelectedSeats(prev => prev.slice(0, total));
    }
  }, [catA, catB, student, selectedSeats.length]);

  useEffect(() => {
    const fetchPartnersData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, `apps/${APP_ID}/partners`));
        const partnerData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.data().companyName || 'Unbenannt',
          type: doc.data().type || ''
        }));
        setPartners(partnerData);
      } catch (error) {
        console.error('Fehler beim Laden der Partner:', error);
      }
    };
    fetchPartnersData();
    
    // Live stream master pricing configs
    const unsubPricing = onSnapshot(doc(db, `apps/${APP_ID}/config`, 'pricing'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.catA !== undefined) setPriceCatA(data.catA);
        if (data.catB !== undefined) setPriceCatB(data.catB);
        if (data.student !== undefined) setPriceStudent(data.student);
      }
    });

    // Fetch live Events
    const unsubEvents = onSnapshot(query(collection(db, `apps/${APP_ID}/events`), orderBy('date', 'asc')), snap => {
      const evts: Event[] = [];
      const now = Date.now();
      snap.forEach(d => {
         const ev = { id: d.id, ...d.data() } as Event;
         // Optional: filter past events
         if (ev.date.toMillis() >= now) evts.push(ev);
      });
      setAvailableEvents(evts);
    });

    return () => {
      unsubPricing();
      unsubEvents();
    };
  }, []);

  const totalPrice = (catA * priceCatA) + (catB * priceCatB) + (student * priceStudent);
  const totalTickets = catA + catB + student;

  const handleSubmit = async () => {
    if (!selectedEventId) return alert("Bitte wähle ein Konzert aus.");
    if (totalTickets === 0) return alert("Bitte wähle mindestens ein Ticket aus der Kategorie aus.");
    if (selectedSeats.length !== totalTickets) return alert(`Bitte weise genau ${totalTickets} Sitzplätze im physischen Saalplan zu.`);
    if (!customerName || !customerEmail) return alert("Kundenname und Email sind zwingend erforderlich.");

    setIsSubmitting(true);
    try {
      const tickets = [];
      if (catA > 0) tickets.push({ categoryId: 'cat_a', quantity: catA });
      if (catB > 0) tickets.push({ categoryId: 'cat_b', quantity: catB });
      if (student > 0) tickets.push({ categoryId: 'student', quantity: student });

      const selectedEvent = availableEvents.find(e => e.id === selectedEventId);

      await executeBookingTransaction({
        eventId: derivedEventId,
        variantId: variant,
        eventTitle: selectedEvent?.title || '',
        eventDate: selectedEvent?.date ? selectedEvent.date.toDate().toISOString() : '',
        partnerId: selectedPartnerId || null,
        isB2B: !!selectedPartnerId,
        source: selectedPartnerId ? 'b2b' : 'manual',
        status: paymentStatus,
        tickets,
        customerData: { name: customerName, email: customerEmail },
        totalAmount: totalPrice
      }, selectedSeats);
      
      setSuccess(true);
      setTimeout(() => navigate('/bookings'), 3000);
    } catch (err: any) {
      console.error(err);
      alert("Schwerer Fehler bei der Transaktion: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-3xl mx-auto mt-20 p-12 bg-white rounded-2xl shadow-xl text-center border border-gray-100 flex flex-col items-center">
         <CheckCircle2 className="w-24 h-24 text-green-500 mb-6 animate-in zoom-in" />
         <h2 className="text-3xl font-heading font-bold text-gray-900 mb-2">Transaktion erfolgreich!</h2>
         <p className="text-gray-500 text-lg">Die Reservierung wurde als "Pending" im Zentralsystem erfasst.</p>
         <p className="text-sm text-gray-400 mt-6 animate-pulse">Sie werden zur Buchungsübersicht weitergeleitet...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-heading text-brand-primary font-bold">Varianten-Buchung (Mozart Ensemble)</h1>
        <p className="text-gray-500 mt-2 text-lg font-medium">Regiondo B2B Flow & asymmetrische Kontingentbuchung</p>
      </div>

      {/* Sektion 1: Event & Termin */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-primary shadow-[0_0_10px_#c02a2a]"></div>
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-brand-primary"/> 1. Event & Termin Option
        </h2>
        
        <div className="grid grid-cols-1 gap-6">
           <div>
             <label className="block text-sm font-bold text-gray-700 mb-2">Konzert / Event auswählen</label>
             <select 
               value={selectedEventId} 
               onChange={e => setSelectedEventId(e.target.value)} 
               className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none bg-gray-50 text-gray-900 font-bold cursor-pointer transition-shadow shadow-inner"
             >
               <option value="">-- Bitte wählen --</option>
               {availableEvents.map(e => (
                 <option key={e.id} value={e.id}>
                   {e.date.toDate().toLocaleString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr — {e.title}
                 </option>
               ))}
             </select>
           </div>
        </div>
      </section>

      {/* Sektion 2: Kundendaten & B2B */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-500"/> 2. Käuferdetails & Partner-Zuweisung
        </h2>
        
        <div className="space-y-6">
           {/* Partner Auswahl (B2B) */}
           <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
             <label className="block text-sm font-medium text-gray-700 mb-2">
               B2B Partner (Optional)
             </label>
             <select
               value={selectedPartnerId}
               onChange={(e) => setSelectedPartnerId(e.target.value)}
               className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#c02a2a] focus:border-transparent"
             >
               <option value="">-- Kein Partner (Direktbuchung) --</option>
               {partners.map(partner => (
                 <option key={partner.id} value={partner.id}>
                   {partner.name} {partner.type ? `(${partner.type})` : ''}
                 </option>
               ))}
             </select>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Vor- und Nachname</label>
               <input type="text" placeholder="Max Mustermann" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none shadow-sm" />
             </div>
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Gültige E-Mail Adresse</label>
               <input type="email" placeholder="max@example.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none shadow-sm" />
             </div>
           </div>
           
           <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
             <label className="block text-sm font-medium text-gray-700 mb-3">
               Zahlungsstatus
             </label>
             <div className="flex gap-4">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input
                   type="radio"
                   name="paymentStatus"
                   value="pending"
                   checked={paymentStatus === 'pending'}
                   onChange={(e) => setPaymentStatus(e.target.value as 'pending' | 'paid')}
                   className="text-[#c02a2a] focus:ring-[#c02a2a]"
                 />
                 <span className="text-sm text-gray-700">Noch offen (Zahlung ausstehend)</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input
                   type="radio"
                   name="paymentStatus"
                   value="paid"
                   checked={paymentStatus === 'paid'}
                   onChange={(e) => setPaymentStatus(e.target.value as 'pending' | 'paid')}
                   className="text-[#c02a2a] focus:ring-[#c02a2a]"
                 />
                 <span className="text-sm text-gray-700">Bereits bezahlt</span>
               </label>
             </div>
           </div>
        </div>
      </section>

      {/* Sektion 3: Tickets */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
        <h2 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
          <Ticket className="w-6 h-6 text-emerald-500"/> 3. Kontingente & Tickets
        </h2>
        
        <div className="grid grid-cols-1 items-stretch md:grid-cols-3 gap-6 mb-10">
           {/* Cat A */}
           <div className="p-6 border border-gray-200 rounded-2xl bg-gray-50 flex flex-col items-center justify-between shadow-sm">
             <div className="text-center mb-6">
                <span className="block text-xl font-bold text-gray-900 mb-1">
                  <div className="w-4 h-4 rounded-full bg-amber-500 shadow-sm inline-block mr-2"></div>
                  Kategorie A
                </span>
                <span className="block text-sm text-gray-500 font-medium">{priceCatA.toFixed(2)} € pro Ticket</span>
             </div>
             <div className="flex items-center gap-5">
               <button onClick={() => setCatA(Math.max(0, catA - 1))} className="w-12 h-12 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-2xl hover:bg-gray-100 shadow-sm active:scale-95 transition-transform">-</button>
               <span className="text-3xl font-heading font-bold w-10 text-center text-brand-primary">{catA}</span>
               <button onClick={() => setCatA(catA + 1)} className="w-12 h-12 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-2xl hover:bg-gray-100 shadow-sm active:scale-95 transition-transform">+</button>
             </div>
           </div>

           {/* Cat B */}
           <div className="p-6 border border-gray-200 rounded-2xl bg-gray-50 flex flex-col items-center justify-between shadow-sm">
             <div className="text-center mb-6">
                <span className="block text-xl font-bold text-gray-900 mb-1">
                  <div className="w-4 h-4 rounded-full bg-blue-500 shadow-sm inline-block mr-2"></div>
                  Kategorie B
                </span>
                <span className="block text-sm text-gray-500 font-medium">{priceCatB.toFixed(2)} € pro Ticket</span>
             </div>
             <div className="flex items-center gap-5">
               <button onClick={() => setCatB(Math.max(0, catB - 1))} className="w-12 h-12 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-2xl hover:bg-gray-100 shadow-sm active:scale-95 transition-transform">-</button>
               <span className="text-3xl font-heading font-bold w-10 text-center text-brand-primary">{catB}</span>
               <button onClick={() => setCatB(catB + 1)} className="w-12 h-12 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-2xl hover:bg-gray-100 shadow-sm active:scale-95 transition-transform">+</button>
             </div>
           </div>

           {/* Student */}
           <div className="p-6 border border-gray-200 rounded-2xl bg-gray-50 flex flex-col items-center justify-between shadow-sm">
             <div className="text-center mb-6">
                <span className="block text-xl font-bold text-gray-900 mb-1">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-sm inline-block mr-2"></div>
                  Student
                </span>
                <span className="block text-sm text-gray-500 font-medium">{priceStudent.toFixed(2)} € pro Ticket</span>
             </div>
             <div className="flex items-center gap-5">
               <button onClick={() => setStudent(Math.max(0, student - 1))} className="w-12 h-12 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-2xl hover:bg-gray-100 shadow-sm active:scale-95 transition-transform">-</button>
               <span className="text-3xl font-heading font-bold w-10 text-center text-brand-primary">{student}</span>
               <button onClick={() => setStudent(student + 1)} className="w-12 h-12 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-2xl hover:bg-gray-100 shadow-sm active:scale-95 transition-transform">+</button>
             </div>
           </div>
        </div>

        {/* Sektion 4: Saalplan */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500 shadow-[0_0_10px_#a855f7]"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
            <Ticket className="w-6 h-6 text-purple-500"/> 4. Saalplan-Zuweisung ({selectedSeats.length} / {totalTickets} zugewiesen)
          </h2>
          
          {totalTickets === 0 ? (
            <div className="p-8 text-center text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-xl font-medium">
               👆 Bitte definieren Sie zuerst die Ticket-Anzahl in Sektion 3, um die Plätze physisch zuzuweisen.
            </div>
          ) : !selectedEventId ? (
            <div className="p-8 text-center text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-xl font-medium">
               👆 Bitte wählen Sie zuerst ein Konzert aus Sektion 1, um den tagesaktuellen Saalplan zu laden.
            </div>
          ) : (
            <div className="overflow-hidden">
               <SeatMap 
                 eventId={derivedEventId}
                 requiredSeats={totalTickets}
                 selectedSeats={selectedSeats}
                 onSeatSelect={setSelectedSeats}
                 catCounts={{ catA, catB, student }}
               />
            </div>
          )}
        </section>

        {/* Checkout Bar */}
        <div className="bg-gray-900 p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
           <div className="z-10 text-center md:text-left">
             <p className="text-gray-400 font-bold mb-1 uppercase tracking-widest text-sm">Zusammenfassung: <strong className="text-brand-primary bg-red-500/10 px-2 py-0.5 rounded ml-1">{totalTickets} Ticket(s)</strong></p>
             <p className="text-4xl font-bold text-white tracking-tight">€ {totalPrice.toLocaleString('de-AT', {minimumFractionDigits: 2})}</p>
           </div>
           <button 
             onClick={handleSubmit} 
             disabled={isSubmitting || totalTickets === 0}
             className="w-full md:w-auto px-10 py-5 bg-brand-primary text-white text-xl font-bold rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 z-10"
           >
             {isSubmitting ? 'Transaktion läuft...' : 'Zahlungspflichtig Buchen'}
             {!isSubmitting && <ChevronRight className="w-7 h-7"/>}
           </button>
        </div>
      </section>
    </div>
  );
}
