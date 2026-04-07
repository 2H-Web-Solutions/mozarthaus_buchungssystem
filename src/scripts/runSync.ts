import { collection, getDocs, doc, writeBatch, Timestamp, deleteDoc, getFirestore } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import * as dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const APP_ID = 'mozarthaus_new_buchungssystem_mozarthaus_v1';
const EVENTS_COL = `apps/${APP_ID}/events`;

// Dummy seating plan for initialization (67 seats)
const SEATING_PLAN_SIZE = 67;

async function deleteAllEvents() {
  const querySnapshot = await getDocs(collection(db, EVENTS_COL));
  console.log(`Found ${querySnapshot.size} events to delete.`);

  for (const eventDoc of querySnapshot.docs) {
    const eventId = eventDoc.id;
    console.log(`Deleting event: ${eventId}`);
    
    const seatsSnap = await getDocs(collection(db, `${EVENTS_COL}/${eventId}/seats`));
    const seatBatch = writeBatch(db);
    seatsSnap.forEach(sDoc => seatBatch.delete(sDoc.ref));
    await seatBatch.commit();
    await deleteDoc(doc(db, EVENTS_COL, eventId));
  }
}

async function runSync() {
  try {
    console.log('Starting Wipe...');
    await deleteAllEvents();
    console.log('Wipe complete.');

    const url = 'http://localhost:5174/api/regiondo?dt_from=2026-04-07&dt_to=2027-04-08&store_locale=de-AT&path=products%2Favailabilities%2F559148';
    console.log(`Fetching from ${url}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
    
    const result = await response.json();
    const data = result.data;

    let createdCount = 0;
    const title = "Mozart Ensemble";
    const titleSlug = "mozart-ensemble";
    const regiondoId = "559148";

    for (const [dateStr, timeGroups] of Object.entries(data)) {
      const times = (timeGroups as any).flat();

      for (const timeStr of times) {
        const [hours, minutes] = (timeStr as string).split(':');
        const timeShort = `${hours}:${minutes}`;

        // ID: title-slug_YYYY_MM_DD_HH_MM
        const dateIdPart = dateStr.replace(/-/g, '_');
        const timeIdPart = timeShort.replace(/:/g, '_');
        const eventId = `${titleSlug}_${dateIdPart}_${timeIdPart}`;

        const eventDate = new Date(`${dateStr}T${timeStr}`);
        const eventRef = doc(db, EVENTS_COL, eventId);
        
        const eventData = {
          title: title,
          date: Timestamp.fromDate(eventDate),
          time: timeShort,
          status: 'active',
          totalCapacity: SEATING_PLAN_SIZE,
          occupied: 0,
          regiondoId: regiondoId
        };

        const batch = writeBatch(db);
        batch.set(eventRef, eventData);
        
        // Initialize seats (67 docs)
        for (let i = 1; i <= SEATING_PLAN_SIZE; i++) {
          const seatRef = doc(db, `${EVENTS_COL}/${eventId}/seats`, `seat_${i}`);
          batch.set(seatRef, {
            id: `seat_${i}`,
            status: 'available',
            eventId: eventId
          });
        }
        
        await batch.commit();
        console.log(`Created event and 67 seats: ${eventId}`);
        createdCount++;
      }
    }

    console.log(`\nSuccess! Sync complete. Total events created: ${createdCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Error during sync:', err);
    process.exit(1);
  }
}

runSync();
