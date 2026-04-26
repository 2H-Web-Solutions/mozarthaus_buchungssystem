import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { useNavigate } from 'react-router-dom';
import { fetchPartners } from '../../services/partnerService';
import { executeBookingTransaction } from '../../services/transactionService';
import { SeatMap } from './SeatMap';
import { Partner } from '../../types/schema';
import { CalendarDays, Ticket, Building2, ChevronRight, CheckCircle2 } from 'lucide-react';

export function BookingFlow() {
  const navigate = useNavigate();
  // Section 1
  const [variant, setVariant] = useState('streichquartett');
  const [bookingDate, setBookingDate] = useState('');
  
  // Section 2
  const [partners, setPartners] = useState<Partner[]>([]);
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
  
  // Section 4
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const derivedEventId = variant && bookingDate ? `${variant}_${bookingDate.replace(/-/g, '')}` : '';

  useEffect(() => {
    fetchPartners().then(setPartners);
    
    // Live stream master pricing configs
    const unsubPricing = onSnapshot(doc(db, `apps/${APP_ID}/config`, 'pricing'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.catA !== undefined) setPriceCatA(data.catA);
        if (data.catB !== undefined) setPriceCatB(data.catB);
        if (data.student !== undefined) setPriceStudent(data.student);
      }
    });

    return () => unsubPricing();
  }, []);

  const totalPrice = (catA * priceCatA) + (catB * priceCatB) + (student * priceStudent);
  const totalTickets = catA + catB + student;

  const handleSubmit = async () => {
    if (!bookingDate) return alert("Bitte w├ñhle ein Datum aus.");
    if (totalTickets === 0) return alert("Bitte w├ñhle mindestens ein Ticket aus der Kategorie aus.");
    if (selectedSeats.length !== totalTickets) return alert(`Bitte weise genau ${totalTickets} Sitzpl├ñtze im physischen Saalplan zu.`);
    if (!customerName || !customerEmail) return alert("Kundenname und Email sind zwingend erforderlich.");

    setIsSubmitting(true);
    try {
      const tickets = [];
      if (catA > 0) tickets.push({ categoryId: 'cat_a', quantity: catA });
      if (catB > 0) tickets.push({ categoryId: 'cat_b', quantity: catB });
      if (student > 0) tickets.push({ categoryId: 'student', quantity: student });

      await executeBookingTransaction({
        eventId: derivedEventId,
        variantId: variant,
        partnerId: selectedPartnerId || null,
        source: selectedPartnerId ? 'b2b' : 'manual',
        status: 'confirmed',
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
         <p className="text-sm text-gray-400 mt-6 animate-pulse">Sie werden zur Buchungs├╝bersicht weitergeleitet...</p>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
             <label className="block text-sm font-bold text-gray-700 mb-2">Ensemble Variante (Line-Up)</label>
             <select value={variant} onChange={e => setVariant(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none bg-gray-50 text-gray-900 font-bold cursor-pointer transition-shadow shadow-inner">
               <option value="streichquartett">­ƒÄ╗ Streichquartett (Mi, Fr, So, Sa)</option>
               <option value="klaviertrio">­ƒÄ╣ Klaviertrio (Di, Do)</option>
             </select>
           </div>
           <div>
             <label className="block text-sm font-bold text-gray-700 mb-2">Konzertdatum</label>
             <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none bg-gray-50 text-gray-900 font-bold shadow-inner" />
           </div>
        </div>
      </section>

      {/* Sektion 2: Kundendaten & B2B */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-500"/> 2. K├ñuferdetails & Partner-Zuweisung
        </h2>
        
        <div className="space-y-6">
           <div>
             <label className="block text-sm font-bold text-brand-primary mb-2">B2B Agentur / Partner (Optional f├╝r Kommission)</label>
             <select value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)} className="w-full p-4 border-2 border-brand-primary/20 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none bg-blue-50 text-blue-900 font-bold cursor-pointer shadow-inner">
               <option value="">-- Direktbuchung (B2C Konsument) --</option>
               {partners.map(p => <option key={p.id} value={p.id}>{p.companyName} {p.commissionRate ? `(${p.commissionRate}% Provision)` : ''}</option>)}
             </select>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Vor- und Nachname</label>
               <input type="text" placeholder="Max Mustermann" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none shadow-sm" />
             </div>
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">G├╝ltige E-Mail Adresse</label>
               <input type="email" placeholder="max@example.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none shadow-sm" />
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
                <span className="block text-sm text-gray-500 font-medium">{priceCatA.toFixed(2)} Ôé¼ pro Ticket</span>
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
                <span className="block text-sm text-gray-500 font-medium">{priceCatB.toFixed(2)} Ôé¼ pro Ticket</span>
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
                <span className="block text-sm text-gray-500 font-medium">{priceStudent.toFixed(2)} Ôé¼ pro Ticket</span>
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
               ­ƒæå Bitte definieren Sie zuerst die Ticket-Anzahl in Sektion 3, um die Pl├ñtze physisch zuzuweisen.
            </div>
          ) : !bookingDate ? (
            <div className="p-8 text-center text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-xl font-medium">
               ­ƒæå Bitte w├ñhlen Sie zuerst ein Konzertdatum in Sektion 1, um den tagesaktuellen Saalplan zu laden.
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
             <p className="text-4xl font-bold text-white tracking-tight">Ôé¼ {totalPrice.toLocaleString('de-AT', {minimumFractionDigits: 2})}</p>
           </div>
           <button 
             onClick={handleSubmit} 
             disabled={isSubmitting || totalTickets === 0}
             className="w-full md:w-auto px-10 py-5 bg-brand-primary text-white text-xl font-bold rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 z-10"
           >
             {isSubmitting ? 'Transaktion l├ñuft...' : 'Zahlungspflichtig Buchen'}
             {!isSubmitting && <ChevronRight className="w-7 h-7"/>}
           </button>
        </div>
      </section>
    </div>
  );
}
