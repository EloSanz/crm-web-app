import { buildApiUrl, getAuthHeaders } from './api';
import type {
  CatalogMetrics,
  ClientDetailMetrics,
  ClientsMetrics,
  ContactMetrics,
  MetricsDays,
  ProjectDetailMetrics,
  ProjectsMetrics,
  QuoteDetailMetrics,
  QuotesMetrics,
  SalesMetrics,
  SellerDetailMetrics,
  SellersMetrics,
  StagesMetrics,
} from '@/types/metrics';

/** Error con el código HTTP, para distinguir "sin permiso" (403) de "no existe" (404). */
export class MetricsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getMetrics<T>(path: string, days: MetricsDays): Promise<T> {
  const res = await fetch(buildApiUrl(`/api/metrics/${path}`, { days: String(days) }), {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const fallback =
      res.status === 403 ? 'Tu rol no tiene acceso a estos indicadores' : res.status === 404 ? 'No encontramos ese registro' : 'No se pudieron cargar los indicadores';
    throw new MetricsError(typeof err.detail === 'string' ? err.detail : fallback, res.status);
  }
  return res.json();
}

export const fetchSalesMetrics = (days: MetricsDays) => getMetrics<SalesMetrics>('sales', days);
export const fetchSellersMetrics = (days: MetricsDays) => getMetrics<SellersMetrics>('sellers', days);
export const fetchSellerDetailMetrics = (id: string, days: MetricsDays) => getMetrics<SellerDetailMetrics>(`sellers/${id}`, days);
export const fetchStagesMetrics = (days: MetricsDays) => getMetrics<StagesMetrics>('stages', days);
export const fetchQuotesMetrics = (days: MetricsDays) => getMetrics<QuotesMetrics>('quotes', days);
export const fetchQuoteDetailMetrics = (id: string, days: MetricsDays) => getMetrics<QuoteDetailMetrics>(`quotes/${id}`, days);
export const fetchClientsMetrics = (days: MetricsDays) => getMetrics<ClientsMetrics>('clients', days);
export const fetchClientDetailMetrics = (id: string, days: MetricsDays) => getMetrics<ClientDetailMetrics>(`clients/${id}`, days);
export const fetchProjectsMetrics = (days: MetricsDays) => getMetrics<ProjectsMetrics>('projects', days);
export const fetchProjectDetailMetrics = (id: string, days: MetricsDays) => getMetrics<ProjectDetailMetrics>(`projects/${id}`, days);
export const fetchContactMetrics = (days: MetricsDays) => getMetrics<ContactMetrics>('contact', days);
export const fetchCatalogMetrics = (days: MetricsDays) => getMetrics<CatalogMetrics>('catalog', days);
