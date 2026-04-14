import { Booking } from '../../types/schema';
import { CheckCircle2, AlertCircle, CheckSquare, Square, Mail } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { sendBookingConfirmation } from '../../services/firebase/mailService';
import { getBookingDisplayData } from '../../utils/bookingMapper';
import toast from 'react-hot-toast';

interface Props {
  bookings: Booking[];
  seating: Record<string, any>;
}

interface GroupedBooking {
  id: string;
  customerName: string;
  source: string;
  paymentStatus: string;
  amount: number;
  paymentMethod: string;
  categorySummary: string;
  seatsLabel: string;
  quantity: number;
  createdAt: Date;
  isCheckedIn: boolean;
}

export function EventBookingTable({ bookings, seating }: Props) {
  
  const groupedList: GroupedBooking[] = [];
  
  bookings.forEach(booking => {
     if (booking.status === 'cancelled') return;
     
     const display = getBookingDisplayData(booking);
     const createdDate = (booking.createdAt as any)?.toDate ? (booking.createdAt as any).toDate() : new Date(booking.createdAt as any);
     
     // 1. Resolve Seats Label (e.g. "A/1, A/2")
     let seatsLabel = '-';
     if (booking.seatIds && booking.seatIds.length > 0) {
        seatsLabel = booking.seatIds.map(sid => {
          const match = sid.match(/row_([a-z]+)_seat_(\d+)/i);
          return match ? `${match[1].toUpperCase()}/${match[2]}` : sid;
        }).join(', ');
     }

     // 2. Resolve Category Summary (e.g. "2x A, 1x STUDENT")
     let categorySummary = display.categoryPayloadName || (booking.isB2B ? 'B2B Partner' : '-');
     if (booking.seatIds && booking.seatIds.length > 0) {
        const catCounts: Record<string, number> = {};
        booking.seatIds.forEach(sid => {
          const cat = seating[sid]?.category || (sid.match(/row_[a-c]_/i) ? 'A' : 'B');
          const finalCat = cat === 'STUDENT' ? 'Student' : `Kat. ${cat}`;
          catCounts[finalCat] = (catCounts[finalCat] || 0) + 1;
        });
        
        categorySummary = Object.entries(catCounts)
          .map(([cat, count]) => `${count}x ${cat}`)
          .join(', ');
     } else if (booking.tickets && booking.tickets.length > 0) {
        categorySummary = booking.tickets.map((t: any) => `${t.quantity || 1}x ${t.categoryName || 'Ticket'}`).join(', ');
     }

     groupedList.push({
       id: booking.id,
       customerName: display.customerName,
       source: display.sourceLabel,
       paymentStatus: booking.status,
       amount: display.totalAmount, // Total for the group
       paymentMethod: display.paymentMethod,
       categorySummary,
       seatsLabel,
       quantity: display.quantity,
       createdAt: createdDate,
       isCheckedIn: !!booking.isCheckedIn || (!!booking.checkedInSeats && booking.checkedInSeats.length >= (booking.seatIds?.length || 1))
     });
  });

  // Sort by first seat if available, else by name
  groupedList.sort((a, b) => {
     if (a.seatsLabel !== '-' && b.seatsLabel !== '-') {
       return a.seatsLabel.localeCompare(b.seatsLabel);
     }
     return a.customerName.localeCompare(b.customerName);
  });

  const toggleCheckIn = async (bookingId: string, isCurrentlyCheckedIn: boolean) => {
     try {
       const bookingRef = doc(db, `apps/${APP_ID}/bookings`, bookingId);
       await updateDoc(bookingRef, { 
         isCheckedIn: !isCurrentlyCheckedIn,
         // For backward compatibility, also fill checkedInSeats if they exist
         checkedInSeats: !isCurrentlyCheckedIn ? (bookings.find(b => b.id === bookingId)?.seatIds || []) : []
       });
     } catch (err) {
       console.error("Fehler beim Check-In:", err);
       alert("Speichern fehlgeschlagen.");
     }
  };

  const handleResendMail = async (bookingId: string) => {
    toast.promise(
      sendBookingConfirmation(bookingId),
      {
         loading: 'Sende Ticket...',
         success: 'E-Mail erfolgreich versendet!',
         error: 'Fehler beim Senden',
      }
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none print:rounded-none">
      <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center print:bg-white print:border-b-2 print:border-black">
        <h3 className="font-bold text-gray-900 print:text-xl uppercase tracking-wider text-xs">Buchungen ({groupedList.length})</h3>
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-left text-sm whitespace-nowrap print:text-black">
          <thead className="bg-white">
            <tr className="text-gray-400 font-bold uppercase tracking-widest border-b border-gray-200 text-[10px] print:text-black print:border-b-2 print:border-black">
              <th className="p-4 w-12 text-center border-r border-gray-50 print:border-r-2 print:border-black">Check-In</th>
              <th className="p-4 w-32 text-center border-r border-gray-50 print:border-r-2 print:border-black">Plätze</th>
              <th className="p-4 w-12 text-center border-r border-gray-50 print:border-r-2 print:border-black">Anz.</th>
              <th className="p-4 border-r border-gray-50 print:border-r-2 print:border-black">Teilnehmer</th>
              <th className="p-4 border-r border-gray-50 print:border-black print:hidden">Vertrieb</th>
              <th className="p-4 border-r border-gray-50 print:border-black">Status</th>
              <th className="p-4 text-right border-r border-gray-50 print:border-black print:hidden">Summe</th>
              <th className="p-4 border-r border-gray-50 print:border-black print:hidden">Zahlart</th>
              <th className="p-4 print:border-black">Kategorien</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 print:divide-black/20">
            {groupedList.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-gray-400 font-medium italic">Keine Teilnehmer in der Liste vorhanden.</td>
              </tr>
            ) : (
              groupedList.map(item => (
                <tr key={item.id} className={`transition-colors group border-b border-gray-100 print:border-b-2 print:border-black/30 print:bg-white ${item.isCheckedIn ? 'bg-green-50/40 opacity-70' : 'hover:bg-brand-primary/5'}`}>
                  <td className="p-4 text-center cursor-pointer print:hidden" onClick={() => toggleCheckIn(item.id, item.isCheckedIn)}>
                    <div className="flex justify-center">
                      {item.isCheckedIn ? (
                        <CheckSquare className="w-6 h-6 text-green-600" />
                      ) : (
                        <Square className="w-6 h-6 text-gray-300 hover:text-brand-primary transition-colors" />
                      )}
                    </div>
                  </td>
                  {/* Print Checkbox */}
                  <td className="hidden print:table-cell p-4 text-center border-r-2 border-black">
                     <div className="w-6 h-6 border-2 border-black inline-block rounded-sm relative">
                       {item.isCheckedIn && <div className="absolute inset-0.5 bg-black"></div>}
                     </div>
                  </td>
                  
                  <td className="p-4 text-center font-bold text-gray-900 border-r border-gray-100 print:border-black">
                    <span className="text-xs uppercase bg-slate-100 px-2 py-1 rounded border border-slate-200">{item.seatsLabel}</span>
                  </td>
                  <td className="p-4 text-center font-bold text-brand-red border-r border-gray-100 print:border-black">{item.quantity}</td>
                  <td className={`p-4 font-bold ${item.isCheckedIn ? 'text-gray-500' : 'text-gray-800'} border-r border-gray-100 print:border-black`}>
                    <span>{item.customerName}</span>
                  </td>
                  <td className="p-4 text-gray-600 border-r border-gray-100 print:hidden">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold uppercase tracking-wider border border-gray-200">
                      {item.source}
                    </span>
                  </td>
                  <td className="p-4 border-r border-gray-100 print:border-black">
                    {item.paymentStatus === 'paid' ? (
                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-green-700 bg-green-50 border border-green-100 print:border-none print:p-0 print:text-black print:bg-transparent">
                         <CheckCircle2 className="w-3 h-3 print:hidden" /> <span>Paid</span>
                       </span>
                    ) : item.paymentStatus === 'confirmed' || item.paymentStatus === 'sent' ? (
                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-blue-700 bg-blue-50 border border-blue-100 print:border-none print:p-0 print:text-black print:bg-transparent">
                         <CheckCircle2 className="w-3 h-3 print:hidden" /> <span>Confirmed</span>
                       </span>
                    ) : (
                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-yellow-700 bg-yellow-50 border border-yellow-100 print:border-none print:p-0 print:text-black print:bg-transparent">
                         <AlertCircle className="w-3 h-3 print:hidden" /> <span>Pending</span>
                       </span>
                    )}
                  </td>
                  <td className="p-4 text-right font-bold text-gray-900 border-r border-gray-100 print:hidden">
                    <div className="flex justify-end items-baseline gap-1">
                      <span className="text-xs opacity-50 select-none">€</span>
                      <span className="tabular-nums">
                        {item.amount.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 border-r border-gray-100 print:hidden">
                    <span className="font-bold uppercase tracking-wider text-xs text-gray-400">{item.paymentMethod}</span>
                  </td>
                  <td className="p-4 text-gray-700 font-medium flex items-center gap-2 print:border-none">
                    <span className="truncate max-w-[250px] block font-bold text-brand-primary uppercase text-[10px] tracking-tight print:text-black">{item.categorySummary}</span>
                    <button
                      onClick={() => handleResendMail(item.id)}
                      title="Bestätigung & Ticket erneut senden"
                      className="p-1.5 ml-auto text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors print:hidden"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
