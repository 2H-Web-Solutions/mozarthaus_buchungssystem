import { doc, runTransaction, writeBatch, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { SEATING_PLAN_TEMPLATE } from '../config/seatingPlan';
import { Booking } from '../types/schema';
import { sendBookingConfirmation } from './firebase/mailService';

const getAppPath = () => `apps/${APP_ID}`;

async function getNextBookingNumber(transaction: any): Promise<string> {
  const year = new Date().getFullYear().toString();
  const counterRef = doc(db, `${getAppPath()}/counters`, 'booking_numbers');
  
  const counterDoc = await transaction.get(counterRef);
  let currentNumber = 0;

  if (counterDoc.exists()) {
    const data = counterDoc.data();
    // Wenn wir im selben Jahr sind, zähle weiter. Sonst fange bei 0 an.
    if (data.year === year) {
      currentNumber = data.lastNumber || 0;
    }
  }

  const nextNumber = currentNumber + 1;
  
  // Speichere den neuen Stand
  transaction.set(counterRef, {
    year: year,
    lastNumber: nextNumber
  }, { merge: true });

  return `${year}-${nextNumber}`;
}

/**
 * Initializes the seating map directly on the event document.
 */
export async function initializeEventSeats(eventId: string) {
  const eventRef = doc(db, `${getAppPath()}/events`, eventId);
  const seating: Record<string, any> = {};

  SEATING_PLAN_TEMPLATE.forEach(row => {
    row.elements.forEach(el => {
      if (el.type === 'seat') {
        seating[el.id] = {
          bookingId: null,
          category: el.category,
          row: el.row,
          number: el.number
        };
      }
    });
  });

  const batch = writeBatch(db);
  batch.update(eventRef, { seating });
  await batch.commit();
}

/**
 * Creates a booking securely using a Firestore Transaction.
 */
export async function createBooking(
  eventId: string, 
  seatIds: string[], 
  bookingData: Omit<Booking, 'id' | 'seatIds' | 'eventId' | 'createdAt'>
) {
  const bookingId = `booking_${eventId}_${Date.now()}`;
  const bookingRef = doc(db, `${getAppPath()}/bookings`, bookingId);
  const eventRef = doc(db, `${getAppPath()}/events`, eventId);


  try {
    await runTransaction(db, async (transaction) => {
      // 1. Get Event to check seating map
      const eventDoc = await transaction.get(eventRef);
      if (!eventDoc.exists()) throw new Error('Event not found');
      
      const eventData = eventDoc.data();
      const seating = eventData.seating || {};

      // 2. Validate availability
      for (const seatId of seatIds) {
        if (!seating[seatId]) throw new Error(`Seat ${seatId} does not exist`);
        if (seating[seatId].bookingId) throw new Error('Seats already taken');
      }

      // 3. Update seating map
      const updatedSeating = { ...seating };
      seatIds.forEach(id => {
        if (updatedSeating[id]) {
          updatedSeating[id].bookingId = bookingId;
          // Set category to STUDENT if the booking is for a student
          if (bookingData.categoryName?.toLowerCase().includes('student') || 
              bookingData.lastPayload?.variation_name?.toLowerCase().includes('student')) {
            updatedSeating[id].category = 'STUDENT';
          }
        }
      });

      // 4. Create the Booking document & update event
      const bookingNumber = await getNextBookingNumber(transaction);
      
      const newBooking: Booking = {
        ...bookingData,
        id: bookingId,
        bookingNumber: bookingNumber,
        eventId,
        seatIds,
        createdAt: Timestamp.now()
      };
      
      const sanitizeForFirestore = (obj: any): any => {
        if (obj === null || typeof obj !== 'object' || obj instanceof Timestamp) return obj;
        if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
        const result: any = {};
        for (const key in obj) {
          if (obj[key] !== undefined) {
            result[key] = sanitizeForFirestore(obj[key]);
          }
        }
        return result;
      };

      transaction.update(eventRef, { seating: updatedSeating });
      transaction.set(bookingRef, sanitizeForFirestore(newBooking));
    });
    
    sendBookingConfirmation(bookingId).catch(e => console.error('Mail confirmation trigger failed silently: ', e));

    return bookingId;
  } catch (error) {
    console.error('Transaction failed: ', error);
    throw error;
  }
}

/**
 * Cancels a booking and resets its associated seats in the event seating map.
 */
export async function cancelBooking(bookingId: string) {
  const bookingRef = doc(db, `${getAppPath()}/bookings`, bookingId);

  try {
    await runTransaction(db, async (transaction) => {
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists()) throw new Error('Booking not found');

      const booking = bookingDoc.data() as Booking;
      if (booking.status === 'cancelled') return;

      const eventRef = doc(db, `${getAppPath()}/events`, booking.eventId);
      const eventDoc = await transaction.get(eventRef);
      
      if (eventDoc.exists()) {
        const seating = eventDoc.data().seating || {};
        const updatedSeating = { ...seating };

        Object.keys(updatedSeating).forEach(id => {
          if (updatedSeating[id].bookingId === bookingId) {
            updatedSeating[id].bookingId = null;
            // Restore original category based on row
            const row = updatedSeating[id].row;
            updatedSeating[id].category = (['A', 'B', 'C'].includes(row) ? 'A' : 'B');
          }
        });

        transaction.update(eventRef, { seating: updatedSeating });
      }

      transaction.update(bookingRef, { status: 'cancelled' });
    });
  } catch (error) {
    console.error('Cancellation failed: ', error);
    throw error;
  }
}

/**
 * Real-time listener for the event document to get the seating map.
 */
export function getEventSeating(eventId: string, callback: (eventData: any) => void) {
  const eventRef = doc(db, `${getAppPath()}/events`, eventId);
  return onSnapshot(eventRef, (doc) => {
    callback(doc.data());
  });
}

/**
 * Creates a variant-based booking and AUTO-ASSIGNS seats based on category.
 */
export async function createVariantBooking(bookingData: Omit<Booking, 'id' | 'createdAt'>) {
  const bookingId = `booking_${bookingData.eventId}_${Date.now()}`;
  const bookingRef = doc(db, `${getAppPath()}/bookings`, bookingId);
  const eventRef = doc(db, `${getAppPath()}/events`, bookingData.eventId);

  try {
    await runTransaction(db, async (transaction) => {
      const eventDoc = await transaction.get(eventRef);
      if (!eventDoc.exists()) throw new Error('Event not found');
      
      const seating = eventDoc.data().seating || {};
      const updatedSeating = { ...seating };

      // Determine category from variation_name or other fields
      const variation = (bookingData.lastPayload?.variation_name || bookingData.categoryName || '').toLowerCase();
      let targetCat: 'A' | 'B' | 'STUDENT' = 'B';
      if (variation.includes('category a') || variation.includes('kategorie a')) targetCat = 'A';
      else if (variation.includes('student')) targetCat = 'STUDENT';

      // Auto-assign logic
      const qty = bookingData.effectiveQty || bookingData.lastPayload?.qty || 1;
      
      let availableSeats: string[] = [];
      if (targetCat === 'STUDENT') {
        // Students prefer Cat B (Rows D-F) but can sit in Cat A (Rows A-C) if needed
        const catB = Object.keys(updatedSeating).filter(id => updatedSeating[id].category === 'B' && updatedSeating[id].bookingId === null);
        const catA = Object.keys(updatedSeating).filter(id => updatedSeating[id].category === 'A' && updatedSeating[id].bookingId === null);
        availableSeats = [...catB, ...catA];
      } else {
        availableSeats = Object.keys(updatedSeating).filter(id => 
          updatedSeating[id].category === targetCat && updatedSeating[id].bookingId === null
        );
      }

      const assignedSeatIds: string[] = [];
      for(let i = 0; i < Math.min(qty, availableSeats.length); i++) {
        const seatId = availableSeats[i];
        updatedSeating[seatId].bookingId = bookingId;
        if (targetCat === 'STUDENT') {
          updatedSeating[seatId].category = 'STUDENT';
        }
        assignedSeatIds.push(seatId);
      }

      const bookingNumber = await getNextBookingNumber(transaction);
      const newBooking: Booking = {
        ...bookingData,
        id: bookingId,
        bookingNumber,
        seatIds: assignedSeatIds,
        createdAt: Timestamp.now()
      };

      transaction.update(eventRef, { seating: updatedSeating });
      transaction.set(bookingRef, newBooking);
    });

    sendBookingConfirmation(bookingId).catch(console.error);
    return bookingId;
  } catch (error) {
    console.error('Variant booking failed: ', error);
    throw error;
  }
}
