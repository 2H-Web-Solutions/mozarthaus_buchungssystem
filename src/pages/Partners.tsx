import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Partner } from '../types/schema';
import { Plus, Users } from 'lucide-react';

export function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<string>('');
  const [partnerTypes, setPartnerTypes] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const fetchPartnerTypes = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, `apps/${APP_ID}/partner_types`));
        const typesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        setPartnerTypes(typesData);
        
        // Setze den ersten Typ als Standardwert, falls vorhanden
        if (typesData.length > 0) {
          setType(typesData[0].id);
        }
      } catch (error) {
        console.error('Fehler beim Laden der Partner-Typen:', error);
      }
    };
    fetchPartnerTypes();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `apps/${APP_ID}/partners`), snap => {
      const p: Partner[] = [];
      snap.forEach(d => p.push({ id: d.id, ...d.data() } as Partner));
      setPartners(p);
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !email) return;

    setIsSaving(true);
    const slugId = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    try {
      // Optimistic UI closure
      setIsModalOpen(false);
      setCompanyName('');
      setContactPerson('');
      setEmail('');
      if (partnerTypes.length > 0) {
        setType(partnerTypes[0].id);
      } else {
        setType('');
      }

      await setDoc(doc(db, `apps/${APP_ID}/partners`, slugId), {
        companyName,
        contactPerson,
        email,
        type
      });
    } catch(err) {
      alert('Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-heading text-brand-primary">B2B Partner & Agenturen</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-red-700 transition"
        >
          <Plus className="w-5 h-5"/> Neuer Partner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {partners.map(p => (
          <div key={p.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{p.companyName}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                    {p.type.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-2 flex-1 mt-2">
              <p><span className="font-medium">Kontakt:</span> {p.contactPerson || '-'}</p>
              <p><span className="font-medium">Email:</span> <a href={`mailto:${p.email}`} className="text-blue-600 hover:underline">{p.email}</a></p>
            </div>
          </div>
        ))}
        {partners.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
            Keine Partner hinterlegt.
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white p-6 rounded-lg w-full max-w-md">
             <h2 className="text-xl font-heading text-brand-primary mb-4">Neuen Partner anlegen</h2>
             <form onSubmit={handleCreate} className="space-y-4">
               <div>
                  <label className="block text-sm text-gray-700 mb-1">Firmenname</label>
                  <input autoFocus required type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="z.B. GetYourGuide GmbH" />
               </div>
               <div>
                  <label className="block text-sm text-gray-700 mb-1">Typ</label>
                  <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary">
                    {partnerTypes.length === 0 && <option value="">Keine Typen angelegt</option>}
                    {partnerTypes.map(pt => (
                      <option key={pt.id} value={pt.id}>{pt.name}</option>
                    ))}
                  </select>
               </div>
               <div>
                  <label className="block text-sm text-gray-700 mb-1">Ansprechpartner</label>
                  <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>
               <div>
                  <label className="block text-sm text-gray-700 mb-1">Email</label>
                  <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>
               
               <div className="flex gap-3 justify-end mt-6">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Abbrechen</button>
                 <button disabled={isSaving} type="submit" className="px-4 py-2 bg-brand-primary text-white rounded hover:bg-red-700 disabled:opacity-50">
                   {isSaving ? 'Speichert...' : 'Partner anlegen'}
                 </button>
               </div>
             </form>
           </div>
        </div>
      )}
    </div>
  );
}
