import { Booking } from '../../types/schema';
import { CheckCircle2, AlertCircle, CheckSquare, Square, Mail } from 'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { sendBookingConfirmation } from '../../services/firebase/mailService';
import { getBookingDisplayData } from '../../utils/bookingMapper';
import toast from 'react-hot-toast';

interface Props {
  bookings: Booking[];
}

interface FlattenedTicket {
  id: string;
  bookingId: string;
  row: string;
  seatNumber: string;
  customerName: string;
  source: string;
  paymentStatus: string;
  amount: number;
  paymentMethod: string;
  info: string;
  quantity: number;
  createdAt: Date;
  isCheckedIn: boolean;
}

export function EventBookingTable({ bookings }: Props) {
  
  // Flatten bookings into individual tickets
  const flattenedTickets: FlattenedTicket[] = [];
  
  bookings.forEach(booking => {
     if (booking.status === 'cancelled') return;
     
     const display = getBookingDisplayData(booking);
     const createdDate = (booking.createdAt as any)?.toDate ? (booking.createdAt as any).toDate() : new Date(booking.createdAt as any);
     
     // 1. Case: Specific Seats Assigned
     if (booking.seatIds && booking.seatIds.length > 0) {
        const amountPerSeat = display.totalAmount / booking.seatIds.length;
        booking.seatIds.forEach((seatId: string) => {
           const match = seatId.match(/row_([a-z]+)_seat_(\d+)/i);
           const rowName = match ? match[1].toUpperCase() : '-';
           const seatNumber = match ? match[2] : '-';
           
           flattenedTickets.push({
             id: seatId,
             bookingId: booking.id,
             row: rowName,
             seatNumber: seatNumber,
             customerName: display.customerName,
             source: display.sourceLabel,
             paymentStatus: booking.status,
             amount: amountPerSeat,
             paymentMethod: display.paymentMethod,
             info: booking.isB2B ? 'B2B Partner' : (display.categoryPayloadName || ''),
             quantity: display.quantity,
             createdAt: createdDate,
             isCheckedIn: (booking.checkedInSeats || []).includes(seatId)
           });
        });
     } 
     // 2. Case: Internal Ticket Categories (no seats)
     else if (booking.tickets && booking.tickets.length > 0) {
        booking.tickets.forEach((t: any, i: number) => {
            const qty = t.quantity || 1;
            for (let q = 0; q < qty; q++) {
                flattenedTickets.push({
                  id: `${booking.id}-t${i}-q${q}`,
                  bookingId: booking.id,
                  row: '-',
                  seatNumber: '-',
                  customerName: display.customerName,
                  source: display.sourceLabel,
                  paymentStatus: booking.status,
                  amount: t.price || (display.totalAmount / qty),
                  paymentMethod: display.paymentMethod,
                  info: `Category: ${t.categoryName || t.categoryId}`,
                  quantity: display.quantity,
                  createdAt: createdDate,
                  isCheckedIn: (booking.checkedInSeats || []).includes(`${booking.id}-t${i}-q${q}`)
                });
            }
        });
     }
     // 3. Fallback: Generic Quantity (Synced bookings without seat/ticket structure yet)
     else {
        const qty = booking.groupPersons || (booking.lastPayload as any)?.qty || 1;
        const amountPerTicket = display.totalAmount / qty;
        for (let q = 0; q < qty; q++) {
            flattenedTickets.push({
              id: `${booking.id}-fallback-q${q}`,
              bookingId: booking.id,
              row: '-',
              seatNumber: '-',
              customerName: display.customerName,
              source: display.sourceLabel,
              paymentStatus: booking.status,
              amount: amountPerTicket,
              paymentMethod: display.paymentMethod,
              info: display.categoryPayloadName || 'Confirmed Ticket',
              quantity: display.quantity,
              createdAt: createdDate,
              isCheckedIn: (booking.checkedInSeats || []).includes(`${booking.id}-fallback-q${q}`)
            });
        }
     }
  });

  // Sort default by Row A-Z, then SeatNumber 1-99
  flattenedTickets.sort((a, b) => {
     if (a.row !== b.row) return a.row.localeCompare(b.row);
     return parseInt(a.seatNumber) - parseInt(b.seatNumber);
  });

  const toggleCheckIn = async (bookingId: string, ticketId: string, isCurrentlyCheckedIn: boolean) => {
     try {
       const bookingRef = doc(db, `apps/${APP_ID}/bookings`, bookingId);
       if (isCurrentlyCheckedIn) {
         await updateDoc(bookingRef, { checkedInSeats: arrayRemove(ticketId) });
       } else {
         await updateDoc(bookingRef, { checkedInSeats: arrayUnion(ticketId) });
       }
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-gray-400">
      <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center print:bg-white print:border-b-2 print:border-black">
        <h3 className="font-bold text-gray-900 print:text-xl uppercase tracking-wider text-xs">Booked seats ({flattenedTickets.length})</h3>
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-left text-sm whitespace-nowrap print:text-black">
          <thead className="bg-white">
            <tr className="text-gray-400 font-bold uppercase tracking-widest border-b border-gray-200 text-[10px] print:text-black print:border-black">
              <th className="p-4 w-12 text-center border-r border-gray-50 print:border-black">Check-In</th>
              <th className="p-4 w-16 text-center border-r border-gray-50 print:border-black">Row</th>
              <th className="p-4 w-16 text-center border-r border-gray-50 print:border-black">Place</th>
              <th className="p-4 w-12 text-center border-r border-gray-50 print:border-black">Qty</th>
              <th className="p-4 border-r border-gray-50 print:border-black">Name</th>
              <th className="p-4 border-r border-gray-50 print:border-black print:hidden">Salesperson</th>
              <th className="p-4 border-r border-gray-50 print:border-black">Payment Status</th>
              <th className="p-4 text-right border-r border-gray-50 print:border-black print:hidden">Amount</th>
              <th className="p-4 border-r border-gray-50 print:border-black print:hidden">Payment Method</th>
              <th className="p-4 print:border-black">Kategorie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 print:divide-black/20">
            {flattenedTickets.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-12 text-center text-gray-400 font-medium italic">Keine Teilnehmer in der Liste vorhanden.</td>
              </tr>
            ) : (
              flattenedTickets.map(ticket => (
                <tr key={ticket.id} className={`transition-colors group print:border-b print:border-gray-300 ${ticket.isCheckedIn ? 'bg-green-50/40 text-gray-500' : 'hover:bg-brand-primary/5'}`}>
                  <td className="p-4 text-center cursor-pointer print:hidden" onClick={() => toggleCheckIn(ticket.bookingId, ticket.id, ticket.isCheckedIn)}>
                    <div className="flex justify-center">
                      {ticket.isCheckedIn ? (
                        <CheckSquare className="w-6 h-6 text-green-600" />
                      ) : (
                        <Square className="w-6 h-6 text-gray-300 hover:text-brand-primary transition-colors" />
                      )}
                    </div>
                  </td>
                  {/* Print Checkbox visually representing CheckIn */}
                  <td className="hidden print:table-cell p-4 text-center border-r border-gray-100 border-black">
                     <div className="w-5 h-5 border-2 border-black inline-block rounded-sm">
                       {ticket.isCheckedIn && <div className="w-full h-full bg-black"></div>}
                     </div>
                  </td>
                  <td className="p-4 text-center font-bold text-gray-900 border-r border-gray-100 print:border-black">{ticket.row}</td>
                  <td className="p-4 text-center font-bold text-gray-900 border-r border-gray-100 print:border-black">{ticket.seatNumber}</td>
                  <td className="p-4 text-center font-bold text-brand-red border-r border-gray-100 print:border-black">{ticket.quantity}</td>
                  <td className={`p-4 font-bold ${ticket.isCheckedIn ? 'text-gray-500' : 'text-gray-800'} border-r border-gray-100 print:border-black`}>
                    {ticket.customerName}
                  </td>
                  <td className="p-4 text-gray-600 border-r border-gray-100 print:hidden">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold uppercase tracking-wider border border-gray-200">
                      {ticket.source}
                    </span>
                  </td>
                  <td className="p-4 border-r border-gray-100 print:border-black">
                    {ticket.paymentStatus === 'paid' ? (
                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-green-700 bg-green-50 border border-green-100 print:border-none print:p-0 print:text-black print:bg-transparent">
                         <CheckCircle2 className="w-3 h-3 print:hidden" /> Paid
                       </span>
                    ) : ticket.paymentStatus === 'confirmed' || ticket.paymentStatus === 'sent' ? (
                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-blue-700 bg-blue-50 border border-blue-100 print:border-none print:p-0 print:text-black print:bg-transparent">
                         <CheckCircle2 className="w-3 h-3 print:hidden" /> Confirmed
                       </span>
                    ) : (
                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-yellow-700 bg-yellow-50 border border-yellow-100 print:border-none print:p-0 print:text-black print:bg-transparent">
                         <AlertCircle className="w-3 h-3 print:hidden" /> Pending
                       </span>
                    )}
                  </td>
                  <td className="p-4 text-right font-bold text-gray-900 border-r border-gray-100 print:hidden">
                    € {ticket.amount.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-gray-600 border-r border-gray-100 print:hidden">
                    {ticket.paymentMethod !== '-' ? (
                       <span className="font-bold uppercase tracking-wider text-xs text-gray-500">
                         {ticket.paymentMethod}
                       </span>
                    ) : '-'}
                  </td>
                  <td className="p-4 text-gray-700 font-medium flex items-center gap-2">
                    <span className="truncate max-w-[200px] block font-bold text-brand-primary uppercase text-[10px] tracking-tight">{ticket.info || '-'}</span>
                    <button
                      onClick={() => handleResendMail(ticket.bookingId)}
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
