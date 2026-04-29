import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { APP_ID } from '../../../lib/constants';
import { Booking, Partner, TicketCategory } from '../../../types/schema';
import { Printer, CalendarDays, Receipt, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getBookingDisplayData } from '../../../utils/bookingMapper';

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
    if (dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-');
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(d);
  }
  if (typeof d.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  return new Date();
}

export function PartnerInvoicesOverview() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1); 
  const [selectedYear, setSelectedYear] = useState(new Date().getMonth() === 0 ? CURRENT_YEAR - 1 : CURRENT_YEAR);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [bookingSnap, privateSnap, partnerSnap, catsSnap] = await Promise.all([
          getDocs(collection(db, `apps/${APP_ID}/bookings`)),
          getDocs(collection(db, `apps/${APP_ID}/privatebooking`)),
          getDocs(collection(db, `apps/${APP_ID}/partners`)),
          getDocs(collection(db, `apps/${APP_ID}/ticketCategories`))
        ]);
        
        const loadedBookings = [
          ...bookingSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Booking),
          ...privateSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Booking)
        ];
        const loadedPartners = partnerSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Partner);
        const loadedCats = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as TicketCategory);
        
        setBookings(loadedBookings);
        setPartners(loadedPartners);
        setCategories(loadedCats);
      } catch (err) {
        console.error("Error loading partner invoices data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const aggregatedData = useMemo(() => {
    if (!bookings.length || !partners.length) return [];

    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    // Remove the 'now' restriction so we can forecast/bill for the whole month even if we are in the middle of it,
    // or keep it if we only bill past events. Let's allow the whole month.

    const monthBookings = bookings.filter(b => {
        const display = getBookingDisplayData(b);
        // Do not filter out cancelled, we want to show them in the "Storniert" column
        const d = parseEventDate(display.eventDateTime);
        return d >= startOfMonth && d <= endOfMonth;
    });

    const partnerMap: Record<string, {
        bezahlt: number,
        offen: number,
        storniert: number,
        summe: number
    }> = {};

    monthBookings.forEach(b => {
        if (!b.partnerId && !b.isB2B) return;
        
        // Find partner ID. If isB2B but no partnerId, we might not be able to assign it, but let's try.
        let pid = b.partnerId;
        if (!pid) return;

        if (!partnerMap[pid]) {
            partnerMap[pid] = { bezahlt: 0, offen: 0, storniert: 0, summe: 0 };
        }

        const display = getBookingDisplayData(b);
        const s = display.status.toLowerCase();

        let isCancelled = false;
        let isPaid = false;

        if (s.includes('cancel') || s.includes('storno') || s.includes('refund') || s.includes('abgelehnt')) {
            isCancelled = true;
        } else if (s.includes('paid') || s.includes('bezahlt') || s.includes('abgeschlossen') || s.includes('completed')) {
            isPaid = true;
        }

        if (isCancelled) {
            partnerMap[pid].storniert += display.totalAmount;
        } else if (isPaid) {
            partnerMap[pid].bezahlt += display.totalAmount;
            partnerMap[pid].summe += display.totalAmount;
        } else {
            partnerMap[pid].offen += display.totalAmount;
            partnerMap[pid].summe += display.totalAmount;
        }
    });

    return Object.keys(partnerMap).map(pid => {
        const p = partners.find(x => x.id === pid);
        if (!p) return null;
        
        const stats = partnerMap[pid];
        if (stats.summe === 0 && stats.storniert === 0) return null;

        const commissionRate = p.commissionRate || 0;
        const provision = stats.summe * (commissionRate / 100);
        const openAmount = stats.summe - provision;

        return {
            partner: p,
            ...stats,
            provision,
            openAmount
        };
    }).filter(Boolean).sort((a,b) => (a!.partner.companyName || '').localeCompare(b!.partner.companyName || '')) as any[];

  }, [bookings, partners, categories, selectedMonth, selectedYear]);

  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);

  const getStatusInfo = (data: any) => {
      if (data.offen > 0) return { color: 'bg-yellow-100 text-yellow-800', text: 'Offene Zahlung' };
      if (data.offen === 0 && data.bezahlt > 0) return { color: 'bg-green-100 text-green-800', text: 'Erledigt' };
      if (data.offen === 0 && data.bezahlt === 0 && data.storniert > 0) return { color: 'bg-red-100 text-red-800', text: 'Storniert' };
      return { color: 'bg-gray-100 text-gray-800', text: 'Keine Buchungen' };
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-primary/10 rounded-lg">
              <Building2 className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900">Partner-Abrechnungen</h1>
              <p className="text-sm text-gray-500 font-medium">Rechnungsvorschläge für B2B Partner</p>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
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
            <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Rechnungsvorschläge für {String(selectedMonth + 1).padStart(2, '0')}/{selectedYear}</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold whitespace-nowrap">
                            <th className="p-3">Nr.</th>
                            <th className="p-3">Verkäufer</th>
                            <th className="p-3 text-center">Zeitraum</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-right">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {aggregatedData.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500 font-medium">
                                    Keine abrechenbaren Buchungen für {MONTHS[selectedMonth]} {selectedYear} gefunden.
                                </td>
                            </tr>
                        ) : (
                            aggregatedData.map(data => {
                                const status = getStatusInfo(data);
                                return (
                                <tr key={data.partner.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3 font-mono text-gray-500">{data.partner.merchantNr || data.partner.id.substring(0,6)}</td>
                                    <td className="p-3 font-bold text-gray-900">{data.partner.companyName}</td>
                                    <td className="p-3 text-center text-gray-600">{String(selectedMonth + 1).padStart(2, '0')}/{selectedYear}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.color}`}>
                                            {status.text}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => setSelectedDetails(data)}
                                            className="text-brand-primary hover:text-brand-primary/80 font-bold text-sm transition-colors"
                                        >
                                            Rechnung ansehen
                                        </button>
                                    </td>
                                </tr>
                            )})
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-black text-gray-900">{selectedDetails.partner.companyName}</h3>
                        <p className="text-sm text-gray-500">Abrechnungsdetails für {String(selectedMonth + 1).padStart(2, '0')}/{selectedYear}</p>
                    </div>
                    <button 
                        onClick={() => setSelectedDetails(null)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
                
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                            <p className="text-sm text-green-600 font-bold mb-1">Bezahlt</p>
                            <p className="text-2xl font-black text-green-700">{selectedDetails.bezahlt.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</p>
                        </div>
                        <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                            <p className="text-sm text-yellow-600 font-bold mb-1">Offen</p>
                            <p className="text-2xl font-black text-yellow-700">{selectedDetails.offen.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</p>
                        </div>
                        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                            <p className="text-sm text-red-600 font-bold mb-1">Storniert</p>
                            <p className="text-2xl font-black text-red-700">{selectedDetails.storniert.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</p>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                        <div className="flex justify-between items-center text-gray-600">
                            <span className="font-medium">Summe (Aktiv)</span>
                            <span className="font-bold text-gray-900">{selectedDetails.summe.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-600">
                            <span className="font-medium">Provision ({selectedDetails.partner.commissionRate || 0}%)</span>
                            <span className="font-bold text-red-600">- {selectedDetails.provision.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</span>
                        </div>
                        <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-900">Offener Betrag</span>
                            <span className="text-2xl font-black text-brand-primary">{selectedDetails.openAmount.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                    <button 
                        onClick={() => setSelectedDetails(null)}
                        className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Schließen
                    </button>
                    <Link
                        to={`/invoices/partner/print/${selectedYear}/${selectedMonth + 1}/${selectedDetails.partner.id}`}
                        target="_blank"
                        className="px-5 py-2.5 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-primary/90 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        Abrechnungsübersicht drucken
                    </Link>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
