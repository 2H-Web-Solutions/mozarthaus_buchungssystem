// src/services/n8nService.ts
import { Booking } from '../types/schema';

/**
 * Alter generischer Outbound-Webhhok (z.B. für Dashboard-Alerts, Statusmeldungen).
 */
export async function notifyN8n(message: string, type: 'info' | 'warning' | 'error' = 'info') {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, type, timestamp: new Date().toISOString() })
    }).catch(e => console.error(e));
  } catch(e) { console.error(e); }
}

/**
 * Spezifischer Outbound-Trigger für die Regiondo-Synchronisation.
 * Nutzt VITE_N8N_2_WEBHOOK_URL und enthält Loop-Protection.
 */
export async function triggerN8nOutboundSync(booking: Booking) {
  const regiondoWebhookUrl = import.meta.env.VITE_N8N_2_WEBHOOK_URL;
  
  if (!regiondoWebhookUrl) {
    console.warn('[n8n Regiondo Sync] VITE_N8N_2_WEBHOOK_URL is missing in .env.');
    return;
  }

  // Loop Protection: Nicht zurück an Regiondo senden, wenn es von dort kam
  if (booking.source === 'regiondo') {
    console.log('[n8n Regiondo Sync] Skipping outbound sync: Booking originated from Regiondo.');
    return;
  }

  try {
    fetch(regiondoWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
    }).catch(err => {
      console.warn('[n8n Regiondo Sync] Failed to dispatch webhook asynchronously:', err);
    });
  } catch (error) {
    console.error('[n8n Regiondo Sync] Webhook execution threw synchronous error:', error);
  }
}
