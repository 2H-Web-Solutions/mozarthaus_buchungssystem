import { Timestamp } from 'firebase/firestore';

export interface Event {
  id: string;
  title: string;
  date: Timestamp;
  status: 'active' | 'completed' | 'cancelled';
}

export interface Seat {
  id: string;
  row: string;
  number: number;
  status: 'available' | 'sold' | 'blocked' | 'reserved' | 'cart';
  eventId: string;
  bookingId: string | null;
}

export interface Booking {
  id: string;
  eventId: string;
  partnerId: string | null;
  source: 'manual' | 'regiondo' | 'b2b';
  status: 'confirmed' | 'cancelled';
  seatIds: string[];
  customerData: {
    name: string;
    email: string;
  };
  totalAmount: number;
  createdAt: Timestamp;
}

export interface Partner {
  id: string;
  companyName: string;
  type: 'b2b' | 'agency';
  contactPerson: string;
  email: string;
}
