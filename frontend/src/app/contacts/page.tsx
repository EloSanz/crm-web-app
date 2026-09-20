'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Company, Contact, ContactFormData, ContactStatus } from '@/types/crm';
import { 
  fetchContacts, 
  fetchCompanies, 
  createContact, 
  updateContact, 
  deleteContact 
} from '@/lib/api';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  Building2, 
  Edit2, 
  Trash2, 
  X, 
  AlertTriangle,
  Loader2,
  CheckCircle,
  HardHat
} from 'lucide-react';

const STATUS_LABELS: Record<ContactStatus, { label: string; bg: string; text: string }> = {
  potencial: { label: 'Potencial', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  cliente: { label: 'Cliente Activo', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  inactivo: { label: 'Inactivo', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600' },
  no_contactar: { label: 'No Contactar', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
};

const COMMON_ROLES = [
  'Maestro Mayor de Obra',
  'Contratista General',
  'Capataz de Obra',
  'Arquitecto / Director de Obra',
  'Jefe de Compras',
  'Particular / Dueño de Obra',
];

const ORIGIN_OPTIONS = [
  'Vino al local (mostrador)',
  'Recomendación de otro contratista',
  'Cliente existente / recompra',
  'Prospección propia',
  'Redes sociales',
  'Publicidad',
  'Página web',
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<ContactFormData>({
    first_name: '',
    last_name: '',
    company_id: '',
    job_title: 'Maestro Mayor de Obra',
    email: '',
    phone: '',
    document_number: '',
    status: 'potencial',
    origin: 'Vino al local (mostrador)',
    notes: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [contactsData, companiesData] = await Promise.all([
        fetchContacts(),
        fetchCompanies(),
      ]);
      setContacts(contactsData);
      setCompanies(companiesData);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar contactos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([fetchContacts(), fetchCompanies()])
      .then(([contactsData, companiesData]) => {
        if (isMounted) {
          setContacts(contactsData);
          setCompanies(companiesData);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) setErrorMsg(err instanceof Error ? err.message : 'Error al cargar contactos');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
      const matchesSearch = 
        fullName.includes(searchQuery.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.phone && c.phone.includes(searchQuery)) ||
        (c.company_name && c.company_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesCompany = companyFilter === 'all' || c.company_id === companyFilter;

      return matchesSearch && matchesStatus && matchesCompany;
    });
  }, [contacts, searchQuery, statusFilter, companyFilter]);

  const handleOpenCreateModal = () => {
    setEditingContact(null);
    setFormData({
      first_name: '',
      last_name: '',
      company_id: '',
      job_title: 'Maestro Mayor de Obra',
      email: '',
      phone: '',
      document_number: '',
      status: 'potencial',
      origin: 'Vino al local (mostrador)',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Contact) => {
    setEditingContact(c);
    setFormData({
      first_name: c.first_name,
      last_name: c.last_name,
      company_id: c.company_id || '',
      job_title: c.job_title || 'Maestro Mayor de Obra',
      email: c.email || '',
      phone: c.phone || '',
      document_number: c.document_number || '',
      status: c.status,
      origin: c.origin || 'Vino al local (mostrador)',
      notes: c.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name.trim() || !formData.last_name.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const payload: ContactFormData = {
      ...formData,
      company_id: formData.company_id ? formData.company_id : undefined,
    };

    try {
      if (editingContact) {
        await updateContact(editingContact.id, payload);
        setSuccessMsg('Contacto actualizado con éxito');
      } else {
        await createContact(payload);
        setSuccessMsg('Contacto registrado exitosamente');
      }
      setIsModalOpen(false);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar contacto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingContact) return;
    setIsSubmitting(true);
    try {
      await deleteContact(deletingContact.id);
      setSuccessMsg(`Contacto "${deletingContact.first_name} ${deletingContact.last_name}" dado de baja (baja lógica).`);
      setDeletingContact(null);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al dar de baja contacto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-7 h-7 text-blue-600" />
              Contactos / Contratistas
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Maestros mayores de obra, capataces y clientes particulares o vinculados a empresas.
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Nuevo Contacto
          </button>
        </div>

        {/* Notificaciones */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            {errorMsg}
          </div>
        )}

        {/* Barra de Búsqueda y Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          {/* Búsqueda por texto */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Filtro Empresa */}
          <div>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
              <option value="all">Todas las empresas (o particulares)</option>
              {companies.map((comp) => (
                <option key={comp.id} value={comp.id}>{comp.name}</option>
              ))}
            </select>
          </div>

          {/* Filtro Estado */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {['all', 'potencial', 'cliente', 'inactivo'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium capitalize transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'all' ? 'Todos' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de Contactos */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-sm">Cargando contactos...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
              <Users className="w-10 h-10 text-slate-300" />
              <p className="font-semibold text-slate-700">No se encontraron contactos</p>
              <p className="text-xs text-slate-400">Prueba con otro término de búsqueda o registra un nuevo contacto.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase tracking-wider font-semibold text-slate-600">
                    <th className="py-3 px-4">Contacto / Cargo</th>
                    <th className="py-3 px-4">Empresa Vinculada</th>
                    <th className="py-3 px-4">Teléfono Directo</th>
                    <th className="py-3 px-4">Correo Electrónico</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredContacts.map((c) => {
                    const st = STATUS_LABELS[c.status] || STATUS_LABELS.potencial;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <HardHat className="w-3.5 h-3.5 text-blue-600" />
                            {c.first_name} {c.last_name}
                          </div>
                          <div className="text-xs text-slate-500">{c.job_title || 'Maestro de Obra'}</div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {c.company_name ? (
                            <span className="inline-flex items-center gap-1 font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {c.company_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Cliente Particular</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          {c.phone ? (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {c.phone}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {c.email ? (
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {c.email}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${st.bg} ${st.text}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(c)}
                              title="Editar contacto"
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingContact(c)}
                              title="Dar de baja (Lógica)"
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE ALTA / EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                {editingContact ? 'Editar Contacto' : 'Registrar Nuevo Contacto'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Juan"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Pérez"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Empresa Contratista Vinculada
                </label>
                <select
                  value={formData.company_id || ''}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="">Ninguna (Cliente Particular / Independiente)</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>{comp.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Cargo o Función
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Maestro Mayor de Obra"
                    list="roles-list"
                    value={formData.job_title || ''}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <datalist id="roles-list">
                    {COMMON_ROLES.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    DNI / Documento
                  </label>
                  <input
                    type="text"
                    placeholder="ej. 32.123.456"
                    value={formData.document_number || ''}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Teléfono Celular
                  </label>
                  <input
                    type="text"
                    placeholder="+54 9 11 5566-7788"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="juan.perez@obras.com"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Estado Comercial *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ContactStatus })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    <option value="potencial">Potencial</option>
                    <option value="cliente">Cliente Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="no_contactar">No contactar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Origen
                  </label>
                  <select
                    value={formData.origin || ''}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    {ORIGIN_OPTIONS.map((orig) => (
                      <option key={orig} value={orig}>{orig}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Observaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Información sobre obras en las que trabaja o preferencias de contacto..."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingContact ? 'Actualizar Contacto' : 'Registrar Contacto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE BAJA LÓGICA */}
      {deletingContact && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">¿Dar de baja a este contacto?</h3>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {deletingContact.first_name} {deletingContact.last_name}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Conforme a la regla invariante de negocio (Invariante 2), se aplicará <strong>baja lógica</strong>:
                el registro se preserva para mantener la trazabilidad de cotizaciones e historial.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingContact(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar Baja Lógica
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
