export type CompanyStatus = 'potencial' | 'cliente' | 'inactivo' | 'no_contactar';
export type ContactStatus = 'potencial' | 'cliente' | 'inactivo' | 'no_contactar';

export type ProductCategory =
  | 'Aglomerantes'
  | 'Áridos'
  | 'Hierros y Aceros'
  | 'Mampostería'
  | 'Techos e Hidráulica'
  | 'Servicios';

export interface Company {
  id: string;
  name: string;
  cuit?: string | null;
  industry?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  status: CompanyStatus;
  origin?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyFormData {
  name: string;
  cuit?: string;
  industry?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  status: CompanyStatus;
  origin?: string;
  notes?: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  company_id?: string | null;
  company_name?: string | null;
  document_number?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  status: ContactStatus;
  origin?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactFormData {
  first_name: string;
  last_name: string;
  company_id?: string;
  document_number?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  status: ContactStatus;
  origin?: string;
  notes?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: ProductCategory;
  unit: string;
  unit_price: number;
  description?: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductFormData {
  code: string;
  name: string;
  category: ProductCategory;
  unit: string;
  unit_price: number;
  description?: string;
  is_active: boolean;
}

export interface OpportunityItem {
  id: string;
  opportunity_id: string;
  product_id?: string | null;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface Opportunity {
  id: string;
  title: string;
  company_id?: string | null;
  company_name?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  assigned_to: string;
  assigned_to_name?: string | null;
  stage_id: string;
  stage_name?: string | null;
  stage_slug?: string | null;
  stage_color?: string | null;
  status: 'abierta' | 'ganada' | 'perdida';
  estimated_value: number;
  currency: string;
  expected_close_date?: string | null;
  delivery_location?: string | null;
  loss_reason?: string | null;
  items: OpportunityItem[];
  // North Star Metric (NSM)
  last_activity_at?: string | null;
  days_since_last_activity?: number | null;
  health_status?: 'healthy' | 'warning' | 'stale';
  is_deleted: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type ActivityType = 
  | 'llamada' 
  | 'whatsapp' 
  | 'reunion' 
  | 'visita_obra' 
  | 'mostrador' 
  | 'email' 
  | 'nota' 
  | 'presupuesto';

export interface ActivityAttachment {
  url: string;
  name: string;
  content_type?: string | null;
  size_bytes?: number | null;
}

export interface Activity {
  id: string;
  opportunity_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  user_id: string;
  user_name?: string | null;
  activity_type: ActivityType;
  summary: string;
  description?: string | null;
  activity_date: string;
  attachments?: ActivityAttachment[];
  created_at: string;
}

export interface ActivityFormData {
  opportunity_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  activity_type: ActivityType;
  summary: string;
  description?: string | null;
  activity_date?: string;
  attachments?: ActivityAttachment[];
}

export interface ActivePipelineMetric {
  window_days: number;
  total_open_opportunities: number;
  active_opportunities_count: number;
  active_opportunities_amount: number;
  pipeline_health_ratio: number;
  stale_opportunities_count: number;
  stale_opportunities_amount: number;
}


export type ProjectType =
  | 'vivienda_unifamiliar'
  | 'edificio_multifamiliar'
  | 'comercial_industrial'
  | 'refaccion'
  | 'obra_publica';

export type ProjectStatus = 'planificacion' | 'en_curso' | 'frenada' | 'finalizada';

export interface Project {
  id: string;
  name: string;
  company_id?: string | null;
  company_name?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  address: string;
  project_type: ProjectType;
  status: ProjectStatus;
  observations?: string | null;
  opportunities_count?: number;
  is_deleted: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFormData {
  name: string;
  company_id?: string | null;
  contact_id?: string | null;
  address: string;
  project_type: ProjectType;
  status: ProjectStatus;
  observations?: string | null;
}

export interface Stage {
  id: string;
  name: string;
  slug: string;
  position: number;
  is_closed_won: boolean;
  is_closed_lost: boolean;
  color: string;
}

export interface OpportunityItemCreateData {
  product_id?: string | null;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

export interface OpportunityCreateData {
  title: string;
  company_id?: string | null;
  contact_id?: string | null;
  project_id?: string | null;
  assigned_to: string;
  stage_id: string;
  status?: 'abierta' | 'ganada' | 'perdida';
  currency?: string;
  expected_close_date?: string | null;
  delivery_location?: string | null;
  items: OpportunityItemCreateData[];
}

export interface OpportunityUpdateData {
  title?: string;
  company_id?: string | null;
  contact_id?: string | null;
  project_id?: string | null;
  assigned_to?: string;
  stage_id?: string;
  status?: 'abierta' | 'ganada' | 'perdida';
  estimated_value?: number;
  expected_close_date?: string | null;
  delivery_location?: string | null;
  loss_reason?: string | null;
  items?: OpportunityItemCreateData[];
}




export type CrmRole = 'admin' | 'gerente_comercial' | 'ejecutivo_ventas';

export interface CrmUser {
  id: string;
  email: string;
  full_name: string;
  role: CrmRole;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CrmUserFormData {
  email: string;
  full_name: string;
  role: CrmRole;
  is_active: boolean;
}
