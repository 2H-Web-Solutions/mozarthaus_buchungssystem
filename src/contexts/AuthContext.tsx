import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { subscribeToAuth } from '../services/firebase/authService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { AppUser } from '../types/schema';

// Admins hardcoded from requirement
const SUPER_ADMINS = ['konzerte@mozarthaus.at', 'info@up-seo.at'];

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, appUser: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAuth(async (u) => {
      setUser(u);
      
      if (u) {
        if (u.email && SUPER_ADMINS.includes(u.email)) {
          // Hardcoded admins bypass the DB check to guarantee access
          setAppUser({
            id: u.uid,
            email: u.email,
            role: 'admin'
          });
          setLoading(false);
          return;
        }

        // Fetch custom role from DB
        try {
          const userDoc = await getDoc(doc(db, `apps/${APP_ID}/users`, u.uid));
          if (userDoc.exists()) {
            setAppUser(userDoc.data() as AppUser);
          } else {
            console.warn("User has no role in the DB. Defaulting to empty access.");
            setAppUser(null);
          }
        } catch (error) {
          console.error("Failed to fetch user role", error);
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }
      
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return <AuthContext.Provider value={{ user, appUser, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
