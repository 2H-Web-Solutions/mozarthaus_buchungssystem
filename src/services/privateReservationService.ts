import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { SEATING_PLAN_TEMPLATE } from '../config/seatingPlan';
import { Booking, Event } from '../types/schema';

const getAppPath = () => `apps/${APP_ID}`;

/**
 * Interface for the private reservation creation data
 */
interface PrivateReservationInput {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  guestCount: number;
  totalPrice?: number;
}

/**
 * Creates an internal private reservation.
 * Registers a new 'is_private' event and a 'privatebooking' document.
 */
export async function createPrivateReservation(input: PrivateReservationInput) {
  const eventId = `private_${input.date.replace(/-/g, '')}_${input.time.replace(/:/g, '')}_${Date.now().toString().slice(-4)}`;
  const eventRef = doc(db, `${getAppPath()}/events`, eventId);
  
  const bookingId = `privat_${eventId}`;
  const bookingRef = doc(db, `${getAppPath()}/privatebooking`, bookingId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. Initialize Seating Plan
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

      // 2. Auto-assign Category A seats (Rows A, B, C)
      const availableSeatsA = Object.keys(seating).filter(id => 
        seating[id].category === 'A' && seating[id].bookingId === null
      );

      const assignedSeatIds: string[] = [];
      const qty = Math.min(input.guestCount, availableSeatsA.length);
      
      for (let i = 0; i < qty; i++) {
        const seatId = availableSeatsA[i];
        seating[seatId].bookingId = bookingId;
        assignedSeatIds.push(seatId);
      }

      // 3. Create Event Document
      const newEvent: Event = {
        id: eventId,
        title: input.title,
        date: input.date,
        time: input.time,
        status: 'active',
        totalCapacity: 67,
        seating: seating,
        occupied: qty,
        // @ts-ignore - Adding custom flag
        is_private: true
      };

      // 4. Create Private Booking Document
      const newBooking: Booking = {
        id: bookingId,
        bookingNumber: `PRIV-${input.date.replace(/-/g, '')}`,
        eventId: eventId,
        partnerId: null,
        isB2B: false,
        source: 'manual',
        status: 'pending', // Mapped to 'Neu' in Kanban
        bookingType: 'privat',
        customerData: {
          name: input.customerName,
          email: input.customerEmail,
          phone: input.customerPhone
        },
        eventTitle: input.title,
        eventDate: input.date,
        dateTime: `${input.date} ${input.time}`,
        seatIds: assignedSeatIds,
        totalAmount: input.totalPrice || (qty * 69), // Default Cat A price €69
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastPayload: {
          is_internal: true,
          guest_count: input.guestCount
        }
      };

      transaction.set(eventRef, newEvent);
      transaction.set(bookingRef, newBooking);

      return { eventId, bookingId };
    });

    return result;
  } catch (error) {
    console.error('Private Reservation creation failed:', error);
    throw error;
  }
}
