import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Booking } from '../types/schema';
import { cancelBooking } from '../services/bookingService';
import { Search, Filter, Ban } from 'lucide-react';

export function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isCancelling, setIsCancelling] = useState<string | null>(null);

  useEffect(() => {
    // For MVP sorting in JS. In prod, create composite index and use orderBy('createdAt', 'desc')
    const q = query(collection(db, `apps/${APP_ID}/bookings`));
    const unsubscribe = onSnapshot(q, (snap) => {
      const b: Booking[] = [];
      snap.forEach(doc => b.push({ id: doc.id, ...doc.data() } as Booking));
      b.sort((x, y) => y.createdAt.toMillis() - x.createdAt.toMillis());
      setBookings(b);
    });
    return () => unsubscribe();
  }, []);

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm('Buchung wirklich stornieren? Plätze werden wieder freigegeben!')) return;
    setIsCancelling(bookingId);
    try {
      await cancelBooking(bookingId);
    } catch (err: any) {
      alert('Fehler beim Stornieren: ' + err.message);
    } finally {
      setIsCancelling(null);
    }
  };

  const calculateTotal = (booking: Booking) => {
    return booking.totalAmount || 0;
  };

  const filteredBookings = bookings.filter(b => {
    const matchSearch = b.customerData.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        b.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSource = filterSource === 'all' || b.source === filterSource;
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchSearch && matchSource && matchStatus;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-heading text-brand-primary">Buchungen</h1>
      </div>

      <div className="bg-white p-4 rounded-t-lg shadow-sm border border-gray-200 border-b-0 flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Suchen nach Name oder ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div className="flex gap-2 items-center">
          <Filter className="w-4 h-4 text-gray-500" />
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm bg-gray-50">
            <option value="all">Alle Quellen</option>
            <option value="manual">Manuell</option>
            <option value="b2b">B2B Partner</option>
            <option value="regiondo">Regiondo</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm bg-gray-50">
            <option value="all">Alle Status</option>
            <option value="confirmed">Bestätigt</option>
            <option value="cancelled">Storniert</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-b-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-500 uppercase tracking-wider">
              <th className="p-4">ID & Datum</th>
              <th className="p-4">Kunde</th>
              <th className="p-4">Plätze</th>
              <th className="p-4">Betrag</th>
              <th className="p-4">Quelle / Status</th>
              <th className="p-4 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
             {filteredBookings.length === 0 ? (
               <tr><td colSpan={6} className="p-8 text-center text-gray-500">Keine Buchungen gefunden.</td></tr>
             ) : filteredBookings.map(b => (
               <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                 <td className="p-4">
                   <div className="font-medium text-gray-900">{b.id.split('-').pop()}</div>
                   <div className="text-xs text-gray-500">{b.createdAt.toDate().toLocaleString('de-AT')}</div>
                   <div className="text-xs text-brand-primary mt-1">{b.eventId}</div>
                 </td>
                 <td className="p-4">
                   <div className="font-medium">{b.customerData.name}</div>
                   <div className="text-gray-500">{b.customerData.email}</div>
                 </td>
                 <td className="p-4 max-w-xs">
                   <div className="flex flex-wrap gap-1">
                     {b.seatIds.map(sid => (
                       <span key={sid} className="bg-gray-100 border border-gray-200 text-gray-700 text-[10px] px-1.5 py-0.5 rounded uppercase">
                         {sid.replace(/row_|_seat_/g, ' ')}
                       </span>
                     ))}
                   </div>
                   <div className="text-xs text-gray-500 mt-1">{b.seatIds.length} Platz/Plätze</div>
                 </td>
                 <td className="p-4 font-bold">
                   € {calculateTotal(b).toFixed(2)}
                 </td>
                 <td className="p-4">
                   <div className="mb-1">
                     <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">
                       {b.source.toUpperCase()}
                     </span>
                   </div>
                   <div>
                     <span className={`px-2 py-0.5 rounded text-xs font-medium border ${b.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                       {b.status.toUpperCase()}
                     </span>
                   </div>
                 </td>
                 <td className="p-4 text-right">
                   {b.status === 'confirmed' && (
                     <button 
                       onClick={() => handleCancel(b.id)}
                       disabled={isCancelling === b.id}
                       className="inline-flex items-center gap-1 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
                     >
                       <Ban className="w-4 h-4" /> {isCancelling === b.id ? 'Lädt...' : 'Stornieren'}
                     </button>
                   )}
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
