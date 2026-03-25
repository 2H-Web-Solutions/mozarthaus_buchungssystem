import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { BookingCard } from './BookingCard';
import { PaymentModal } from './PaymentModal';
import { subscribeToBookings, updateBookingStatus } from '../../services/bookingManagementService';
import { Booking } from '../../types/schema';
import { LayoutDashboard, Loader2, Search, Calendar, Users } from 'lucide-react';

export function BookingKanban() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [paymentModalData, setPaymentModalData] = useState<{ isOpen: boolean; bookingId: string } | null>(null);

  useEffect(() => {
    const unsub = subscribeToBookings((data) => {
      setBookings(data);
      setIsInitializing(false);
    });
    return () => unsub();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterPartnerId, setFilterPartnerId] = useState('all');
  const [partners, setPartners] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const snapshot = await getDocs(collection(db, `apps/${APP_ID}/partners`));
        const partnerData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.data().companyName || 'Unbekannt'
        }));
        setPartners(partnerData);
      } catch (error) {
        console.error('Fehler beim Laden der Partner:', error);
      }
    };
    fetchPartners();
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchSearch = b.customerData?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.customerData?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.id.includes(searchTerm);
      
      const matchDate = filterDate ? b.eventId.includes(filterDate.replace(/-/g, '')) : true;
      const matchPartner = filterPartnerId === 'all' 
        ? true 
        : filterPartnerId === 'direct' 
          ? (!b.partnerId || b.isB2B === false)
          : b.partnerId === filterPartnerId;
      
      return matchSearch && matchDate && matchPartner;
    });
  }, [bookings, searchTerm, filterDate, filterPartnerId]);

  // Filter columns based on realtime DB snapshot
  const cols = {
    pending: filteredBookings.filter(b => b.status === 'pending' || b.status === 'confirmed'), // Treating legacy 'confirmed' as pending
    paid: filteredBookings.filter(b => b.status === 'paid'),
    cancelled: filteredBookings.filter(b => b.status === 'cancelled')
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const newStatus = destination.droppableId as 'pending' | 'paid' | 'cancelled';
    
    // Prevent un-cancelling
    const draggedBooking = bookings.find(b => b.id === draggableId);
    if (draggedBooking?.status === 'cancelled') {
      alert('Stornierte Buchungen können nicht reaktiviert werden, da die Sitzplätze bereits permanent auf dem Saalplan freigegeben wurden.');
      return;
    }

    if (newStatus === 'cancelled') {
      const confirmCancel = window.confirm(
        `Achtung: Möchten Sie die Buchung von ${draggedBooking?.customerData.name || 'Unbekannt'} wirklich stornieren?\n\nDadurch werden alle verknüpften Sitzplätze sofort wieder für den Verkauf freigegeben. Dieser Vorgang kann nicht rückgängig gemacht werden.`
      );
      if (!confirmCancel) return; // Abbruch durch den User
    }

    if (newStatus === 'paid') {
      // Step 1: Open verification modal before committing transition
      setPaymentModalData({ isOpen: true, bookingId: draggableId });
    } else {
      // Direct state mutation
      try {
        await updateBookingStatus(draggableId, newStatus);
      } catch (err) {
        console.error(err);
        alert("Statusänderung fehlgeschlagen. Überprüfen Sie Ihre Rechte.");
      }
    }
  };

  const handlePaymentConfirm = async (method: 'bar' | 'karte' | 'voucher' | 'rechnung') => {
    if (!paymentModalData) return;
    try {
      await updateBookingStatus(paymentModalData.bookingId, 'paid', method);
      setPaymentModalData(null);
    } catch (err) {
      console.error(err);
      alert("Schwerer Fehler bei der Festschreibung der Zahlungsmetadaten.");
    }
  };

  const renderColumn = (id: string, title: string, items: Booking[]) => (
    <div className="flex flex-col flex-1 bg-gray-100 rounded-2xl overflow-hidden shadow-sm border border-gray-200 border-t-0 border-x-0 h-full">
      <div className="p-5 border-b-2 border-brand-sidebar bg-white flex justify-between items-center shadow-sm z-10">
        <h3 className="font-bold text-gray-900 tracking-tight">{title}</h3>
        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">{items.length}</span>
      </div>
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-4 overflow-y-auto space-y-4 transition-colors duration-200 ${snapshot.isDraggingOver ? 'bg-blue-50/50 ring-inset ring-2 ring-blue-500/10' : ''}`}
            style={{ minHeight: '600px' }}
          >
            {items.map((booking, index) => (
              <BookingCard key={booking.id} booking={booking} index={index} partners={partners} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );

  if (isInitializing) {
     return (
       <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
         <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
         <p className="font-medium text-lg text-gray-600">Lade Status Board & Echtzeit-Pipeline...</p>
       </div>
     );
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-primary/10 rounded-xl shadow-inner">
             <LayoutDashboard className="w-7 h-7 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-heading text-brand-primary font-bold leading-tight">Live Status</h1>
            <p className="text-gray-500 text-base font-medium mt-1">Statusüberwachung, Stornierungen & Zahlungsverwaltung</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-center animate-in slide-in-from-top-4">
        
        {/* Suche */}
        <div className="relative flex-1 min-w-[200px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Suchen (Name, E-Mail, ID)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#c02a2a] focus:border-transparent text-sm"
          />
        </div>

        {/* Datum */}
        <div className="relative min-w-[150px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Calendar className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#c02a2a] focus:border-transparent text-sm"
          />
        </div>

        {/* Partner */}
        <div className="relative min-w-[200px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Users className="h-4 w-4 text-gray-400" />
          </div>
          <select
            value={filterPartnerId}
            onChange={(e) => setFilterPartnerId(e.target.value)}
            className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#c02a2a] focus:border-transparent text-sm appearance-none bg-white"
          >
            <option value="all">Alle Buchungen</option>
            <option value="direct">Nur Direktbuchungen</option>
            <optgroup label="Partner (B2B)">
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Reset Button */}
        {(searchTerm || filterDate || filterPartnerId !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterDate('');
              setFilterPartnerId('all');
            }}
            className="text-sm text-gray-500 hover:text-[#c02a2a] underline px-2 transition-colors"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-210px)] overflow-hidden pb-4">
          {renderColumn('pending', 'Neu / Ausstehend', cols.pending)}
          {renderColumn('paid', 'Bezahlt / Bestätigt', cols.paid)}
          {renderColumn('cancelled', 'Storniert', cols.cancelled)}
        </div>
      </DragDropContext>

      <PaymentModal 
        isOpen={paymentModalData?.isOpen || false} 
        bookingId={paymentModalData?.bookingId || ''}
        onClose={() => setPaymentModalData(null)}
        onConfirm={handlePaymentConfirm}
      />
    </div>
  );
}
