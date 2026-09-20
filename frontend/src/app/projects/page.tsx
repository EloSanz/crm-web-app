'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Project, ProjectType, ProjectStatus, ProjectFormData, Company, Contact } from '@/types/crm';
import { 
  fetchProjects, 
  createProject, 
  updateProject, 
  deleteProject, 
  fetchCompanies, 
  fetchContacts 
} from '@/lib/api';
import { 
  MapPin, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  AlertTriangle, 
  Loader2, 
  CheckCircle, 
  Building2, 
  User as UserIcon, 
  FileSpreadsheet
} from 'lucide-react';
import Link from 'next/link';

const PROJECT_TYPES: { label: string; value: ProjectType | 'all' }[] = [
  { label: 'Todos los Tipos', value: 'all' },
  { label: 'Vivienda Unifamiliar', value: 'vivienda_unifamiliar' },
  { label: 'Edificio Multifamiliar', value: 'edificio_multifamiliar' },
  { label: 'Comercial / Industrial', value: 'comercial_industrial' },
  { label: 'Refacción', value: 'refaccion' },
  { label: 'Obra Pública', value: 'obra_publica' },
];

const STATUS_FILTERS: { label: string; value: ProjectStatus | 'all' }[] = [
  { label: 'Todos los Estados', value: 'all' },
  { label: 'En Curso', value: 'en_curso' },
  { label: 'Planificación', value: 'planificacion' },
  { label: 'Frenada / Pausada', value: 'frenada' },
  { label: 'Finalizada', value: 'finalizada' },
];

const STATUS_BADGES: Record<ProjectStatus, { label: string; bg: string; text: string; border: string }> = {
  'en_curso': { label: 'En Curso', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'planificacion': { label: 'Planificación', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'frenada': { label: 'Frenada', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  'finalizada': { label: 'Finalizada', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
};

const TYPE_LABELS: Record<ProjectType, string> = {
  'vivienda_unifamiliar': 'Vivienda Unifamiliar',
  'edificio_multifamiliar': 'Edificio Multifamiliar',
  'comercial_industrial': 'Comercial / Industrial',
  'refaccion': 'Refacción',
  'obra_publica': 'Obra Pública',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    company_id: null,
    contact_id: null,
    address: '',
    project_type: 'vivienda_unifamiliar',
    status: 'en_curso',
    observations: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [projectsData, companiesData, contactsData] = await Promise.all([
        fetchProjects(),
        fetchCompanies(),
        fetchContacts(),
      ]);
      setProjects(projectsData);
      setCompanies(companiesData);
      setContacts(contactsData);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar las obras');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([fetchProjects(), fetchCompanies(), fetchContacts()])
      .then(([pData, cData, ctData]) => {
        if (!isMounted) return;
        setProjects(pData);
        setCompanies(cData);
        setContacts(ctData);
      })
      .catch((err: unknown) => {
        if (isMounted) setErrorMsg(err instanceof Error ? err.message : 'Error al conectar con la API');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const openCreateModal = () => {
    setEditingProject(null);
    setFormData({
      name: '',
      company_id: companies.length > 0 ? companies[0].id : null,
      contact_id: null,
      address: '',
      project_type: 'vivienda_unifamiliar',
      status: 'en_curso',
      observations: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setFormData({
      name: proj.name,
      company_id: proj.company_id || null,
      contact_id: proj.contact_id || null,
      address: proj.address,
      project_type: proj.project_type,
      status: proj.status,
      observations: proj.observations || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) {
      setErrorMsg('Nombre de la obra y dirección son requeridos.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingProject) {
        await updateProject(editingProject.id, formData);
        setSuccessMsg(`Obra "${formData.name}" actualizada con éxito.`);
      } else {
        await createProject(formData);
        setSuccessMsg(`Obra "${formData.name}" registrada con éxito.`);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar la obra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingProject) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await deleteProject(deletingProject.id);
      setSuccessMsg(`Obra "${deletingProject.name}" dada de baja.`);
      setDeletingProject(null);
      await loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al dar de baja la obra');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrado reactivo
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.company_name && p.company_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = selectedStatus === 'all' || p.status === selectedStatus;
      const matchType = selectedType === 'all' || p.project_type === selectedType;

      return matchSearch && matchStatus && matchType;
    });
  }, [projects, searchQuery, selectedStatus, selectedType]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header con título y botón de acción */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <MapPin className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Obras y Locaciones de Entrega</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Registro de obras en construcción para programar despachos de materiales, fletes y cotizaciones directas.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Obra
          </button>
        </div>

        {/* Notificaciones */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {successMsg}
            </span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por nombre, dirección o contratista..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Filtro de Estado */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Filtro de Tipo de Obra */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            >
              {PROJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de Obras */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
            <p className="text-sm text-slate-500 font-medium">Cargando obras del corralón...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No se encontraron obras</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">
              {searchQuery || selectedStatus !== 'all' || selectedType !== 'all'
                ? 'Probá ajustando los filtros o el término de búsqueda.'
                : 'Comenzá registrando la primera locación de entrega de tus clientes contratistas.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => {
              const badge = STATUS_BADGES[project.status] || STATUS_BADGES.en_curso;
              return (
                <div
                  key={project.id}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-200 hover:shadow-md transition-all p-5 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border} mb-2`}>
                          {badge.label}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {project.name}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          {TYPE_LABELS[project.project_type] || project.project_type}
                        </p>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(project)}
                          title="Editar obra"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingProject(project)}
                          title="Dar de baja"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Dirección de entrega */}
                    <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-xl text-xs text-slate-700">
                      <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <span className="font-medium leading-relaxed">{project.address}</span>
                    </div>

                    {/* Contratista y Contacto */}
                    <div className="space-y-1.5 pt-1 text-xs text-slate-600">
                      {project.company_name ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">{project.company_name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400 italic">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Particular / Sin empresa contratista</span>
                        </div>
                      )}

                      {project.contact_name && (
                        <div className="flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Resp. en obra: {project.contact_name}</span>
                        </div>
                      )}
                    </div>

                    {/* Observaciones de entrega */}
                    {project.observations && (
                      <p className="text-xs text-slate-500 italic line-clamp-2 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
                        "{project.observations}"
                      </p>
                    )}
                  </div>

                  {/* Footer de la tarjeta con acción para presupuestar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Registrada el {new Date(project.created_at).toLocaleDateString('es-AR')}
                    </span>
                    <Link
                      href={`/opportunities?project_id=${project.id}`}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Cotizar materiales
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de Crear / Editar Obra */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingProject ? 'Editar Obra' : 'Registrar Nueva Obra'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Identificación / Nombre de la Obra *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Torre Belgrano 450, Casa Lote 12"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Dirección física de descarga *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Av. Rivadavia 12300, Ramos Mejía"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Empresa Contratista
                    </label>
                    <select
                      value={formData.company_id || ''}
                      onChange={(e) => setFormData({ ...formData, company_id: e.target.value || null })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value="">-- Sin empresa / Particular --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Responsable en Obra
                    </label>
                    <select
                      value={formData.contact_id || ''}
                      onChange={(e) => setFormData({ ...formData, contact_id: e.target.value || null })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value="">-- Sin responsable asignado --</option>
                      {contacts.map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.first_name} {ct.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Tipo de Obra
                    </label>
                    <select
                      value={formData.project_type}
                      onChange={(e) => setFormData({ ...formData, project_type: e.target.value as ProjectType })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      {PROJECT_TYPES.filter((t) => t.value !== 'all').map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Estado Operativo
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      {STATUS_FILTERS.filter((s) => s.value !== 'all').map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Instrucciones de descarga / Observaciones
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ej. Requiere hidrogrúa. Entrar marcha atrás por calle angosta."
                    value={formData.observations || ''}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Obra'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Confirmación de Baja Lógica */}
        {deletingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">¿Dar de baja esta obra?</h3>
              <p className="text-sm text-slate-600 mt-2">
                La obra <strong className="text-slate-900">{deletingProject.name}</strong> en{' '}
                <span className="text-slate-800">{deletingProject.address}</span> pasará a estar inactiva. Los presupuestos ya generados conservarán su historial.
              </p>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setDeletingProject(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Confirmar Baja
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
