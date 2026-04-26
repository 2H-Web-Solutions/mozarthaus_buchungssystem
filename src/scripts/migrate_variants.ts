import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { resolve } from 'path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });

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
const COLLECTION_PATH = `apps/${APP_ID}/ticket_categories`;

async function migrate() {
  const updates = [
    { id: 'hotel_kat__b', parentId: 'cat_b' },
    { id: 'hotel_kat_a', parentId: 'cat_a' },
    { id: 'hotel_student_', parentId: 'student' },
    { id: 'vienna_card', parentId: 'cat_b' }, // Kat B
    { id: 'vienna_card_kat_a', parentId: 'cat_a' },
    { id: 'vienna_card_student', parentId: 'student' }
  ];

  for (const update of updates) {
    const docRef = doc(db, COLLECTION_PATH, update.id);
    await setDoc(docRef, { type: 'variant', parentId: update.parentId }, { merge: true });
    console.log(`Updated ${update.id} -> parentId: ${update.parentId}`);
  }
  
  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(console.error);
