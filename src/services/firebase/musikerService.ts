import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';

export interface Musiker {
  id: string;
  art: 'Musiker' | 'Mitarbeiter' | string; 
  instrument?: string; // z.B. "1. Violine", "Cello", "Sopran", "Dirigent"
  nachname: string;
  vorname: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  steuernummer: string;
  steuersatz: number;
  active?: boolean;
  grundgage?: number;
}

export async function fetchMusiker(): Promise<Musiker[]> {
  try {
    const snapshot = await getDocs(collection(db, `apps/${APP_ID}/musiker`));
    const musiker: Musiker[] = [];
    snapshot.forEach(doc => {
      musiker.push({ id: doc.id, ...doc.data() } as Musiker);
    });
    return musiker.sort((a, b) => {
      const aActive = a.active !== false;
      const bActive = b.active !== false;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return (a.nachname || '').localeCompare(b.nachname || '');
    });
  } catch (error) {
    console.error('Error fetching musiker:', error);
    return [];
  }
}

export async function createMusiker(id: string, musiker: Omit<Musiker, 'id'>) {
    await setDoc(doc(db, `apps/${APP_ID}/musiker`, id), musiker);
}

export async function deleteMusiker(id: string) {
    await deleteDoc(doc(db, `apps/${APP_ID}/musiker`, id));
}

export async function updateMusiker(id: string, updates: Partial<Musiker>) {
    await setDoc(doc(db, `apps/${APP_ID}/musiker`, id), updates, { merge: true });
}
