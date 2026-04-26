import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Booking, TicketCategory } from '../types/schema';
import { Search, ExternalLink, Trash2 } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { ConfirmDeleteModal } from '../components/common/ConfirmDeleteModal';
import { getBookingDisplayData } from '../utils/bookingMapper';
import { listenTicketCategories } from '../services/firebase/pricingService';

// Verhindert Zeitzonen-Verschiebungen und zeigt Buchungszeiten 1:1 an
const formatRawDate = (dateVal: any) => {
  if (!dateVal) return '-';
  
  if (dateVal.toDate) {
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    };
    return dateVal.toDate().toLocaleString('de-AT', options);
  }
  
  if (typeof dateVal === 'string') {
    // Regex für YYYY-MM-DD HH:mm:ss
    const match = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (match) {
      return `${match[3]}.${match[2]}.${match[1]}, ${match[4]}:${match[5]}`;
    }
    return dateVal;
  }
  
  return '-';
};

export function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { isAdmin } = useAdmin();
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!bookingToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, `apps/${APP_ID}/bookings`, bookingToDelete.id));
      setBookingToDelete(null);
    } catch(err) {
      console.error("Delete Error", err);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    // 1. Listen for categories for mapping
    const unsubCats = listenTicketCategories((data) => {
      setCategories(data);
    });

    // 2. Listen for bookings
    const q = query(collection(db, `apps/${APP_ID}/bookings`));
    const unsubBookings = onSnapshot(q, (snap) => {
      const b: Booking[] = [];
      snap.forEach(doc => b.push({ id: doc.id, ...doc.data() } as Booking));
      b.sort((x, y) => {
        const timeX = (x.createdAt as any)?.toMillis ? (x.createdAt as any).toMillis() : new Date(x.createdAt as any).getTime();
        const timeY = (y.createdAt as any)?.toMillis ? (y.createdAt as any).toMillis() : new Date(y.createdAt as any).getTime();
        return timeY - timeX;
      });
      setBookings(b);
    });

    return () => {
      unsubCats();
      unsubBookings();
    };
  }, []);

  const filteredBookings = bookings.filter(b => {
    const display = getBookingDisplayData(b);
    const matchSearch = display.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        display.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        b.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus = filterStatus === 'all' || 
                        (filterStatus === 'paid' && (display.status.includes('paid') || display.status === 'confirmed')) ||
                        (filterStatus === 'cancelled' && display.status === 'cancelled');
                        
    return matchSearch && matchStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-black text-slate-900">Alle Buchungen</h1>
      </div>

      <div className="glass-card flex flex-col md:flex-row gap-4 p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Name, Buchungs-ID oder E-Mail..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-red/20 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex gap-3">
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)} 
            className="px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold uppercase tracking-wider text-slate-500 focus:ring-2 focus:ring-brand-red/20 outline-none"
          >
            <option value="all">ALLE STATUS</option>
            <option value="paid">BEZAHLT</option>
            <option value="cancelled">STORNIERT</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                <th className="px-6 py-5">Kunde & Kontakt</th>
                <th className="px-6 py-5">Event Details</th>
                <th className="px-6 py-5">Kategorie</th>
                <th className="px-6 py-5">Buchung #</th>
                <th className="px-6 py-5 text-center">Tickets</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5 text-right">Betrag</th>
                <th className="px-6 py-5 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
               {filteredBookings.length === 0 ? (
                 <tr><td colSpan={8} className="p-16 text-center text-slate-400 font-medium italic">Keine Buchungen vorhanden.</td></tr>
               ) : filteredBookings.map(b => {
                 const display = getBookingDisplayData(b);
                 
                 // Resolve Category Name with robust fallback logic
                 const matchedByRegiondoId = categories.find(c => 
                    (c.regiondoOptionId && (c.regiondoOptionId === display.optionId || c.regiondoOptionId === display.variationId)) ||
                    c.id === display.optionId ||
                    c.id === display.variationId
                 );
                 
                 const matchedByName = categories.find(c => c.name === display.categoryPayloadName);
                 
                 const categoryName = matchedByRegiondoId?.name || 
                                    matchedByName?.name || 
                                    display.categoryPayloadName || 
                                    display.variationId || 
                                    display.optionId ||
                                    '-';

                 return (
                  <tr key={b.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-900">{display.customerName}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{display.customerEmail}</div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-semibold text-slate-800">{display.eventTitle}</div>
                      <div className="text-[11px] text-slate-500 mt-1 font-bold">
                        {display.eventDateTime ? formatRawDate(display.eventDateTime) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase">
                       {categoryName}
                    </td>
                    <td className="px-6 py-5 text-xs font-mono">
                      <div className="text-slate-900 font-bold">{display.bookingNumber}</div>
                      <div className="text-[9px] text-slate-300 mt-0.5 truncate max-w-[100px]">{b.id}</div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-black">
                        {b.seatIds?.length || b.groupPersons || (b.lastPayload as any)?.qty || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`status-badge ${
                        display.status.includes('paid') || display.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        display.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-100' :
                        'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {display.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-slate-900">
                      € {display.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-5 text-center flex items-center justify-end gap-2">
                       {b.receiptUrl && (
                          <a href={b.receiptUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-300 hover:text-blue-500 transition-colors" title="Beleg öffnen">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {isAdmin && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setBookingToDelete(b); }}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                            title="Buchung löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                    </td>
                  </tr>
                 );
               })}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmDeleteModal
        isOpen={!!bookingToDelete}
        onClose={() => setBookingToDelete(null)}
        onConfirm={handleDelete}
        title="Buchung endgültig löschen"
        message={`Möchten Sie diese Buchung (${bookingToDelete?.id}) wirklich unwiderruflich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        isLoading={isDeleting}
      />
    </div>
  );
}
