import type {
  RegiondoCartItem,
  RegiondoPurchaseInput,
  RegiondoPurchaseResponse,
} from '../types/regiondoCheckout';

/**
 * Builds the URL for the Regiondo proxy.
 * Subpath is appended to /api/regiondo/
 */
function buildRegiondoProxyUrl(subPath: string, searchParams?: URLSearchParams): string {
  const base = '/api/regiondo/';
  const path = subPath.replace(/^\/+/, '');
  const url = new URL(`${base}${path}`, window.location.origin);
  if (searchParams) {
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

/**
 * Checks if the Regiondo API response indicates success.
 * Regiondo sometimes returns 200 OK but with an error message in the body.
 */
function assertRegiondoCheckoutSuccess(data: any) {
  if (!data) throw new Error('Regiondo API: Empty response');
  
  // Handle nested data property if present
  const body = data.data || data;
  
  if (body.error || body.errors) {
    const msg = body.message || (body.errors && JSON.stringify(body.errors)) || 'Unknown Regiondo error';
    throw new Error(`Regiondo API: ${msg}`);
  }
}

async function regiondoApiJson<T>(
  method: string,
  subPath: string,
  options?: { searchParams?: URLSearchParams; body?: unknown; assertCheckoutSuccess?: boolean }
): Promise<T> {
  const url = buildRegiondoProxyUrl(subPath, options?.searchParams);
  const hasBody =
    options?.body !== undefined &&
    method !== 'GET' &&
    method !== 'DELETE';

  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `Regiondo API error (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(typeof data === 'object' && data !== null && 'message' in data
      ? String((data as { message: unknown }).message)
      : text || `HTTP ${res.status}`);
  }

  if (options?.assertCheckoutSuccess) {
    assertRegiondoCheckoutSuccess(data);
  }

  return data as T;
}

/**
 * POST /checkout/purchase — complete booking.
 */
export async function purchase(
  body: RegiondoPurchaseInput,
  opts?: { store_locale?: string; sync_tickets_processing?: boolean; send_confirmation_email?: boolean; currency?: string }
): Promise<RegiondoPurchaseResponse> {
  const sp = new URLSearchParams();
  if (opts?.store_locale) sp.set('store_locale', opts.store_locale);
  if (opts?.sync_tickets_processing != null) {
    sp.set('sync_tickets_processing', String(opts.sync_tickets_processing));
  }
  if (opts?.send_confirmation_email != null) {
    sp.set('send_confirmation_email', String(opts.send_confirmation_email));
  }
  if (opts?.currency) sp.set('currency', opts.currency);

  return regiondoApiJson<RegiondoPurchaseResponse>('POST', 'checkout/purchase', {
    searchParams: sp,
    body,
    assertCheckoutSuccess: true,
  });
}

/** POST /checkout/totals — price / required fields before purchase. */
export async function getCheckoutTotals(
  body: { items: RegiondoCartItem[]; coupon_code?: string; source_type?: number; return_only_totals?: number },
  currency = 'default'
): Promise<unknown> {
  const sp = new URLSearchParams();
  sp.set('currency', currency);
  sp.set('store_locale', 'de-AT');
  return regiondoApiJson('POST', 'checkout/totals', { searchParams: sp, body });
}
