import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';

// Initialize a secondary app just for auth management so the main user doesn't get logged out
const ADMIN_APP_NAME = 'auth-admin-app';
const adminApp = getApps().length > 1 
  ? getApp(ADMIN_APP_NAME) 
  : initializeApp(firebaseConfig, ADMIN_APP_NAME);

const adminAuth = getAuth(adminApp);

export async function createDigitalRole(email: string, pass: string, role: 'mitarbeiter' | 'musiker' | 'admin', linkedRecordId?: string) {
  try {
    const userCredential = await createUserWithEmailAndPassword(adminAuth, email, pass);
    const uid = userCredential.user.uid;

    // Create the AppUser record in our database
    const userRef = doc(db, `apps/${APP_ID}/users`, uid);
    await setDoc(userRef, {
      id: uid,
      email: email,
      role: role,
      linkedRecordId: linkedRecordId || null
    }, { merge: true });

    // We MUST logout from the secondary app to prevent auth-state contamination
    await adminAuth.signOut();
    return uid;
  } catch (error) {
    console.error('Fehler beim Anlegen der digitalen Rolle:', error);
    throw error;
  }
}

export async function updateDigitalPassword() {
  // To update a password from the frontend without the user being logged into the main app instance:
  // Using the secondary app works ONLY if the secondary auth is currently signed into that user.
  // Standard Firebase frontend SDK does not allow updating ANOTHER user's password directly unless using Admin SDK.
  // 
  // Da dies ein Frontend-Client ist, kann er nicht einfach fremde Passwörter löschen/ändern, außer über Cloud Functions.
  // Sofern das Frontend das tun muss, müssten wir uns mit den Credentials des Users in der Secondary App kurz einloggen (wofür wir das alte Passwort bräuchten),
  // oder wir belassen es beim reinem Anlegen. Firebase Frontend SDK erlaubt kein `adminAuth.updateUser()`.
  
  throw new Error("Admin-Passwort-Änderungen erfordern das alte Passwort im Frontend oder eine Cloud Function. Fürs Erste empfehlen wir das Löschen und Neuanlegen des Auth-Users in der Firebase Console.");
}
