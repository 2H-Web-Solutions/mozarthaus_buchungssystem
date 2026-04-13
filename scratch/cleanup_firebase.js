
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
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

async function cleanupAndFetch() {
  const appId = 'mozarthaus_new_buchungssystem_mozarthaus_v1';
  console.log(`\n--- Searching for Test Events in ${appId} ---\n`);
  
  try {
    const eventsRef = collection(db, `apps/${appId}/events`);
    
    // 1. Fetch some events anyway to show the user
    const qRaw = await getDocs(query(eventsRef, where('status', '==', 'active')));
    console.log('Active Events:');
    qRaw.docs.slice(0, 5).forEach(d => {
       console.log(`ID: ${d.id} | Title: ${d.data().title} | Date: ${d.data().date?.toDate?.()?.toISOString() || d.data().date}`);
    });

    // 2. Search for events to delete
    // Check for explicit "Test" titles 
    const qTest = query(eventsRef, where('title', '==', 'Test Event'));
    const testDocs = await getDocs(qTest);
    
    for (const d of testDocs.docs) {
      console.log(`Deleting Test Event: ${d.id}`);
      await deleteDoc(doc(db, `apps/${appId}/events`, d.id));
    }

    if (testDocs.empty) {
      console.log('No specific "Test Event" documents found.');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

cleanupAndFetch();
