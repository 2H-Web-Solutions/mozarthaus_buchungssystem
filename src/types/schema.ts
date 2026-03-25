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
  variantId?: string;
  partnerId: string | null;
  isB2B: boolean;
  source: 'manual' | 'regiondo' | 'b2b';
  status: 'confirmed' | 'cancelled' | 'pending' | 'paid';
  paymentMethod?: 'bar' | 'karte' | 'voucher' | 'rechnung';
  seatIds?: string[];
  tickets?: { categoryId: string, quantity: number }[];
  customerData: {
    name: string;
    email: string;
  };
  eventDate?: string;
  eventTitle?: string;
  totalAmount: number;
  createdAt: Timestamp;
  updatedAt?: string | Timestamp;
}

export interface Partner {
  id: string;
  companyName: string;
  type: string;
  contactPerson: string;
  email: string;
  commissionRate?: number;
}
