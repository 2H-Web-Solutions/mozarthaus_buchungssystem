import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Booking } from '../types/schema';

const generateBookingId = () => {
  const prefix = 'RES';
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

async function getNextBookingNumber(transaction: any): Promise<string> {
  const year = new Date().getFullYear().toString();
  const counterRef = doc(db, `apps/${APP_ID}/counters`, 'booking_numbers');
  
  const counterDoc = await transaction.get(counterRef);
  let currentNumber = 0;

  if (counterDoc.exists()) {
    const data = counterDoc.data();
    if (data.year === year) {
      currentNumber = data.lastNumber || 0;
    }
  }

  const nextNumber = currentNumber + 1;
  
  transaction.set(counterRef, {
    year: year,
    lastNumber: nextNumber
  }, { merge: true });

  return `${year}-${nextNumber}`;
}

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
  const eventRef = doc(db, `apps/${APP_ID}/events`, bookingData.eventId);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Get Event to check seating map
      const eventDoc = await transaction.get(eventRef);
      if (!eventDoc.exists()) throw new Error('Event not found');
      
      const eventData = eventDoc.data();
      const seating = eventData.seating || {};
      const updatedSeating = { ...seating };

      // Phase 1: Seat Assignment (Manual or Auto)
      const finalSeatIds = [...selectedSeatIds];

      if ((bookingData.bookingType === 'einzel' || bookingData.bookingType === 'gruppe') && finalSeatIds.length === 0 && bookingData.tickets && bookingData.tickets.length > 0) {
        // AUTO-ASSIGNMENT LOGIC
        for (const ticket of bookingData.tickets) {
          const qty = ticket.quantity || 1;
          const catId = ticket.categoryId.toLowerCase();
          
          // Map categoryId to internal 'A', 'B', 'STUDENT'
          let targetCat: 'A' | 'B' | 'STUDENT' = 'B';
          if (catId.includes('cat_a') || catId.includes('kategorie a')) targetCat = 'A';
          else if (catId.includes('student')) targetCat = 'STUDENT';

          // Find available seats for this category
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

          // Assign seats
          for (let i = 0; i < Math.min(qty, availableSeats.length); i++) {
            const seatId = availableSeats[i];
            updatedSeating[seatId].bookingId = bookingId;
            if (targetCat === 'STUDENT') {
              updatedSeating[seatId].category = 'STUDENT';
            }
            finalSeatIds.push(seatId);
          }
        }
      } else if (selectedSeatIds.length > 0) {
        // MANUAL ASSIGNMENT Logic (Legacy fallback/B2B overrides)
        for (const seatId of selectedSeatIds) {
          if (!updatedSeating[seatId]) {
            throw new Error(`Sitzplatz ${seatId} existiert im System nicht.`);
          }
          if (updatedSeating[seatId].bookingId) {
            throw new Error(`Ticket-Konflikt: Platz Reihe ${updatedSeating[seatId].row} - Sitz ${updatedSeating[seatId].number} wurde bereits vergeben.`);
          }
          updatedSeating[seatId].bookingId = bookingId;
        }
      }

      const generatedBookingNumber = await getNextBookingNumber(transaction);

      // Emit final booking payload
      const newBooking: Booking = {
        ...bookingData,
        id: bookingId,
        bookingNumber: bookingData.bookingNumber || generatedBookingNumber,
        seatIds: (bookingData.bookingType === 'einzel' || bookingData.bookingType === 'gruppe') ? finalSeatIds : [],
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

      const sanitizedBooking = sanitizeForFirestore(newBooking);
      
      // Atomic updates
      transaction.update(eventRef, { seating: updatedSeating });
      transaction.set(bookingRef, sanitizedBooking);
    });

    return bookingId;
  } catch (error) {
    console.error('Fatal: Booking transaction aborted due to strict mode integrity violation.', error);
    throw error;
  }
}
