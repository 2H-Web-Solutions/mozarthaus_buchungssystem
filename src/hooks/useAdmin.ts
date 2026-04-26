import { useAuth } from '../contexts/AuthContext';

export function useAdmin() {
  const { appUser } = useAuth();
  
  return {
    isAdmin: appUser?.role === 'admin',
    appUser
  };
}
