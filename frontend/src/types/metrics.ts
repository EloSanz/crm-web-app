/** Indicadores operativos (GET /api/metrics/*). Todas las respuestas traen el período consultado. */

export type MetricsDays = 30 | 90 | 180 | 365;
export type Granularity = 'week' | 'month';
export type HealthKey = 'healthy' | 'warning' | 'stale';
export type ChannelGroup = 'llamada' | 'whatsapp' | 'email' | 'presencial' | 'presupuesto';
export type ContactType = 'llamada' | 'whatsapp' | 'email' | 'visita_obra' | 'mostrador' | 'reunion' | 'presupuesto';

export interface MetricsBase {
  days: MetricsDays;
  granularity: Granularity;
  since: string;
  until: string;
}

export interface OutcomeSummary {
  won_amount: number;
  won_count: number;
  lost_amount: number;
  lost_count: number;
  close_rate: number | null;
  avg_ticket: number | null;
  avg_cycle_days: number | null;
}

export interface OutcomeBucket {
  start: string;
  won_amount: number;
  won_count: number;
  lost_amount: number;
  lost_count: number;
  close_rate: number | null;
}

export interface OpenQuoteRow {
  id: string;
  title: string;
  client: string;
  seller_id: string | null;
  seller: string;
  stage_id: string;
  stage_name: string;
  amount: number;
  health: HealthKey;
  days_since_last_activity: number | null;
  days_in_stage: number | null;
  age_days: number | null;
  version: number;
  discount_pct: number;
}

export interface MaterialRow {
  product_id: string | null;
  name: string;
  unit: string;
  quotes: number;
  quantity: number;
  amount: number;
}

// --- Ventas ------------------------------------------------------------------

export interface SalesMetrics extends MetricsBase {
  summary: OutcomeSummary;
  previous: OutcomeSummary;
  buckets: OutcomeBucket[];
  loss_reasons: { reason: string; count: number; amount: number }[];
  sales: {
    id: string;
    title: string;
    client: string;
    company_id: string | null;
    seller_id: string | null;
    seller: string;
    amount: number;
    closed_at: string | null;
    cycle_days: number | null;
  }[];
}

// --- Vendedores -----------------------------------------------------------------

export type HealthSplit = Record<HealthKey, { count: number; amount: number }>;

export interface SellerRow {
  user_id: string;
  name: string;
  role: string | null;
  is_active: boolean;
  open_count: number;
  pipeline_amount: number;
  health: HealthSplit;
  stale_count: number;
  won_count: number;
  won_amount: number;
  lost_count: number;
  close_rate: number | null;
  avg_ticket: number | null;
  contacts_total: number;
  contacts_by_channel: Record<ChannelGroup, number>;
  avg_days_between_contacts: number | null;
}

type TeamOutcome = Pick<OutcomeSummary, 'won_amount' | 'won_count' | 'lost_count' | 'close_rate' | 'avg_ticket'>;

export interface SellersMetrics extends MetricsBase {
  summary: TeamOutcome & {
    open_count: number;
    pipeline_amount: number;
    healthy_pct: number | null;
    previous: TeamOutcome;
    avg_days_between_contacts: number | null;
  };
  sellers: SellerRow[];
}

export interface SellerDetailMetrics extends MetricsBase {
  seller: SellerRow;
  team: { close_rate: number | null; avg_ticket: number | null; avg_days_between_contacts: number | null };
  buckets: OutcomeBucket[];
  stage_times: { stage_id: string; name: string; position: number; avg_days: number | null; team_avg_days: number | null; count: number }[];
  activity_mix: { channel: ChannelGroup; count: number }[];
  open: OpenQuoteRow[];
}

// --- Etapas ----------------------------------------------------------------------

export interface StagesMetrics extends MetricsBase {
  summary: {
    avg_cycle_days: number | null;
    slowest_stage: { stage_id: string; name: string; avg_days: number } | null;
    open_count: number;
    avg_days_in_current_stage: number | null;
    stuck_count: number;
  };
  macro: {
    stage_id: string;
    name: string;
    position: number;
    avg_days: number | null;
    median_days: number | null;
    max_days: number | null;
    count: number;
    en_curso: number;
  }[];
  matrix: {
    sellers: { user_id: string; name: string }[];
    stages: { stage_id: string; name: string }[];
    cells: { user_id: string; stage_id: string; avg_days: number | null; count: number }[];
  };
  conversion: {
    stage_id: string;
    name: string;
    entered: number;
    advanced: number;
    lost: number;
    back: number;
    en_curso: number;
    advance_rate: number | null;
    loss_rate: number | null;
  }[];
  won_count: number;
  open_by_stage: { stage_id: string; name: string; count: number; amount: number; avg_days_in_stage: number | null; max_days_in_stage: number | null }[];
  open: OpenQuoteRow[];
}

// --- Presupuestos ----------------------------------------------------------------

export interface RangeBucket {
  key: string;
  min: number;
  max: number | null;
  count: number;
  amount: number;
}

export interface QuotesMetrics extends MetricsBase {
  summary: {
    open_count: number;
    open_amount: number;
    considered_count: number;
    renegotiated_count: number;
    renegotiated_pct: number | null;
    discounted_count: number;
    avg_discount_pct: number | null;
    avg_age_days: number | null;
  };
  amount_ranges: RangeBucket[];
  age_ranges: RangeBucket[];
  health: { health: HealthKey; count: number; amount: number }[];
  top_materials: MaterialRow[];
  open: OpenQuoteRow[];
}

export interface QuoteDetailMetrics extends MetricsBase {
  quote: OpenQuoteRow & {
    status: 'abierta' | 'ganada' | 'perdida';
    company_id: string | null;
    project_id: string | null;
    project_name: string | null;
    loss_reason: string | null;
    created_at: string | null;
    closed_at: string | null;
    cycle_days: number | null;
  };
  stage_times: { stage_id: string; name: string; position: number; days: number; visits: number; en_curso: boolean }[];
  segments: { stage_id: string; name: string; start: string; end: string; days: number; en_curso: boolean }[];
  contacts_total: number;
  contacts_by_channel: { channel: ContactType; count: number }[];
  first_response_hours: number | null;
  avg_days_between_contacts: number | null;
  versions: { version: number; total: number; discount_pct: number; note: string | null; created_at: string | null }[];
  items: { name: string; unit: string; quantity: number; amount: number }[];
}

// --- Clientes --------------------------------------------------------------------

export interface ClientRow {
  company_id: string;
  name: string;
  status: string;
  origin: string;
  created_at: string | null;
  quotes: number;
  open_amount: number;
  quoted_amount: number;
  won_amount: number;
  won_count_period: number;
  won_count: number;
  last_won_at: string | null;
}

export interface ClientsMetrics extends MetricsBase {
  summary: {
    clients: number;
    buyers: number;
    repeat_buyers: number;
    repeat_pct: number | null;
    new_clients: number;
    new_clients_previous: number;
    avg_won_per_buyer: number | null;
  };
  top: ClientRow[];
  new_buckets: { start: string; count: number }[];
  by_status: { status: string; count: number; won_amount: number; open_amount: number }[];
  by_origin: { origin: string; count: number; won_amount: number; open_amount: number }[];
  clients: ClientRow[];
}

export interface QuoteHistoryRow extends OpenQuoteRow {
  status: 'abierta' | 'ganada' | 'perdida';
  created_at: string | null;
  closed_at: string | null;
}

export interface ClientDetailMetrics extends MetricsBase {
  client: { company_id: string; name: string; status: string; origin: string; created_at: string | null };
  summary: {
    won_amount_period: number;
    won_count_period: number;
    won_amount_total: number;
    won_count_total: number;
    lost_count_total: number;
    close_rate_total: number | null;
    open_amount: number;
    open_count: number;
    first_won_at: string | null;
    last_won_at: string | null;
  };
  buckets: OutcomeBucket[];
  top_materials: MaterialRow[];
  projects: { project_id: string; name: string; quotes: number; amount: number }[];
  quotes: QuoteHistoryRow[];
}

// --- Obras -----------------------------------------------------------------------

export interface ProjectRow {
  project_id: string;
  name: string;
  company_name: string | null;
  project_type: string;
  status: string;
  quotes: number;
  open_count: number;
  open_amount: number;
  quoted_amount: number;
  won_amount: number;
  won_count: number;
  lost_count: number;
}

interface ProjectGroup {
  projects: number;
  quotes: number;
  open_amount: number;
  quoted_amount: number;
  won_amount: number;
}

export interface ProjectsMetrics extends MetricsBase {
  summary: {
    projects: number;
    projects_with_quotes: number;
    open_amount: number;
    quoted_amount: number;
    won_amount: number;
    without_project_pct: number | null;
  };
  by_type: (ProjectGroup & { project_type: string })[];
  by_status: (ProjectGroup & { status: string })[];
  projects: ProjectRow[];
}

export interface ProjectDetailMetrics extends MetricsBase {
  project: ProjectRow & { address: string | null };
  by_stage: { stage_id: string; name: string; count: number; amount: number; is_closed_won: boolean; is_closed_lost: boolean }[];
  top_materials: MaterialRow[];
  quotes: QuoteHistoryRow[];
}

// --- Contacto ----------------------------------------------------------------------

export interface ContactMetrics extends MetricsBase {
  summary: {
    contacts: number;
    contacts_previous: number;
    calls: number;
    whatsapp: number;
    emails: number;
    in_person: number;
    first_response_avg_hours: number | null;
    first_response_median_hours: number | null;
    responded: number;
    awaiting_first_contact: number;
    avg_days_between_contacts: number | null;
  };
  buckets: ({ start: string; total: number } & Record<ChannelGroup, number>)[];
  by_type: { type: ContactType; count: number }[];
  by_seller: {
    user_id: string;
    name: string;
    is_active: boolean;
    total: number;
    by_channel: Record<ChannelGroup, number>;
    first_response_avg_hours: number | null;
    avg_days_between_contacts: number | null;
  }[];
}

// --- Catálogo ------------------------------------------------------------------------

export interface CatalogMaterial {
  product_id: string | null;
  code: string | null;
  name: string;
  category: string;
  unit: string;
  quoted_quotes: number;
  quoted_qty: number;
  quoted_amount: number;
  sold_quotes: number;
  sold_qty: number;
  sold_amount: number;
}

export interface CatalogMetrics extends MetricsBase {
  summary: {
    materials_quoted: number;
    materials_sold: number;
    quoted_amount: number;
    sold_amount: number;
    top_category: string | null;
  };
  materials: CatalogMaterial[];
  top_quoted: CatalogMaterial[];
  top_sold: CatalogMaterial[];
  by_category: { category: string; quoted_amount: number; sold_amount: number; materials: number }[];
}
