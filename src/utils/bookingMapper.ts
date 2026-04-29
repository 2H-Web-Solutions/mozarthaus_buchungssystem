import { Booking } from '../types/schema';

export interface BookingDisplayData {
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  status: string;
  eventTitle: string;
  eventDateTime: string;
  bookingNumber: string;
  sourceLabel: string;
  variationId: string;
  optionId: string;
  categoryPayloadName: string;
  paymentMethod: string;
  quantity: number;
}

export function getBookingDisplayData(booking: Booking): BookingDisplayData {
  const lp = booking.lastPayload || {};
  
  // 1. Resolve Customer Name
  let customerName = booking.customerData?.name || '';
  
  if (!customerName) {
    // Try Regiondo specifics
    const contact = lp.contact_data || {};
    const first = contact.firstname || lp.first_name || '';
    const last = contact.lastname || lp.last_name || '';
    
    if (first || last) {
      customerName = `${first} ${last}`.trim();
    } else if (lp.buyer_data && Array.isArray(lp.buyer_data)) {
      // Fallback to buyer_data array
      const fName = lp.buyer_data.find((f: any) => f.title === 'First name')?.value || '';
      const lName = lp.buyer_data.find((f: any) => f.title === 'Last name')?.value || '';
      if (fName || lName) customerName = `${fName} ${lName}`.trim();
    }
  }
  
  if (!customerName) customerName = 'Unbekannt';

  // 2. Resolve Customer Email
  let customerEmail = booking.customerData?.email || lp.contact_data?.email || lp.email || '-';

  // 3. Resolve Total Amount with better fallbacks
  let totalAmount = booking.totalAmount ?? 0;
  
  // Check payload for variations of total price
  if (lp && Object.keys(lp).length > 0) {
    const rawAmount = lp.total_amount ?? lp.total_price ?? lp.amount ?? lp.payment_amount;
    if (rawAmount !== undefined && rawAmount !== null) {
      if (typeof rawAmount === 'string') {
        // Handle both comma and dot as decimal separators
        const cleanedAmount = rawAmount.replace(',', '.');
        const parsed = parseFloat(cleanedAmount);
        if (!isNaN(parsed)) totalAmount = parsed;
      } else if (typeof rawAmount === 'number') {
        totalAmount = rawAmount;
      }
    }
  }

  // Ensure totalAmount is a valid number
  if (isNaN(totalAmount)) totalAmount = 0;

  // 4. Payment Method
  let paymentMethod = booking.paymentMethod || lp.payment_method?.label || lp.payment_method || (lp.pos_id ? 'POS / Vor Ort' : '-');

  // 5. Resolve Status
  let status = booking.status || 'unknown';
  if (lp.booking_status?.label) {
    status = lp.booking_status.label.toLowerCase();
  } else if (lp.payment_status?.label) {
    status = lp.payment_status.label.toLowerCase();
  } else if (lp.status) {
    status = lp.status.toLowerCase();
  }

  // 6. Resolve Event Details
  const eventTitle = booking.eventTitle || lp.product_name || lp.variation_name || booking.eventId || 'Unbekanntes Event';
  const eventDateTime = lp.event_date_time || booking.eventDate || booking.dateTime || (booking as any).date || '';

  // 7. Resolve Booking Number
  const bookingNumber = booking.bookingNumber || lp.order_number || lp.order_id || lp.booking_key || booking.id.split('_').pop() || '-';

  // 8. Resolve Source
  const sourceLabel = booking.source || (booking.lastPayload ? 'Regiondo' : 'Manuell');

  // 9. Resolve Category IDs for mapping
  const variationId = String(lp.variation_id || booking.variantId || '');
  const optionId = String(lp.option_id || '');
  const categoryPayloadName = lp.variation_name || lp.option_name || '';

  // 10. Quantity
  const quantity = booking.groupPersons || Number(lp.qty || 0) || (booking.tickets?.reduce((acc: number, t: any) => acc + (t.quantity || 1), 0)) || (booking.seatIds?.length) || 1;

  return {
    customerName,
    customerEmail,
    totalAmount,
    status,
    eventTitle,
    eventDateTime,
    bookingNumber,
    sourceLabel,
    variationId,
    optionId,
    categoryPayloadName,
    paymentMethod,
    quantity
  };
}
