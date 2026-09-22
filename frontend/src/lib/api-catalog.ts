import type { Product } from '@/types/crm';
import type { CatalogAuditEntry, CatalogAuditQuery } from '@/types/catalog';
import { buildApiUrl, getAuthHeaders } from './api';

async function errorDetail(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({}));
  return typeof err.detail === 'string' ? err.detail : fallback;
}

/** Historial de altas, ediciones y bajas del catálogo, del más nuevo al más viejo. */
export async function fetchCatalogAudit(params: CatalogAuditQuery = {}): Promise<CatalogAuditEntry[]> {
  const url = buildApiUrl('/api/products/audit', {
    product_id: params.product_id,
    user_id: params.user_id,
    q: params.q,
    limit: params.limit?.toString(),
    offset: params.offset?.toString(),
  });
  const res = await fetch(url, { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(await errorDetail(res, 'No se pudo cargar el historial del catálogo'));
  return res.json();
}

/** Todos los materiales vigentes, habilitados o no (el listado común trae sólo los habilitados). */
export async function fetchAllMaterials(): Promise<Product[]> {
  const load = async (active: boolean): Promise<Product[]> => {
    const res = await fetch(buildApiUrl('/api/products', { is_active: String(active), limit: '500' }), {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(await errorDetail(res, 'Error al obtener materiales del catálogo'));
    return res.json();
  };
  const [enabled, disabled] = await Promise.all([load(true), load(false)]);
  return [...enabled, ...disabled];
}
