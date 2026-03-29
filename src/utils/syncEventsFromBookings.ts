import { collection, getDocs, doc, getDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { initializeEventSeats } from '../services/bookingService';

export async function syncMissingEvents() {
  try {
    const bookingsSnap = await getDocs(collection(db, `apps/${APP_ID}/bookings`));
    const uniqueEvents = new Map();

    // 1. Daten intelligent aus der eventId extrahieren (Format: slug_YYYY_MM_DD)
    bookingsSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.eventId) {
        const parts = data.eventId.split('_');
        if (parts.length >= 4) {
          const slug = parts[0]; // z.B. "mozart-ensemble"
          const year = parts[1];
          const month = parts[2];
          const day = parts[3];
          
          const dateString = `${year}-${month}-${day}`;
          const timeString = "20:00"; // Fixe lokale Zeit, um UTC-Shifts zu ignorieren
          const dateTimeString = `${dateString}T${timeString}:00`;
          
          // Titel aus dem Slug generieren (z.B. "Mozart Ensemble")
          const title = slug.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

          if (!uniqueEvents.has(data.eventId)) {
            uniqueEvents.set(data.eventId, {
              title: title,
              dateString: dateTimeString,
              time: timeString
            });
          }
        }
      }
    });

    let createdCount = 0;
    let initializedSeatsCount = 0;
    
    // 2. Events in Batches (max 100) verarbeiten
    const eventsArray = Array.from(uniqueEvents.entries());
    const chunkSize = 100;
    
    for (let i = 0; i < eventsArray.length; i += chunkSize) {
      const chunk = eventsArray.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      const seatsToInitialize = [];
      
      for (const [eventId, eventData] of chunk) {
        const eventRef = doc(db, `apps/${APP_ID}/events`, eventId);
        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) {
          // Event fehlt -> Neu anlegen
          const eventTimestamp = Timestamp.fromDate(new Date(eventData.dateString));
          batch.set(eventRef, {
            title: eventData.title,
            date: eventTimestamp,
            time: eventData.time,
            status: 'active'
          });
          seatsToInitialize.push(eventId);
          createdCount++;
        } else {
          // Event existiert -> Prüfen ob Sitze fehlen
          const seatsSnap = await getDocs(collection(db, `apps/${APP_ID}/events/${eventId}/seats`));
          if (seatsSnap.empty) {
            seatsToInitialize.push(eventId);
            initializedSeatsCount++;
          }
        }
      }
      
      await batch.commit();
      
      // 3. Sitze initialisieren
      for (const eventId of seatsToInitialize) {
        await initializeEventSeats(eventId);
      }
    }

    return { createdCount, initializedSeatsCount };
  } catch (error) {
    console.error("Fehler beim Synchronisieren:", error);
    throw error;
  }
}
