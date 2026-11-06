import type { AuditPage, AuditQuery } from '@/types/audit';
import { buildApiUrl, getAuthHeaders } from './api';

/** Auditoría de cambios, de lo más nuevo a lo más viejo, paginada en el servidor (sólo managers). */
export async function fetchAudit(params: AuditQuery = {}): Promise<AuditPage> {
  const url = buildApiUrl('/api/audit', {
    entity: params.entity,
    entity_id: params.entity_id,
    user_id: params.user_id,
    desde: params.desde,
    hasta: params.hasta,
    limit: params.limit?.toString(),
    offset: params.offset?.toString(),
  });
  const res = await fetch(url, { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'No se pudo cargar la auditoría');
  }
  return res.json();
}
