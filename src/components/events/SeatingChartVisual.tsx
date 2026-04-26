import { useState, useEffect, useMemo } from 'react';
import { SEATING_PLAN_TEMPLATE } from '../../config/seatingPlan';
import { X } from 'lucide-react';
import { createBooking } from '../../services/bookingService';
import { Booking } from '../../types/schema';
import { getBookingDisplayData } from '../../utils/bookingMapper';
import { listenTicketCategories } from '../../services/firebase/pricingService';

interface Props {
  eventId: string;
  seating?: Record<string, { 
    bookingId: string | null, 
    category: 'A' | 'B' | 'STUDENT',
    row: string,
    number: number
  }>;
  bookings?: Booking[];
  readOnly?: boolean;
}

export function SeatingChartVisual({ eventId, seating = {}, bookings = [], readOnly = false }: Props) {
  const [categories, setCategories] = useState<any[]>([]);
  
  useEffect(() => {
    const unsub = listenTicketCategories(setCategories);
    return () => unsub();
  }, []);

  const baseCategoryColors = useMemo(() => {
    const mapping: Record<string, string> = {
      'A': '#BC6868',
      'B': '#2D7FBD',
      'STUDENT': '#96BF33'
    };
    categories.filter(c => !c.type || c.type === 'main').forEach(c => {
      if (c.name.toLowerCase().includes('a')) mapping['A'] = c.colorCode || mapping['A'];
      if (c.name.toLowerCase().includes('b')) mapping['B'] = c.colorCode || mapping['B'];
      if (c.name.toLowerCase().includes('student')) mapping['STUDENT'] = c.colorCode || mapping['STUDENT'];
    });
    return mapping;
  }, [categories]);

  const [selectedSeat, setSelectedSeat] = useState<{ id: string, name: string, category: string } | null>(null);
  const [customerName, setCustomerName] = useState('Abendkasse');
  const [paymentMethod, setPaymentMethod] = useState<'bar' | 'karte'>('bar');
  const [priceCategory, setPriceCategory] = useState('Standard (€69)');
  const [isSaving, setIsSaving] = useState(false);

  const priceMapping: Record<string, number> = {
    'Standard (€69)': 69,
    'Ermäßigt (€49)': 49,
    'Student (€29)': 29
  };

  const getSeatColor = (seatId: string) => {
    const seat = seating[seatId];
    if (!seat) return { className: 'border-gray-200 bg-gray-50', style: {} };
    
    const isBooked = !!seat.bookingId;
    if (!isBooked) return { className: 'border-gray-300 bg-white hover:border-brand-primary/50', style: {} };

    const color = baseCategoryColors[seat.category] || baseCategoryColors['B'];
    return { 
      className: '', 
      style: { backgroundColor: `${color}1A`, borderColor: color, color: color } 
    };
  };

  const getDotColor = (category: string) => {
    return baseCategoryColors[category] || baseCategoryColors['B'];
  };

  const openQuickSell = (seatId: string) => {
    const seat = seating[seatId];
    setSelectedSeat({
      id: seatId,
      name: seatId.replace(/row_|_seat_/g, ' ').toUpperCase(),
      category: seat?.category || 'B'
    });
    setCustomerName('Abendkasse');
    setPaymentMethod('bar');
    setPriceCategory('Standard (€69)');
  };

  const handleSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeat) return;
    setIsSaving(true);
    
    try {
      await createBooking(eventId, [selectedSeat.id], {
        customerData: {
          name: customerName,
          email: 'abendkasse@mozarthaus.at'
        },
        source: 'boxoffice',
        status: 'paid',
        partnerId: null,
        isB2B: false,
        paymentMethod,
        totalAmount: priceMapping[priceCategory] || 69,
        categoryName: selectedSeat.category === 'A' ? 'Category A' : 'Category B'
      });
      setSelectedSeat(null);
    } catch (err) {
      console.error(err);
      alert('Fehler beim Ausstellen des Tickets.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 items-center p-6 bg-white rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none print:p-0">
      <div className="w-full max-w-sm h-10 bg-brand-primary rounded-b-xl flex items-center justify-center text-white font-bold tracking-[0.2em] mb-6 shadow-sm">
        KONZERTBÜHNE
      </div>
      
      {SEATING_PLAN_TEMPLATE.map((rowBlueprint) => (
        <div key={rowBlueprint.rowId} className="flex flex-row justify-center items-center gap-1.5 w-full">
          <div className="w-6 flex-shrink-0 text-center font-bold text-gray-500 text-sm">
            {rowBlueprint.rowId}
          </div>
          
          <div className="flex flex-row gap-1.5 justify-center items-center">
            {rowBlueprint.elements.map((el, i) => {
              if (el.type === 'spacer') {
                const spacerWidth = (el.width * 1.5) + ((el.width - 1) * 0.375);
                return <div key={`spacer-${rowBlueprint.rowId}-${i}`} style={{ width: `${spacerWidth}rem`, flexShrink: 0 }} />;
              }
              
              const isBooked = !!seating[el.id]?.bookingId;
              const category = seating[el.id]?.category || 'B';
              const bkId = seating[el.id]?.bookingId;
              const booking = bkId ? bookings.find(b => b.id === bkId) : null;
              
              let customerName = '';
              if (booking) {
                const display = getBookingDisplayData(booking);
                customerName = display.customerName;
              }
              
              const seatLabel = `${el.id.replace(/row_|_seat_/g, ' ').toUpperCase()} (Cat ${category})`;
              const displayTitle = isBooked && customerName ? `${seatLabel} - ${customerName}` : seatLabel;
              
              const seatStyle = getSeatColor(el.id);
              
              return (
                <button 
                  key={el.id}
                  disabled={isBooked || readOnly}
                  onClick={() => !readOnly && openQuickSell(el.id)}
                  className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-colors print:w-5 print:h-5 ${seatStyle.className} ${isBooked || readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  style={seatStyle.style}
                  title={displayTitle}
                >
                  {isBooked ? (
                    <div className={`w-2.5 h-2.5 rounded-full print:hidden`} style={{ backgroundColor: getDotColor(category) }}></div>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="w-6 flex-shrink-0 text-center font-bold text-gray-500 text-sm">
            {rowBlueprint.rowId}
          </div>
        </div>
      ))}
      
      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="flex flex-wrap justify-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 rounded bg-white"></div> Frei
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: baseCategoryColors['A'] }}></div> Kat. A (Reihe A-C)
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: baseCategoryColors['B'] }}></div> Kat. B (Reihe D-F)
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: baseCategoryColors['STUDENT'] }}></div> Student
          </div>
        </div>
      </div>

      {selectedSeat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center print:hidden">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold font-heading text-lg text-brand-primary">Abendkasse</h3>
              <button onClick={() => setSelectedSeat(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSell} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Platz & Kategorie</label>
                <div className="p-2 bg-gray-50 border border-gray-200 rounded font-medium text-gray-900 text-center flex justify-between items-center">
                  <span>{selectedSeat.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full text-white`} style={{ backgroundColor: getDotColor(selectedSeat.category) }}>
                    KATEGORIE {selectedSeat.category}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Name (Optional)</label>
                <input 
                  type="text" 
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Kategorie / Preis</label>
                <select 
                  value={priceCategory}
                  onChange={(e) => setPriceCategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary bg-white"
                >
                  {Object.keys(priceMapping).map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Zahlart</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPaymentMethod('bar')} className={`flex-1 py-1.5 rounded border text-sm font-medium transition-colors ${paymentMethod === 'bar' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-600 border-gray-300 hover:border-brand-primary/50'}`}>Bar</button>
                  <button type="button" onClick={() => setPaymentMethod('karte')} className={`flex-1 py-1.5 rounded border text-sm font-medium transition-colors ${paymentMethod === 'karte' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-600 border-gray-300 hover:border-brand-primary/50'}`}>Karte</button>
                </div>
              </div>
              <button 
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 mt-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Speichert...' : 'Ticket ausstellen'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
