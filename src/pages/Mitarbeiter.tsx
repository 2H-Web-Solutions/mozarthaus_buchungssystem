import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { createMusiker, deleteMusiker, type Musiker as MusikerType } from '../services/firebase/musikerService';
import { Plus, User, Trash2, Edit2 } from 'lucide-react';

export function Mitarbeiter() {
  const [musikerList, setMusikerList] = useState<MusikerType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
        if (data.art === 'Mitarbeiter' || data.art === 'Dienstleister') {
          list.push({ id: d.id, ...data } as MusikerType);
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
        steuersatz
      });
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      alert('Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Möchten Sie ${name} wirklich löschen?`)) {
      try {
        await deleteMusiker(id);
      } catch (err) {
        alert('Fehler beim Löschen');
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-heading text-brand-primary">Mitarbeiter & Dienstleister</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition"
          >
            <Plus className="w-5 h-5"/> Neu anlegen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {musikerList.map(m => (
          <div key={m.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col relative group">
            <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity gap-2">
              <button onClick={() => openEditModal(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title="Bearbeiten">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(m.id, `${m.vorname} ${m.nachname}`)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md" title="Löschen">
                <Trash2 className="w-4 h-4" />
              </button>
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
        {musikerList.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
            Keine Musiker/Mitarbeiter hinterlegt.
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
                  <label className="block text-sm text-gray-700 mb-1">Instrument / Rolle</label>
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
