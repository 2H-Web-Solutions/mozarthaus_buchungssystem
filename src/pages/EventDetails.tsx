import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Event, Partner, TicketCategory } from '../types/schema';
import { createBooking } from '../services/bookingService';
import { SeatingPlan } from '../components/seating/SeatingPlan';
import { EnsembleModal } from '../components/events/EnsembleModal';
import { Users } from 'lucide-react';

import { listenTicketCategories } from '../services/firebase/pricingService';

// Dynamic categories loaded from DB in component state

export function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  
  // State from SeatingPlan callback
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [seatCategories, setSeatCategories] = useState<Record<string, string>>({});
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
  
  // Booking Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [source, setSource] = useState<'manual' | 'boxoffice' | 'phone' | 'website' | 'b2b'>('manual');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [isEnsembleModalOpen, setIsEnsembleModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;

    // Fetch Event metadata
    getDoc(doc(db, `apps/${APP_ID}/events`, id)).then(snap => {
      if (snap.exists()) {
        setEvent({ id: snap.id, ...snap.data() } as Event);
      } else {
        alert("Event nicht gefunden.");
        navigate('/events');
      }
    });

    // Fetch Partners array from CRM
    getDocs(collection(db, `apps/${APP_ID}/partners`)).then(snap => {
       const p: Partner[] = [];
       snap.forEach(d => p.push({ id: d.id, ...d.data() } as Partner));
       setPartners(p);
    });

    const unsubCategories = listenTicketCategories((cats) => {
      setTicketCategories(cats.filter(c => c.isActive));
    });

    return () => unsubCategories();
  }, [id, navigate]);

  // Callback coming from SeatingPlan via prompt constraints
  const handleSelectionChange = (ids: string[]) => {
    setSelectedSeatIds(ids);
    setSeatCategories(prev => {
      const newMapping: Record<string, string> = {};
      const fallbackId = ticketCategories.length > 0 ? ticketCategories[0].id : '';
      ids.forEach(id => {
        newMapping[id] = prev[id] || fallbackId; // Behalte bestehende oder setze Standard
      });
      return newMapping;
    });
  };

  const calculateTotal = () => {
    return selectedSeatIds.reduce((total, seatId) => {
      const fallbackId = ticketCategories.length > 0 ? ticketCategories[0].id : '';
      const catId = seatCategories[seatId] || fallbackId;
      const category = ticketCategories.find(c => c.id === catId);
      return total + (category?.price || 0);
    }, 0);
  };

  const handleBooking = async () => {
    if (selectedSeatIds.length === 0) return;
    if (!customerName || !customerEmail || !customerPhone) return alert('Bitte Kundenname, Email und Telefonnummer angeben!');
    if (source === 'b2b' && !selectedPartnerId) return alert('Bitte B2B Partner auswählen!');
    
    setIsBooking(true);
    try {
      await createBooking(event!.id, selectedSeatIds, {
        source,
        partnerId: source === 'b2b' ? selectedPartnerId : null,
        isB2B: source === 'b2b',
        status: 'confirmed',
        customerData: { name: customerName, email: customerEmail, phone: customerPhone },
        totalAmount: calculateTotal()
      });
      // Clear cart
      setCustomerName('');
      setCustomerEmail('');
      alert('Buchung war erfolgreich! Sitze wurden in der Datenbank auf gebucht gesetzt.');
      // Auto-updates via onSnapshot in SeatingPlan
    } catch (err: any) {
      alert('Fehler bei der Buchung: ' + err.message);
    } finally {
      setIsBooking(false);
    }
  };

  if (!event) return (
    <div className="flex h-64 items-center justify-center bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="animate-pulse space-y-4 w-1/3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Links (70%): Seating Plan */}
      <div className="w-full lg:w-[70%] flex flex-col h-full bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-8 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
          <div>
            <h1 className="text-3xl font-heading text-brand-primary font-bold mb-2">{event.title}</h1>
            <p className="text-gray-600 font-medium">📅 {(event.date as any)?.toDate ? (event.date as any).toDate().toLocaleString('de-AT', { dateStyle: 'full', timeStyle: 'short' }) + ' Uhr' : `${new Date(event.date as string).toLocaleDateString('de-AT', { dateStyle: 'full'})} ${event.time || ''} Uhr`}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsEnsembleModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 rounded-lg text-sm font-bold border border-brand-primary/20 transition-colors">
              <Users className="w-4 h-4" /> Dienstplan
            </button>
            <div className="hidden md:block px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-bold border border-gray-200">
              Status: {event.status.toUpperCase()}
            </div>
          </div>
        </div>
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50">
          <SeatingPlan eventId={event.id} onSelectionChange={handleSelectionChange} readOnly={true} />
        </div>
      </div>

      {/* Rechts (30%): Buchungs-Panel */}
      <div className="w-full lg:w-[30%] bg-white p-7 rounded-xl shadow-lg border border-gray-200 flex flex-col h-full sticky top-0 overflow-y-auto">
        <h2 className="text-2xl font-heading text-brand-primary mb-6 border-b border-gray-100 pb-4">Check-Out</h2>
        
        <div className="mb-6 flex-1">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Ausgewählte Plätze</h3>
          <div className="mb-8 min-h-[3rem] bg-gray-50 rounded-lg border border-gray-100 p-2 max-h-64 overflow-y-auto">
            {selectedSeatIds.length > 0 ? (
              <div className="space-y-2">
                {selectedSeatIds.map(seatId => {
                  const fallbackId = ticketCategories.length > 0 ? ticketCategories[0].id : '';
                  const currentCatId = seatCategories[seatId] || fallbackId;
                  const currentPrice = ticketCategories.find(c => c.id === currentCatId)?.price || 0;
                  
                  return (
                    <div key={seatId} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200 shadow-sm">
                      <span className="font-bold text-brand-primary text-sm">
                        {seatId.replace(/row_|_seat_/g, ' ').toUpperCase()}
                      </span>
                      <div className="flex items-center gap-3">
                        <select 
                          value={currentCatId}
                          onChange={(e) => setSeatCategories(prev => ({ ...prev, [seatId]: e.target.value }))}
                          className="text-sm border-gray-300 rounded p-1 bg-gray-50 focus:ring-brand-primary focus:border-brand-primary"
                        >
                          {ticketCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <span className="font-bold text-gray-700 w-12 text-right">€ {currentPrice}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-400 italic font-medium">
                Noch keine Plätze im Warenkorb
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center font-bold text-2xl mb-8 bg-red-50 p-5 rounded-xl border border-red-100">
            <span className="text-brand-primary">Gesamtpreis:</span>
            <span className="text-gray-900">€ {calculateTotal().toFixed(2)}</span>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Vor- und Nachname</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary bg-gray-50 focus:bg-white" placeholder="Max Mustermann" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
              <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary bg-gray-50 focus:bg-white" placeholder="max@beispiel.at" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Telefonnummer</label>
              <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary bg-gray-50 focus:bg-white" placeholder="+43 123 45678" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Buchungsquelle</label>
              <select value={source} onChange={(e) => setSource(e.target.value as any)} className="w-full p-3 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer font-medium">
                <option value="manual">Manuell / Vor Ort</option>
                <option value="boxoffice">Abendkasse</option>
                <option value="phone">Telefonisch</option>
                <option value="website">Website (Eigen)</option>
                <option value="b2b">B2B Agentur</option>
                <option value="b2b">B2B Agentur</option>
              </select>
            </div>
            
            {source === 'b2b' && (
              <div className="animate-in slide-in-from-top-2 fade-in">
                <label className="block text-sm font-bold text-brand-primary mb-2">Partner wählen</label>
                <select value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)} className="w-full p-3 border-2 border-brand-primary rounded-lg text-sm bg-red-50 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary cursor-pointer font-bold text-brand-primary">
                  <option value="">-- CRM Partner --</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.companyName}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={handleBooking}
          disabled={isBooking || selectedSeatIds.length === 0}
          className="w-full py-4 bg-brand-primary text-white font-bold text-lg rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-primary/30 active:scale-[0.98] flex items-center justify-center"
        >
          {isBooking ? 'Verarbeite Buchung...' : 'Kostenpflichtig buchen'}
        </button>
      </div>

      {isEnsembleModalOpen && <EnsembleModal event={event} onClose={() => setIsEnsembleModalOpen(false)} />}
    </div>
  );
}
