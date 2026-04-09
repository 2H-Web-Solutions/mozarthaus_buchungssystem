import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { Event, Booking } from '../../types/schema';
import { getBookingDisplayData } from '../../utils/bookingMapper';

export interface DashboardStats {
  revenue: number;
  upcomingEventsCount: number;
  occupancyPercent: number;
  recentEvents: Event[];
  recentBookings: Booking[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  // 1. Fetch upcoming events
  const eventsRef = collection(db, `apps/${APP_ID}/events`);
  const upcomingEventsQuery = query(
    eventsRef,
    where('date', '>=', today.toISOString().split('T')[0]),
    orderBy('date', 'asc'),
    limit(5)
  );
  
  const eventsSnap = await getDocs(upcomingEventsQuery);
  const recentEvents = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
  
  const upcomingEventsCount = eventsSnap.docs.filter(doc => {
    const eData = doc.data();
    const dStr = eData.date;
    if (!dStr) return false;
    const d = new Date(dStr);
    return d >= today && d <= nextWeek;
  }).length;

  // 2. Fetch Recent Bookings
  const bookingsRef = collection(db, `apps/${APP_ID}/bookings`);
  const recentBookingsQuery = query(
    bookingsRef,
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  
  const bookingsSnap = await getDocs(recentBookingsQuery);
  const recentBookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));

  // 3. Calculate Average Occupancy for the next 3 events
  let occupancySum = 0;
  let eventOccupancyCount = 0;
  for (let i = 0; i < Math.min(3, recentEvents.length); i++) {
    const e = recentEvents[i];
    const capacity = e.totalCapacity || 67;
    
    // Use doc-level 'occupied' field (updated by sync/webhooks)
    const occupied = e.occupied || 0;
    occupancySum += (occupied / capacity) * 100;
    eventOccupancyCount++;
  }
  
  const occupancyPercent = eventOccupancyCount > 0 
    ? Math.round(occupancySum / eventOccupancyCount)
    : 0;

  // 4. Calculate Revenue for current month
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentMonthBookingsQuery = query(
    bookingsRef,
    orderBy('createdAt', 'desc'),
    limit(200) // Increase limit to ensure we hit older items in the month
  );

  const monthSnap = await getDocs(currentMonthBookingsQuery);
  const revenue = monthSnap.docs.reduce((sum, doc) => {
    const b = doc.data() as Booking;
    const display = getBookingDisplayData({ id: doc.id, ...b } as Booking);
    
    // Use the mapped status and amount
    if (display.status === 'paid' || display.status.includes('paid') || display.status === 'confirmed') {
        const createdAtRaw = b.createdAt;
        const createdAt = (createdAtRaw as any)?.toDate ? (createdAtRaw as any).toDate() : new Date(createdAtRaw as any);
        
        if (createdAt >= startOfMonth) {
            return sum + display.totalAmount;
        }
    }
    return sum;
  }, 0);

  return {
    revenue,
    upcomingEventsCount,
    occupancyPercent,
    recentEvents,
    recentBookings
  };
}
