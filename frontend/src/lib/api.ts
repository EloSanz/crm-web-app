import { 
  Company, 
  CompanyFormData, 
  Contact, 
  ContactFormData 
} from '@/types/crm';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('crm_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

// ---------------------------------------------------------------------------
// EMPRESAS (CONTRATISTAS)
// ---------------------------------------------------------------------------

export async function fetchCompanies(params?: { q?: string; status?: string }): Promise<Company[]> {
  const url = new URL(`${API_BASE_URL}/api/companies`);
  if (params?.q) url.searchParams.append('q', params.q);
  if (params?.status) url.searchParams.append('status', params.status);

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al obtener empresas');
  }
  return res.json();
}

export async function fetchCompany(id: string): Promise<Company> {
  const res = await fetch(`${API_BASE_URL}/api/companies/${id}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al obtener detalle de la empresa');
  }
  return res.json();
}

export async function createCompany(data: CompanyFormData): Promise<Company> {
  const res = await fetch(`${API_BASE_URL}/api/companies`, {
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
  const res = await fetch(`${API_BASE_URL}/api/companies/${id}`, {
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
  const res = await fetch(`${API_BASE_URL}/api/companies/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al dar de baja la empresa');
  }
}

export async function fetchCompanyContacts(companyId: string): Promise<Contact[]> {
  const res = await fetch(`${API_BASE_URL}/api/companies/${companyId}/contacts`, {
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
  const url = new URL(`${API_BASE_URL}/api/contacts`);
  if (params?.q) url.searchParams.append('q', params.q);
  if (params?.status) url.searchParams.append('status', params.status);
  if (params?.company_id) url.searchParams.append('company_id', params.company_id);

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al obtener contactos');
  }
  return res.json();
}

export async function fetchContact(id: string): Promise<Contact> {
  const res = await fetch(`${API_BASE_URL}/api/contacts/${id}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Error al obtener detalle del contacto');
  }
  return res.json();
}

export async function createContact(data: ContactFormData): Promise<Contact> {
  const res = await fetch(`${API_BASE_URL}/api/contacts`, {
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
  const res = await fetch(`${API_BASE_URL}/api/contacts/${id}`, {
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
  const res = await fetch(`${API_BASE_URL}/api/contacts/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al dar de baja el contacto');
  }
}
