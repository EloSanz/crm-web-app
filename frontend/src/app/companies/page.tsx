'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Company, CompanyFormData, CompanyStatus, Contact } from '@/types/crm';
import { 
  fetchCompanies, 
  createCompany, 
  updateCompany, 
  deleteCompany,
  fetchCompanyContacts 
} from '@/lib/api';
import { 
  Building2, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Edit2, 
  Trash2, 
  Users, 
  X, 
  AlertTriangle,
  Loader2,
  CheckCircle
} from 'lucide-react';

const STATUS_LABELS: Record<CompanyStatus, { label: string; bg: string; text: string }> = {
  potencial: { label: 'Potencial', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  cliente: { label: 'Cliente Activo', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  inactivo: { label: 'Inactivo', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600' },
  no_contactar: { label: 'No Contactar', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
};

const ORIGIN_OPTIONS = [
  'Vino al local (mostrador)',
  'Recomendación de otro contratista',
  'Cliente existente / recompra',
  'Prospección propia',
  'Redes sociales',
  'Publicidad',
  'Página web',
];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [viewingContactsCompany, setViewingContactsCompany] = useState<Company | null>(null);
  const [companyContacts, setCompanyContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    cuit: '',
    industry: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    status: 'potencial',
    origin: 'Vino al local (mostrador)',
    notes: '',
  });

  const loadCompanies = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchCompanies();
      setCompanies(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar empresas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchCompanies()
      .then((data) => {
        if (isMounted) setCompanies(data);
      })
      .catch((err: unknown) => {
        if (isMounted) setErrorMsg(err instanceof Error ? err.message : 'Error al cargar empresas');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCompanies = useMemo(() => {
    return companies.filter((comp) => {
      const matchesSearch = 
        comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (comp.cuit && comp.cuit.includes(searchQuery)) ||
        (comp.industry && comp.industry.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || comp.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [companies, searchQuery, statusFilter]);

  const handleOpenCreateModal = () => {
    setEditingCompany(null);
    setFormData({
      name: '',
      cuit: '',
      industry: 'Construcción / Obra Civil',
      email: '',
      phone: '',
      address: '',
      website: '',
      status: 'potencial',
      origin: 'Vino al local (mostrador)',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (comp: Company) => {
    setEditingCompany(comp);
    setFormData({
      name: comp.name,
      cuit: comp.cuit || '',
      industry: comp.industry || '',
      email: comp.email || '',
      phone: comp.phone || '',
      address: comp.address || '',
      website: comp.website || '',
      status: comp.status,
      origin: comp.origin || 'Vino al local (mostrador)',
      notes: comp.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, formData);
        setSuccessMsg('Empresa actualizada correctamente');
      } else {
        await createCompany(formData);
        setSuccessMsg('Empresa contratista registrada con éxito');
      }
      setIsModalOpen(false);
      await loadCompanies();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar la empresa');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCompany) return;
    setIsSubmitting(true);
    try {
      await deleteCompany(deletingCompany.id);
      setSuccessMsg(`Empresa "${deletingCompany.name}" dada de baja correctamente (Baja lógica).`);
      setDeletingCompany(null);
      await loadCompanies();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al dar de baja');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenContacts = async (comp: Company) => {
    setViewingContactsCompany(comp);
    setIsLoadingContacts(true);
    try {
      const contacts = await fetchCompanyContacts(comp.id);
      setCompanyContacts(contacts);
    } catch {
      setCompanyContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-7 h-7 text-blue-600" />
              Empresas Contratistas
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Registro comercial de constructoras, hormigoneras y contratistas de obra.
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Nueva Empresa
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
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por razón social, CUIT o especialidad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Filtro por estado */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-semibold text-slate-500 mr-1">Estado:</span>
            {['all', 'potencial', 'cliente', 'inactivo', 'no_contactar'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium capitalize transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'all' ? 'Todos' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Listado / Tabla de Empresas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-sm">Cargando empresas contratistas...</p>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
              <Building2 className="w-10 h-10 text-slate-300" />
              <p className="font-semibold text-slate-700">No se encontraron empresas</p>
              <p className="text-xs text-slate-400">Prueba con otro término de búsqueda o registra una nueva empresa.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase tracking-wider font-semibold text-slate-600">
                    <th className="py-3 px-4">Razón Social / Especialidad</th>
                    <th className="py-3 px-4">CUIT</th>
                    <th className="py-3 px-4">Contacto Directo</th>
                    <th className="py-3 px-4">Ubicación</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCompanies.map((comp) => {
                    const st = STATUS_LABELS[comp.status] || STATUS_LABELS.potencial;
                    return (
                      <tr key={comp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{comp.name}</div>
                          <div className="text-xs text-slate-500">{comp.industry || 'Construcción'}</div>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-600">
                          {comp.cuit || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {comp.phone && (
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {comp.phone}
                            </div>
                          )}
                          {comp.email && (
                            <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {comp.email}
                            </div>
                          )}
                          {!comp.phone && !comp.email && <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                          {comp.address ? (
                            <div className="flex items-center gap-1.5" title={comp.address}>
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{comp.address}</span>
                            </div>
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
                              onClick={() => handleOpenContacts(comp)}
                              title="Ver contactos asociados"
                              className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(comp)}
                              title="Editar empresa"
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingCompany(comp)}
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
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                {editingCompany ? 'Editar Empresa Contratista' : 'Registrar Nueva Empresa Contratista'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Razón Social / Nombre Comercial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Construcciones del Oeste SRL"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    CUIT
                  </label>
                  <input
                    type="text"
                    placeholder="30-12345678-9"
                    value={formData.cuit || ''}
                    onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Especialidad / Rubro
                  </label>
                  <input
                    type="text"
                    placeholder="Hormigón, Estructuras, Viviendas"
                    value={formData.industry || ''}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Teléfono Principal
                  </label>
                  <input
                    type="text"
                    placeholder="+54 11 4455-6677"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Correo
                  </label>
                  <input
                    type="email"
                    placeholder="compras@empresa.com"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Dirección o Depósito
                </label>
                <input
                  type="text"
                  placeholder="Av. Rivadavia 1200, Morón"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Estado Comercial *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as CompanyStatus })}
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
                  Observaciones Comerciales
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre capacidad de compra, obras habituales o formas de pago..."
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
                  {editingCompany ? 'Actualizar Empresa' : 'Registrar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE BAJA LÓGICA */}
      {deletingCompany && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">¿Dar de baja a esta empresa?</h3>
              <p className="text-sm font-semibold text-slate-800 mt-1">{deletingCompany.name}</p>
              <p className="text-xs text-slate-500 mt-2">
                Conforme a las reglas del sistema (Invariante 2), se aplicará <strong>baja lógica</strong>: 
                el registro no se eliminará físicamente de la base de datos para preservar el historial comercial.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCompany(null)}
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

      {/* DRAWER / MODAL DE CONTACTOS DE LA EMPRESA */}
      {viewingContactsCompany && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Contactos de {viewingContactsCompany.name}
                </h3>
                <p className="text-xs text-slate-500">Maestros mayores de obra, capataces y encargados registrados.</p>
              </div>
              <button onClick={() => setViewingContactsCompany(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {isLoadingContacts ? (
                <div className="py-8 text-center text-slate-500 flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <p className="text-xs">Cargando contactos...</p>
                </div>
              ) : companyContacts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-1">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-medium text-slate-600">No hay contactos vinculados a esta empresa.</p>
                  <p className="text-xs">Puedes crearlos desde la sección de Contactos asociándolos a esta constructora.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {companyContacts.map((c) => (
                    <div key={c.id} className="p-3.5 bg-white hover:bg-slate-50 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900">{c.first_name} {c.last_name}</div>
                        <div className="text-xs text-slate-500 font-medium">{c.job_title || 'Contacto Comercial'}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                          {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />{c.phone}</span>}
                          {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" />{c.email}</span>}
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 capitalize">
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Total: {companyContacts.length} contactos</span>
              <button
                onClick={() => setViewingContactsCompany(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
