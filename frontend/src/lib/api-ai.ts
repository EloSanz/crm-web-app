import { buildApiUrl, getAuthHeaders } from './api';
import { CommsError } from './api-comms';
import type { AIDraft, AIStatus, CatchupAnswer, CatchupOverview, DraftPayload, GmailStatus, GmailSyncResult } from '@/types/ai';

async function request<T>(endpoint: string, init: RequestInit, fallback: string): Promise<T> {
  const res = await fetch(buildApiUrl(endpoint), { cache: 'no-store', ...init, headers: getAuthHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.detail;
    const message =
      typeof detail === 'string' ? detail : Array.isArray(detail) && detail[0]?.msg ? String(detail[0].msg).replace(/^Value error, /, '') : fallback;
    throw new CommsError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// ASISTENTE
// ---------------------------------------------------------------------------

export function fetchAIStatus(): Promise<AIStatus> {
  return request('/api/ai/status', {}, 'No se pudo consultar el asistente');
}

/** Pide un borrador de respuesta. No envía nada: el vendedor lo revisa y lo manda. */
export function requestDraft(payload: DraftPayload): Promise<AIDraft> {
  return request('/api/ai/drafts', { method: 'POST', body: JSON.stringify(payload) }, 'No se pudo sugerir una respuesta');
}

export function fetchCatchup(companyId: string): Promise<CatchupOverview> {
  return request(`/api/ai/catchup/${companyId}`, {}, 'No se pudo cargar el historial del cliente');
}

export function askCatchup(companyId: string, question: string, history: { question: string; answer: string }[]): Promise<CatchupAnswer> {
  return request(
    `/api/ai/catchup/${companyId}/ask`,
    { method: 'POST', body: JSON.stringify({ question, history }) },
    'No se pudo responder la pregunta'
  );
}

// ---------------------------------------------------------------------------
// GMAIL DEL VENDEDOR
// ---------------------------------------------------------------------------

export function fetchGmailStatus(): Promise<GmailStatus> {
  return request('/api/gmail/status', {}, 'No se pudo consultar la conexión con Gmail');
}

export async function gmailConnectUrl(): Promise<string> {
  const { url } = await request<{ url: string }>('/api/gmail/connect', {}, 'No se pudo iniciar la conexión con Gmail');
  return url;
}

export function disconnectGmail(): Promise<void> {
  return request('/api/gmail/connection', { method: 'DELETE' }, 'No se pudo desconectar Gmail');
}

/** Busca respuestas nuevas en los hilos del CRM. Sin opportunity_id, en la casilla propia. */
export function syncGmail(opportunityId?: string, force = false): Promise<GmailSyncResult> {
  return request('/api/gmail/sync', { method: 'POST', body: JSON.stringify({ opportunity_id: opportunityId ?? null, force }) }, 'No se pudieron buscar respuestas');
}
