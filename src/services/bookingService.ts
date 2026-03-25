import { doc, runTransaction, writeBatch, Timestamp, collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { SEATING_PLAN_TEMPLATE } from '../config/seatingPlan';
import { Booking, Seat } from '../types/schema';

const getAppPath = () => `apps/${APP_ID}`;

/**
 * Initializes all seat documents for a newly created event.
 * Writes to subcollection: apps/.../events/{eventId}/seats
 */
export async function initializeEventSeats(eventId: string) {
  const batch = writeBatch(db);
  const seatsColPath = `${getAppPath()}/events/${eventId}/seats`;

  SEATING_PLAN_TEMPLATE.forEach(row => {
    row.elements.forEach(el => {
      if (el.type === 'seat') {
        const seatRef = doc(db, seatsColPath, el.id);
        const newSeat: Seat = {
          id: el.id,
          row: el.row,
          number: el.number,
          status: 'available',
          eventId: eventId,
          bookingId: null
        };
        batch.set(seatRef, newSeat);
      }
    });
  });

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
  const seatsColPath = `${getAppPath()}/events/${eventId}/seats`;

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Read all requested Seat documents
      const seatRefs = seatIds.map(id => doc(db, seatsColPath, id));
      const seatDocs = await Promise.all(seatRefs.map(ref => transaction.get(ref)));

      // 2. Validate availability
      for (const seatDoc of seatDocs) {
        if (!seatDoc.exists()) {
          throw new Error(`Seat ${seatDoc.id} does not exist`);
        }
        const seat = seatDoc.data() as Seat;
        if (seat.status !== 'available') {
          throw new Error('Seats already taken');
        }
      }

      // 3. Write updates (Mark seats as sold/reserved)
      const targetStatus = bookingData.source === 'b2b' ? 'reserved' : 'sold';
      seatRefs.forEach(ref => {
        transaction.update(ref, {
          status: targetStatus,
          bookingId: bookingId
        });
      });

      // 4. Create the Booking document
      const newBooking: Booking = {
        ...bookingData,
        id: bookingId,
        eventId,
        seatIds,
        createdAt: Timestamp.now()
      };
      
      transaction.set(bookingRef, newBooking);
    });
    
    return bookingId;
  } catch (error) {
    console.error('Transaction failed: ', error);
    throw error;
  }
}

/**
 * Cancels a booking and resets its associated seats.
 */
export async function cancelBooking(bookingId: string) {
  const bookingRef = doc(db, `${getAppPath()}/bookings`, bookingId);

  try {
    await runTransaction(db, async (transaction) => {
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists()) {
        throw new Error('Booking not found');
      }

      const booking = bookingDoc.data() as Booking;
      if (booking.status === 'cancelled') return;

      const seatsColPath = `${getAppPath()}/events/${booking.eventId}/seats`;
      const seatRefs = booking.seatIds.map(id => doc(db, seatsColPath, id));

      // Reset seats
      seatRefs.forEach(ref => {
        transaction.update(ref, {
          status: 'available',
          bookingId: null
        });
      });

      // Cancel booking
      transaction.update(bookingRef, { status: 'cancelled' });
    });
  } catch (error) {
    console.error('Cancellation failed: ', error);
    throw error;
  }
}

/**
 * Real-time listener setup for seating plan UI per event.
 */
export function getEventSeats(eventId: string, callback: (seats: Seat[]) => void) {
  const seatsColPath = `${getAppPath()}/events/${eventId}/seats`;
  const q = query(collection(db, seatsColPath));
  
  return onSnapshot(q, (snapshot) => {
    const seats: Seat[] = [];
    snapshot.forEach((doc) => {
      seats.push(doc.data() as Seat);
    });
    callback(seats);
  });
}
