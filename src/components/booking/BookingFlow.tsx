import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { useNavigate } from 'react-router-dom';
import { Event, TicketCategory } from '../../types/schema';
import { listenTicketCategories } from '../../services/firebase/pricingService';
import { createPrivateReservation } from '../../services/privateReservationService';
import { purchaseWithRegiondo } from '../../services/regiondoBookingPurchase';
import { CalendarDays, Ticket, Building2, ChevronRight, CheckCircle2, User, UsersRound } from 'lucide-react';
import { SeatMap } from './SeatMap';
import toast from 'react-hot-toast';

export function BookingFlow() {
  const navigate = useNavigate();
  // Section 1
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  
  // Section 2
  const [partners, setPartners] = useState<{id: string, name: string, type: string}[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedTariffGroup, setSelectedTariffGroup] = useState<string | null>(null);
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
  
  // Section 4
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

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

  useEffect(() => {
    setQuantities({});
    setDoubleCategoryId('');
    setSelectedSeats([]);
  }, [selectedTariffGroup]);

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

  // Reset seats when event changes or tickets decrease
  useEffect(() => {
    setSelectedSeats([]);
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedSeats.length > totalTickets) {
      setSelectedSeats(prev => prev.slice(0, totalTickets));
    }
  }, [totalTickets, selectedSeats.length]);

  const categoryAllocations = useMemo(() => {
    const allocs: { id: string; name: string; quantity: number; colorCode: string }[] = [];
    if (bookingType === 'einzel') {
      categories.forEach(c => {
        const q = quantities[c.id] || 0;
        if (q > 0) {
          const isVariant = c.type === 'variant';
          const mainCat = isVariant ? categories.find(m => m.id === c.parentId) : c;
          allocs.push({
            id: c.id,
            name: mainCat ? mainCat.name : c.name,
            quantity: q,
            colorCode: mainCat ? mainCat.colorCode : (c.colorCode || '#D4AF37')
          });
        }
      });
    } else if (bookingType === 'double') {
      const cat = categories.find(c => c.id === doubleCategoryId);
      if (cat && Number(doubleTickets) > 0) {
        const isVariant = cat.type === 'variant';
        const mainCat = isVariant ? categories.find(m => m.id === cat.parentId) : cat;
        allocs.push({
          id: cat.id,
          name: mainCat ? mainCat.name : cat.name,
          quantity: Number(doubleTickets),
          colorCode: mainCat ? mainCat.colorCode : (cat.colorCode || '#D4AF37')
        });
      }
    }
    return allocs;
  }, [bookingType, categories, quantities, doubleCategoryId, doubleTickets]);

  const baseCategoryColors = useMemo(() => {
    const mapping: Record<string, string> = {
      'A': '#D4AF37',
      'B': '#1E3A8A',
      'STUDENT': '#10B981'
    };
    categories.filter(c => !c.type || c.type === 'main').forEach(c => {
      if (c.name.toLowerCase().includes('a')) mapping['A'] = c.colorCode || mapping['A'];
      if (c.name.toLowerCase().includes('b')) mapping['B'] = c.colorCode || mapping['B'];
      if (c.name.toLowerCase().includes('student')) mapping['STUDENT'] = c.colorCode || mapping['STUDENT'];
    });
    return mapping;
  }, [categories]);

  const handleSubmit = async () => {
    if (totalTickets === 0 && bookingType !== 'privat') return toast.error("Bitte wähle mindestens ein Ticket aus der Kategorie aus.");
    if (bookingType !== 'privat' && selectedSeats.length !== totalTickets) return toast.error(`Bitte weise genau ${totalTickets} Sitzplätze im physischen Saalplan zu.`);
    
    const missing: string[] = [];

    if (bookingType === 'einzel') {
      if (!selectedEventId) missing.push('Konzert / Event Option');
      if (!customerName) missing.push('Vor- und Nachname');
      if (!customerEmail) missing.push('Email');
      if (!customerPhone) missing.push('Telefon');
      if (totalTickets === 0) missing.push('Mindestens 1 Ticket aus einer Kategorie');
    } else if (bookingType === 'privat') {
      if (!privateEventTitle) missing.push('Event-Titel');
      if (!privateEventDate) missing.push('Datum');
      if (!privateEventTime) missing.push('Uhrzeit');
      if (!customerName) missing.push('Vor- und Nachname');
      if (!customerEmail) missing.push('Email');
      if (!customerPhone) missing.push('Telefon');
      if (!groupPersons) missing.push('Personenanzahl');
      if (!customTotalPrice) missing.push('Pauschalpreis (€)');
    } else if (bookingType === 'double') {
      if (!selectedEventId) missing.push('Konzert / Event Option');
      if (!sellerReference) missing.push('Verkäuferreferenz');
      if (!contactPerson) missing.push('Kontaktperson');
      if (!customerEmail) missing.push('Email');
      if (!customerPhone) missing.push('Telefon');
      if (!doubleCategoryId) missing.push('Ticket-Kategorie wählen');
      if (!doubleTickets) missing.push('Anzahl Tickets');
      if (!doublePrice) missing.push('Gesamtpreis (€)');
    }

    if (missing.length > 0) {
      toast.error(
        `Bitte füllen Sie noch folgende Felder aus:\n\n- ${missing.join('\n- ')}`,
        { duration: 6000, style: { minWidth: '300px', whiteSpace: 'pre-line' } }
      );
      return;
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

        const isVariant = cat.type === 'variant';
        const mainCat = isVariant ? categories.find(m => m.id === cat.parentId) : cat;

        const ticketData = [{
          categoryId: cat.id,
          categoryName: cat.name,
          quantity: Number(doubleTickets),
          price: Number(doublePrice) / (Number(doubleTickets) || 1),
          parentId: cat.parentId || null
        }];

        await purchaseWithRegiondo({
          productId: '23941',
          dateYmd,
          time: selectedEvent?.time || '15:00',
          categories: [{
            name: mainCat?.name || cat.name,
            quantity: Number(doubleTickets),
            regiondoOptionId: mainCat?.regiondoOptionId || cat.regiondoOptionId
          }],
          customerData: {
            name: customerName || contactPerson || 'Gruppenbuchung',
            email: customerEmail,
            phone: customerPhone,
            comment: JSON.stringify({ tickets: ticketData, seatIds: selectedSeats })
          }
        });

        await createPrivateReservation({
          title: `Gruppenbuchung: ${selectedEvent?.title || 'Mozart Ensemble'}`,
          date: dateYmd,
          time: selectedEvent?.time || '15:00',
          customerName: customerName || contactPerson || 'Gruppenbuchung',
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
          .map(c => {
             const isVariant = c.type === 'variant';
             const mainCat = isVariant ? categories.find(m => m.id === c.parentId) : c;
             return {
               name: mainCat?.name || c.name,
               quantity: quantities[c.id],
               regiondoOptionId: mainCat?.regiondoOptionId || c.regiondoOptionId
             };
          });

        const ticketData = categories
          .filter(c => (quantities[c.id] || 0) > 0)
          .map(c => ({
             categoryId: c.id,
             categoryName: c.name,
             quantity: quantities[c.id],
             price: c.price,
             parentId: c.parentId || null
          }));

        await purchaseWithRegiondo({
          productId: '23941',
          dateYmd,
          time: selectedEvent?.time || '15:00',
          categories: regiondoCats,
          customerData: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            comment: JSON.stringify({ tickets: ticketData, seatIds: selectedSeats })
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
    <div className="max-w-4xl mx-auto pb-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="border-b border-gray-200 pb-3">
        <h1 className="text-2xl font-heading text-brand-primary font-bold">Konzert-Buchung</h1>
      </div>

      <div className="flex gap-3 mb-4">
        <button onClick={() => setBookingType('einzel')} className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${bookingType === 'einzel' ? 'bg-brand-primary text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <User className="w-5 h-5"/> Einzelbuchung
        </button>
        <button onClick={() => setBookingType('double')} className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${bookingType === 'double' ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <Ticket className="w-5 h-5"/> Gruppenbuchung
        </button>
        <button onClick={() => setBookingType('privat')} className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${bookingType === 'privat' ? 'bg-purple-500 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <UsersRound className="w-5 h-5"/> Privatbuchung
        </button>
      </div>

      {/* Section 1: Event Selection */}
      <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-primary"></div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-brand-primary"/> 1. Event & Termin Option
        </h2>
        
        <div className="grid grid-cols-1 gap-4">
          {bookingType === 'privat' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Event-Titel</label>
                <input type="text" value={privateEventTitle} onChange={e => setPrivateEventTitle(e.target.value)} placeholder="z.B. Privatkonzert Mozart" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Datum</label>
                <input type="date" value={privateEventDate} onChange={e => setPrivateEventDate(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Uhrzeit</label>
                <input type="time" value={privateEventTime} onChange={e => setPrivateEventTime(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none" />
              </div>
            </div>
          ) : (
            <div>
              <select 
                value={selectedEventId} 
                onChange={e => setSelectedEventId(e.target.value)} 
                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none bg-gray-50 text-gray-900 font-bold"
              >
                <option value="">-- Bitte wählen --</option>
                {availableEvents.map(e => {
                  const date = e.date 
                    ? (typeof (e.date as any).toDate === 'function' 
                        ? (e.date as any).toDate().toLocaleDateString('de-AT') 
                        : new Date(e.date as string).toLocaleDateString('de-AT'))
                    : 'Unbekannt';
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
      <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-500"/> 2. Käuferdetails & Partner
        </h2>
        
        <div className="space-y-4">
           <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">B2B Partner (Optional)</label>
                 <select
                   value={selectedPartnerId}
                   onChange={e => setSelectedPartnerId(e.target.value)}
                   className="w-full p-2 border border-gray-300 rounded-md outline-none bg-white"
                 >
                   <option value="">-- Kein Partner --</option>
                   {partners.map(partner => (
                     <option key={partner.id} value={partner.id}>{partner.name}</option>
                   ))}
                 </select>
               </div>
               {bookingType === 'einzel' && (
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Tarif / Rabattaktion</label>
                   <select
                     value={selectedTariffGroup || ''}
                     onChange={e => setSelectedTariffGroup(e.target.value || null)}
                     className="w-full p-2 border border-gray-300 rounded-md outline-none bg-white"
                   >
                     <option value="">Standard (Kein Rabatt)</option>
                     {Array.from(new Set(
                       categories
                         .filter(c => c.type === 'variant' && c.tariffGroup && c.tariffGroup.trim() !== '')
                         .map(c => c.tariffGroup!.trim())
                     )).map(group => (
                       <option key={group} value={group}>{group}</option>
                     ))}
                   </select>
                 </div>
               )}
             </div>
           </div>

           {bookingType === 'double' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">Verkäuferreferenz</label>
                 <input type="text" value={sellerReference} onChange={e => setSellerReference(e.target.value)} placeholder="z.B. REF-12345" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none" />
               </div>
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">Kontaktperson</label>
                 <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Name der meldenden Person" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none" />
               </div>
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">
                 Vor- und Nachname {bookingType === 'einzel' && <span className="text-red-500">*</span>}
               </label>
               <input type="text" required={bookingType === 'einzel'} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Max Mustermann" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none" />
             </div>
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">
                 Email {bookingType === 'einzel' && <span className="text-red-500">*</span>}
               </label>
               <input type="email" required={bookingType === 'einzel'} value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="max@example.com" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none" />
             </div>
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">
                 Telefon {bookingType === 'einzel' && <span className="text-red-500">*</span>}
               </label>
               <input type="tel" required={bookingType === 'einzel'} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+43 1 123456" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none" />
             </div>
           </div>
        </div>
      </section>

      {/* Section 3: Details */}
      {bookingType === 'einzel' && (
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-emerald-500"/> 3. Tickets
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {categories.filter(cat => !cat.type || cat.type === 'main').map(mainCat => {
              const effectiveOption = selectedTariffGroup 
                ? categories.find(c => c.type === 'variant' && c.parentId === mainCat.id && c.tariffGroup === selectedTariffGroup)
                : mainCat;
              
              const isAvailable = !!effectiveOption;
              const optionId = isAvailable ? effectiveOption.id : mainCat.id;

              return (
                <div key={mainCat.id} className={`p-0 border border-gray-200 rounded-2xl bg-white flex flex-col shadow-sm relative overflow-hidden ${!isAvailable ? 'opacity-50' : ''}`}>
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: mainCat.colorCode }}></div>
                  <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: mainCat.colorCode }}></div>
                    <span className="text-lg font-bold">{mainCat.name}</span>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    {isAvailable ? (
                      <>
                        <div className="flex flex-col">
                          <span className="text-lg font-bold text-gray-900">{effectiveOption.price.toFixed(2)} €</span>
                          <span className="text-xs text-gray-500">{selectedTariffGroup ? `Tarif: ${selectedTariffGroup}` : 'Standard Tarif'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setQuantities(p => ({...p, [optionId]: Math.max(0, (p[optionId]||0)-1)}))} className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-full bg-white text-gray-600 hover:bg-gray-100 transition-colors shadow-sm">-</button>
                          <span className="text-xl font-bold w-6 text-center">{quantities[optionId] || 0}</span>
                          <button onClick={() => setQuantities(p => ({...p, [optionId]: (p[optionId]||0)+1}))} className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-full bg-white text-gray-600 hover:bg-gray-100 transition-colors shadow-sm">+</button>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-500 py-2">
                        Nicht verfügbar im gewählten Tarif
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {bookingType === 'double' && (
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-orange-500"/> 3. Gruppenbuchung Details
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {categories.filter(cat => !cat.type || cat.type === 'main').map(cat => (
                <label key={cat.id} className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${doubleCategoryId === cat.id ? 'border-orange-500 bg-orange-50' : 'bg-white'}`}>
                  <input type="radio" value={cat.id} className="hidden" onChange={() => setDoubleCategoryId(cat.id)} />
                  <div className="w-3 h-3 rounded-full shadow-sm border border-gray-100" style={{ backgroundColor: cat.colorCode }}></div>
                  <span className="text-base font-bold text-center">{cat.name}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Anzahl Tickets</label>
                <input type="number" placeholder="Tickets" value={doubleTickets} onChange={e => setDoubleTickets(e.target.value ? Number(e.target.value) : '')} className="p-2.5 border border-gray-300 rounded-lg text-center text-lg font-bold w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Gesamtpreis (€)</label>
                <input type="number" placeholder="Preis (€)" value={doublePrice} onChange={e => setDoublePrice(e.target.value ? Number(e.target.value) : '')} className="p-2.5 border border-gray-300 rounded-lg text-center text-lg font-bold w-full outline-none" />
              </div>
            </div>
          </div>
        </section>
      )}

      {bookingType === 'privat' && (
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <UsersRound className="text-purple-500 w-5 h-5"/> 3. Pauschal-Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Personenanzahl</label>
              <input type="number" placeholder="Personen" value={groupPersons} onChange={e => setGroupPersons(e.target.value ? Number(e.target.value) : '')} className="p-2.5 border border-gray-300 rounded-lg text-lg font-bold w-full outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Pauschalpreis (€)</label>
              <input type="number" placeholder="Gesamtpreis" value={customTotalPrice} onChange={e => setCustomTotalPrice(e.target.value ? Number(e.target.value) : '')} className="p-2.5 border border-gray-300 rounded-lg text-lg font-bold w-full outline-none" />
            </div>
          </div>
        </section>
      )}

      {/* Sektion 4: Saalplan */}
      {(bookingType === 'einzel' || bookingType === 'double') && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500 shadow-[0_0_10px_#a855f7]"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
            <Ticket className="w-6 h-6 text-purple-500"/> 4. Saalplan-Zuweisung ({selectedSeats.length} / {totalTickets} zugewiesen)
          </h2>
          
          {totalTickets === 0 ? (
            <div className="p-8 text-center text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-xl font-medium">
               👆 Bitte definieren Sie zuerst die Ticket-Anzahl, um die Plätze physisch zuzuweisen.
            </div>
          ) : !selectedEventId ? (
            <div className="p-8 text-center text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-xl font-medium">
               👆 Bitte wählen Sie zuerst ein Konzert, um den tagesaktuellen Saalplan zu laden.
            </div>
          ) : (
            <div className="overflow-hidden">
               <SeatMap 
                 eventId={selectedEventId}
                 requiredSeats={totalTickets}
                 selectedSeats={selectedSeats}
                 onSeatSelect={setSelectedSeats}
                 categoryAllocations={categoryAllocations}
                 baseCategoryColors={baseCategoryColors}
               />
            </div>
          )}
        </section>
      )}

      {/* Checkout Bar */}
      <div className="bg-gray-900 p-6 rounded-2xl flex justify-between items-center shadow-2xl relative overflow-hidden">
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
