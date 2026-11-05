import { buildApiUrl, getAuthHeaders } from './api';
import type { HistoryKind, HistoryPage, HistoryScope } from '@/types/history';

/** Historial comercial de una empresa o un contacto, del más nuevo al más viejo. */
export async function fetchClientHistory(
  scope: HistoryScope,
  id: string,
  { kind, limit = 20, offset = 0 }: { kind?: HistoryKind | null; limit?: number; offset?: number } = {}
): Promise<HistoryPage> {
  const url = buildApiUrl(`/api/${scope}/${id}/history`, { kind, limit: String(limit), offset: String(offset) });
  const res = await fetch(url, { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'No se pudo cargar el historial');
  }
  return res.json();
}
