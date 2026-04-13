/**
 * Regiondo Utilities for Purchase Flow
 */

/**
 * Splits a full name into firstname and lastname for Regiondo.
 */
export function splitNameForRegiondo(fullName: string): { firstname: string; lastname: string } {
  const t = fullName.trim();
  if (!t) return { firstname: '—', lastname: '—' };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { firstname: parts[0], lastname: '.' };
  return { firstname: parts[0], lastname: parts.slice(1).join(' ') };
}

/**
 * Formats a date string and time string into Regiondo expected format: Y-m-d H:i:s
 */
export function toRegiondoDateTime(dateYmd: string, time: string): string {
  // Ensure dateYmd is YYYY-MM-DD
  const t = (time || '00:00').trim();
  const [hh, mm] = t.split(':');
  const h = (hh || '00').padStart(2, '0');
  const m = (mm || '00').padStart(2, '0');
  return `${dateYmd} ${h}:${m}:00`;
}

/**
 * Extracts grand total from totals response.
 */
export function parseGrandTotalFromTotalsResponse(data: any): number | undefined {
  if (!data) return undefined;
  const inner = data.data || data;
  const gt = inner.totals?.grand_total ?? inner.grand_total;
  
  if (typeof gt === 'number') return gt;
  if (typeof gt === 'string') {
    const n = parseFloat(gt.replace(',', '.'));
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

/**
 * Extracts currency from totals response.
 */
export function parseCurrencyFromTotalsResponse(data: any): string | undefined {
  if (!data) return undefined;
  const inner = data.data || data;
  return inner.totals?.currency ?? inner.currency;
}

/**
 * Extracts required fields from totals response.
 */
export function parseRequiredFields(data: any) {
  if (!data) return { contact: [], buyer: [] };
  const inner = data.data || data;
  return {
    contact: Array.isArray(inner.contact_data_required) ? inner.contact_data_required : [],
    buyer: Array.isArray(inner.buyer_data_required) ? inner.buyer_data_required : []
  };
}
