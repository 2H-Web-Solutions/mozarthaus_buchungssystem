import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, getDocs, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Partner } from '../types/schema';
import { Plus, Users, Search, Edit2, Archive, ArchiveRestore, Trash2, RefreshCw, Mail } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { ConfirmDeleteModal } from '../components/common/ConfirmDeleteModal';

export function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { isAdmin } = useAdmin();

  // List State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('nameAsc');
  const [filterType, setFilterType] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  // Form State
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<string>('');
  const [partnerTypes, setPartnerTypes] = useState<{id: string, name: string}[]>([]);
  const [merchantNr, setMerchantNr] = useState('');
  const [strasse, setStrasse] = useState('');
  const [ort, setOrt] = useState('');
  const [commissionRate, setCommissionRate] = useState<number | ''>('');
  
  // New Form Fields
  const [telefon, setTelefon] = useState('');
  const [steuernummer, setSteuernummer] = useState('');
  const [website, setWebsite] = useState('');
  const [bezahloption, setBezahloption] = useState('');
  const [bezahlinformation, setBezahlinformation] = useState('');
  const [notifyOnHighOccupancy, setNotifyOnHighOccupancy] = useState(false);
  
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [globalOccupancyEmailTemplate, setGlobalOccupancyEmailTemplate] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const defaultTemplate = `Sehr geehrte Damen und Herren,

Das Konzert am [Datum/Zeit] ist bereits ausverkauft.

Für weitere Fragen stehen wir gerne unter konzerte@mozarthaus.at oder telefonisch unter (0043)-1-911 9077 bereit!

Wir danken Ihnen für die Mitarbeit und verbleiben,

mit freundlichen Grüßen

Ihr Konzerte im Mozarthaus - Team

www.mozarthaus.at
Singerstrasse 7
A - 1010 Wien
(0043)-1-911 9077`;

  useEffect(() => {
    const fetchPartnerTypes = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, `apps/${APP_ID}/partner_types`));
        const typesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        setPartnerTypes(typesData);
        
        if (typesData.length > 0) {
          setType(typesData[0].id);
        }
      } catch (error) {
        console.error('Fehler beim Laden der Partner-Typen:', error);
      }
    };
    fetchPartnerTypes();

    const fetchGlobalTemplate = async () => {
      try {
        const docRef = doc(db, `apps/${APP_ID}/settings`, 'partner_email');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().template) {
          setGlobalOccupancyEmailTemplate(docSnap.data().template);
        } else {
          setGlobalOccupancyEmailTemplate(defaultTemplate);
        }
      } catch (err) {
        console.error("Error fetching global template", err);
        setGlobalOccupancyEmailTemplate(defaultTemplate);
      }
    };
    fetchGlobalTemplate();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `apps/${APP_ID}/partners`), snap => {
      const p: Partner[] = [];
      snap.forEach(d => p.push({ id: d.id, ...d.data() } as Partner));
      setPartners(p);
    });
    return () => unsub();
  }, []);

  const filteredAndSortedPartners = useMemo(() => {
    let result = [...partners];

    // Filter by Active/Archived
    if (activeTab === 'active') {
      result = result.filter(p => p.aktiv !== false);
    } else {
      result = result.filter(p => p.aktiv === false);
    }

    // Filter by Type
    if (filterType) {
      result = result.filter(p => p.type === filterType);
    }

    // Filter by Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.companyName?.toLowerCase().includes(q) || 
        p.contactPerson?.toLowerCase().includes(q) || 
        p.email?.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'nameAsc') return (a.companyName || '').localeCompare(b.companyName || '');
      if (sortBy === 'nameDesc') return (b.companyName || '').localeCompare(a.companyName || '');
      if (sortBy === 'type') return (a.type || '').localeCompare(b.type || '');
      return 0;
    });

    return result;
  }, [partners, searchQuery, sortBy, filterType, activeTab]);

  const openCreateModal = () => {
    setEditingPartnerId(null);
    setCompanyName('');
    setContactPerson('');
    setEmail('');
    setType(partnerTypes.length > 0 ? partnerTypes[0].id : '');
    setMerchantNr('');
    setStrasse('');
    setOrt('');
    setCommissionRate('');
    setTelefon('');
    setSteuernummer('');
    setWebsite('');
    setBezahloption('');
    setBezahlinformation('');
    setNotifyOnHighOccupancy(false);
    setIsModalOpen(true);
  };

  const openEditModal = (partner: Partner) => {
    setEditingPartnerId(partner.id);
    setCompanyName(partner.companyName || '');
    setContactPerson(partner.contactPerson || '');
    setEmail(partner.email || '');
    setType(partner.type || (partnerTypes.length > 0 ? partnerTypes[0].id : ''));
    setMerchantNr(partner.merchantNr || '');
    setStrasse(partner.strasse || '');
    setOrt(partner.ort || '');
    setCommissionRate(partner.commissionRate || '');
    setTelefon(partner.telefon || '');
    setSteuernummer(partner.steuernummer || '');
    setWebsite(partner.website || '');
    setBezahloption(partner.bezahloption || '');
    setBezahlinformation(partner.bezahlinformation || '');
    setNotifyOnHighOccupancy(partner.notifyOnHighOccupancy || false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !email) return;

    setIsSaving(true);
    
    try {
      const partnerData = {
        companyName,
        contactPerson,
        email,
        type,
        merchantNr,
        strasse,
        ort,
        commissionRate: Number(commissionRate) || 0,
        telefon,
        steuernummer,
        website,
        bezahloption,
        bezahlinformation,
        notifyOnHighOccupancy,
        aktiv: true
      };

      if (editingPartnerId) {
        await updateDoc(doc(db, `apps/${APP_ID}/partners`, editingPartnerId), partnerData);
      } else {
        const slugId = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        await setDoc(doc(db, `apps/${APP_ID}/partners`, slugId), partnerData);
      }

      setIsModalOpen(false);
    } catch(err) {
      console.error(err);
      alert('Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (id: string, activeStatus: boolean) => {
    try {
      await updateDoc(doc(db, `apps/${APP_ID}/partners`, id), {
        aktiv: activeStatus
      });
    } catch(err) {
      console.error(err);
      alert('Fehler beim Ändern des Status');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Möchten Sie den Partner '${name}' unwiderruflich löschen?`)) {
      try {
        await deleteDoc(doc(db, `apps/${APP_ID}/partners`, id));
      } catch (err) {
        alert('Fehler beim Löschen');
      }
    }
  };

  const handleSaveGlobalTemplate = async () => {
    setIsSavingTemplate(true);
    try {
      await setDoc(doc(db, `apps/${APP_ID}/settings`, 'partner_email'), {
        template: globalOccupancyEmailTemplate
      }, { merge: true });
      setIsTemplateModalOpen(false);
    } catch(err) {
      console.error(err);
      alert('Fehler beim Speichern der Vorlage');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-heading text-brand-primary">B2B Partner & Agenturen</h1>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <>
              <button 
                onClick={() => setIsTemplateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition text-sm"
              >
                <Mail className="w-4 h-4"/> Email Vorlage
              </button>
              <button 
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-red-700 transition text-sm"
              >
                <Plus className="w-4 h-4"/> Neuer Partner
              </button>
            </>
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
          Aktive Partner
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`py-2 px-4 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'archived' 
              ? 'border-brand-primary text-brand-primary font-bold' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Archivierte Partner
        </button>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white w-full md:w-auto"
            >
              <option value="">Alle Typen</option>
              {partnerTypes.map(pt => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white w-full md:w-auto"
            >
              <option value="nameAsc">Name (A-Z)</option>
              <option value="nameDesc">Name (Z-A)</option>
              <option value="type">Kategorie</option>
            </select>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Partner suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedPartners.map(p => (
          <div key={p.id} className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col relative group transition ${p.aktiv === false ? 'opacity-60 grayscale' : ''}`}>
            {isAdmin && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                <button 
                  onClick={() => openEditModal(p)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition"
                  title="Partner bearbeiten"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {activeTab === 'active' ? (
                  <button 
                    onClick={() => handleArchive(p.id, false)}
                    className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-md transition"
                    title="Partner archivieren"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => handleArchive(p.id, true)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition"
                      title="Partner wiederherstellen"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(p.id, p.companyName || p.contactPerson || 'Partner')}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition"
                      title="Endgültig löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 pr-8">{p.companyName}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                    {p.type?.toUpperCase() || '-'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-2 flex-1 mt-2">
              <p><span className="font-medium">Kontakt:</span> {p.contactPerson || '-'}</p>
              <p><span className="font-medium">Email:</span> <a href={`mailto:${p.email}`} className="text-blue-600 hover:underline">{p.email}</a></p>
              {p.telefon && <p><span className="font-medium">Tel:</span> {p.telefon}</p>}
            </div>
            
            {isAdmin && p.aktiv !== false && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input 
                    type="checkbox" 
                    checked={!!p.notifyOnHighOccupancy} 
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      try {
                        await updateDoc(doc(db, `apps/${APP_ID}/partners`, p.id), { notifyOnHighOccupancy: newValue });
                      } catch (err) {
                        console.error(err);
                        alert('Fehler beim Ändern der Automatisierungseinstellung');
                      }
                    }}
                    className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary w-3.5 h-3.5" 
                  />
                  <span className="font-medium text-gray-600">80% Stop-Sales Email senden</span>
                </label>
              </div>
            )}
          </div>
        ))}
        {filteredAndSortedPartners.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
            {searchQuery ? 'Keine Partner zur Suchanfrage gefunden.' : 'Keine Partner hinterlegt.'}
          </div>
        )}
      </div>

      {isModalOpen && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
           <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
             <h2 className="text-xl font-heading text-brand-primary mb-6">
               {editingPartnerId ? 'Partner bearbeiten' : 'Neuen Partner anlegen'}
             </h2>
             <form onSubmit={handleSave} className="space-y-6">
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                 
                 <div className="md:col-span-2 border-b pb-2 mb-2">
                   <h3 className="font-bold text-gray-800">Allgemeine Informationen</h3>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firmenname *</label>
                    <input autoFocus required type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="z.B. GetYourGuide GmbH" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                    <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary">
                      {partnerTypes.length === 0 && <option value="">Keine Typen angelegt</option>}
                      {partnerTypes.map(pt => (
                        <option key={pt.id} value={pt.id}>{pt.name}</option>
                      ))}
                    </select>
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ansprechpartner</label>
                    <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input type="tel" value={telefon} onChange={e => setTelefon(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website Adresse</label>
                    <input type="url" value={website} onChange={e => setWebsite(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="https://" />
                 </div>

                 <div className="md:col-span-2 border-b pb-2 mt-4 mb-2">
                   <h3 className="font-bold text-gray-800">Adresse & Abrechnung</h3>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                    <input type="text" value={strasse} onChange={e => setStrasse(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PLZ / Ort</label>
                    <input type="text" value={ort} onChange={e => setOrt(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Steuernummer / UID</label>
                    <input type="text" value={steuernummer} onChange={e => setSteuernummer(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bezahloption</label>
                    <select value={bezahloption} onChange={e => setBezahloption(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary">
                      <option value="">Bitte wählen...</option>
                      <option value="Rechnung">Rechnung</option>
                      <option value="Kreditkarte">Kreditkarte</option>
                      <option value="SEPA">SEPA Lastschrift</option>
                      <option value="PayPal">PayPal</option>
                      <option value="Bar">Barzahlung</option>
                      <option value="Sonstiges">Sonstiges</option>
                    </select>
                 </div>

                 <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bezahlinformationen (IBAN, etc.)</label>
                    <textarea value={bezahlinformation} onChange={e => setBezahlinformation(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="z.B. IBAN, BIC oder andere Notizen zur Abrechnung..." />
                 </div>

                 <div className="md:col-span-2 border-b pb-2 mt-4 mb-2">
                   <h3 className="font-bold text-gray-800">Interne Details</h3>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Nr.</label>
                    <input type="text" value={merchantNr} onChange={e => setMerchantNr(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provisionssatz (%)</label>
                    <input type="number" step="0.01" value={commissionRate} onChange={e => setCommissionRate(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="z.B. 15" />
                 </div>

                 <div className="md:col-span-2 border-b pb-2 mt-4 mb-2">
                   <h3 className="font-bold text-gray-800">Automatisierungen</h3>
                 </div>

                 <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer mb-0">
                      <input 
                        type="checkbox" 
                        checked={notifyOnHighOccupancy} 
                        onChange={e => setNotifyOnHighOccupancy(e.target.checked)} 
                        className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary w-4 h-4" 
                      />
                      <span className="font-medium text-gray-800">Email bei 80% Auslastung senden (Ausverkauft-Warnung)</span>
                    </label>
                 </div>

               </div>

               <div className="flex gap-3 justify-end mt-8 pt-4 border-t border-gray-200">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium">Abbrechen</button>
                 {isAdmin && (
                   <button disabled={isSaving} type="submit" className="px-6 py-2 bg-brand-primary text-white rounded hover:bg-red-700 disabled:opacity-50 font-bold">
                     {isSaving ? 'Speichert...' : (editingPartnerId ? 'Änderungen speichern' : 'Partner anlegen')}
                   </button>
                 )}
               </div>
             </form>
           </div>
        </div>
      )}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
             <h2 className="text-xl font-heading text-brand-primary mb-2 flex items-center gap-2">
               <Mail className="w-5 h-5"/> Email Vorlage (Stop-Sales)
             </h2>
             <p className="text-sm text-gray-600 mb-6">Diese Vorlage wird für alle Partner verwendet, die für "Email bei 80% Auslastung senden" aktiviert sind.</p>
             
             <div className="mb-4">
               <p className="text-xs text-gray-500 mb-2">Platzhalter: <code className="bg-gray-100 px-1 rounded">[Datum/Zeit]</code> wird beim Senden automatisch ersetzt.</p>
               <textarea 
                 value={globalOccupancyEmailTemplate} 
                 onChange={e => setGlobalOccupancyEmailTemplate(e.target.value)} 
                 rows={12} 
                 className="w-full p-3 border border-gray-300 rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-sm font-mono bg-gray-50" 
               />
             </div>

             <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200">
               <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium">Abbrechen</button>
               <button disabled={isSavingTemplate} onClick={handleSaveGlobalTemplate} className="px-6 py-2 bg-brand-primary text-white rounded hover:bg-red-700 disabled:opacity-50 font-bold">
                 {isSavingTemplate ? 'Speichert...' : 'Vorlage speichern'}
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
