import { useState, useEffect } from 'react';
import { SEATING_PLAN_TEMPLATE } from '../../config/seatingPlan';
import { Seat, Booking, TicketCategory } from '../../types/schema';
import { SeatButton } from './SeatButton';
import { getEventSeating, initializeEventSeats } from '../../services/bookingService';
import { X } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { listenTicketCategories } from '../../services/firebase/pricingService';

interface Props {
  eventId: string;
  onSelectionChange: (selectedSeatIds: string[], seatsMap: Map<string, Seat>) => void;
  readOnly?: boolean;
}

export function SeatingPlan({ eventId, onSelectionChange, readOnly = false }: Props) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    // 1. Fetch from subcollection in real-time
    const unsub = getEventSeating(eventId, async (eventData) => {
      const fetchedSeating = eventData?.seating || {};
      
      const fetchedSeats: Seat[] = Object.entries(fetchedSeating).map(([id, s]: [string, any]) => ({
        id,
        eventId,
        row: s.row,
        number: s.number,
        status: s.bookingId ? 'sold' : 'available',
        bookingId: s.bookingId
      }));

      // Auto-fallback: If no seats exist for this event, generate them on the fly!
      if (fetchedSeats.length === 0) {
        setIsLoading(true);
        try {
          await initializeEventSeats(eventId);
        } catch (err) {
          console.error("Failed to auto-initialize seats:", err);
          setIsLoading(false);
        }
        return; 
      }

      setSeats(fetchedSeats);
      setIsLoading(false);
      
      // Auto-remove seats from user cart if they were booked somewhere else in DB
      setSelectedSeatIds(prev => {
        const validSelections = prev.filter(id => {
          const seat = fetchedSeats.find(s => s.id === id);
          return seat && seat.status === 'available';
        });
        
        // Push state up
        if (validSelections.length !== prev.length) {
           const map = new Map(fetchedSeats.map(s => [s.id, s]));
           onSelectionChange(validSelections, map);
        }
        return validSelections;
      });
    });
    
    // 2. Fetch Bookings for this specific Event
    const q = query(
      collection(db, `apps/${APP_ID}/bookings`),
      where('eventId', '==', eventId)
    );
    const unsubBookings = onSnapshot(q, (snap) => {
      const bList: Booking[] = [];
      snap.forEach(d => bList.push({ id: d.id, ...d.data() } as Booking));
      setBookings(bList);
    });

    // 3. Fetch Ticket Categories
    const unsubCategories = listenTicketCategories((cats) => {
       setCategories(cats);
    });
    
    return () => {
      unsub();
      unsubBookings();
      unsubCategories();
    };
  }, [eventId]);

  const toggleSeat = (seatId: string) => {
    if (readOnly) return;
    setSelectedSeatIds(prev => {
      const next = prev.includes(seatId) 
        ? prev.filter(id => id !== seatId) 
        : [...prev, seatId];
      
      const map = new Map(seats.map(s => [s.id, s]));
      onSelectionChange(next, map);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse pt-10">
        {Array.from({length: 6}).map((_, i) => (
           <div key={i} className="h-10 bg-gray-200 rounded-full w-full max-w-2xl mx-auto"></div>
        ))}
      </div>
    );
  }

  const seatMap = new Map(seats.map(s => [s.id, s]));

  return (
    <div className="flex flex-col gap-5 items-center overflow-x-auto p-4 md:p-8 bg-gray-50 rounded-xl border border-gray-200 shadow-inner">
      <div className="w-full max-w-lg h-14 bg-gray-300 rounded-b-3xl flex items-center justify-center text-gray-600 font-bold tracking-[0.3em] mb-12 shadow-sm border-b-2 border-gray-400">
        B Ü H N E
      </div>
      
      {/* 2. Map SEATING_PLAN_TEMPLATE strictly */}
      {SEATING_PLAN_TEMPLATE.map((rowBlueprint) => (
        <div key={rowBlueprint.rowId} className="flex flex-row justify-center items-center gap-2">
          {/* Left Label */}
          <div className="w-8 flex-shrink-0 text-center font-bold text-gray-500 font-heading text-xl mr-2">
            {rowBlueprint.rowId}
          </div>
          
          <div className="flex flex-row gap-2 justify-center items-center">
            {rowBlueprint.elements.map((el, i) => {
              if (el.type === 'spacer') {
                // width = number of missing seats (el.width) * seat_width (2.5rem) + (el.width - 1) * gap (0.5rem)
                const missingSeats = el.width;
                const spacerWidth = (missingSeats * 2.5) + ((missingSeats - 1) * 0.5);
                return <div key={`spacer-${rowBlueprint.rowId}-${i}`} style={{ width: `${spacerWidth}rem`, flexShrink: 0 }} />;
              }
              
              const dbSeat = seatMap.get(el.id);
              if (!dbSeat) return null;

              const isSelected = selectedSeatIds.includes(el.id);
              
              // Find matching booking if seat appears sold/reserved/checkedIn
              const seatBooking = bookings.find(b => b.seatIds?.includes(el.id) || b.tickets?.some(t => t.seatId === el.id));
              let categoryColor: string | undefined = undefined;
              
              if (seatBooking) {
                 const ticket = seatBooking.tickets?.find(t => t.seatId === el.id);
                 if (ticket) {
                    categoryColor = categories.find(c => c.id === ticket.categoryId)?.colorCode;
                 }
              }

              return (
                <SeatButton 
                  key={el.id} 
                  seat={dbSeat} 
                  isSelected={isSelected} 
                  onToggle={toggleSeat} 
                  categoryColor={categoryColor}
                  onClickInfo={seatBooking ? () => setSelectedBooking(seatBooking) : undefined}
                />
              );
            })}
          </div>

          {/* Right Label */}
          <div className="w-8 flex-shrink-0 text-center font-bold text-gray-500 font-heading text-xl ml-2">
            {rowBlueprint.rowId}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="mt-14 flex flex-wrap justify-center gap-6 text-sm bg-white p-5 rounded-full shadow-md border border-gray-200 font-medium">
         <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#bababa] bg-white rounded-full"></div> Frei
         </div>
         <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#c02a2a] rounded-full shadow-sm"></div> Ausgewählt
         </div>
         <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 rounded-full"></div> Verkauft
         </div>
         <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div> Reserviert (B2B)
         </div>
         <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center"><X className="w-3 h-3 text-white"/></div> Gesperrt
         </div>
      </div>

      {/* Info Modal per Click */}
      {selectedBooking && selectedBooking.customerData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full relative">
            <button 
              onClick={() => setSelectedBooking(null)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-gray-900 text-lg mb-4 pr-6">Buchungsdetails</h3>
            <div className="space-y-3 text-sm">
               <div className="flex justify-between border-b border-gray-100 pb-2">
                 <span className="text-gray-500">Kunde:</span>
                 <span className="font-medium text-gray-900">{selectedBooking.customerData.name}</span>
               </div>
               <div className="flex justify-between border-b border-gray-100 pb-2">
                 <span className="text-gray-500">Email:</span>
                 <span className="font-medium text-gray-900 truncate pl-4">{selectedBooking.customerData.email}</span>
               </div>
               <div className="flex justify-between border-b border-gray-100 pb-2">
                 <span className="text-gray-500">Status:</span>
                 <span className="font-medium text-gray-900 capitalize">{selectedBooking.status}</span>
               </div>
               <div className="flex justify-between border-b border-gray-100 pb-2">
                 <span className="text-gray-500">Quelle:</span>
                 <span className="font-medium text-gray-900 capitalize">{selectedBooking.source === 'boxoffice' ? 'Abendkasse' : selectedBooking.source}</span>
               </div>
               <div className="flex justify-between pt-1">
                 <span className="text-gray-500">Sitzplätze:</span>
                 <span className="font-medium text-brand-primary">{selectedBooking.seatIds?.length || 0} Ticket(s)</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
