import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { useNavigate } from 'react-router-dom';
import { executeBookingTransaction } from '../../services/transactionService';
import { Event, TicketCategory } from '../../types/schema';
import { listenTicketCategories } from '../../services/firebase/pricingService';
import { createPrivateReservation } from '../../services/privateReservationService';
import { purchaseWithRegiondo } from '../../services/regiondoBookingPurchase';
import { CalendarDays, Ticket, Building2, ChevronRight, CheckCircle2, Users, User, UsersRound } from 'lucide-react';

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
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [bookingType, setBookingType] = useState<'einzel' | 'gruppe' | 'privat'>('einzel');
  const [sellerReference, setSellerReference] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [groupPersons, setGroupPersons] = useState<number | ''>('');
  const [customTotalPrice, setCustomTotalPrice] = useState<number | ''>('');
  
  const [privateEventDate, setPrivateEventDate] = useState('');
  const [privateEventTime, setPrivateEventTime] = useState('');
  const [privateEventTitle, setPrivateEventTitle] = useState('Mozart Ensemble');
  
  // Section 3
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  


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
    const unsubPricing = listenTicketCategories(cats => {
      setCategories(cats.filter(c => c.isActive).sort((a,b) => b.price - a.price)); // Highest price first
    });

    // Fetch live Events
    const unsubEvents = onSnapshot(query(collection(db, `apps/${APP_ID}/events`), orderBy('date', 'asc')), snap => {
      const evts: any[] = [];
      const now = Date.now();
      snap.forEach(d => {
         const data = d.data();
         const ev = { id: d.id, ...data };
         let eventTime = 0;
         if (data.date && typeof data.date.toDate === 'function') {
           eventTime = data.date.toMillis();
         } else if (data.date) {
           eventTime = new Date(`${data.date}T${data.time || '00:00'}`).getTime();
         }
         // Optional: filter past events
         if (!eventTime || eventTime >= now) evts.push(ev);
      });
      setAvailableEvents(evts);
    });

    return () => {
      unsubPricing();
      unsubEvents();
    };
  }, []);

  let totalPrice = 0;
  let totalTickets = 0;
  
  if (bookingType === 'einzel') {
    categories.forEach(c => {
      const q = quantities[c.id] || 0;
      totalPrice += q * c.price;
      totalTickets += q;
    });
  } else {
    totalPrice = Number(customTotalPrice) || 0;
    totalTickets = Number(groupPersons) || 0;
  }

  const categoryAllocations = categories.map(c => ({
    id: c.id,
    name: c.name,
    quantity: quantities[c.id] || 0,
    colorCode: c.colorCode
  }));

  const handleSubmit = async () => {
    
    if (bookingType === 'einzel') {
      if (totalTickets === 0) return alert("Bitte wähle mindestens ein Ticket aus der Kategorie aus.");
      if (!customerName || !customerEmail || !customerPhone) return alert("Kundenname, Email und Telefonnummer sind zwingend erforderlich.");
    } else if (bookingType === 'gruppe') {
      if (!selectedPartnerId) return alert("Bitte wähle einen Partner für die Gruppenbuchung aus.");
      if (!sellerReference || !contactPerson) return alert("Verkäuferreferenz und Kontaktperson sind erforderlich.");
      if (!groupPersons || !customTotalPrice) return alert("Personenanzahl und Gesamtpreis sind erforderlich.");
    } else if (bookingType === 'privat') {
      if (!customerName || !customerEmail || !customerPhone) return alert("Kundenname, Email und Telefonnummer sind zwingend erforderlich.");
      if (!groupPersons || !customTotalPrice) return alert("Personenanzahl und Gesamtpreis sind erforderlich.");
      if (!privateEventDate || !privateEventTime) return alert("Bitte Datum und Uhrzeit für das Privat-Event angeben.");
    }

    if (bookingType !== 'privat') {
      if (!selectedEventId) return alert("Bitte wähle ein Konzert aus.");
    }

    setIsSubmitting(true);
    try {
      if (bookingType === 'privat') {
        const result = await createPrivateReservation({
          title: privateEventTitle || `Privat Event - ${customerName}`,
          date: privateEventDate,
          time: privateEventTime,
          customerName,
          customerEmail,
          customerPhone,
          guestCount: Number(groupPersons),
          totalPrice: Number(customTotalPrice)
        });
        console.log("Private Reservation Created:", result);
      } else {
        const selectedEvent = availableEvents.find(e => e.id === selectedEventId);
        
        let regiondoResult = null;
        if (bookingType === 'einzel' && selectedEvent?.regiondoId) {
          // Handle Regiondo Purchase
          const eventDateRaw = selectedEvent.date;
          const dateYmd = eventDateRaw 
            ? (typeof (eventDateRaw as any).toDate === 'function' 
                ? (eventDateRaw as any).toDate().toISOString().split('T')[0] 
                : (eventDateRaw as string).split('T')[0]) 
            : '';

          const regiondoCats = categories
            .filter(c => (quantities[c.id] || 0) > 0)
            .map(c => ({
              name: c.name,
              quantity: quantities[c.id],
              regiondoOptionId: c.regiondoOptionId
            }));

          regiondoResult = await purchaseWithRegiondo({
            productId: selectedEvent.regiondoId,
            dateYmd,
            time: selectedEvent.time || '19:00', // Default if missing
            categories: regiondoCats,
            customerData: {
              name: customerName,
              email: customerEmail,
              phone: customerPhone
            }
          });
          console.log("Regiondo Purchase Success:", regiondoResult);
        }

        const tickets = bookingType === 'einzel' ? categories
          .filter(c => (quantities[c.id] || 0) > 0)
          .map(c => ({ categoryId: c.id, quantity: quantities[c.id] })) : [];

        const eventDateRaw = selectedEvent?.date;
        const finalEventDateStr = eventDateRaw 
          ? (typeof (eventDateRaw as any).toDate === 'function' ? (eventDateRaw as any).toDate().toISOString() : eventDateRaw as string) 
          : '';

        await executeBookingTransaction({
          eventId: selectedEventId,
          variantId: selectedEventId.split('_')[0] || '',
          eventTitle: selectedEvent?.title || '',
          eventDate: finalEventDateStr,
          partnerId: selectedPartnerId || null,
          isB2B: !!selectedPartnerId,
          source: selectedPartnerId ? 'b2b' : (regiondoResult ? 'website' : 'manual'),
          status: regiondoResult ? 'confirmed' : 'pending', // Regiondo purchases are pre-paid/confirmed
          bookingType,
          sellerReference: bookingType === 'gruppe' ? sellerReference : undefined,
          contactPerson: bookingType === 'gruppe' ? contactPerson : undefined,
          groupPersons: bookingType !== 'einzel' ? Number(groupPersons) : undefined,
          customTotalPrice: bookingType !== 'einzel' ? Number(customTotalPrice) : undefined,
          tickets,
          customerData: { name: customerName, email: customerEmail, phone: customerPhone },
          totalAmount: regiondoResult?.grandTotal || totalPrice,
          lastPayload: regiondoResult || undefined, // Store Regiondo result
        }, []);
      }
      
      setSuccess(true);
      setTimeout(() => navigate(bookingType === 'privat' ? '/kanban' : '/bookings'), 3000);
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
         <h2 className="text-3xl font-heading font-bold text-gray-900 mb-2">
           {bookingType === 'privat' ? 'Privatbuchung erfolgreich erstellt!' : 'Transaktion erfolgreich!'}
         </h2>
         <p className="text-gray-500 text-lg">
           {bookingType === 'privat' 
            ? 'Das Event und die entsprechende Buchung wurden im System angelegt.' 
            : 'Die Reservierung wurde als "Pending" im Zentralsystem erfasst.'}
         </p>
         <p className="text-sm text-gray-400 mt-6 animate-pulse">
           Sie werden zur {bookingType === 'privat' ? 'Live Status Übersicht' : 'Buchungsübersicht'} weitergeleitet...
         </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-heading text-brand-primary font-bold">Varianten-Buchung (System)</h1>
        <p className="text-gray-500 mt-2 text-lg font-medium">Partner Flow & Pauschalbuchung</p>
      </div>

      <div className="flex gap-4 mb-8">
        <button onClick={() => setBookingType('einzel')} className={`flex-1 py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${bookingType === 'einzel' ? 'bg-brand-primary text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <User className="w-5 h-5"/> Einzelbuchung
        </button>
        <button onClick={() => setBookingType('gruppe')} className={`flex-1 py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${bookingType === 'gruppe' ? 'bg-blue-500 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <Users className="w-5 h-5"/> Gruppenbuchung
        </button>
        <button onClick={() => setBookingType('privat')} className={`flex-1 py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${bookingType === 'privat' ? 'bg-purple-500 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <UsersRound className="w-5 h-5"/> Privatbuchung
        </button>
      </div>

      {/* Sektion 1: Event & Termin */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-primary shadow-[0_0_10px_#c02a2a]"></div>
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-brand-primary"/> 1. Event & Termin Option
        </h2>
        
        <div className="grid grid-cols-1 gap-6">
          {bookingType === 'privat' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">Event-Titel (z.B. Firmenevent ABC)</label>
                <input type="text" placeholder="Privatkonzert" value={privateEventTitle} onChange={e => setPrivateEventTitle(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Datum des Privat-Events</label>
                <input type="date" value={privateEventDate} onChange={e => setPrivateEventDate(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Uhrzeit</label>
                <input type="time" value={privateEventTime} onChange={e => setPrivateEventTime(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none shadow-sm" />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Konzert / Event auswählen</label>
              <select 
                value={selectedEventId} 
                onChange={e => setSelectedEventId(e.target.value)} 
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none bg-gray-50 text-gray-900 font-bold cursor-pointer transition-shadow shadow-inner"
              >
                <option value="">-- Bitte wählen --</option>
                {availableEvents.map(e => {
                  let displayDate = '';
                  if (e.date && typeof (e.date as any).toDate === 'function') {
                    displayDate = (e.date as any).toDate().toLocaleDateString('de-AT');
                  } else if (e.date) {
                    displayDate = new Date(e.date as string).toLocaleDateString('de-AT');
                  }
                  
                  return (
                    <option key={e.id} value={e.id}>
                      {displayDate} {(e as any).time ? `- ${(e as any).time} Uhr` : ''} — {e.title || 'Mozart Ensemble'}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Sektion 2: Kundendaten & B2B */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-500"/> 2. Käuferdetails & Partner-Zuweisung
        </h2>
        
        <div className="space-y-6">
           {/* Partner Auswahl (B2B) - Immer für Gruppe, Optional für Einzel */}
           {(bookingType === 'einzel' || bookingType === 'gruppe') && (
             <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
               <label className="block text-sm font-medium text-gray-700 mb-2">
                 {bookingType === 'gruppe' ? 'Hotel / Partner (Erforderlich)' : 'B2B Partner (Optional)'}
               </label>
               <select
                 value={selectedPartnerId}
                 onChange={(e) => setSelectedPartnerId(e.target.value)}
                 className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#c02a2a] focus:border-transparent"
               >
                 <option value="">{bookingType === 'gruppe' ? '-- Bitte Partner wählen --' : '-- Kein Partner (Direktbuchung) --'}</option>
                 {partners.map(partner => (
                   <option key={partner.id} value={partner.id}>
                     {partner.name} {partner.type ? `(${partner.type})` : ''}
                   </option>
                 ))}
               </select>
             </div>
           )}

           {bookingType === 'gruppe' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2">Verkäuferreferenz (Buchungsnummer)</label>
                 <input type="text" placeholder="z.B. REF-12345" value={sellerReference} onChange={e => setSellerReference(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
               </div>
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2">Kontaktperson (Name)</label>
                 <input type="text" placeholder="Name der meldenden Person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
               </div>
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">{bookingType === 'gruppe' ? 'E-Mail für Bestätigung' : 'Vor- und Nachname'}</label>
               {bookingType === 'gruppe' ? (
                 <input type="email" placeholder="hotel@example.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
               ) : (
                 <input type="text" placeholder="Max Mustermann" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none shadow-sm" />
               )}
             </div>
             {bookingType !== 'gruppe' && (
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2">Gültige E-Mail Adresse</label>
                 <input type="email" placeholder="max@example.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none shadow-sm" />
               </div>
             )}
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Telefonnummer</label>
               <input type="tel" placeholder="+43 123 45678" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className={`w-full p-4 border border-gray-300 rounded-xl focus:ring-2 outline-none shadow-sm ${bookingType === 'gruppe' ? 'focus:ring-blue-500' : 'focus:ring-brand-primary'}`} />
             </div>
           </div>
        </div>
      </section>

      {/* Sektion 3: Tickets */}
      {bookingType === 'einzel' && (
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
        <h2 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
          <Ticket className="w-6 h-6 text-emerald-500"/> 3. Kontingente & Tickets
        </h2>         <div className="grid grid-cols-1 items-stretch md:grid-cols-3 gap-6 mb-10">
           {categories.map((cat) => (
             <div key={cat.id} className="p-6 border border-gray-200 rounded-2xl bg-gray-50 flex flex-col items-center justify-between shadow-sm">
               <div className="text-center mb-6">
                  <span className="block text-xl font-bold text-gray-900 mb-1 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: cat.colorCode }}></div>
                    {cat.name}
                  </span>
                  <span className="block text-sm text-gray-500 font-medium">{cat.price.toFixed(2)} € pro Ticket</span>
               </div>
               <div className="flex items-center gap-5">
                 <button onClick={() => setQuantities(prev => ({ ...prev, [cat.id]: Math.max(0, (prev[cat.id] || 0) - 1)}))} className="w-12 h-12 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-2xl hover:bg-gray-100 shadow-sm active:scale-95 transition-transform">-</button>
                 <span className="text-3xl font-heading font-bold w-10 text-center text-brand-primary">{quantities[cat.id] || 0}</span>
                 <button onClick={() => setQuantities(prev => ({ ...prev, [cat.id]: (prev[cat.id] || 0) + 1}))} className="w-12 h-12 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-2xl hover:bg-gray-100 shadow-sm active:scale-95 transition-transform">+</button>
               </div>
             </div>
           ))}
           {categories.length === 0 && (
             <div className="col-span-1 md:col-span-3 p-8 text-center text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-xl font-medium">Es sind noch keine Ticket-Kategorien angelegt (Stammdaten).</div>
           )}
         </div> 
      </section>
      )}



      {bookingType !== 'einzel' && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-1.5 h-full ${bookingType === 'gruppe' ? 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'bg-purple-500 shadow-[0_0_10px_#a855f7]'}`}></div>
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <UsersRound className={`w-6 h-6 ${bookingType === 'gruppe' ? 'text-blue-500' : 'text-purple-500'}`}/> 3. Pauschal-Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Personenanzahl</label>
               <input type="number" min="1" placeholder="z.B. 25" value={groupPersons} onChange={e => setGroupPersons(e.target.value ? Number(e.target.value) : '')} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-xl font-bold" />
             </div>
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Gesamtpreis (€)</label>
               <input type="number" min="0" step="0.01" placeholder="z.B. 1500.00" value={customTotalPrice} onChange={e => setCustomTotalPrice(e.target.value ? Number(e.target.value) : '')} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-xl font-bold" />
             </div>
          </div>
        </section>
      )}

        {/* Checkout Bar */}
        <div className="bg-gray-900 p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
           <div className="z-10 text-center md:text-left">
             <p className="text-gray-400 font-bold mb-1 uppercase tracking-widest text-sm">
               <span>Zusammenfassung:</span>{' '}
               <strong className="text-brand-primary bg-red-500/10 px-2 py-0.5 rounded ml-1">
                 <span>{totalTickets}</span> <span>Ticket(s)</span>
               </strong>
             </p>
             <p className="text-4xl font-bold text-white tracking-tight">
               <span>€</span> <span>{totalPrice.toLocaleString('de-AT', {minimumFractionDigits: 2})}</span>
             </p>
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
    </div>
  );
}
