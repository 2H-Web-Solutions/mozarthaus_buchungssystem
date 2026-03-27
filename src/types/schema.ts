import { Timestamp } from 'firebase/firestore';

export interface EventEnsembleMember {
  musikerId: string;
  name: string;
  instrument: string;
  gage?: number;
  status: 'angefragt' | 'bestätigt' | 'abgesagt';
}

export interface Event {
  id: string;
  title: string;
  date: Timestamp | string;
  time?: string;
  status: 'active' | 'completed' | 'cancelled';
  ensemble?: EventEnsembleMember[];
  regiondoId?: string | number; // NEU: Mapping-ID für Regiondo Inbound Sync
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
  source: 'manual' | 'boxoffice' | 'phone' | 'website' | 'regiondo' | 'b2b';
  status: 'confirmed' | 'cancelled' | 'pending' | 'paid';
  paymentMethod?: 'bar' | 'karte' | 'voucher' | 'rechnung';
  seatIds?: string[];
  tickets?: { seatId?: string, categoryId: string, quantity?: number, price?: number, regiondoOptionId?: string | number }[];
  checkedInSeats?: string[]; // Specifically for Abendkasse per-seat tracking
  customerData: {
    name: string;
    email: string;
  };
  eventDate?: string;
  eventTitle?: string;
  totalAmount: number;
  regiondoProductId?: string | number; // NEU: Die Event-ID für Regiondo
  
  // Neue Felder für Buchungsvarianten
  bookingType?: 'einzel' | 'gruppe' | 'privat';
  sellerReference?: string;
  contactPerson?: string;
  groupPersons?: number;
  customTotalPrice?: number;

  createdAt: Timestamp;
  updatedAt?: string | Timestamp;
}

export interface Partner {
  id: string;
  companyName: string; // Used as firmenname in import
  type: string;
  contactPerson?: string;
  email: string;
  commissionRate?: number; // Used as provisionsSatz

  // New fields from bulk import
  art?: string;
  merchantNr?: string;
  strasse?: string;
  ort?: string;
  telefon?: string;
  steuernummer?: string;
  aktiv?: boolean;
}

export interface TicketCategory {
  id: string; // e.g., 'cat_a', 'cat_b', 'student'
  name: string; // e.g., 'Kategorie A'
  price: number; 
  colorCode: string; // Hex color
  isActive: boolean;
  description?: string;
  regiondoOptionId?: string | number; // NEU: Die Option-ID für Regiondo
}
