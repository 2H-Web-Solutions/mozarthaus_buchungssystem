import { doc, runTransaction, collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Booking } from '../types/schema';

/**
 * Real-time active subscription listener mapped across all standard client Bookings.
 */
export function subscribeToBookings(callback: (bookings: Booking[]) => void) {
  const bookingsRef = collection(db, `apps/${APP_ID}/bookings`);
  const privateRef = collection(db, `apps/${APP_ID}/privatebooking`);
  
  let allBookings: Booking[] = [];
  let privateBookings: Booking[] = [];

  const updateList = () => {
    const combined = [...allBookings, ...privateBookings];
    combined.sort((a, b) => {
      const timeB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : new Date(b.createdAt as any || 0).getTime();
      const timeA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : new Date(a.createdAt as any || 0).getTime();
      return timeB - timeA;
    });
    callback(combined);
  };

  const unsubBookings = onSnapshot(bookingsRef, (snapshot) => {
    allBookings = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
    updateList();
  });

  const unsubPrivate = onSnapshot(privateRef, (snapshot) => {
    privateBookings = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
    updateList();
  });

  return () => {
    unsubBookings();
    unsubPrivate();
  };
}

/**
 * Atomically shifts a Booking Status. Dispatches automated seat liberation on Cancellations.
 */
export async function updateBookingStatus(
  bookingId: string, 
  newStatus: 'pending' | 'paid' | 'cancelled', 
  paymentMethod?: 'bar' | 'karte' | 'voucher' | 'rechnung'
): Promise<void> {
  const isPrivate = bookingId.startsWith('privat_');
  const collectionName = isPrivate ? 'privatebooking' : 'bookings';
  const bookingRef = doc(db, `apps/${APP_ID}/${collectionName}`, bookingId);
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
         const eventRef = doc(db, `apps/${APP_ID}/events`, bookingData.eventId);
         const eventSnap = await transaction.get(eventRef);
         
         if (eventSnap.exists()) {
           const eventData = eventSnap.data();
           const updatesForEvent: any = {};
           let shouldUpdateEvent = false;

           // Wenn es eine Privatbuchung ist, stornieren wir das gesamte Event
           if (isPrivate || bookingData.bookingType === 'privat' || bookingData.isPrivate) {
             updatesForEvent.status = 'cancelled';
             shouldUpdateEvent = true;
           }

           // Freigabe der Sitzplätze (sowohl normale als auch private Buchungen können Sitzplätze reserviert haben)
           if (bookingData.seatIds && bookingData.seatIds.length > 0) {
             const seating = eventData.seating || {};
             const updatedSeating = { ...seating };
             
             bookingData.seatIds.forEach(seatId => {
               if (updatedSeating[seatId]) {
                 updatedSeating[seatId].bookingId = null;
               }
             });
             
             updatesForEvent.seating = updatedSeating;
             shouldUpdateEvent = true;
           }

           if (shouldUpdateEvent) {
             transaction.update(eventRef, updatesForEvent);
           }
         }
      }

      // Commit finalized booking object state modification payload
      const updates: any = { 
        status: newStatus,
        updatedAt: Timestamp.now()
      };
      
      if (paymentMethod) {
        updates.paymentMethod = paymentMethod;
      }
      
      transaction.update(bookingRef, updates);
      updatedBooking = { ...bookingData, ...updates } as Booking;
    });
    
    // Dispatch async webhook representing backend status drift
    if (updatedBooking) {
      // n8n sync trigger removed per user request
    }
    
  } catch (error) {
    console.error('Error shifting transaction state', error);
    throw error;
  }
}
