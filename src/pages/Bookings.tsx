import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Booking } from '../types/schema';
import { cancelBooking } from '../services/bookingService';
import { Search, Filter } from 'lucide-react';

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
      b.sort((x, y) => {
        const timeX = (x.createdAt as any)?.toMillis ? (x.createdAt as any).toMillis() : new Date(x.createdAt as any).getTime();
        const timeY = (y.createdAt as any)?.toMillis ? (y.createdAt as any).toMillis() : new Date(y.createdAt as any).getTime();
        return timeY - timeX;
      });
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
    const customerName = b.customerData?.name || '';
    const bookingId = b.id || '';
    const matchSearch = customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        bookingId.toLowerCase().includes(searchTerm.toLowerCase());
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
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 text-xs font-bold text-gray-700 uppercase tracking-wider">
              <th className="p-3 border-r border-gray-200">ID</th>
              <th className="p-3 border-r border-gray-200">Erstellt am</th>
              <th className="p-3 border-r border-gray-200">Event / Datum</th>
              <th className="p-3 border-r border-gray-200">Name</th>
              <th className="p-3 border-r border-gray-200">E-Mail</th>
              <th className="p-3 border-r border-gray-200">Tickets</th>
              <th className="p-3 border-r border-gray-200">Betrag</th>
              <th className="p-3 border-r border-gray-200">Quelle</th>
              <th className="p-3 border-r border-gray-200">Status</th>
              <th className="p-3">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
             {filteredBookings.length === 0 ? (
               <tr><td colSpan={10} className="p-8 text-center text-gray-500">Keine Buchungen gefunden.</td></tr>
             ) : filteredBookings.map(b => (
               <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                 <td className="p-3 border-r border-gray-200 font-mono text-xs text-gray-600 max-w-[120px] truncate" title={b.id}>
                   {b.id?.replace('booking_regiondo_', '') || b.id}
                 </td>
                 <td className="p-3 border-r border-gray-200 whitespace-nowrap text-gray-700">
                   {(b.createdAt as any)?.toDate 
                     ? (b.createdAt as any).toDate().toLocaleString('de-AT') 
                     : new Date(b.createdAt as any).toLocaleString('de-AT')}
                 </td>
                 <td className="p-3 border-r border-gray-200">
                   <div className="font-medium text-brand-primary">{b.eventId}</div>
                   {b.dateTime && <div className="text-xs text-gray-500">{b.dateTime}</div>}
                 </td>
                 <td className="p-3 border-r border-gray-200 font-medium text-gray-900">
                   {b.customerData?.name || '-'}
                 </td>
                 <td className="p-3 border-r border-gray-200 text-gray-600">
                   {b.customerData?.email || '-'}
                 </td>
                 <td className="p-3 border-r border-gray-200 whitespace-nowrap">
                   {b.bookingType === 'gruppe' || b.groupPersons ? (
                     <span className="font-medium">{b.groupPersons} Personen</span>
                   ) : b.seatIds && b.seatIds.length > 0 ? (
                     <span className="font-medium">{b.seatIds.length} Plätze</span>
                   ) : b.tickets && b.tickets.length > 0 ? (
                     <span className="font-medium">{b.tickets.reduce((sum: number, t: any) => sum + (t.quantity || 1), 0)} Tickets</span>
                   ) : (
                     <span className="text-gray-400">0</span>
                   )}
                 </td>
                 <td className="p-3 border-r border-gray-200 font-bold whitespace-nowrap">
                   € {calculateTotal(b).toFixed(2)}
                 </td>
                 <td className="p-3 border-r border-gray-200">
                   <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                     {b.source || 'MANUELL'}
                   </span>
                 </td>
                 <td className="p-3 border-r border-gray-200">
                   <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${b.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' : b.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                     {b.status || 'UNKNOWN'}
                   </span>
                 </td>
                 <td className="p-3 text-right">
                   {b.status === 'confirmed' && (
                     <button 
                       onClick={() => handleCancel(b.id)}
                       disabled={isCancelling === b.id}
                       className="text-red-600 hover:text-red-800 text-xs font-bold disabled:opacity-50"
                     >
                       {isCancelling === b.id ? '...' : 'Stornieren'}
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
