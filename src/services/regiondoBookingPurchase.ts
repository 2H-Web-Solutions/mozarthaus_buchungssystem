import { getCheckoutTotals, purchase } from './regiondoCheckoutService';
import { 
  splitNameForRegiondo, 
  toRegiondoDateTime, 
  parseGrandTotalFromTotalsResponse, 
  parseCurrencyFromTotalsResponse 
} from '../lib/regiondoUtils';
import { RegiondoCartItem, RegiondoPurchaseInput } from '../types/regiondoCheckout';

export async function purchaseWithRegiondo(params: {
  productId: string;
  dateYmd: string;
  time: string;
  categories: { name: string, quantity: number, regiondoOptionId?: string }[];
  customerData: { name: string, email: string, phone: string };
}) {
  const { productId, dateYmd, time, categories, customerData } = params;
  
  // 1. Prepare items
  const dateTime = toRegiondoDateTime(dateYmd, time);
  const items: RegiondoCartItem[] = [];

  for (const cat of categories) {
    if (cat.quantity <= 0) continue;
    if (!cat.regiondoOptionId) {
      throw new Error(`Regiondo: Kategorie "${cat.name}" hat keine Regiondo Option ID.`);
    }

    items.push({
      product_id: Number(productId),
      option_id: cat.regiondoOptionId as any,
      date_time: dateTime,
      qty: cat.quantity
    });
  }

  if (items.length === 0) {
    throw new Error('Keine Tickets für Regiondo ausgewählt.');
  }

  // 2. Validate with Totals
  const totalsResponse = await getCheckoutTotals({ items });
  const grandTotal = parseGrandTotalFromTotalsResponse(totalsResponse);
  const currency = parseCurrencyFromTotalsResponse(totalsResponse);

  // 3. Execute Purchase
  const { firstname, lastname } = splitNameForRegiondo(customerData.name);
  
  const purchaseInput: RegiondoPurchaseInput = {
    items,
    contact_data: {
      firstname,
      lastname,
      email: customerData.email,
      telephone: customerData.phone
    }
  };

  const response = await purchase(purchaseInput, {
    store_locale: 'de-AT',
    sync_tickets_processing: false,
    send_confirmation_email: true,
    currency
  });

  return {
    ...response,
    grandTotal,
    currency
  };
}
