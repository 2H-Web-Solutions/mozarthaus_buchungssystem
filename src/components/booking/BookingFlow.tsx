import { useState, useEffect, useMemo } from 'react';
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
  
  const [bookingType, setBookingType] = useState<'einzel' | 'privat' | 'double'>('einzel');
  const [sellerReference, setSellerReference] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [groupPersons, setGroupPersons] = useState<number | ''>(''); 
  const [customTotalPrice, setCustomTotalPrice] = useState<number | ''>('');
  
  // Double Booking (now Group Booking Tab) fields
  const [doubleCategoryId, setDoubleCategoryId] = useState('');
  const [doubleTickets, setDoubleTickets] = useState<number | ''>('');
  const [doublePrice, setDoublePrice] = useState<number | ''>('');
  
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
        console.error("Error fetching partners:", error);
      }
    };
    fetchPartnersData();
    
    const unsubPricing = listenTicketCategories(cats => {
      setCategories([...cats].sort((a, b) => b.price - a.price));
    });

    const unsubEvents = onSnapshot(query(collection(db, `apps/${APP_ID}/events`), orderBy('date', 'asc')), snap => {
      const evts: any[] = [];
      snap.forEach(d => {
         const data = d.data();
         evts.push({ id: d.id, ...data });
      });
      setAvailableEvents(evts);
    });

    return () => {
      unsubPricing();
      unsubEvents();
    };
  }, []);

  // Derived state for the checkout bar with explicit dependency tracking
  const { totalPrice, totalTickets } = useMemo(() => {
    let price = 0;
    let tickets = 0;
    
    if (bookingType === 'einzel') {
      categories.forEach(c => {
        const q = quantities[c.id] || 0;
        price += q * (Number(c.price) || 0);
        tickets += q;
      });
    } else if (bookingType === 'double') {
      price = Number(doublePrice) || 0;
      tickets = Number(doubleTickets) || 0;
    } else if (bookingType === 'privat') {
      price = Number(customTotalPrice) || 0;
      tickets = Number(groupPersons) || 0;
    }
    
    return { totalPrice: price, totalTickets: tickets };
  }, [bookingType, quantities, doublePrice, doubleTickets, customTotalPrice, groupPersons, categories]);

  // Debugging log to track price updates
  useEffect(() => {
    console.log(`[BookingFlow] Calculation updated: Type=${bookingType}, TotalPrice=${totalPrice}, TotalTickets=${totalTickets}`);
  }, [totalPrice, totalTickets, bookingType]);

  const handleSubmit = async () => {
    if (bookingType === 'einzel') {
      if (totalTickets === 0) return alert("Bitte wähle mindestens ein Ticket aus.");
      if (!customerName || !customerEmail || !customerPhone) return alert("Kontaktdaten sind erforderlich.");
    } else if (bookingType === 'privat') {
      if (!customerName || !customerEmail || !customerPhone) return alert("Kontaktdaten sind erforderlich.");
      if (!groupPersons || !customTotalPrice) return alert("Personenanzahl und Gesamtpreis sind erforderlich.");
      if (!privateEventDate || !privateEventTime) return alert("Datum und Uhrzeit sind erforderlich.");
    } else if (bookingType === 'double') {
      if (!selectedEventId) return alert("Bitte wähle ein Konzert aus.");
      if (!doubleCategoryId) return alert("Bitte wähle eine Kategorie aus.");
      if (!doubleTickets || !doublePrice) return alert("Ticketanzahl und Gesamtpreis sind erforderlich.");
      if (!customerEmail || !customerPhone) return alert("Email und Telefonnummer sind erforderlich.");
      if (!sellerReference || !contactPerson) return alert("Referenz und Kontaktperson sind erforderlich.");
    }

    if (bookingType !== 'privat' && !selectedEventId) {
      return alert("Bitte wähle ein Konzert aus.");
    }

    setIsSubmitting(true);
    try {
      const selectedEvent = availableEvents.find(e => e.id === selectedEventId);
      const eventDateRaw = selectedEvent?.date;
      const dateYmd = eventDateRaw 
        ? (typeof (eventDateRaw as any).toDate === 'function' 
            ? (eventDateRaw as any).toDate().toISOString().split('T')[0] 
            : (eventDateRaw as string).split('T')[0]) 
        : '';

      if (bookingType === 'privat') {
        await createPrivateReservation({
          title: privateEventTitle || `Privat Event - ${customerName}`,
          date: privateEventDate,
          time: privateEventTime,
          customerName,
          customerEmail,
          customerPhone,
          guestCount: Number(groupPersons),
          totalPrice: Number(customTotalPrice),
          partnerId: selectedPartnerId || null
        });
      } else if (bookingType === 'double') {
        const cat = categories.find(c => c.id === doubleCategoryId);
        if (!cat) throw new Error("Kategorie nicht gefunden.");

        await purchaseWithRegiondo({
          productId: '23941',
          dateYmd,
          time: selectedEvent?.time || '15:00',
          categories: [{
            name: cat.name,
            quantity: Number(doubleTickets),
            regiondoOptionId: cat.regiondoOptionId
          }],
          customerData: {
            name: customerName || contactPerson || 'Group Booking',
            email: customerEmail,
            phone: customerPhone
          }
        });

        await createPrivateReservation({
          title: `Group Booking: ${selectedEvent?.title || 'Mozart Ensemble'}`,
          date: dateYmd,
          time: selectedEvent?.time || '15:00',
          customerName: customerName || contactPerson || 'Group Booking',
          customerEmail,
          customerPhone,
          guestCount: Number(doubleTickets),
          totalPrice: Number(doublePrice),
          partnerId: selectedPartnerId || null
        });
      } else {
        // Einzelbuchung
        const regiondoCats = categories
          .filter(c => (quantities[c.id] || 0) > 0)
          .map(c => ({
            name: c.name,
            quantity: quantities[c.id],
            regiondoOptionId: c.regiondoOptionId
          }));

        await purchaseWithRegiondo({
          productId: '23941',
          dateYmd,
          time: selectedEvent?.time || '15:00',
          categories: regiondoCats,
          customerData: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone
          }
        });
      }
      
      setSuccess(true);
      setTimeout(() => navigate(bookingType === 'privat' ? '/kanban' : '/bookings'), 3000);
    } catch (err: any) {
      console.error(err);
      alert("Fehler: " + (err?.message || "Unbekannter Fehler"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-3xl mx-auto mt-20 p-12 bg-white rounded-2xl shadow-xl text-center border border-gray-100 flex flex-col items-center">
         <CheckCircle2 className="w-24 h-24 text-green-500 mb-6 animate-in zoom-in" />
         <h2 className="text-3xl font-heading font-bold text-gray-900 mb-2">
           {bookingType === 'privat' ? 'Privatbuchung erfolgreich erstellt!' : 'Buchung erfolgreich!'}
         </h2>
         <p className="text-gray-500 text-lg">
           Die Reservierung wurde erfolgreich im System erfasst.
         </p>
         <p className="text-sm text-gray-400 mt-6 animate-pulse">
           Sie werden weitergeleitet...
         </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-heading text-brand-primary font-bold">Konzert-Buchung</h1>
        <p className="text-gray-500 mt-2 text-lg font-medium">Partner Flow & Buchungssystem</p>
      </div>

      <div className="flex gap-4 mb-8">
        <button onClick={() => setBookingType('einzel')} className={`flex-1 py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${bookingType === 'einzel' ? 'bg-brand-primary text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <User className="w-5 h-5"/> Einzelbuchung
        </button>
        <button onClick={() => setBookingType('double')} className={`flex-1 py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${bookingType === 'double' ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <Ticket className="w-5 h-5"/> Group Booking
        </button>
        <button onClick={() => setBookingType('privat')} className={`flex-1 py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${bookingType === 'privat' ? 'bg-purple-500 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <UsersRound className="w-5 h-5"/> Privatbuchung
        </button>
      </div>

      {/* Section 1: Event Selection */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-primary"></div>
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-brand-primary"/> 1. Event & Termin Option
        </h2>
        
        <div className="grid grid-cols-1 gap-6">
          {bookingType === 'privat' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">Event-Titel</label>
                <input type="text" value={privateEventTitle} onChange={e => setPrivateEventTitle(e.target.value)} placeholder="z.B. Privatkonzert Mozart" className="w-full p-4 border border-gray-300 rounded-xl outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Datum</label>
                <input type="date" value={privateEventDate} onChange={e => setPrivateEventDate(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Uhrzeit</label>
                <input type="time" value={privateEventTime} onChange={e => setPrivateEventTime(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl outline-none" />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Konzert / Event auswählen</label>
              <select 
                value={selectedEventId} 
                onChange={e => setSelectedEventId(e.target.value)} 
                className="w-full p-4 border border-gray-300 rounded-xl outline-none bg-gray-50 text-gray-900 font-bold"
              >
                <option value="">-- Bitte wählen --</option>
                {availableEvents.map(e => {
                  const date = e.date?.toDate ? e.date.toDate().toLocaleDateString('de-AT') : new Date(e.date).toLocaleDateString('de-AT');
                  return (
                    <option key={e.id} value={e.id}>
                      {date} {e.time ? `- ${e.time} Uhr` : ''} — {e.title || 'Mozart Ensemble'}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Customer & B2B */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-500"/> 2. Käuferdetails & Partner
        </h2>
        
        <div className="space-y-6">
           <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
             <label className="block text-sm font-medium text-gray-700 mb-2">B2B Partner (Optional)</label>
             <select
               value={selectedPartnerId}
               onChange={e => setSelectedPartnerId(e.target.value)}
               className="w-full p-2 border border-gray-300 rounded-md outline-none"
             >
               <option value="">-- Kein Partner --</option>
               {partners.map(partner => (
                 <option key={partner.id} value={partner.id}>{partner.name}</option>
               ))}
             </select>
           </div>

           {bookingType === 'double' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2">Verkäuferreferenz</label>
                 <input type="text" value={sellerReference} onChange={e => setSellerReference(e.target.value)} placeholder="z.B. REF-12345" className="w-full p-4 border border-gray-300 rounded-xl outline-none" />
               </div>
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2">Kontaktperson</label>
                 <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Name der meldenden Person" className="w-full p-4 border border-gray-300 rounded-xl outline-none" />
               </div>
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Vor- und Nachname</label>
               <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Max Mustermann" className="w-full p-4 border border-gray-300 rounded-xl outline-none" />
             </div>
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
               <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="max@example.com" className="w-full p-4 border border-gray-300 rounded-xl outline-none" />
             </div>
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Telefon</label>
               <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+43 1 123456" className="w-full p-4 border border-gray-300 rounded-xl outline-none" />
             </div>
           </div>
        </div>
      </section>

      {/* Section 3: Details */}
      {bookingType === 'einzel' && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
            <Ticket className="w-6 h-6 text-emerald-500"/> 3. Tickets
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {categories.map(cat => (
              <div key={cat.id} className="p-6 border border-gray-200 rounded-2xl bg-gray-50 flex flex-col items-center shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: cat.colorCode }}></div>
                <div className="w-4 h-4 rounded-full mb-2 shadow-sm" style={{ backgroundColor: cat.colorCode }}></div>
                <span className="block text-xl font-bold mb-1">{cat.name}</span>
                <span className="block text-sm text-gray-500 mb-4">{cat.price.toFixed(2)} €</span>
                <div className="flex items-center gap-4">
                  <button onClick={() => setQuantities(p => ({...p, [cat.id]: Math.max(0, (p[cat.id]||0)-1)}))} className="w-10 h-10 border rounded-full">-</button>
                  <span className="text-2xl font-bold">{quantities[cat.id] || 0}</span>
                  <button onClick={() => setQuantities(p => ({...p, [cat.id]: (p[cat.id]||0)+1}))} className="w-10 h-10 border rounded-full">+</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {bookingType === 'double' && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
            <Ticket className="w-6 h-6 text-orange-500"/> 3. Group Booking Details
          </h2>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {categories.filter(c => c.name.toLowerCase().includes('kategorie')).map(cat => (
                <label key={cat.id} className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${doubleCategoryId === cat.id ? 'border-orange-500 bg-orange-50' : 'bg-white'}`}>
                  <input type="radio" value={cat.id} className="hidden" onChange={() => setDoubleCategoryId(cat.id)} />
                  <div className="w-4 h-4 rounded-full shadow-sm border border-gray-100" style={{ backgroundColor: cat.colorCode }}></div>
                  <span className="text-xl font-bold">{cat.name}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Anzahl Tickets</label>
                <input type="number" placeholder="Tickets" value={doubleTickets} onChange={e => setDoubleTickets(e.target.value ? Number(e.target.value) : '')} className="p-4 border border-gray-300 rounded-xl text-center text-xl font-bold w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Gesamtpreis (€)</label>
                <input type="number" placeholder="Preis (€)" value={doublePrice} onChange={e => setDoublePrice(e.target.value ? Number(e.target.value) : '')} className="p-4 border border-gray-300 rounded-xl text-center text-xl font-bold w-full outline-none" />
              </div>
            </div>
          </div>
        </section>
      )}

      {bookingType === 'privat' && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <UsersRound className="text-purple-500 w-6 h-6"/> 3. Pauschal-Details
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Personenanzahl</label>
              <input type="number" placeholder="Personen" value={groupPersons} onChange={e => setGroupPersons(e.target.value ? Number(e.target.value) : '')} className="p-4 border border-gray-300 rounded-xl text-xl font-bold w-full outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Pauschalpreis (€)</label>
              <input type="number" placeholder="Gesamtpreis" value={customTotalPrice} onChange={e => setCustomTotalPrice(e.target.value ? Number(e.target.value) : '')} className="p-4 border border-gray-300 rounded-xl text-xl font-bold w-full outline-none" />
            </div>
          </div>
        </section>
      )}

      {/* Checkout Bar */}
      <div className="bg-gray-900 p-8 rounded-2xl flex justify-between items-center shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
         <div className="z-10">
           <p className="text-gray-400 font-bold mb-1 uppercase text-sm tracking-wider">
             <span>
               {bookingType === 'einzel' 
                 ? `Einzelbuchung: ${totalTickets} Tickets` 
                 : bookingType === 'double' 
                   ? `Gruppen-Pauschale: ${totalTickets} Tickets` 
                   : `Privatevent: ${totalTickets} Personen`}
             </span>
           </p>
           <div className="text-4xl font-bold text-white flex items-baseline gap-2">
             <span className="text-2xl opacity-80 decoration-none select-none">€</span>
             <span className="tabular-nums">
               {totalPrice.toLocaleString('de-AT', {minimumFractionDigits: 2})}
             </span>
           </div>
         </div>
         <button 
           onClick={handleSubmit} 
           disabled={isSubmitting || totalTickets === 0 || totalPrice === 0} 
           className="px-10 py-5 bg-brand-primary text-white text-xl font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all flex items-center gap-2 z-10"
         >
           {isSubmitting ? 'Verarbeitung...' : 'Zahlungspflichtig Buchen'}
           {!isSubmitting && <ChevronRight className="w-6 h-6" />}
         </button>
      </div>
    </div>
  );
}
