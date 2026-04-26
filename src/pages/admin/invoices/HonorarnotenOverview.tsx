import { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import html2pdf from 'html2pdf.js';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { APP_ID } from '../../../lib/constants';
import { Event } from '../../../types/schema';
import { Musiker, fetchMusiker } from '../../../services/firebase/musikerService';
import { Printer, CalendarDays, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { HonorarnoteTemplateView, Gig } from '../../../components/admin/HonorarnoteTemplateView';

const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

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

export function HonorarnotenOverview() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1); 
  const [selectedYear, setSelectedYear] = useState(new Date().getMonth() === 0 ? CURRENT_YEAR - 1 : CURRENT_YEAR);
  const [events, setEvents] = useState<Event[]>([]);
  const [musiker, setMusiker] = useState<Musiker[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [eventSnap, musikerData] = await Promise.all([
          getDocs(collection(db, `apps/${APP_ID}/events`)),
          fetchMusiker()
        ]);
        
        const loadedEvents = eventSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Event);
        setEvents(loadedEvents);
        setMusiker(musikerData);
      } catch (err) {
        console.error("Error loading honorarnoten basis data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const aggregatedData = useMemo(() => {
    if (!events.length || !musiker.length) return [];

    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    const now = new Date(); // To ensure we only bill *past* gigs!

    const monthEvents = events.filter(e => {
        if (e.status === 'cancelled') return false; 
        
        const d = parseEventDate(e.date);
        return d >= startOfMonth && d <= endOfMonth && d <= now;
    });

    const musikerMap: Record<string, { count: number, totalNetto: number }> = {};
    
    monthEvents.forEach(e => {
        if (!e.ensemble) return;
        e.ensemble.forEach(member => {
            if (!member.musikerId) return;
            if (member.status === 'abgesagt') return; 
            
            if (!musikerMap[member.musikerId]) {
                musikerMap[member.musikerId] = { count: 0, totalNetto: 0 };
            }
            musikerMap[member.musikerId].count += 1;
            musikerMap[member.musikerId].totalNetto += (member.gage || 0);
        });
    });

    return musiker.filter(m => musikerMap[m.id] && musikerMap[m.id].totalNetto > 0).map(m => {
        const stats = musikerMap[m.id];
        const mwstRate = m.steuersatz !== undefined ? m.steuersatz : 13; // default 13% for musicians
        const mwstAmount = stats.totalNetto * (mwstRate / 100);
        const totalBrutto = stats.totalNetto + mwstAmount;
        
        return {
            musiker: m,
            count: stats.count,
            totalNetto: stats.totalNetto,
            mwstRate,
            mwstAmount,
            totalBrutto
        };
    }).sort((a,b) => a.musiker.nachname.localeCompare(b.musiker.nachname));

  }, [events, musiker, selectedMonth, selectedYear]);

  const totalSummeBrutto = aggregatedData.reduce((acc, curr) => acc + curr.totalBrutto, 0);

  const handleDownloadPdf = async (m: Musiker) => {
      setIsDownloading(m.id);
      try {
          const startOfMonth = new Date(selectedYear, selectedMonth, 1);
          const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
          const now = new Date(); 
  
          const monthEvents = events.filter(e => {
              if (e.status === 'cancelled') return false; 
              const d = parseEventDate(e.date);
              return d >= startOfMonth && d <= endOfMonth && d <= now;
          });
  
          const gigs: Gig[] = [];
          monthEvents.forEach(e => {
              if (!e.ensemble) return;
              const member = e.ensemble.find(mem => mem.musikerId === m.id && mem.status !== 'abgesagt');
              if (member) {
                  const d = parseEventDate(e.date);
                  const dateStr = `${padTo2Digits(d.getDate())}.${padTo2Digits(d.getMonth() + 1)}.${d.getFullYear()}`;
                  const timeStr = e.time ? e.time : '20:00';
                  gigs.push({
                      dateStr: `${dateStr} ${timeStr}`,
                      gage: member.gage || 0
                  });
              }
          });
  
          gigs.sort((a,b) => {
            const partsA = a.dateStr.split(' ')[0].split('.');
            const partsB = b.dateStr.split(' ')[0].split('.');
            const codeA = `${partsA[2]}${partsA[1]}${partsA[0]}`;
            const codeB = `${partsB[2]}${partsB[1]}${partsB[0]}`;
            return codeA.localeCompare(codeB);
        });

        const container = document.createElement('div');
        // Place it physically on the page but behind everything, so html2canvas renders it properly without white boundaries
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.zIndex = '-1000';
        container.style.width = '800px'; 
        document.body.appendChild(container);

        const root = createRoot(container);
        root.render(
            <HonorarnoteTemplateView musiker={m} gigs={gigs} month={selectedMonth + 1} year={selectedYear} />
        );

        await new Promise(resolve => setTimeout(resolve, 800)); // wait for render and font paint

        const content = container.firstElementChild || container;

        const periodStr = `${String(selectedMonth + 1).padStart(2, '0')}-${selectedYear}`;
        const opt = {
            margin: [10, 10, 10, 10],
            filename: `Honorarnote_${m.nachname}_${periodStr}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 800 }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(content).save();

        root.unmount();
        document.body.removeChild(container);
    } catch (err) {
        console.error("Failed to generate PDF", err);
    } finally {
        setIsDownloading(null);
    }
};

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-primary/10 rounded-lg">
              <Receipt className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900">Honorarnoten</h1>
              <p className="text-sm text-gray-500 font-medium">Monatliche Abrechnung der Gagen</p>
            </div>
        </div>

        <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-1.5">
                <CalendarDays className="w-5 h-5 text-gray-500 ml-2" />
                <select 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="bg-transparent border-none font-bold text-gray-700 focus:ring-0 cursor-pointer"
                >
                    {MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
                </select>
                <select 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="bg-transparent border-none font-bold text-gray-700 focus:ring-0 cursor-pointer pr-4"
                >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200">
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Musiker</th>
                            <th className="p-4 text-xs font-bold text-center text-gray-500 uppercase tracking-wider">Auftritte</th>
                            <th className="p-4 text-xs font-bold text-right text-gray-500 uppercase tracking-wider">Netto (Gagen)</th>
                            <th className="p-4 text-xs font-bold text-right text-gray-500 uppercase tracking-wider">MwSt</th>
                            <th className="p-4 text-xs font-bold text-right text-gray-500 uppercase tracking-wider">Bruttobetrag</th>
                            <th className="p-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Aktion</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {aggregatedData.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500 font-medium">
                                    Keine abrechenbaren Auftritte für {MONTHS[selectedMonth]} {selectedYear} gefunden.
                                </td>
                            </tr>
                        ) : (
                            aggregatedData.map(data => (
                                <tr key={data.musiker.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">{data.musiker.vorname} {data.musiker.nachname}</div>
                                        <div className="text-sm text-gray-500">{(data.musiker as any).steuernummer || 'Keine Steuernummer'}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold text-sm">
                                            {data.count}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-medium text-gray-700">
                                        € {data.totalNetto.toLocaleString('de-AT', {minimumFractionDigits: 2})}
                                    </td>
                                    <td className="p-4 text-right text-sm text-gray-500">
                                        {data.mwstRate}% ({(data.mwstAmount).toLocaleString('de-AT', {minimumFractionDigits: 2})})
                                    </td>
                                    <td className="p-4 text-right font-black text-gray-900">
                                        € {data.totalBrutto.toLocaleString('de-AT', {minimumFractionDigits: 2})}
                                    </td>
                                    <td className="p-4 flex justify-end gap-2">
                                        <Link
                                            to={`/invoices/honorarnoten/print/${selectedYear}/${selectedMonth + 1}/${data.musiker.id}`}
                                            target="_blank"
                                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm"
                                        >
                                            <Printer className="w-4 h-4" />
                                            Drucken
                                        </Link>
                                        <button
                                            onClick={() => handleDownloadPdf(data.musiker)}
                                            disabled={isDownloading === data.musiker.id}
                                            className="inline-flex items-center justify-center min-w-[90px] gap-2 px-3 py-1.5 bg-gray-800 text-white text-sm font-bold rounded-lg hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isDownloading === data.musiker.id ? (
                                                <div className="w-4 h-4 rounded-full border-t-2 border-r-2 border-white animate-spin"></div>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                    PDF
                                                </>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                        {aggregatedData.length > 0 && (
                            <tr className="bg-gray-50/80 border-t border-gray-200">
                                <td colSpan={4} className="p-4 text-right font-bold text-gray-600">Gesamtsumme Brutto (Monat)</td>
                                <td className="p-4 text-right font-black text-brand-primary text-lg">
                                    € {totalSummeBrutto.toLocaleString('de-AT', {minimumFractionDigits: 2})}
                                </td>
                                <td></td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
}
