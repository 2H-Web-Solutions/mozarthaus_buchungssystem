import { useState, useEffect } from 'react';
import { SEATING_PLAN_TEMPLATE } from '../../config/seatingPlan';
import { Seat } from '../../types/schema';
import { SeatButton } from './SeatButton';
import { getEventSeats } from '../../services/bookingService';
import { X } from 'lucide-react';

interface Props {
  eventId: string;
  onSelectionChange: (selectedSeatIds: string[], seatsMap: Map<string, Seat>) => void;
}

export function SeatingPlan({ eventId, onSelectionChange }: Props) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch from subcollection in real-time
    const unsub = getEventSeats(eventId, (fetchedSeats) => {
      setSeats(fetchedSeats);
      setIsLoading(false);
      
      // Auto-remove seats from user cart if they were booked in DB
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
    return () => unsub();
  }, [eventId]);

  const toggleSeat = (seatId: string) => {
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
           <div key={i} className="h-10 bg-gray-200 rounded-lg w-full max-w-2xl mx-auto"></div>
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
                // Wait, seat width is 10 Tailwind units = 2.5rem. Gap is 2 units = 0.5rem.
                const missingSeats = el.width;
                const spacerWidth = (missingSeats * 2.5) + ((missingSeats - 1) * 0.5);
                return <div key={`spacer-${rowBlueprint.rowId}-${i}`} style={{ width: `${spacerWidth}rem`, flexShrink: 0 }} />;
              }
              
              const dbSeat = seatMap.get(el.id);
              if (!dbSeat) return null;

              const isSelected = selectedSeatIds.includes(el.id);
              return (
                <SeatButton 
                  key={el.id} 
                  seat={dbSeat} 
                  isSelected={isSelected} 
                  onToggle={toggleSeat} 
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
    </div>
  );
}
