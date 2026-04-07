import { collection, getDocs, doc, writeBatch, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { initializeEventSeats } from './bookingService';

const EVENTS_COL = `apps/${APP_ID}/events`;

/**
 * Wipes out all documents in the events collection, including their seats subcollections.
 */
export async function deleteAllEvents() {
  const querySnapshot = await getDocs(collection(db, EVENTS_COL));
  console.log(`Found ${querySnapshot.size} events to delete.`);

  // We process in chunks to avoid Firestore batch limits (500)
  for (const eventDoc of querySnapshot.docs) {
    const eventId = eventDoc.id;
    
    // 1. Delete all seats first (subcollection)
    const seatsSnap = await getDocs(collection(db, `${EVENTS_COL}/${eventId}/seats`));
    const seatBatch = writeBatch(db);
    seatsSnap.forEach(sDoc => seatBatch.delete(sDoc.ref));
    await seatBatch.commit();

    // 2. Delete the event itself
    await deleteDoc(doc(db, EVENTS_COL, eventId));
  }
  
  return querySnapshot.size;
}

interface RegiondoApiResponse {
  data: Record<string, string[][]>;
}

/**
 * Fetches events from the local proxy and populates Firestore.
 */
export async function resetEventsFromRegiondo() {
  // 1. Delete everything first
  await deleteAllEvents();

  // 2. Fetch new data
  const url = 'http://localhost:5174/api/regiondo?dt_from=2026-04-07&dt_to=2027-04-08&store_locale=de-AT&path=products%2Favailabilities%2F559148';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
  
  const result: RegiondoApiResponse = await response.json();
  const data = result.data;

  let createdCount = 0;
  const title = "Mozart Ensemble";
  const titleSlug = "mozart-ensemble";
  const regiondoId = "559148";

  // 3. Process dates and times
  for (const [dateStr, timeGroups] of Object.entries(data)) {
    // Flatten timeGroups if it's nested
    const times = timeGroups.flat();

    for (const timeStr of times) {
      // timeStr is usually "20:00:00" or "21:00:00"
      const [hours, minutes] = timeStr.split(':');
      const timeShort = `${hours}:${minutes}`; // e.g. "20:00"

      // Create unique ID: title-slug_YYYY_MM_DD_HH_mm
      const dateIdPart = dateStr.replace(/-/g, '_');
      const timeIdPart = timeShort.replace(/:/g, '_');
      const eventId = `${titleSlug}_${dateIdPart}_${timeIdPart}`;

      // Create Date object for Firestore Timestamp
      const eventDate = new Date(`${dateStr}T${timeStr}`);
      
      const eventRef = doc(db, EVENTS_COL, eventId);
      
      const eventData = {
        title: title,
        date: Timestamp.fromDate(eventDate),
        time: timeShort,
        status: 'active',
        totalCapacity: 67,
        occupied: 0,
        regiondoId: regiondoId
      };

      await writeBatch(db).set(eventRef, eventData).commit();

      // 4. Initialize the 67 seats for this event
      await initializeEventSeats(eventId);
      
      createdCount++;
    }
  }

  return createdCount;
}
