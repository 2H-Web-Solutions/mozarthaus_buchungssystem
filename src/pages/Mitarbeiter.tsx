import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { createMusiker, deleteMusiker, updateMusiker, type Musiker as MusikerType } from '../services/firebase/musikerService';
import { Plus, User, Trash2, Edit2, Archive, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createDigitalRole } from '../services/firebase/adminAuthService';
import toast from 'react-hot-toast';

export function Mitarbeiter() {
  const [musikerList, setMusikerList] = useState<MusikerType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const { appUser } = useAuth();
  const role = appUser?.role || 'admin';

  // Digital Role State
  const [enableDigitalRole, setEnableDigitalRole] = useState(false);
  const [digitalEmail, setDigitalEmail] = useState('');
  const [digitalPassword, setDigitalPassword] = useState('');

  // Form State
  const [art, setArt] = useState('Mitarbeiter');
  const [instrument, setInstrument] = useState('');
  const [nachname, setNachname] = useState('');
  const [vorname, setVorname] = useState('');
  const [strasse, setStrasse] = useState('');
  const [plz, setPlz] = useState('');
  const [ort, setOrt] = useState('');
  const [telefon, setTelefon] = useState('');
  const [email, setEmail] = useState('');
  const [steuernummer, setSteuernummer] = useState('');
  const [steuersatz, setSteuersatz] = useState<number>(0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `apps/${APP_ID}/musiker`), snap => {
      const list: MusikerType[] = [];
      snap.forEach(d => {
        const data = d.data();
        const isActive = data.active !== false;
        if (data.art === 'Mitarbeiter' || data.art === 'Dienstleister') {
          list.push({ id: d.id, ...data, active: isActive } as MusikerType);
        }
      });
      // Sortieren nach Nachname
      list.sort((a, b) => a.nachname.localeCompare(b.nachname));
      setMusikerList(list);
    });
    return () => unsub();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setArt('Mitarbeiter');
    setInstrument('');
    setNachname('');
    setVorname('');
    setStrasse('');
    setPlz('');
    setOrt('');
    setTelefon('');
    setEmail('');
    setSteuernummer('');
    setSteuersatz(0);
    setEnableDigitalRole(false);
    setDigitalEmail('');
    setDigitalPassword('');
  };

  const openNewModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (m: MusikerType) => {
    setEditingId(m.id);
    setArt(m.art);
    setInstrument(m.instrument || '');
    setNachname(m.nachname);
    setVorname(m.vorname);
    setStrasse(m.strasse || '');
    setPlz(m.plz || '');
    setOrt(m.ort || '');
    setTelefon(m.telefon || '');
    setEmail(m.email || '');
    setSteuernummer(m.steuernummer || '');
    setSteuersatz(m.steuersatz || 0);
    setEnableDigitalRole(false);
    setDigitalEmail('');
    setDigitalPassword('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nachname || !vorname) return;

    setIsSaving(true);
    const id = editingId || `${nachname.toLowerCase()}-${vorname.toLowerCase()}`.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();

    try {
      await createMusiker(id, {
        art,
        instrument,
        nachname,
        vorname,
        strasse,
        plz,
        ort,
        telefon,
        email,
        steuernummer,
        steuersatz,
        active: true
      });

      if (enableDigitalRole && digitalEmail && digitalPassword) {
        try {
          await createDigitalRole(digitalEmail, digitalPassword, 'mitarbeiter', id);
          toast.success('Digitale Rolle erfolgreich angelegt!');
        } catch (err: any) {
          toast.error(err.message || 'Fehler beim Anlegen der digitalen Rolle');
        }
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      alert('Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (id: string, activeStatus: boolean) => {
    try {
      await updateMusiker(id, { active: activeStatus });
    } catch (error) {
      console.error("Error updating status:", error);
      alert('Fehler beim Aktualisieren des Status');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Möchten Sie ${name} unwiderruflich löschen?`)) {
      try {
        await deleteMusiker(id);
      } catch (err) {
        alert('Fehler beim Löschen');
      }
    }
  };

  const displayedMitarbeiter = musikerList.filter(m => {
    const isTabMatch = activeTab === 'active' ? m.active : !m.active;
    const searchLower = searchQuery.toLowerCase();
    const isSearchMatch = 
      m.vorname.toLowerCase().includes(searchLower) ||
      m.nachname.toLowerCase().includes(searchLower) ||
      (m.email && m.email.toLowerCase().includes(searchLower)) ||
      m.art.toLowerCase().includes(searchLower);
      
    const isTypeMatch = filterType ? m.art === filterType : true;
    const isRoleMatch = filterRole ? m.instrument === filterRole : true;
    
    const isAllowed = role === 'admin' ? true : m.id === appUser?.linkedRecordId;
    
    return isTabMatch && isSearchMatch && isTypeMatch && isRoleMatch && isAllowed;
  });

  const uniqueRoles = Array.from(new Set(musikerList.map(m => m.instrument).filter(Boolean))).sort();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-heading text-brand-primary">Mitarbeiter & Dienstleister</h1>
        <div className="flex items-center gap-3">
          {role === 'admin' && (
            <button 
              onClick={openNewModal}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition"
            >
              <Plus className="w-5 h-5"/> Neu anlegen
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-200 pb-2">
        <div className="flex space-x-4">
        <button
          onClick={() => setActiveTab('active')}
          className={`py-2 px-4 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'active' 
              ? 'border-brand-primary text-brand-primary font-bold' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Aktive Mitarbeiter
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`py-2 px-4 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'archived' 
              ? 'border-brand-primary text-brand-primary font-bold' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Archivierte Mitarbeiter
        </button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
           <select 
             value={filterType}
             onChange={e => setFilterType(e.target.value)}
             className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary w-full md:w-40 bg-white"
           >
             <option value="">Alle Typen</option>
             <option value="Mitarbeiter">Mitarbeiter</option>
             <option value="Dienstleister">Dienstleister</option>
           </select>
           
           <select 
             value={filterRole}
             onChange={e => setFilterRole(e.target.value)}
             className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary w-full md:w-40 bg-white"
           >
             <option value="">Alle Rollen</option>
             {uniqueRoles.map(role => (
               <option key={role} value={role}>{role}</option>
             ))}
           </select>
           
           <div className="relative w-full md:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input 
               type="text" 
               placeholder="Mitarbeiter suchen..." 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
               className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
             />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedMitarbeiter.map(m => (
          <div key={m.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col relative group">
            <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity gap-2">
              <button onClick={() => openEditModal(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title="Bearbeiten">
                <Edit2 className="w-4 h-4" />
              </button>
              {role === 'admin' && (
                activeTab === 'active' ? (
                  <button onClick={() => handleArchive(m.id, false)} className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-md" title="Archivieren">
                    <Archive className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleArchive(m.id, true)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md" title="Wiederherstellen">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(m.id, `${m.vorname} ${m.nachname}`)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md" title="Endgültig löschen">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )
              )}
            </div>

            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{m.vorname} {m.nachname}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                    {m.art} {m.instrument ? `- ${m.instrument}` : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-1 flex-1 mt-2">
              <p><span className="font-medium">Adresse:</span> {m.strasse}, {m.plz} {m.ort}</p>
              <p><span className="font-medium">Tel:</span> {m.telefon || '-'}</p>
              <p><span className="font-medium">Email:</span> {m.email ? <a href={`mailto:${m.email}`} className="text-blue-600 hover:underline">{m.email}</a> : '-'}</p>
              <p><span className="font-medium">Steuer:</span> {m.steuernummer || '-'} ({m.steuersatz}%)</p>
            </div>
          </div>
        ))}
        {displayedMitarbeiter.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
            Keine Einträge in diesem Tab gefunden.
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
           <div className="bg-white p-6 rounded-lg w-full max-w-2xl my-8">
             <h2 className="text-xl font-heading text-brand-primary mb-6">
               {editingId ? 'Eintrag bearbeiten' : 'Neu anlegen'}
             </h2>
             <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">Art</label>
                  <select value={art} onChange={e => setArt(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary">
                    <option value="Mitarbeiter">Mitarbeiter</option>
                    <option value="Dienstleister">Dienstleister</option>
                  </select>
               </div>
               
               <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">Arbeit / Rolle</label>
                  <input type="text" value={instrument} onChange={e => setInstrument(e.target.value)} placeholder="z.B. Kassierer, Reinigung..." className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>

               <div>
                  <label className="block text-sm text-gray-700 mb-1">Vorname *</label>
                  <input autoFocus required type="text" value={vorname} onChange={e => setVorname(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>
               <div>
                  <label className="block text-sm text-gray-700 mb-1">Nachname *</label>
                  <input required type="text" value={nachname} onChange={e => setNachname(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>

               <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">Straße</label>
                  <input type="text" value={strasse} onChange={e => setStrasse(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>
               
               <div>
                  <label className="block text-sm text-gray-700 mb-1">PLZ</label>
                  <input type="text" value={plz} onChange={e => setPlz(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>
               <div>
                  <label className="block text-sm text-gray-700 mb-1">Ort</label>
                  <input type="text" value={ort} onChange={e => setOrt(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>

               <div>
                  <label className="block text-sm text-gray-700 mb-1">Telefon</label>
                  <input type="text" value={telefon} onChange={e => setTelefon(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>
               <div>
                  <label className="block text-sm text-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>

               <div>
                  <label className="block text-sm text-gray-700 mb-1">Steuernummer</label>
                  <input type="text" value={steuernummer} onChange={e => setSteuernummer(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>
               <div>
                  <label className="block text-sm text-gray-700 mb-1">Steuersatz (%)</label>
                  <input type="number" step="0.1" value={steuersatz} onChange={e => setSteuersatz(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
               </div>

               {role === 'admin' && (
                 <div className="col-span-1 md:col-span-2 mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                   <div className="flex items-center gap-2 mb-4">
                     <input 
                       type="checkbox" 
                       id="digitalRole"
                       checked={enableDigitalRole}
                       onChange={e => setEnableDigitalRole(e.target.checked)}
                       className="w-4 h-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary"
                     />
                     <label htmlFor="digitalRole" className="font-bold flex items-center gap-2 text-blue-900 cursor-pointer">
                       <ShieldCheck className="w-5 h-5 text-blue-600" />
                       Digitale Rolle aktivieren (Login)
                     </label>
                   </div>
                   
                   {enableDigitalRole && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-blue-200 ml-2">
                       <div>
                         <label className="block text-sm text-blue-800 mb-1">Login E-Mail *</label>
                         <input 
                           type="email" 
                           required={enableDigitalRole}
                           value={digitalEmail} 
                           onChange={e => setDigitalEmail(e.target.value)} 
                           placeholder="vorname@beispiel.at"
                           className="w-full p-2 border border-blue-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white" 
                         />
                       </div>
                       <div>
                         <label className="block text-sm text-blue-800 mb-1">Passwort *</label>
                         <input 
                           type="password" 
                           required={enableDigitalRole}
                           minLength={6}
                           value={digitalPassword} 
                           onChange={e => setDigitalPassword(e.target.value)} 
                           placeholder="Mindestens 6 Zeichen"
                           className="w-full p-2 border border-blue-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white" 
                         />
                       </div>
                     </div>
                   )}
                 </div>
               )}
               
               <div className="col-span-1 md:col-span-2 flex gap-3 justify-end mt-6">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded focus:outline-none">Abbrechen</button>
                 <button disabled={isSaving} type="submit" className="px-4 py-2 bg-brand-primary text-white rounded hover:bg-brand-primary/90 disabled:opacity-50 focus:outline-none">
                   {isSaving ? 'Speichert...' : 'Speichern'}
                 </button>
               </div>
             </form>
           </div>
        </div>
      )}
    </div>
  );
}
