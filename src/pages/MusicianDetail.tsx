import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, getDocs } from 'firebase/firestore';
import { createRoot } from 'react-dom/client';
import html2pdf from 'html2pdf.js';
import toast from 'react-hot-toast';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { ArrowLeft, Printer, CalendarDays, CalendarClock, ChevronRight } from 'lucide-react';
import { HonorarnoteTemplateView, Gig } from '../components/admin/HonorarnoteTemplateView';
import { Musiker } from '../services/firebase/musikerService';

const PRIMARY_COLOR = '#c02a2a';

// Helper parsing logic identical to overview
function parseEventDate(d: any): Date {
  if (!d) return new Date();
  if (typeof d === 'string') {
    const parts = d.split(' ');
    const dateStr = parts[0];
    if (dateStr.includes('.')) {
      const [day, month, year] = dateStr.split('.');
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(d);
  }
  if (typeof d.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  return new Date();
}

function padTo2Digits(num: number) {
  return num.toString().padStart(2, '0');
}

export function MusicianDetail() {
  const { id } = useParams<{ id: string }>();
  const [musician, setMusician] = useState<Musiker | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [groupedHistory, setGroupedHistory] = useState<Record<string, { month: number, year: number, monthName: string, gigs: Gig[], totalGage: number }>>({});
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
      vorname: '',
      nachname: '',
      instrument: '',
      email: '',
      telefon: '',
      strasse: '',
      plz: '',
      ort: '',
      steuernummer: '',
      steuersatz: 13,
      iban: '' // Added IBAN as requested
  });

  useEffect(() => {
    if (!id) return;

    // Listen to Musiker
    const docRef = doc(db, `apps/${APP_ID}/musiker`, id); // Use musiker instead of musicians as the schema dictates
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as any;
            setMusician({ id: docSnap.id, ...data } as Musiker);
            setFormData({
                vorname: data.vorname || '',
                nachname: data.nachname || '',
                instrument: data.instrument || '',
                email: data.email || '',
                telefon: data.telefon || '',
                strasse: data.strasse || '',
                plz: data.plz || '',
                ort: data.ort || '',
                steuernummer: data.steuernummer || '',
                steuersatz: data.steuersatz !== undefined ? data.steuersatz : 13,
                iban: data.iban || ''
            });
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    async function loadEvents() {
        if (!id) return;
        const evSnap = await getDocs(collection(db, `apps/${APP_ID}/events`));
        const allEvents: any[] = [];
        evSnap.forEach(d => allEvents.push({ id: d.id, ...d.data() }));

        const now = new Date();
        now.setHours(0,0,0,0); // Start of today so today's gigs aren't missed
        const pastGigs: any[] = [];
        const upcomingGigs: any[] = [];

        allEvents.forEach(e => {
            if (e.status === 'cancelled') return;
            const d = parseEventDate(e.date);

            if (e.ensemble) {
                const member = e.ensemble.find((m: any) => m.musikerId === id && m.status !== 'abgesagt');
                if (member) {
                    if (d >= now) {
                        upcomingGigs.push({
                            id: e.id,
                            title: e.title || 'Konzert in der Sala Terrena',
                            eventDate: d,
                            dateStr: `${padTo2Digits(d.getDate())}.${padTo2Digits(d.getMonth() + 1)}.${d.getFullYear()}`,
                            time: e.time || '20:00',
                            gage: member.gage || 0
                        });
                    } else {
                        pastGigs.push({
                            eventDate: d,
                            gage: member.gage || 0,
                            time: e.time || '20:00'
                        });
                    }
                }
            }
        });

        // Sort upcoming ascending
        upcomingGigs.sort((a,b) => a.eventDate.getTime() - b.eventDate.getTime());
        setUpcomingEvents(upcomingGigs);

        // Group past by Month/Year
        const grouped: Record<string, any> = {};
        const months = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

        pastGigs.forEach(g => {
            const month = g.eventDate.getMonth();
            const year = g.eventDate.getFullYear();
            const key = `${year}-${month}`; // e.g. 2026-3

            if (!grouped[key]) {
                grouped[key] = {
                    month: month + 1,
                    year,
                    monthName: `${months[month]} ${year}`,
                    gigs: [],
                    totalGage: 0
                };
            }

            const dateStr = `${padTo2Digits(g.eventDate.getDate())}.${padTo2Digits(month + 1)}.${year}`;
            grouped[key].gigs.push({
                dateStr: `${dateStr} ${g.time}`,
                gage: g.gage
            });
            grouped[key].totalGage += g.gage;
        });

        // Sort inside groups and convert to sorted array based on newest first
        Object.keys(grouped).forEach(k => {
            grouped[k].gigs.sort((a: Gig, b: Gig) => {
                const partsA = a.dateStr.split(' ')[0].split('.');
                const partsB = b.dateStr.split(' ')[0].split('.');
                return `${partsA[2]}${partsA[1]}${partsA[0]}`.localeCompare(`${partsB[2]}${partsB[1]}${partsB[0]}`);
            });
        });

        setGroupedHistory(grouped);
    }
    loadEvents();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: name === 'steuersatz' ? Number(value) : value }));
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      setSaving(true);
      try {
          const docRef = doc(db, `apps/${APP_ID}/musiker`, id);
          await updateDoc(docRef, {
              ...formData
          });
          toast.success('Stammdaten erfolgreich gespeichert!');
      } catch (err: any) {
          toast.error('Fehler beim Speichern der Daten.');
          console.error(err);
      } finally {
          setSaving(false);
      }
  };

  const handleGeneratePdf = async (monthKey: string) => {
      if (!musician) return;
      setIsGeneratingPdf(monthKey);
      
      const data = groupedHistory[monthKey];
      
      try {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.zIndex = '-1000';
        container.style.width = '800px'; 
        document.body.appendChild(container);

        const root = createRoot(container);
        root.render(
            <HonorarnoteTemplateView musiker={musician} gigs={data.gigs} month={data.month} year={data.year} />
        );

        await new Promise(resolve => setTimeout(resolve, 800));

        const content = (container.firstElementChild || container) as HTMLElement;
        const periodStr = `${String(data.month).padStart(2, '0')}-${data.year}`;
        const opt = {
            margin: 10,
            filename: `Honorarnote_${musician.nachname}_${periodStr}.pdf`,
            image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 800 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as 'portrait' }
        };

        await html2pdf().set(opt).from(content).save();

        root.unmount();
        document.body.removeChild(container);
      } catch (e) {
          console.error(e);
          toast.error('Fehler bei der PDF-Generierung.');
      } finally {
          setIsGeneratingPdf(null);
      }
  };

  if (loading) {
      return (
          <div className="p-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
          </div>
      );
  }

  if (!musician) {
      return (
        <div className="p-8 text-center text-gray-500">
            Musiker nicht gefunden.
        </div>
      );
  }

  // Sort history keys descending
  const sortedHistoryKeys = Object.keys(groupedHistory).sort((a, b) => {
      const [yearA, monthA] = a.split('-').map(Number);
      const [yearB, monthB] = b.split('-').map(Number);
      if (yearA !== yearB) return yearB - yearA;
      return monthB - monthA;
  });

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
          <Link to="/stammdaten/musiker" className="text-gray-500 hover:text-gray-700 transition">
              <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Musiker Details: {musician.vorname} {musician.nachname}</h1>
      </div>

      {/* Stammdaten Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-100 text-brand-primary flex items-center justify-center"><CalendarDays className="w-3.5 h-3.5" /></span>
              Stammdaten
          </h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Vorname</label>
                  <input name="vorname" value={formData.vorname} onChange={handleChange} required className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" />
              </div>
              <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nachname</label>
                  <input name="nachname" value={formData.nachname} onChange={handleChange} required className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" />
              </div>
              <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Instrument / Rolle</label>
                  <input name="instrument" value={formData.instrument} onChange={handleChange} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" />
              </div>
              <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Steuersatz (%)</label>
                  <input type="number" step="1" name="steuersatz" value={formData.steuersatz} onChange={handleChange} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" />
              </div>
              <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" />
              </div>
              <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
                  <input name="telefon" value={formData.telefon} onChange={handleChange} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" />
              </div>
              
              <div className="col-span-1 md:col-span-3 space-y-3 pt-3 mt-1 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Adresse & Finanzdaten</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="col-span-1 md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Straße & Hausnummer</label>
                          <input name="strasse" value={formData.strasse} onChange={handleChange} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" />
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">PLZ</label>
                          <input name="plz" value={formData.plz} onChange={handleChange} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" />
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Ort</label>
                          <input name="ort" value={formData.ort} onChange={handleChange} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" />
                      </div>
                      <div className="col-span-1 md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">IBAN</label>
                          <input name="iban" value={formData.iban} onChange={handleChange} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" />
                      </div>
                      <div className="col-span-1 md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Steuernummer</label>
                          <input name="steuernummer" value={formData.steuernummer} onChange={handleChange} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" />
                      </div>
                  </div>
              </div>

              <div className="col-span-1 md:col-span-3 flex justify-end mt-2">
                  <button type="submit" disabled={saving} className="px-5 py-1.5 text-sm rounded-md text-white font-medium transition-colors" style={{ backgroundColor: PRIMARY_COLOR }}>
                      {saving ? 'Speichert...' : 'Änderungen speichern'}
                  </button>
              </div>
          </form>
      </div>

      {/* Kommende Einsätze */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-bold mb-3 text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><CalendarClock className="w-3.5 h-3.5" /></span>
              Kommende Einsätze
          </h2>

          {upcomingEvents.length === 0 ? (
              <p className="text-gray-500 italic text-sm">Keine kommenden Einsätze geplant.</p>
          ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {upcomingEvents.map(ev => (
                      <div key={ev.id} className="flex flex-col p-3 rounded-md border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition">
                          <div className="mb-2">
                              <h3 className="font-bold text-sm text-gray-900">{ev.dateStr} <span className="text-gray-500 font-normal">um {ev.time}</span></h3>
                              <p className="text-xs text-gray-600 truncate">{ev.title}</p>
                          </div>
                          <div className="mt-auto flex justify-end">
                              <Link 
                                to={`/events/${ev.id}/belegungsplan`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded transition-colors"
                              >
                                  Zum Event
                                  <ChevronRight className="w-3 h-3" />
                              </Link>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* Honorarnoten-Historie */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-bold mb-3 text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center"><Printer className="w-3.5 h-3.5" /></span>
              Honorarnoten Historie
          </h2>
          
          {sortedHistoryKeys.length === 0 ? (
              <p className="text-gray-500 italic text-sm">Bisher keine vergangenen Abrechnungen gefunden.</p>
          ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sortedHistoryKeys.map(key => {
                      const data = groupedHistory[key];
                      const totalBrutto = data.totalGage + (data.totalGage * (formData.steuersatz / 100));

                      return (
                          <div key={key} className="flex flex-col justify-between p-3 rounded-md border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition">
                              <div className="mb-2">
                                  <h3 className="font-bold text-sm text-gray-900">{data.monthName}</h3>
                                  <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                                      <span>{data.gigs.length} Gigs</span>
                                      <span className="font-medium text-gray-800">Brutto: {totalBrutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR'})}</span>
                                  </div>
                              </div>
                              <div className="mt-1 flex justify-end">
                                  <button 
                                      onClick={() => handleGeneratePdf(key)}
                                      disabled={isGeneratingPdf === key}
                                      className="inline-flex items-center justify-center min-w-[120px] gap-1.5 px-2.5 py-1 font-bold text-xs bg-gray-800 text-white rounded hover:bg-gray-700 transition disabled:opacity-50"
                                  >
                                      {isGeneratingPdf === key ? (
                                          <div className="w-3.5 h-3.5 rounded-full border-t-2 border-r-2 border-white animate-spin"></div>
                                      ) : (
                                          <>
                                              <Printer className="w-3.5 h-3.5" />
                                              PDF Generieren
                                          </>
                                      )}
                                  </button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          )}
      </div>

    </div>
  );
}
