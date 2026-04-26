import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { APP_ID } from '../../../lib/constants';
import { Event } from '../../../types/schema';
import { Musiker } from '../../../services/firebase/musikerService';

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

export function HonorarnotePrintTemplate() {
  const { year, month, musikerId } = useParams<{ year: string; month: string; musikerId: string }>();
  const [events, setEvents] = useState<Event[]>([]);
  const [musiker, setMusiker] = useState<Musiker | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!year || !month || !musikerId) return;
      try {
        const musikerSnap = await getDoc(doc(db, `apps/${APP_ID}/musiker`, musikerId));
        if (musikerSnap.exists()) {
          setMusiker(musikerSnap.data() as Musiker);
        }

        const eventSnap = await getDocs(collection(db, `apps/${APP_ID}/events`));
        const loadedEvents = eventSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Event);
        setEvents(loadedEvents);
      } catch (err) {
        console.error('Error loading honorarnote print data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [year, month, musikerId]);

  const targetEvents = useMemo(() => {
    if (!events.length || !year || !month || !musikerId) return [];
    
    const y = parseInt(year);
    const m = parseInt(month) - 1; // URLs are 1-12
    const startOfMonth = new Date(y, m, 1);
    const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);
    
    const validEvents = events.filter(e => {
        if (e.status === 'cancelled') return false; 
        const d = parseEventDate(e.date);
        return d >= startOfMonth && d <= endOfMonth;
    });

    const gigs: Array<{ dateStr: string, gage: number }> = [];
    
    validEvents.forEach(e => {
        if (!e.ensemble) return;
        const member = e.ensemble.find(mem => mem.musikerId === musikerId && mem.status !== 'abgesagt');
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
    
    // Sort gigs by date purely via their string (cheap sort since format matches chronologically usually, but DD.MM.YYYY needs parse)
    gigs.sort((a,b) => {
        const partsA = a.dateStr.split(' ')[0].split('.');
        const partsB = b.dateStr.split(' ')[0].split('.');
        const codeA = `${partsA[2]}${partsA[1]}${partsA[0]}`;
        const codeB = `${partsB[2]}${partsB[1]}${partsB[0]}`;
        return codeA.localeCompare(codeB);
    });

    return gigs;
  }, [events, year, month, musikerId]);

  useEffect(() => {
    if (!loading && musiker) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, musiker]);

  if (loading) return <div className="p-8">Lade Daten für Honorarnote...</div>;
  if (!musiker) return <div className="p-8 text-red-600">Fehler: Musiker-Daten nicht gefunden.</div>;

  const formatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const mwstRate = musiker.steuersatz !== undefined ? musiker.steuersatz : 13;
  
  let sumNetto = 0;
  let sumBrutto = 0;

  const rows = targetEvents.map((gig, idx) => {
    const mwstAmount = gig.gage * (mwstRate / 100);
    const brutto = gig.gage + mwstAmount;
    
    sumNetto += gig.gage;
    sumBrutto += brutto;

    return (
      <tr key={idx}>
        <td className="p-1 border border-gray-300 text-sm whitespace-nowrap">{gig.dateStr}</td>
        <td className="p-1 text-right border border-gray-300 text-sm whitespace-nowrap">{formatter.format(gig.gage)}</td>
        <td className="p-1 text-right border border-gray-300 text-sm whitespace-nowrap">{mwstRate.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
        <td className="p-1 text-right border border-gray-300 text-sm whitespace-nowrap">{formatter.format(brutto)}</td>
        <td className="p-1 text-right border border-gray-300 text-sm whitespace-nowrap">&euro;</td>
      </tr>
    );
  });

  const today = new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const periodStr = `${String(month).padStart(2, '0')}/${year}`;

  return (
    <div 
      className="bg-white text-black min-h-screen p-8 max-w-4xl mx-auto font-sans print:p-0 print:m-0"
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      {/* Kopfzeile (Sender) */}
      <div className="mb-16 text-[14px]">
        <p className="font-medium">{musiker.vorname} {musiker.nachname}</p>
        <p>{musiker.strasse}</p>
        <p>{musiker.plz} {musiker.ort}</p>
        {(musiker as any).steuernummer && <p className="mt-1">Steuernummer: {(musiker as any).steuernummer}</p>}
      </div>

      {/* Empfänger und Datum */}
      <div className="flex justify-between items-start mb-16 text-[14px]">
        <div>
          <p className="font-bold">An</p>
          <p className="font-bold">Konzerte im Mozarthaus</p>
          <p className="font-bold">Claudio Cunha Bentes</p>
          <p className="font-bold">Konzertveranstalter</p>
          <p className="font-bold">Singerstrasse 7</p>
          <p className="font-bold">A - 1010 Wien</p>
        </div>
        <div className="text-right text-[14px]">
          <p>Wien am, {today}</p>
        </div>
      </div>

      {/* Titel */}
      <h1 className="text-[22px] font-bold text-center mb-8 tracking-wide">HONORARNOTE für {periodStr}</h1>

      {/* Einleitungstext */}
      <p className="mb-8 leading-relaxed text-[14px]">
        Für meine Auftritte in der Sala Terrena im Deutsch Ordenshaus, Singerstraße 7, 1010 Wien, erlaube ich mir folgenden Betrag in Rechnung zu stellen:
      </p>

      {/* Tabelle */}
      <table className="w-full border-collapse mb-10 mx-auto max-w-3xl">
        <thead>
          <tr className="bg-[#8b0000] text-white">
            <th className="p-1.5 text-left border border-[#8b0000] text-sm font-bold">Konzert am</th>
            <th className="p-1.5 text-right border border-[#8b0000] text-sm font-bold">Nettobetrag</th>
            <th className="p-1.5 text-right border border-[#8b0000] text-sm font-bold">MwSt</th>
            <th className="p-1.5 text-right border border-[#8b0000] text-sm font-bold">Bruttobetrag</th>
            <th className="p-1.5 text-right border border-[#8b0000] text-sm font-bold">Spesen</th>
          </tr>
        </thead>
        <tbody>
          {rows}
          <tr className="bg-[#8b0000] text-white font-bold">
            <td className="p-1.5 text-left border border-[#8b0000] text-sm">Summe:</td>
            <td className="p-1.5 text-right border border-[#8b0000] text-sm">{formatter.format(sumNetto)}</td>
            <td className="p-1.5 text-right border border-[#8b0000] text-sm">{mwstRate.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
            <td className="p-1.5 text-right border border-[#8b0000] text-sm">{formatter.format(sumBrutto)}</td>
            <td className="p-1.5 text-right border border-[#8b0000] text-sm">&euro;</td>
          </tr>
        </tbody>
      </table>

      {/* Fußtexte */}
      <div className="space-y-6 text-[14px]">
        <p>Der Betrag von <span className="font-bold">{formatter.format(sumBrutto)}</span> + ________ &euro; Spesenersatz wird auf Ihr Konto überwiesen.</p>
        
        <p>Ich nehme zur Kenntnis, daß ich für die Versteuerung der Honorare selbst sorgen muß, da kein Dienstverhältnis vorliegt.</p>
        
        <div className="mt-24 pt-8 text-center flex justify-center">
            <div className="w-96 text-left">
                <p>Unterschrift: ___________________________________</p>
            </div>
        </div>
      </div>
    </div>
  );
}
