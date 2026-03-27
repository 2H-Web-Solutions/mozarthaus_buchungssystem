import { doc, runTransaction, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Booking } from '../types/schema';
import { triggerN8nOutboundSync } from './n8nService';

/**
 * Real-time active subscription listener mapped across all standard client Bookings.
 */
export function subscribeToBookings(callback: (bookings: Booking[]) => void) {
  const colRef = collection(db, `apps/${APP_ID}/bookings`);
  return onSnapshot(colRef, (snapshot) => {
    const list: Booking[] = [];
    snapshot.forEach(d => {
      list.push({ ...d.data(), id: d.id } as Booking);
    });
    // Optional: Sort descending by natural date
    list.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    callback(list);
  }, (error) => {
    console.error('Board Sync Failed:', error);
  });
}

/**
 * Atomically shifts a Booking Status. Dispatches automated seat liberation on Cancellations.
 */
export async function updateBookingStatus(
  bookingId: string, 
  newStatus: 'pending' | 'paid' | 'cancelled', 
  paymentMethod?: 'bar' | 'karte' | 'voucher' | 'rechnung'
): Promise<void> {

  const bookingRef = doc(db, `apps/${APP_ID}/bookings`, bookingId);
  let updatedBooking: Booking | null = null;

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(bookingRef);
      if (!snap.exists()) {
        throw new Error('Buchung nicht gefunden.');
      }
      const bookingData = snap.data() as Booking;

      // Ensure locked seats are released exactly once during cancellation mutations
      if (newStatus === 'cancelled' && bookingData.status !== 'cancelled') {
         if (bookingData.seatIds && bookingData.seatIds.length > 0) {
            const seatsColPath = `apps/${APP_ID}/events/${bookingData.eventId}/seats`;
            
            // Read target seats
            const seatRefs = bookingData.seatIds.map(id => doc(db, seatsColPath, id));
            
            // Mutate physical floorplan tracking records sequentially into memory cache
            seatRefs.forEach(ref => {
              transaction.update(ref, {
                status: 'available',
                bookingId: null
              });
            });
         }
      }

      // Commit finalized booking object state modification payload
      const updates: Partial<Booking> = { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
      if (paymentMethod) {
        updates.paymentMethod = paymentMethod;
      }
      transaction.update(bookingRef, updates);
      updatedBooking = { ...bookingData, ...updates } as Booking;
    });
    
    // Dispatch async webhook representing backend status drift
    if (updatedBooking) {
      triggerN8nOutboundSync(updatedBooking).catch(e => {
        console.error('Failed to trigger n8n sync on status change:', e);
      });
    }
    
  } catch (error) {
    console.error('Error shifting transaction state', error);
    throw error;
  }
}
