import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { APP_ID } from '../../../lib/constants';
import { Partner, Booking, TicketCategory } from '../../../types/schema';
import { getBookingDisplayData } from '../../../utils/bookingMapper';
import { Loader2 } from 'lucide-react';

export function PartnerInvoicePrintTemplate() {
  const { year, month, partnerId } = useParams<{ year: string, month: string, partnerId: string }>();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!partnerId || !year || !month) return;
      try {
        const partnerSnap = await getDoc(doc(db, `apps/${APP_ID}/partners`, partnerId));
        if (partnerSnap.exists()) {
          setPartner({ id: partnerSnap.id, ...partnerSnap.data() } as Partner);
        }

        const [bookingSnap, privateSnap, catsSnap, settingsSnap] = await Promise.all([
          getDocs(collection(db, `apps/${APP_ID}/bookings`)),
          getDocs(collection(db, `apps/${APP_ID}/privatebooking`)),
          getDocs(collection(db, `apps/${APP_ID}/ticketCategories`)),
          getDoc(doc(db, `apps/${APP_ID}/settings`, 'general'))
        ]);
        
        const loadedBookings = [
          ...bookingSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Booking),
          ...privateSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Booking)
        ];
        
        setBookings(loadedBookings);
        setCategories(catsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as TicketCategory));
        
        if (settingsSnap.exists() && settingsSnap.data().logoBase64) {
          setLogoBase64(settingsSnap.data().logoBase64);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [partnerId, year, month]);

  const { items, totals } = useMemo(() => {
    if (!bookings.length || !partner || !month || !year) return { items: [], totals: null };

    const selectedYear = Number(year);
    const selectedMonth = Number(month) - 1; // 0-indexed
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);

    function parseEventDate(d: any): Date {
        if (!d) return new Date();
        if (typeof d === 'string') {
          const parts = d.split(' ');
          const dateStr = parts[0];
          if (dateStr.includes('.')) {
            const [day, m, y] = dateStr.split('.');
            return new Date(Number(y), Number(m) - 1, Number(day));
          }
          if (dateStr.includes('-')) {
              const [y, m, day] = dateStr.split('-');
              return new Date(Number(y), Number(m) - 1, Number(day));
          }
          return new Date(d);
        }
        if (typeof d.toDate === 'function') return d.toDate();
        if (d instanceof Date) return d;
        return new Date();
    }

    const partnerBookings = bookings.filter(b => {
        if (b.partnerId !== partner.id) return false;
        const display = getBookingDisplayData(b);
        if (display.status === 'cancelled') return false; 
        
        const d = parseEventDate(display.eventDateTime);
        return d >= startOfMonth && d <= endOfMonth;
    });

    const items = partnerBookings.map(b => {
        const display = getBookingDisplayData(b);
        let katA = 0;
        let katB = 0;
        let katS = 0;

        if (b.tickets && b.tickets.length > 0) {
            b.tickets.forEach(t => {
                const cname = (t.categoryName || '').toLowerCase();
                if (cname.endsWith(' a') || cname === 'a') katA += (t.quantity || 1);
                else if (cname.endsWith(' b') || cname === 'b') katB += (t.quantity || 1);
                else if (cname.includes('student')) katS += (t.quantity || 1);
                else {
                    const cat = categories.find(c => c.id === t.categoryId);
                    if (cat) {
                        const cn = cat.name.toLowerCase();
                        if (cn.endsWith(' a') || cn === 'a') katA += (t.quantity || 1);
                        else if (cn.endsWith(' b') || cn === 'b') katB += (t.quantity || 1);
                        else if (cn.includes('student')) katS += (t.quantity || 1);
                    } else katA += (t.quantity || 1);
                }
            });
        } else if (b.seatIds && b.seatIds.length > 0) {
            katA += b.seatIds.length;
        } else {
            const cname = (display.categoryPayloadName || '').toLowerCase();
            if (cname.endsWith(' a') || cname === 'a') katA += display.quantity;
            else if (cname.endsWith(' b') || cname === 'b') katB += display.quantity;
            else if (cname.includes('student')) katS += display.quantity;
            else katA += display.quantity;
        }

        const summe = display.totalAmount;
        const provRate = partner.commissionRate || 0;
        const provision = summe * (provRate / 100);
        const openAmount = summe - provision;

        const dateParsed = parseEventDate(display.eventDateTime);
        const timeParts = display.eventDateTime.split(' ');
        const time = timeParts.length > 1 ? timeParts[1] : '';
        const formattedDate = `${String(dateParsed.getDate()).padStart(2, '0')}.${String(dateParsed.getMonth() + 1).padStart(2, '0')}.${dateParsed.getFullYear()}`;
        const concertStr = time ? `${formattedDate} ${time}` : formattedDate;

        return {
            id: b.id,
            bookingNumber: display.bookingNumber,
            customerName: display.customerName,
            concertStr,
            katA,
            katB,
            katS,
            summe,
            provision,
            openAmount,
            dateParsed
        };
    }).sort((a,b) => a.dateParsed.getTime() - b.dateParsed.getTime());

    const t = items.reduce((acc, curr) => {
        acc.katA += curr.katA;
        acc.katB += curr.katB;
        acc.katS += curr.katS;
        acc.summe += curr.summe;
        acc.provision += curr.provision;
        acc.openAmount += curr.openAmount;
        return acc;
    }, { katA: 0, katB: 0, katS: 0, summe: 0, provision: 0, openAmount: 0 });

    return { items, totals: t };
  }, [bookings, partner, month, year, categories]);

  useEffect(() => {
    if (!loading && items.length >= 0) {
        // Automatically trigger print dialog once loaded
        setTimeout(() => {
            window.print();
        }, 800);
    }
  }, [loading, items]);

  if (loading) {
      return (
        <div className="flex justify-center p-12 h-screen items-center">
            <Loader2 className="w-10 h-10 animate-spin text-gray-500" />
        </div>
      );
  }

  if (!partner) {
      return <div className="p-8">Partner nicht gefunden.</div>;
  }

  const periodStr = `${String(month).padStart(2, '0')}/${year}`;

  return (
    <div className="bg-white min-h-screen text-black print:p-0">
        <style>
            {`
            @media print {
                @page { margin: 15mm; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .print-hide { display: none !important; }
            }
            `}
        </style>

        <div className="max-w-[900px] mx-auto p-8 relative">
            <div className="flex justify-end mb-12">
                {logoBase64 ? (
                    <img src={logoBase64} alt="Mozarthaus" className="h-16 object-contain" />
                ) : (
                    <div className="h-16 w-64 bg-[#A31621] text-white flex items-center justify-center text-xl font-serif italic">
                        Konzerte im Mozarthaus
                    </div>
                )}
            </div>

            <div className="mb-10 space-y-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-slate-900">Abrechnung {partner.companyName || '-'}</h1>
                    <p className="text-slate-500 font-medium">Provisionen für den gewählten Zeitraum</p>
                </div>
                
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Kunde: {partner.companyName}</h2>
                    <div className="text-sm text-gray-800 leading-relaxed">
                        <div>{partner.companyName}</div>
                        <div>{partner.strasse || 'Keine Straße'}</div>
                        <div>{partner.ort || 'Kein Ort'}</div>
                    </div>
                </div>

                <div className="text-sm font-medium text-gray-700">
                    Provision: {partner.commissionRate || 0}%
                </div>
            </div>

            <table className="w-full text-sm border-collapse mt-8">
                <thead>
                    <tr className="bg-[#A31621] text-white">
                        <th className="p-2 border border-white text-left font-bold w-1/5">Ihre Bestellnr</th>
                        <th className="p-2 border border-white text-left font-bold w-1/4">Kunde Name</th>
                        <th className="p-2 border border-white text-left font-bold w-[15%]">Konzert am</th>
                        <th className="p-2 border border-white text-center font-bold">Kat A</th>
                        <th className="p-2 border border-white text-center font-bold">Kat B</th>
                        <th className="p-2 border border-white text-center font-bold">Kat S</th>
                        <th className="p-2 border border-white text-right font-bold">Summe</th>
                        <th className="p-2 border border-white text-right font-bold">Provision</th>
                        <th className="p-2 border border-white text-right font-bold">Offener Betrag</th>
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan={9} className="p-4 text-center text-gray-500 border border-gray-200">Keine Buchungen vorhanden.</td>
                        </tr>
                    ) : (
                        items.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-300 border-x">
                                <td className="p-2 break-all">{item.bookingNumber !== '-' ? item.bookingNumber : item.id.substring(0, 8)}</td>
                                <td className="p-2">{item.customerName}</td>
                                <td className="p-2 text-xs">{item.concertStr}</td>
                                <td className="p-2 text-center">{item.katA}</td>
                                <td className="p-2 text-center">{item.katB}</td>
                                <td className="p-2 text-center">{item.katS}</td>
                                <td className="p-2 text-right">{item.summe.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</td>
                                <td className="p-2 text-right">{item.provision.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</td>
                                <td className="p-2 text-right">{item.openAmount.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</td>
                            </tr>
                        ))
                    )}
                    {totals && (
                        <tr className="bg-[#A31621] text-white font-bold">
                            <td colSpan={3} className="p-2 border border-white text-right">Gesamt</td>
                            <td className="p-2 border border-white text-center">{totals.katA}</td>
                            <td className="p-2 border border-white text-center">{totals.katB}</td>
                            <td className="p-2 border border-white text-center">{totals.katS}</td>
                            <td className="p-2 border border-white text-right">{totals.summe.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</td>
                            <td className="p-2 border border-white text-right">{totals.provision.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</td>
                            <td className="p-2 border border-white text-right">{totals.openAmount.toLocaleString('de-AT', {minimumFractionDigits: 2})} €</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
}
