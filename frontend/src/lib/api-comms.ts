import { buildApiUrl, getAuthHeaders } from './api';
import type { Activity } from '@/types/crm';
import type {
  CrmMessage,
  EmailSendPayload,
  MessageChannel,
  PhoneTarget,
  WhatsAppConversation,
  WhatsAppSendPayload,
  WhatsAppStatus,
} from '@/types/comms';

/** Error de la API con el código HTTP, para distinguir "no conectado" (409) de un rechazo. */
export class CommsError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CommsError';
    this.status = status;
  }
}

async function fail(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  const detail = body?.detail;
  let message = fallback;
  if (typeof detail === 'string') message = detail;
  else if (Array.isArray(detail) && detail[0]?.msg) message = String(detail[0].msg).replace(/^Value error, /, '');
  throw new CommsError(message, res.status);
}

async function post<T>(endpoint: string, body: unknown, fallback: string, keepalive = false): Promise<T> {
  const res = await fetch(buildApiUrl(endpoint), { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body), keepalive });
  if (!res.ok) return fail(res, fallback);
  return res.json();
}

// ---------------------------------------------------------------------------
// CORREO
// ---------------------------------------------------------------------------

export function sendEmail(payload: EmailSendPayload): Promise<CrmMessage> {
  return post('/api/email/send', payload, 'No se pudo enviar el correo');
}

export async function fetchMessages(params: { opportunity_id?: string; contact_id?: string; channel?: MessageChannel }): Promise<CrmMessage[]> {
  const res = await fetch(buildApiUrl('/api/messages', params), { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) return fail(res, 'No se pudieron cargar los mensajes');
  return res.json();
}

// ---------------------------------------------------------------------------
// WHATSAPP
// ---------------------------------------------------------------------------

let statusCache: { at: number; value: Promise<WhatsAppStatus> } | null = null;

/** ¿Está conectada la WhatsApp Cloud API? Se recuerda un minuto para no consultar en cada menú. */
export function fetchWhatsAppStatus(): Promise<WhatsAppStatus> {
  if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
  const value = fetch(buildApiUrl('/api/whatsapp/status'), { headers: getAuthHeaders(), cache: 'no-store' })
    .then((res) => (res.ok ? (res.json() as Promise<WhatsAppStatus>) : { configured: false, template_available: false }))
    .catch(() => ({ configured: false, template_available: false }));
  statusCache = { at: Date.now(), value };
  return value;
}

export async function fetchWhatsAppConversation(params: { contact_id?: string; phone?: string; opportunity_id?: string }): Promise<WhatsAppConversation> {
  const res = await fetch(buildApiUrl('/api/whatsapp/conversation', params), { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) return fail(res, 'No se pudo cargar la conversación');
  return res.json();
}

export function sendWhatsApp(payload: WhatsAppSendPayload): Promise<CrmMessage> {
  return post('/api/whatsapp/send', payload, 'No se pudo enviar el WhatsApp');
}

/** Registra en el seguimiento que se abrió WhatsApp (wa.me) con el cliente. */
export function logWhatsAppOpen(payload: PhoneTarget & { text?: string }): Promise<Activity> {
  return post('/api/whatsapp/log', payload, 'No se pudo registrar el contacto', true);
}

// ---------------------------------------------------------------------------
// LLAMADAS
// ---------------------------------------------------------------------------

/** Registra una llamada saliente. Sobrevive a la navegación al marcador (keepalive). */
export function logCall(payload: PhoneTarget): Promise<Activity> {
  return post('/api/calls/log', payload, 'No se pudo registrar la llamada', true);
}
