'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  Opportunity, 
  Stage, 
  Company, 
  Contact, 
  Product, 
  Project,
  OpportunityCreateData, 
  OpportunityItemCreateData 
} from '@/types/crm';
import { 
  fetchOpportunities, 
  createOpportunity, 
  fetchStages, 
  fetchCompanies, 
  fetchContacts, 
  fetchProducts,
  fetchProjects 
} from '@/lib/api';
import { useCurrentUser } from '@/lib/useUser';
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Building2, 
  User as UserIcon, 
  MapPin, 
  Boxes, 
  Trash2, 
  X, 
  AlertTriangle, 
  Loader2, 
  CheckCircle,
  Eye,
  DollarSign
} from 'lucide-react';

function formatARS(amount: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function OpportunitiesPage() {
  const currentUser = useCurrentUser();

  // Data states
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageId, setSelectedStageId] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingOpportunity, setViewingOpportunity] = useState<Opportunity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [clientType, setClientType] = useState<'company' | 'contact'>('company');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [formStageId, setFormStageId] = useState('');
  
  // Materials in current quote
  const [quoteItems, setQuoteItems] = useState<OpportunityItemCreateData[]>([]);

  // Current item being added
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number>(10);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [oppsData, stagesData, compsData, contsData, prodsData, projsData] = await Promise.all([
        fetchOpportunities(),
        fetchStages(),
        fetchCompanies(),
        fetchContacts(),
        fetchProducts(),
        fetchProjects(),
      ]);
      setOpportunities(oppsData);
      setStages(stagesData);
      setCompanies(compsData);
      setContacts(contsData);
      setProducts(prodsData);
      setProjects(projsData);
      if (stagesData.length > 0 && !formStageId) {
        setFormStageId(stagesData[0].id);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchOpportunities(),
      fetchStages(),
      fetchCompanies(),
      fetchContacts(),
      fetchProducts(),
      fetchProjects(),
    ])
      .then(([oppsData, stagesData, compsData, contsData, prodsData, projsData]) => {
        if (!isMounted) return;
        setOpportunities(oppsData);
        setStages(stagesData);
        setCompanies(compsData);
        setContacts(contsData);
        setProducts(prodsData);
        setProjects(projsData);
        if (stagesData.length > 0) {
          setFormStageId(stagesData[0].id);
        }
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

  // Filtered Opportunities
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      const matchesSearch = 
        opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (opp.delivery_location && opp.delivery_location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (opp.company_name && opp.company_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (opp.contact_name && opp.contact_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStage = selectedStageId === 'all' || opp.stage_id === selectedStageId;
      return matchesSearch && matchesStage;
    });
  }, [opportunities, searchQuery, selectedStageId]);

  // Selected product object for the adder
  const currentSelectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Total amount of current draft quote
  const currentDraftTotal = useMemo(() => {
    return quoteItems.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
  }, [quoteItems]);

  const handleOpenCreateModal = () => {
    setFormTitle('');
    setClientType('company');
    setSelectedCompanyId(companies[0]?.id || '');
    setSelectedContactId(contacts[0]?.id || '');
    setDeliveryLocation('');
    setFormStageId(stages[0]?.id || '');
    setQuoteItems([]);
    setSelectedProductId(products[0]?.id || '');
    setItemQuantity(10);
    setIsCreateModalOpen(true);
  };

  const handleAddItemToQuote = () => {
    if (!currentSelectedProduct) return;
    if (itemQuantity <= 0) return;

    const newItem: OpportunityItemCreateData = {
      product_id: currentSelectedProduct.id,
      product_name: currentSelectedProduct.name,
      unit: currentSelectedProduct.unit,
      quantity: itemQuantity,
      unit_price: Number(currentSelectedProduct.unit_price),
    };

    setQuoteItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItemFromQuote = (index: number) => {
    setQuoteItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setErrorMsg('Debes ingresar un título para el presupuesto.');
      return;
    }

    if (clientType === 'company' && !selectedCompanyId) {
      setErrorMsg('Debes seleccionar una empresa contratista.');
      return;
    }

    if (clientType === 'contact' && !selectedContactId) {
      setErrorMsg('Debes seleccionar un contacto de obra.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: OpportunityCreateData = {
        title: formTitle.trim(),
        company_id: clientType === 'company' ? selectedCompanyId : undefined,
        contact_id: clientType === 'contact' ? selectedContactId : undefined,
        project_id: selectedProjectId || undefined,
        assigned_to: currentUser?.id || '00000000-0000-0000-0000-000000000001',
        stage_id: formStageId || (stages[0]?.id ?? ''),
        status: 'abierta',
        currency: 'ARS',
        delivery_location: deliveryLocation.trim() || undefined,
        items: quoteItems,
      };

      await createOpportunity(payload);
      setSuccessMsg('¡Presupuesto comercial creado y registrado con éxito!');
      setIsCreateModalOpen(false);
      setSelectedProjectId('');
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar el presupuesto');
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
              <FileSpreadsheet className="w-7 h-7 text-blue-600" />
              Presupuestos de Materiales (Oportunidades)
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Cotizaciones comerciales para obras de contratistas con materiales del catálogo y cálculo de montos.
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Nuevo Presupuesto
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

        {/* Pestañas de Etapas del Embudo */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedStageId('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedStageId === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Todas las Etapas ({opportunities.length})
          </button>
          {stages.map((stg) => {
            const count = opportunities.filter((o) => o.stage_id === stg.id).length;
            const isSelected = selectedStageId === stg.id;
            return (
              <button
                key={stg.id}
                onClick={() => setSelectedStageId(stg.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{stg.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Barra de Búsqueda */}
        <div className="flex items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por título de presupuesto, contratista o destino de obra..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden sm:inline">
            {filteredOpportunities.length} presupuestos
          </span>
        </div>

        {/* Listado de Presupuestos */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2 bg-white rounded-xl border border-slate-200">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm">Cargando presupuestos de materiales...</p>
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2 bg-white rounded-xl border border-slate-200">
            <FileSpreadsheet className="w-10 h-10 text-slate-300" />
            <p className="font-semibold text-slate-700">No hay presupuestos registrados</p>
            <p className="text-xs text-slate-400">Comienza armando una nueva cotización con los materiales del catálogo.</p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear primer presupuesto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOpportunities.map((opp) => {
              return (
                <div
                  key={opp.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        {opp.stage_name || 'En negociación'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        {opp.items.length} {opp.items.length === 1 ? 'material' : 'materiales'}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base mt-2.5 leading-snug">
                      {opp.title}
                    </h3>

                    {/* Cliente vinculado */}
                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      {opp.company_name ? (
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{opp.company_name}</span>
                        </div>
                      ) : opp.contact_name ? (
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <UserIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{opp.contact_name}</span>
                        </div>
                      ) : null}

                      {opp.project_name && (
                        <div className="flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50/60 px-2 py-0.5 rounded-md border border-emerald-100">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">Obra: {opp.project_name}</span>
                        </div>
                      )}

                      {opp.delivery_location && !opp.project_name && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{opp.delivery_location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pie de la tarjeta: Monto y Acciones */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monto Total</span>
                      <p className="text-base font-black text-slate-900 leading-tight">
                        {formatARS(Number(opp.estimated_value))}
                      </p>
                    </div>

                    <button
                      onClick={() => setViewingOpportunity(opp)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver Items
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Crear Presupuesto */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Armar Presupuesto Comercial</h2>
                    <p className="text-xs text-slate-500">Cotización de materiales para contratistas y obras</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
                {/* Título de la Oportunidad */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Título o Referencia del Presupuesto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Presupuesto Cemento y Hierros - Edificio Mitre"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Selección de Cliente */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Tipo de Cliente *
                    </label>
                    <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => setClientType('company')}
                        className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                          clientType === 'company' ? 'bg-white shadow-xs text-blue-700' : 'text-slate-600'
                        }`}
                      >
                        Empresa Contratista
                      </button>
                      <button
                        type="button"
                        onClick={() => setClientType('contact')}
                        className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                          clientType === 'contact' ? 'bg-white shadow-xs text-blue-700' : 'text-slate-600'
                        }`}
                      >
                        Contacto Particular
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      {clientType === 'company' ? 'Empresa Seleccionada *' : 'Contacto Seleccionado *'}
                    </label>
                    {clientType === 'company' ? (
                      <select
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="">-- Seleccionar Empresa --</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} {c.cuit ? `(${c.cuit})` : ''}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={selectedContactId}
                        onChange={(e) => setSelectedContactId(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="">-- Seleccionar Contacto --</option>
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.job_title ? `(${c.job_title})` : ''}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Selección de Obra / Proyecto (Opcional pero recomendado para el corralón) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase text-slate-500">
                      Vincular a Obra / Proyecto (Opcional)
                    </label>
                    <span className="text-xs text-blue-600 font-medium">Autocompleta dirección de descarga</span>
                  </div>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      setSelectedProjectId(pId);
                      if (pId) {
                        const proj = projects.find((p) => p.id === pId);
                        if (proj) {
                          setDeliveryLocation(proj.address);
                        }
                      }
                    }}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    <option value="">-- Sin vincular a obra específica --</option>
                    {projects
                      .filter((p) => {
                        if (clientType === 'company' && selectedCompanyId) {
                          return p.company_id === selectedCompanyId;
                        }
                        if (clientType === 'contact' && selectedContactId) {
                          return p.contact_id === selectedContactId;
                        }
                        return true;
                      })
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.address} ({p.status})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Destino de entrega y Etapa */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Dirección de Obra / Destino de Entrega
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Av. Rivadavia 12400, Ramos Mejía"
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Etapa Inicial del Embudo *
                    </label>
                    <select
                      value={formStageId}
                      onChange={(e) => setFormStageId(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {stages.map((stg) => (
                        <option key={stg.id} value={stg.id}>{stg.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Armador de Items desde el Catálogo */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-blue-600" />
                      Materiales a Cotizar (desde Catálogo)
                    </h3>
                    <span className="text-xs font-semibold text-slate-500">
                      {quoteItems.length} agregados
                    </span>
                  </div>

                  {/* Selector y Cantidad */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Material del Catálogo</label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name} ({formatARS(Number(p.unit_price))} / {p.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItemToQuote}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shrink-0"
                    >
                      + Agregar
                    </button>
                  </div>

                  {/* Tabla de Items Agregados */}
                  {quoteItems.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2 font-bold">Material</th>
                            <th className="px-3 py-2 font-bold text-center">Unidad</th>
                            <th className="px-3 py-2 font-bold text-right">Cant.</th>
                            <th className="px-3 py-2 font-bold text-right">P. Unit.</th>
                            <th className="px-3 py-2 font-bold text-right">Subtotal</th>
                            <th className="px-3 py-2 font-bold text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {quoteItems.map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60">
                              <td className="px-3 py-2 font-medium text-slate-800">{it.product_name}</td>
                              <td className="px-3 py-2 text-center text-slate-500">{it.unit}</td>
                              <td className="px-3 py-2 text-right font-semibold">{it.quantity}</td>
                              <td className="px-3 py-2 text-right text-slate-600">{formatARS(it.unit_price)}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900">
                                {formatARS(it.quantity * it.unit_price)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemFromQuote(idx)}
                                  className="text-rose-500 hover:text-rose-700 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                          <tr>
                            <td colSpan={4} className="px-3 py-2.5 text-right text-slate-700 uppercase tracking-wider">
                              Total Presupuestado:
                            </td>
                            <td className="px-3 py-2.5 text-right text-sm text-blue-700 font-black">
                              {formatARS(currentDraftTotal)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                      Todavía no agregaste materiales a este presupuesto. Selecciona del catálogo arriba y presiona &quot;+ Agregar&quot;.
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Guardando Presupuesto...
                      </>
                    ) : (
                      'Guardar Presupuesto'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Ver Detalle de Presupuesto */}
        {viewingOpportunity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                    {viewingOpportunity.stage_name || 'En preparación'}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">{viewingOpportunity.title}</h2>
                </div>
                <button
                  onClick={() => setViewingOpportunity(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {/* Datos del Cliente y Entrega */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 w-24">Cliente:</span>
                    <span className="font-semibold text-slate-800">
                      {viewingOpportunity.company_name || viewingOpportunity.contact_name || 'Sin especificar'}
                    </span>
                  </div>
                  {viewingOpportunity.delivery_location && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-500 w-24">Destino Obra:</span>
                      <span className="text-slate-700">{viewingOpportunity.delivery_location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 w-24">Fecha:</span>
                    <span className="text-slate-700">{new Date(viewingOpportunity.created_at).toLocaleDateString('es-AR')}</span>
                  </div>
                </div>

                {/* Lista de Materiales Cotizados */}
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-700 mb-2 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-blue-600" />
                    Materiales Incluidos ({viewingOpportunity.items.length})
                  </h3>
                  {viewingOpportunity.items.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2 font-bold">Material</th>
                            <th className="px-3 py-2 font-bold text-center">Unidad</th>
                            <th className="px-3 py-2 font-bold text-right">Cant.</th>
                            <th className="px-3 py-2 font-bold text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {viewingOpportunity.items.map((it) => (
                            <tr key={it.id}>
                              <td className="px-3 py-2 font-medium text-slate-800">{it.product_name}</td>
                              <td className="px-3 py-2 text-center text-slate-500">{it.unit}</td>
                              <td className="px-3 py-2 text-right font-semibold">{it.quantity}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900">
                                {formatARS(Number(it.subtotal))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No se detallaron items individuales.</p>
                  )}
                </div>

                {/* Total */}
                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    Monto Total Presupuestado:
                  </div>
                  <span className="text-lg font-black text-blue-700">
                    {formatARS(Number(viewingOpportunity.estimated_value))}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setViewingOpportunity(null)}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
                >
                  Cerrar Detalle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
