import type { Stage } from '@/types/crm';
import type { CatalogItem, CatalogKind, StageFormData } from '@/types/config';
import { buildApiUrl, getAuthHeaders, readError } from '@/lib/api';

async function send<T>(method: 'GET' | 'POST' | 'PUT', path: string, fallback: string, body?: unknown, params?: Record<string, string>): Promise<T> {
  const res = await fetch(buildApiUrl(path, params), {
    method,
    headers: getAuthHeaders(),
    cache: 'no-store',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, fallback));
  return res.json();
}

// --- Catálogos ---------------------------------------------------------------

export const fetchCatalog = (kind: CatalogKind, includeInactive = false) =>
  send<CatalogItem[]>('GET', '/api/catalogs', 'No pudimos cargar el catálogo', undefined, {
    kind,
    ...(includeInactive ? { include_inactive: 'true' } : {}),
  });

export const createCatalogItem = (kind: CatalogKind, label: string) =>
  send<CatalogItem>('POST', '/api/catalogs', 'No pudimos agregar el valor', { kind, label });

export const updateCatalogItem = (id: string, data: { label?: string; is_active?: boolean }) =>
  send<CatalogItem>('PUT', `/api/catalogs/${id}`, 'No pudimos guardar el cambio', data);

export const reorderCatalog = (kind: CatalogKind, ids: string[]) =>
  send<CatalogItem[]>('PUT', '/api/catalogs/reorder', 'No pudimos guardar el orden', { kind, ids });

// --- Etapas del embudo -----------------------------------------------------------

export const fetchAllStages = () =>
  send<Stage[]>('GET', '/api/stages', 'No pudimos cargar las etapas', undefined, { include_inactive: 'true' });

export const createStage = (data: Required<Pick<StageFormData, 'name' | 'color' | 'kind'>>) =>
  send<Stage>('POST', '/api/stages', 'No pudimos crear la etapa', data);

export const updateStage = (id: string, data: StageFormData) =>
  send<Stage>('PUT', `/api/stages/${id}`, 'No pudimos guardar la etapa', data);

export const reorderStages = (ids: string[]) => send<Stage[]>('PUT', '/api/stages/reorder', 'No pudimos guardar el orden', { ids });
