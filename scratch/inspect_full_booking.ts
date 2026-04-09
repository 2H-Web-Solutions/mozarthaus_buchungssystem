
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

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
  const bookingsRef = collection(db, `apps/${APP_ID}/bookings`);
  const bSnap = await getDocs(query(bookingsRef, limit(1)));
  if (!bSnap.empty) {
    console.log('--- FULL BOOKING DUMP ---');
    const doc = bSnap.docs[0];
    console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
  }
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
