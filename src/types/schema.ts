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
  totalCapacity?: number;
  regiondoId?: string; // Restore for mapping and display
  seating?: Record<string, { 
    bookingId: string | null, 
    category: 'A' | 'B' | 'STUDENT',
    row: string,
    number: number
  }>;
  occupied?: number;
  is_private?: boolean;
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
  bookingNumber?: string; // Fortlaufende Nummer (z.B. 2026-1)
  eventId: string;
  variantId?: string;
  partnerId: string | null;
  isB2B: boolean;
  source: 'manual' | 'boxoffice' | 'phone' | 'website' | 'b2b';
  status: 'confirmed' | 'cancelled' | 'pending' | 'paid';
  isPrivate?: boolean;
  paymentMethod?: 'bar' | 'karte' | 'voucher' | 'rechnung';
  seatIds?: string[];
  tickets?: { seatId?: string, categoryId: string, categoryName?: string, quantity?: number, price?: number }[];
  checkedInSeats?: string[]; // Specifically for Abendkasse per-seat tracking
  customerData: {
    name: string;
    email: string;
    phone?: string;
  };
  eventDate?: string; // Optional: The human-readable date string of the event (e.g. 21.05.2024)
  dateTime?: string; // Optional: The human-readable timestamp of the event for display
  categoryName?: string; // Lesbarer Name der Option/Kategorie
  eventTitle?: string;
  totalAmount: number;
  
  // Neue Felder für Buchungsvarianten
  bookingType?: 'einzel' | 'gruppe' | 'privat';
  sellerReference?: string;
  contactPerson?: string;
  groupPersons?: number;
  customTotalPrice?: number;
  receiptUrl?: string; // Link zum externen Beleg
  
  // Source-specific payload containing raw data from Regiondo or other providers
  lastPayload?: Record<string, any>;
  isCheckedIn?: boolean;
  effectiveQty?: number;

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
  regiondoOptionId?: string; // Add for mapping
  description?: string;
}
