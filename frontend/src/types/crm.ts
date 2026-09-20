export type CompanyStatus = 'potencial' | 'cliente' | 'inactivo' | 'no_contactar';
export type ContactStatus = 'potencial' | 'cliente' | 'inactivo' | 'no_contactar';

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
  company_id?: string | null;
  company_name?: string | null;
  first_name: string;
  last_name: string;
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
  company_id?: string;
  first_name: string;
  last_name: string;
  document_number?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  status: ContactStatus;
  origin?: string;
  notes?: string;
}
