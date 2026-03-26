import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../lib/firebase';

const googleProvider = new GoogleAuthProvider();

export const login = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Optionaler Domain-Check:
    // if (!result.user.email?.endsWith('@mozarthaus.at')) {
    //   await auth.signOut();
    //   throw new Error('Zugriff nur für Mozarthaus-Mitarbeiter gestattet.');
    // }
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Google-Anmeldung wurde abgebrochen.');
    }
    throw new Error('Fehler bei der Google-Anmeldung. Bitte versuchen Sie es erneut.');
  }
};

export const logout = () => signOut(auth);
export const getCurrentUser = () => auth.currentUser;
export const subscribeToAuth = (callback: (user: User | null) => void) => onAuthStateChanged(auth, callback);
