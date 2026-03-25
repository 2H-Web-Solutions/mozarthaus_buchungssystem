import { Seat } from '../../types/schema';
import { X } from 'lucide-react';

interface Props {
  seat: Seat;
  isSelected: boolean;
  onToggle: (seatId: string) => void;
}

export function SeatButton({ seat, isSelected, onToggle }: Props) {
  let baseClass = "relative w-10 h-10 flex items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-200 select-none ";
  let stateClass = "";
  
  if (isSelected) {
     stateClass = "bg-[#c02a2a] border-[#c02a2a] text-white shadow-md";
  } else if (seat.status === 'available') {
     stateClass = "bg-white border-[#bababa] text-gray-700 hover:border-[#c02a2a] hover:text-[#c02a2a] hover:-translate-y-0.5";
  } else if (seat.status === 'sold') {
     stateClass = "bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed";
  } else if (seat.status === 'blocked') {
     stateClass = "bg-gray-800 border-gray-900 text-white cursor-not-allowed";
  } else if (seat.status === 'reserved') {
     stateClass = "bg-blue-500 border-blue-600 text-white cursor-not-allowed";
  } else if (seat.status === 'cart') {
     stateClass = "bg-orange-400 border-orange-500 text-white cursor-not-allowed";
  }

  const disabled = seat.status !== 'available' && !isSelected;

  return (
    <button
      disabled={disabled}
      onClick={() => onToggle(seat.id)}
      className={baseClass + stateClass}
      aria-label={`Reihe ${seat.row}, Platz ${seat.number}, ${seat.status}`}
      title={`Reihe ${seat.row} Platz ${seat.number}`}
    >
      {seat.status === 'blocked' ? <X className="w-5 h-5 text-gray-400" /> : seat.number}
    </button>
  );
}
