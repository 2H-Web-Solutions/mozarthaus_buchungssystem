import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Booking, Seat } from '../types/schema';
import { notifyN8n } from './n8nService';

const generateBookingId = () => {
  const prefix = 'RES';
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Ensures strict cross-client data integrity when finalizing reservations.
 * Atomically checks seat statuses, blocks them, and emits the Booking document.
 */
export async function executeBookingTransaction(
  bookingData: Omit<Booking, 'id' | 'createdAt'>,
  selectedSeatIds: string[]
): Promise<string> {
  const bookingId = generateBookingId();
  const bookingRef = doc(db, `apps/${APP_ID}/bookings`, bookingId);
  const seatsColPath = `apps/${APP_ID}/events/${bookingData.eventId}/seats`;

  try {
    await runTransaction(db, async (transaction) => {
      // Phase 1: Read lock targeting specific seat docs
      const seatRefs = selectedSeatIds.map(id => doc(db, seatsColPath, id));
      const seatDocs = await Promise.all(seatRefs.map(ref => transaction.get(ref)));

      // Phase 2: Validate consistency
      for (const snap of seatDocs) {
        if (!snap.exists()) {
          throw new Error(`Sitzplatz ${snap.id} existiert im System nicht.`);
        }
        const seatData = snap.data() as Seat;
        if (seatData.status !== 'available') {
          throw new Error(`Ticket-Konflikt: Platz Reihe ${seatData.row} - Sitz ${seatData.number} wurde vor wenigen Sekunden vergeben.`);
        }
      }

      // Phase 3: Mutations (Data Write)
      seatRefs.forEach(ref => {
        transaction.update(ref, {
          status: 'sold',
          bookingId: bookingId
        });
      });

      // Emit final booking payload
      const newBooking: Booking = {
        ...bookingData,
        id: bookingId,
        seatIds: selectedSeatIds,
        createdAt: Timestamp.now()
      };
      transaction.set(bookingRef, newBooking);
    });

    // Emitting reliable outbound webhook event to remote n8n orchestration nodes
    notifyN8n('booking_created', { bookingId, eventId: bookingData.eventId, tickets: bookingData.tickets });

    return bookingId;
  } catch (error) {
    console.error('Fatal: Booking transaction aborted due to strict mode integrity violation.', error);
    throw error;
  }
}
