import { 
  Company, 
  CompanyFormData, 
  Contact, 
  ContactFormData,
  Product,
  ProductFormData,
  Project,
  ProjectFormData,
  Opportunity,
  OpportunityCreateData,
  OpportunityUpdateData,
  Stage,
  Activity,
  ActivityFormData,
  ActivePipelineMetric,
  ActivityAttachment,
  CrmUser,
  CrmUserFormData,
  CrmUserCreateData,
  OpportunityVersion,
  TimelineEvent,
} from '@/types/crm';

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL !== undefined && process.env.NEXT_PUBLIC_API_URL !== '') {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // In the browser, an empty string uses relative URLs on the current origin (e.g. /api/...)
  if (typeof window !== 'undefined') {
    return '';
  }
  // In SSR fallback: if VERCEL_URL is present use https://${VERCEL_URL}, else localhost
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://127.0.0.1:8000';
}

export function buildApiUrl(endpoint: string, params?: Record<string, string | undefined | null>): string {
  const base = getApiBaseUrl();
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (!params) {
    return `${base}${cleanPath}`;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  }

  const qs = searchParams.toString();
  return qs ? `${base}${cleanPath}?${qs}` : `${base}${cleanPath}`;
}

/**
 * Tope de registros que pedimos en los listados (empresas, contactos, materiales, presupuestos y obras).
 * La paginación es del lado del cliente (10 por vista) porque el volumen del TP es chico: traemos todo
 * de una vez para que la búsqueda y los filtros trabajen sobre el total y no haya un corte silencioso
 * en los primeros 100. El backend acepta hasta 1000 (ver LIST_MAX_LIMIT en backend/controllers).
 */
export const LIST_LIMIT = '1000';

export const CRM_CLIENT_API_KEY =
  process.env.NEXT_PUBLIC_CRM_API_KEY || 'crm_live_corralon_secret_key_2026';

export function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': CRM_CLIENT_API_KEY,
  };
  if (typeof window !== 'undefined') {
    // El token lo firma el backend al iniciar sesión; sin token, AppLayout manda al login.
    const token = localStorage.getItem('crm_access_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** Mensaje legible del backend: `detail` como texto o la lista de errores de validación de FastAPI. */
export async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) return String(body.detail[0].msg);
  } catch {
    /* sin cuerpo JSON */
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// EMPRESAS (CONTRATISTAS)
// ---------------------------------------------------------------------------

export async function fetchCompanies(params?: { q?: string; status?: string }): Promise<Company[]> {
  const url = buildApiUrl('/api/companies', { limit: LIST_LIMIT, ...params });
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al obtener empresas contratistas');
  }
  return res.json();
}

/** Mensaje de error cuando la API responde 403 al abrir una ficha: el registro existe pero es de otro vendedor. */
export const NO_ACCESS = 'No tenés acceso a este registro';

export async function fetchCompany(id: string): Promise<Company> {
  const url = buildApiUrl(`/api/companies/${id}`);
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(res.status === 403 ? NO_ACCESS : 'Error al obtener detalle de la empresa');
  }
  return res.json();
}

export async function createCompany(data: CompanyFormData): Promise<Company> {
  const url = buildApiUrl('/api/companies');
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al registrar la empresa');
  }
  return res.json();
}

export async function updateCompany(id: string, data: Partial<CompanyFormData>): Promise<Company> {
  const url = buildApiUrl(`/api/companies/${id}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al actualizar la empresa');
  }
  return res.json();
}

export async function deleteCompany(id: string): Promise<void> {
  const url = buildApiUrl(`/api/companies/${id}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al dar de baja la empresa');
  }
}

export async function fetchCompanyContacts(companyId: string): Promise<Contact[]> {
  const url = buildApiUrl(`/api/companies/${companyId}/contacts`);
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al obtener contactos de la empresa');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// CONTACTOS (MAESTROS MAYORES DE OBRA / CONTRATISTAS)
// ---------------------------------------------------------------------------

export async function fetchContacts(params?: { q?: string; status?: string; company_id?: string }): Promise<Contact[]> {
  const url = buildApiUrl('/api/contacts', { limit: LIST_LIMIT, ...params });
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al obtener contactos');
  }
  return res.json();
}

export async function fetchContact(id: string): Promise<Contact> {
  const url = buildApiUrl(`/api/contacts/${id}`);
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(res.status === 403 ? NO_ACCESS : 'Error al obtener detalle del contacto');
  }
  return res.json();
}

export async function createContact(data: ContactFormData): Promise<Contact> {
  const url = buildApiUrl('/api/contacts');
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al registrar el contacto');
  }
  return res.json();
}

export async function updateContact(id: string, data: Partial<ContactFormData>): Promise<Contact> {
  const url = buildApiUrl(`/api/contacts/${id}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al actualizar el contacto');
  }
  return res.json();
}

export async function deleteContact(id: string): Promise<void> {
  const url = buildApiUrl(`/api/contacts/${id}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al dar de baja el contacto');
  }
}

// ---------------------------------------------------------------------------
// CATÁLOGO DE MATERIALES (PRODUCTOS Y SERVICIOS)
// ---------------------------------------------------------------------------

export async function fetchProducts(params?: { category?: string; q?: string }): Promise<Product[]> {
  const url = buildApiUrl('/api/products', { limit: LIST_LIMIT, ...params });
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al obtener materiales del catálogo');
  }
  return res.json();
}

export async function fetchProduct(id: string): Promise<Product> {
  const url = buildApiUrl(`/api/products/${id}`);
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('No encontramos ese material');
  }
  return res.json();
}

export async function createProduct(data: ProductFormData): Promise<Product> {
  const url = buildApiUrl('/api/products');
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al agregar material al catálogo');
  }
  return res.json();
}

export async function updateProduct(id: string, data: Partial<ProductFormData>): Promise<Product> {
  const url = buildApiUrl(`/api/products/${id}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al modificar material');
  }
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  const url = buildApiUrl(`/api/products/${id}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al dar de baja el material');
  }
}

// ---------------------------------------------------------------------------
// OPORTUNIDADES Y ETAPAS DEL EMBUDO
// ---------------------------------------------------------------------------

export async function fetchStages(): Promise<Stage[]> {
  const url = buildApiUrl('/api/stages');
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al obtener etapas del embudo');
  }
  return res.json();
}

export async function fetchOpportunities(params?: {
  company_id?: string;
  contact_id?: string;
  stage_id?: string;
  q?: string;
  /** abierta | ganada | perdida */
  status?: Opportunity['status'];
  /** Sólo lo respeta para admin y responsable comercial; el vendedor ve siempre lo suyo. */
  assigned_to?: string;
  origin?: string;
}): Promise<Opportunity[]> {
  const url = buildApiUrl('/api/opportunities', { limit: LIST_LIMIT, ...params });
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al obtener presupuestos');
  }
  return res.json();
}

export async function fetchOpportunity(id: string): Promise<Opportunity> {
  const url = buildApiUrl(`/api/opportunities/${id}`);
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'No encontramos ese presupuesto'));
  }
  return res.json();
}

/** El backend responde `detail` como texto (reglas de negocio) o como lista (validación de campos). */
function errorDetail(err: { detail?: unknown }): string | undefined {
  if (typeof err.detail === 'string') return err.detail;
  if (Array.isArray(err.detail)) {
    const first = err.detail[0] as { msg?: string } | undefined;
    return first?.msg;
  }
  return undefined;
}

export async function createOpportunity(data: OpportunityCreateData): Promise<Opportunity> {
  const url = buildApiUrl('/api/opportunities');
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(errorDetail(err) || 'Error al generar presupuesto');
  }
  return res.json();
}

export async function updateOpportunity(id: string, data: OpportunityUpdateData): Promise<Opportunity> {
  const url = buildApiUrl(`/api/opportunities/${id}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(errorDetail(err) || 'Error al actualizar el presupuesto');
  }
  return res.json();
}

export async function deleteOpportunity(id: string): Promise<void> {
  const url = buildApiUrl(`/api/opportunities/${id}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al eliminar el presupuesto');
  }
}


// ---------------------------------------------------------------------------
// OBRAS Y PROYECTOS (LOCACIONES DE ENTREGA)
// ---------------------------------------------------------------------------

export async function fetchProjects(params?: {
  company_id?: string;
  contact_id?: string;
  status?: string;
  project_type?: string;
  q?: string;
}): Promise<Project[]> {
  const url = buildApiUrl('/api/projects', { limit: LIST_LIMIT, ...params });
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Error al obtener obras y proyectos'));
  }
  return res.json();
}

export async function fetchProject(id: string): Promise<Project> {
  const url = buildApiUrl(`/api/projects/${id}`);
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    // 403: la obra es de un cliente que el vendedor no ve; el backend explica el motivo.
    throw new Error(await readError(res, 'Error al obtener detalle de la obra'));
  }
  return res.json();
}

export async function createProject(data: ProjectFormData): Promise<Project> {
  const url = buildApiUrl('/api/projects');
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Error al registrar la obra'));
  }
  return res.json();
}

export async function updateProject(id: string, data: Partial<ProjectFormData>): Promise<Project> {
  const url = buildApiUrl(`/api/projects/${id}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Error al actualizar la obra'));
  }
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const url = buildApiUrl(`/api/projects/${id}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al dar de baja la obra');
  }
}

// ---------------------------------------------------------------------------
// ACTIVIDADES COMERCIALES Y NORTH STAR METRIC (NSM)
// ---------------------------------------------------------------------------

export async function fetchOpportunityVersions(opportunityId: string): Promise<OpportunityVersion[]> {
  const res = await fetch(buildApiUrl(`/api/opportunities/${opportunityId}/versions`), { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res, 'No se pudieron traer las versiones'));
  return res.json();
}

export async function fetchOpportunityTimeline(opportunityId: string): Promise<TimelineEvent[]> {
  const res = await fetch(buildApiUrl(`/api/opportunities/${opportunityId}/timeline`), { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res, 'No se pudieron traer los hitos'));
  return res.json();
}

export async function fetchOpportunityActivities(opportunityId: string): Promise<Activity[]> {
  const url = buildApiUrl(`/api/opportunities/${opportunityId}/activities`);
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al cargar la bitácora de actividades');
  }
  return res.json();
}

export async function createActivity(data: ActivityFormData): Promise<Activity> {
  const url = buildApiUrl('/api/activities');
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al registrar la actividad comercial');
  }
  return res.json();
}

export async function fetchActivePipelineMetric(days: number = 7): Promise<ActivePipelineMetric> {
  const url = buildApiUrl('/api/metrics/active-pipeline', { days: String(days) });
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al consultar métrica de pipeline activo');
  }
  return res.json();
}




// ---------------------------------------------------------------------------
// USUARIOS Y ROLES
// ---------------------------------------------------------------------------

export async function fetchUsers(): Promise<CrmUser[]> {
  const res = await fetch(buildApiUrl('/api/users'), { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudieron cargar los usuarios');
  return res.json();
}

export async function fetchUser(id: string): Promise<CrmUser> {
  const res = await fetch(buildApiUrl(`/api/users/${id}`), { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('No encontramos ese usuario');
  return res.json();
}

/** Mensaje del backend para mostrar en un toast (el detail de FastAPI puede venir como lista en un 422). */
async function userApiError(res: Response, fallback: string): Promise<Error> {
  const err = await res.json().catch(() => ({}));
  return new Error(typeof err.detail === 'string' && err.detail ? err.detail : fallback);
}

export async function createUser(data: CrmUserCreateData): Promise<CrmUser> {
  const res = await fetch(buildApiUrl('/api/users'), { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw await userApiError(res, 'No se pudo crear el usuario');
  return res.json();
}

export async function updateUser(id: string, data: Partial<CrmUserFormData>): Promise<CrmUser> {
  const res = await fetch(buildApiUrl(`/api/users/${id}`), { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw await userApiError(res, 'No se pudo actualizar el usuario');
  return res.json();
}

/** Sólo administrador: define una contraseña nueva para el usuario. */
export async function resetUserPassword(id: string, password: string): Promise<void> {
  const res = await fetch(buildApiUrl(`/api/users/${id}/password`), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw await userApiError(res, 'No se pudo cambiar la contraseña');
}

// ---------------------------------------------------------------------------
// ADJUNTOS DEL SEGUIMIENTO (S3)
// ---------------------------------------------------------------------------

export async function uploadAttachment(file: File): Promise<ActivityAttachment> {
  const body = new FormData();
  body.append('file', file);
  const headers = getAuthHeaders() as Record<string, string>;
  delete headers['Content-Type'];
  const res = await fetch(buildApiUrl('/api/upload/adjunto'), { method: 'POST', headers, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `No se pudo subir ${file.name}`);
  }
  const data = await res.json();
  return { url: data.url || data.image_url, name: file.name, content_type: data.content_type || file.type, size_bytes: data.size_bytes ?? file.size };
}
