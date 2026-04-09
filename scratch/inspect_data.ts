
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const firebaseConfig = {
  apiKey: envConfig.VITE_FIREBASE_API_KEY,
  authDomain: envConfig.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envConfig.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envConfig.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envConfig.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envConfig.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const APP_ID = 'mozarthaus_new_buchungssystem_mozarthaus_v1';

async function inspect() {
  console.log('--- INSPECTING EVENTS ---');
  const eventsRef = collection(db, `apps/${APP_ID}/events`);
  const eSnap = await getDocs(query(eventsRef, limit(5)));
  eSnap.forEach(doc => {
    const data = doc.data();
    console.log(`Event ID: ${doc.id} | Title: ${data.title} | Date: ${data.date} | Occupied: ${data.occupied}`);
  });

  console.log('\n--- INSPECTING BOOKINGS ---');
  const bookingsRef = collection(db, `apps/${APP_ID}/bookings`);
  const bSnap = await getDocs(query(bookingsRef, limit(5)));
  bSnap.forEach(doc => {
    const data = doc.data();
    console.log(`Booking ID: ${doc.id} | eventId (field): ${data.eventId} | Status: ${data.status} | Name: ${data.customerData?.name || 'N/A'}`);
  });
  
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
