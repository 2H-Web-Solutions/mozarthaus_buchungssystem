
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

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

async function fetchSampleData() {
  const appId = 'mozarthaus_new_buchungssystem_mozarthaus_v1';
  console.log(`\n--- Fetching Sample Events for ${appId} ---\n`);
  
  try {
    const eventsRef = collection(db, `apps/${appId}/events`);
    const q = query(eventsRef, limit(3));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('No events found.');
    } else {
      querySnapshot.forEach((doc) => {
        console.log(`Event ID: ${doc.id}`);
        console.log(`Data: ${JSON.stringify(doc.data(), null, 2)}`);
        console.log('-------------------');
      });
    }
  } catch (error) {
    console.error('Error fetching events:', error);
  }
}

fetchSampleData();
