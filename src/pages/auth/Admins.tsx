import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { AppUser } from '../../types/schema';
import { Plus, Users, Mail, ShieldAlert } from 'lucide-react';
import { createDigitalRole } from '../../services/firebase/adminAuthService';
import toast from 'react-hot-toast';

export function Admins() {
  const [admins, setAdmins] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, `apps/${APP_ID}/users`),
      where('role', '==', 'admin')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const adminData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppUser[];
      setAdmins(adminData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      toast.error('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    
    setIsSaving(true);
    try {
      await createDigitalRole(newEmail, newPassword, 'admin');
      toast.success('Administrator erfolgreich angelegt.');
      setIsModalOpen(false);
      setNewEmail('');
      setNewPassword('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Fehler beim Anlegen des Administrators.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Administratoren</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Admin hinzufügen
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>
          Administratoren haben uneingeschränkten Zugriff auf alle Bereiche des Systems, inklusive Buchungen, Rechnungen und Systemeinstellungen. Die Basis-Admins <strong>konzerte@mozarthaus.at</strong> und <strong>info@up-seo.at</strong> sind zusätzlich fest im Code als Super-Admins verankert.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  E-Mail Adresse
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Rolle
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Mail className="w-5 h-5 text-gray-400 mr-3" />
                      <div className="text-sm font-medium text-gray-900">
                        {admin.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 uppercase tracking-wider">
                      Administrator
                    </span>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-12 text-center text-gray-500">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>Keine zusätzlichen Administratoren in der Datenbank gefunden.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Neuen Administrator anlegen</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSaveAdmin} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail Adresse <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                  placeholder="admin@beispiel.at"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                  placeholder="Mindestens 6 Zeichen"
                />
                <p className="mt-1 text-xs text-gray-500">Das Passwort muss mindestens 6 Zeichen lang sein.</p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
