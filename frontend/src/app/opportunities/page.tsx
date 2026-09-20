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
  OpportunityItemCreateData,
  OpportunityUpdateData,
  Activity,
  ActivityType,
  ActivityFormData,
  ActivePipelineMetric
} from '@/types/crm';
import { 
  fetchOpportunities, 
  createOpportunity, 
  updateOpportunity,
  fetchStages, 
  fetchCompanies, 
  fetchContacts, 
  fetchProducts,
  fetchProjects,
  fetchOpportunityActivities,
  createActivity,
  fetchActivePipelineMetric
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
  DollarSign,
  Kanban,
  List,
  ChevronRight,
  ChevronLeft,
  Trophy,
  XCircle,
  Clock,
  Sparkles,
  Phone,
  MessageSquare,
  Users,
  Store,
  Mail,
  FileText,
  Activity as ActivityIcon,
  ShieldAlert,
  Flame,
  Filter
} from 'lucide-react';

function formatARS(amount: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

const LOSS_REASONS = [
  'Precio / Presupuesto más caro',
  'Plazo de entrega prolongado',
  'Eligió otro corralón competidor',
  'Obra frenada o postergada',
  'No hubo acuerdo en condiciones de financiación',
  'Falta de respuesta del contratista',
  'Faltante o quiebre de stock de materiales',
  'Otro motivo particular'
];

export default function OpportunitiesPage() {
  const currentUser = useCurrentUser();

  // Data states
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [nsmMetric, setNsmMetric] = useState<ActivePipelineMetric | null>(null);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageId, setSelectedStageId] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'warning' | 'stale'>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Drag and Drop State
  const [draggingOppId, setDraggingOppId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingOpportunity, setViewingOpportunity] = useState<Opportunity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Activities Drawer / Modal State
  const [activityOpp, setActivityOpp] = useState<Opportunity | null>(null);
  const [activitiesList, setActivitiesList] = useState<Activity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [newActivityType, setNewActivityType] = useState<ActivityType>('llamada');
  const [newActivitySummary, setNewActivitySummary] = useState('');
  const [newActivityDesc, setNewActivityDesc] = useState('');
  const [isSavingActivity, setIsSavingActivity] = useState(false);

  // Transition Modals
  const [winModalOpp, setWinModalOpp] = useState<Opportunity | null>(null);
  const [winTargetStageId, setWinTargetStageId] = useState<string>('');
  const [winFinalValue, setWinFinalValue] = useState<string>('');

  const [lostModalOpp, setLostModalOpp] = useState<Opportunity | null>(null);
  const [lostTargetStageId, setLostTargetStageId] = useState<string>('');
  const [lostReason, setLostReason] = useState<string>(LOSS_REASONS[0]);

  // Form State for creation
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
      const [oppsData, stagesData, compsData, contsData, prodsData, projsData, nsmData] = await Promise.all([
        fetchOpportunities(),
        fetchStages(),
        fetchCompanies(),
        fetchContacts(),
        fetchProducts(),
        fetchProjects(),
        fetchActivePipelineMetric(7).catch(() => null),
      ]);
      setOpportunities(oppsData);
      setStages(stagesData);
      setCompanies(compsData);
      setContacts(contsData);
      setProducts(prodsData);
      setProjects(projsData);
      if (nsmData) setNsmMetric(nsmData);
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
      fetchActivePipelineMetric(7).catch(() => null),
    ])
      .then(([oppsData, stagesData, compsData, contsData, prodsData, projsData, nsmData]) => {
        if (!isMounted) return;
        setOpportunities(oppsData);
        setStages(stagesData);
        setCompanies(compsData);
        setContacts(contsData);
        setProducts(prodsData);
        setProjects(projsData);
        if (nsmData) setNsmMetric(nsmData);
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
      const matchesHealth = healthFilter === 'all' || opp.health_status === healthFilter;
      return matchesSearch && matchesStage && matchesHealth;
    });
  }, [opportunities, searchQuery, selectedStageId, healthFilter]);

  // Stage sorted by position
  const sortedStages = useMemo(() => {
    return [...stages].sort((a, b) => a.position - b.position);
  }, [stages]);

  // Pipeline metrics
  const pipelineMetrics = useMemo(() => {
    const openOpps = opportunities.filter((o) => o.status === 'abierta');
    const wonOpps = opportunities.filter((o) => o.status === 'ganada');
    const lostOpps = opportunities.filter((o) => o.status === 'perdida');
    
    const openTotal = openOpps.reduce((acc, o) => acc + Number(o.estimated_value || 0), 0);
    const wonTotal = wonOpps.reduce((acc, o) => acc + Number(o.estimated_value || 0), 0);

    const healthyCount = openOpps.filter((o) => o.health_status === 'healthy').length;
    const warningCount = openOpps.filter((o) => o.health_status === 'warning').length;
    const staleCount = openOpps.filter((o) => o.health_status === 'stale').length;
    
    return {
      openCount: openOpps.length,
      openTotal,
      wonCount: wonOpps.length,
      wonTotal,
      lostCount: lostOpps.length,
      healthyCount,
      warningCount,
      staleCount,
    };
  }, [opportunities]);

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
    setSelectedProjectId('');
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
      setSuccessMsg('¡Presupuesto comercial registrado con éxito!');
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

  // Open Activities Timeline
  const handleOpenActivities = async (opp: Opportunity) => {
    setActivityOpp(opp);
    setNewActivitySummary('');
    setNewActivityDesc('');
    setNewActivityType('llamada');
    setIsLoadingActivities(true);
    try {
      const acts = await fetchOpportunityActivities(opp.id);
      setActivitiesList(acts);
    } catch {
      setActivitiesList([]);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityOpp) return;
    if (!newActivitySummary.trim()) {
      setErrorMsg('Debes ingresar un resumen de la actividad.');
      return;
    }

    setIsSavingActivity(true);
    try {
      const payload: ActivityFormData = {
        opportunity_id: activityOpp.id,
        company_id: activityOpp.company_id || undefined,
        contact_id: activityOpp.contact_id || undefined,
        activity_type: newActivityType,
        summary: newActivitySummary.trim(),
        description: newActivityDesc.trim() || undefined,
      };
      await createActivity(payload);
      setSuccessMsg('¡Actividad registrada! Se actualizó la salud comercial de la oportunidad.');
      setNewActivitySummary('');
      setNewActivityDesc('');
      const updatedActs = await fetchOpportunityActivities(activityOpp.id);
      setActivitiesList(updatedActs);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar la actividad');
    } finally {
      setIsSavingActivity(false);
    }
  };

  // Stage transition initiator
  const triggerStageChange = (opp: Opportunity, targetStage: Stage) => {
    if (opp.stage_id === targetStage.id) return;

    if (targetStage.is_closed_won) {
      setWinModalOpp(opp);
      setWinTargetStageId(targetStage.id);
      setWinFinalValue(String(opp.estimated_value || ''));
      return;
    }

    if (targetStage.is_closed_lost) {
      setLostModalOpp(opp);
      setLostTargetStageId(targetStage.id);
      setLostReason(LOSS_REASONS[0]);
      return;
    }

    // Normal transition
    executeStageTransition(opp.id, {
      stage_id: targetStage.id,
      status: 'abierta',
    }, `Presupuesto movido a "${targetStage.name}"`);
  };

  const executeStageTransition = async (oppId: string, data: OpportunityUpdateData, successText: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await updateOpportunity(oppId, data);
      setSuccessMsg(successText);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al actualizar la etapa del presupuesto');
    } finally {
      setIsSubmitting(false);
      setWinModalOpp(null);
      setLostModalOpp(null);
      setDraggingOppId(null);
      setDragOverStageId(null);
    }
  };

  const handleConfirmWon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!winModalOpp) return;
    const finalVal = parseFloat(winFinalValue);
    if (isNaN(finalVal) || finalVal < 0) {
      setErrorMsg('Debes ingresar un monto válido acordado.');
      return;
    }

    await executeStageTransition(winModalOpp.id, {
      stage_id: winTargetStageId,
      status: 'ganada',
      estimated_value: finalVal,
    }, `🎉 ¡Venta Concretada! Presupuesto #${winModalOpp.title} cerrado como Ganado.`);
  };

  const handleConfirmLost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lostModalOpp) return;
    if (!lostReason) {
      setErrorMsg('Debes seleccionar el motivo de pérdida.');
      return;
    }

    await executeStageTransition(lostModalOpp.id, {
      stage_id: lostTargetStageId,
      status: 'perdida',
      loss_reason: lostReason,
    }, `Presupuesto marcado como Perdido (${lostReason}).`);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    e.dataTransfer.setData('text/plain', oppId);
    setDraggingOppId(oppId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = (e: React.DragEvent, targetStage: Stage) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData('text/plain');
    setDragOverStageId(null);
    setDraggingOppId(null);

    const opp = opportunities.find((o) => o.id === oppId);
    if (opp) {
      triggerStageChange(opp, targetStage);
    }
  };

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'llamada':
        return <Phone className="w-3.5 h-3.5 text-blue-600" />;
      case 'whatsapp':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />;
      case 'visita_obra':
        return <MapPin className="w-3.5 h-3.5 text-purple-600" />;
      case 'mostrador':
        return <Store className="w-3.5 h-3.5 text-amber-600" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-sky-600" />;
      case 'reunion':
        return <Users className="w-3.5 h-3.5 text-indigo-600" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Encabezado y Selector de Vistas */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Tablero Comercial y Oportunidades Activas
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Embudo comercial de corralón con North Star Metric (NSM): seguimiento en tiempo real y semáforo de actividad.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {/* View Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'kanban' 
                    ? 'bg-white text-blue-700 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                Tablero Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'list' 
                    ? 'bg-white text-blue-700 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Vista Lista
              </button>
            </div>

            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Nuevo Presupuesto
            </button>
          </div>
        </div>

        {/* WIDGET NORTH STAR METRIC (NSM): PIPELINE ACTIVO REAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tarjeta NSM 1: Pipeline Activo Real */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4 rounded-2xl border border-emerald-300 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                Pipeline Activo Real (NSM ≤ 7d)
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-black bg-emerald-100 text-emerald-800 rounded-md">
                {nsmMetric ? `${Math.round(nsmMetric.pipeline_health_ratio * 100)}% sano` : 'Al día'}
              </span>
            </div>
            <p className="text-xl font-black text-emerald-950 mt-1.5">
              {formatARS(nsmMetric ? nsmMetric.active_opportunities_amount : pipelineMetrics.openTotal)}
            </p>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
              {nsmMetric ? nsmMetric.active_opportunities_count : pipelineMetrics.healthyCount} presupuestos con contacto reciente
            </p>
          </div>

          {/* Tarjeta NSM 2: En Riesgo o Fríos */}
          <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Requieren Contacto
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-md">
                {pipelineMetrics.warningCount + pipelineMetrics.staleCount} sin atención
              </span>
            </div>
            <p className="text-xl font-black text-slate-900 mt-1.5">
              {formatARS(nsmMetric ? nsmMetric.stale_opportunities_amount : 0)}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Cotizaciones de materiales sin seguimiento en &gt; 7 días
            </p>
          </div>

          {/* Tarjeta 3: Ventas Concretadas */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-blue-600" />
                Ventas Concretadas
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded-md">
                {pipelineMetrics.wonCount} cerradas
              </span>
            </div>
            <p className="text-xl font-black text-slate-900 mt-1.5">
              {formatARS(pipelineMetrics.wonTotal)}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Monto final acordado ingresado al corralón
            </p>
          </div>

          {/* Tarjeta 4: Total en Negociación */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Total Oportunidades Abiertas
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md">
                {pipelineMetrics.openCount} totales
              </span>
            </div>
            <p className="text-xl font-black text-slate-900 mt-1.5">
              {formatARS(pipelineMetrics.openTotal)}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Suma global de presupuestos en proceso
            </p>
          </div>
        </div>

        {/* Notificaciones */}
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Barra de Búsqueda y Filtro de Semáforo Comercial NSM */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por título, empresa contratista, contacto o destino de entrega..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Filtro por Semáforo de Actividad (NSM) */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <span className="text-[10px] font-bold text-slate-500 px-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Salud:
            </span>
            <button
              type="button"
              onClick={() => setHealthFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                healthFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter('healthy')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                healthFilter === 'healthy' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Al día (≤7d)
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter('warning')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                healthFilter === 'warning' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              En riesgo (8-14d)
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter('stale')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                healthFilter === 'stale' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Estancadas (&gt;14d)
            </button>
          </div>

          {/* Filtro por Etapa */}
          <select
            value={selectedStageId}
            onChange={(e) => setSelectedStageId(e.target.value)}
            className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">Todas las etapas</option>
            {stages.map((stg) => (
              <option key={stg.id} value={stg.id}>
                {stg.name}
              </option>
            ))}
          </select>
        </div>

        {/* Contenido: Tablero Kanban o Lista */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            <p className="text-sm font-semibold">Cargando tablero y presupuestos de obra...</p>
          </div>
        ) : viewMode === 'kanban' ? (
          /* TABLERO KANBAN DE 6 ETAPAS CON SEMÁFORO NSM */
          <div className="overflow-x-auto pb-4 pt-1">
            <div className="inline-flex gap-4 min-w-[1240px] items-start">
              {sortedStages.map((stg, stgIdx) => {
                const stageOpps = filteredOpportunities.filter((opp) => opp.stage_id === stg.id);
                const stageTotal = stageOpps.reduce((acc, o) => acc + Number(o.estimated_value || 0), 0);
                const isDragOver = dragOverStageId === stg.id;

                let headerBg = 'bg-slate-100/90 text-slate-800 border-slate-200';
                let badgeColor = 'bg-slate-200 text-slate-700';

                if (stg.is_closed_won) {
                  headerBg = 'bg-emerald-50 text-emerald-900 border-emerald-200';
                  badgeColor = 'bg-emerald-100 text-emerald-800';
                } else if (stg.is_closed_lost) {
                  headerBg = 'bg-rose-50 text-rose-900 border-rose-200';
                  badgeColor = 'bg-rose-100 text-rose-800';
                } else if (stg.position === 1) {
                  headerBg = 'bg-sky-50 text-sky-900 border-sky-200';
                  badgeColor = 'bg-sky-100 text-sky-800';
                } else if (stg.position === 2) {
                  headerBg = 'bg-amber-50 text-amber-900 border-amber-200';
                  badgeColor = 'bg-amber-100 text-amber-800';
                } else if (stg.position === 3) {
                  headerBg = 'bg-indigo-50 text-indigo-900 border-indigo-200';
                  badgeColor = 'bg-indigo-100 text-indigo-800';
                } else if (stg.position === 4) {
                  headerBg = 'bg-violet-50 text-violet-900 border-violet-200';
                  badgeColor = 'bg-violet-100 text-violet-800';
                }

                return (
                  <div
                    key={stg.id}
                    onDragOver={(e) => handleDragOver(e, stg.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, stg)}
                    className={`w-80 shrink-0 flex flex-col rounded-2xl transition-all duration-150 ${
                      isDragOver 
                        ? 'bg-blue-50/70 ring-2 ring-blue-500 ring-dashed' 
                        : 'bg-slate-50/70 border border-slate-200/90'
                    }`}
                  >
                    {/* Encabezado de Columna */}
                    <div className={`p-3 rounded-t-2xl border-b ${headerBg}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stg.color || '#3b82f6' }} />
                          <h2 className="text-xs font-black tracking-tight">{stg.name}</h2>
                        </div>
                        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${badgeColor}`}>
                          {stageOpps.length}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px]">
                        <span className="font-semibold opacity-70">Total columna:</span>
                        <span className="font-black">{formatARS(stageTotal)}</span>
                      </div>
                    </div>

                    {/* Contenedor de Tarjetas */}
                    <div className="p-2.5 space-y-2.5 min-h-[420px] max-h-[calc(100vh-280px)] overflow-y-auto">
                      {stageOpps.length === 0 ? (
                        <div className="h-32 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-center p-3 text-slate-400 text-xs">
                          Arrastrá presupuestos aquí
                        </div>
                      ) : (
                        stageOpps.map((opp) => {
                          const isDragging = draggingOppId === opp.id;
                          const daysSince = opp.days_since_last_activity ?? 0;
                          
                          // Semáforo NSM badge
                          let healthBadge = (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Al día ({daysSince}d)
                            </span>
                          );
                          if (opp.health_status === 'warning') {
                            healthBadge = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                En riesgo ({daysSince}d)
                              </span>
                            );
                          } else if (opp.health_status === 'stale') {
                            healthBadge = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Estancada ({daysSince > 0 ? `${daysSince}d` : 'sin seg.'})
                              </span>
                            );
                          }

                          return (
                            <div
                              key={opp.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, opp.id)}
                              className={`bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-grab active:cursor-grabbing group ${
                                isDragging ? 'opacity-40 scale-98 ring-2 ring-blue-400' : ''
                              }`}
                            >
                              {/* Tarjeta: Título y Cantidad de Materiales */}
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">
                                  {opp.title}
                                </h3>
                                <span className="text-[10px] font-bold text-slate-400 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {opp.items.length} {opp.items.length === 1 ? 'mat.' : 'mats.'}
                                </span>
                              </div>

                              {/* Cliente y Obra */}
                              <div className="mt-2 space-y-1 text-xs text-slate-600">
                                {opp.company_name ? (
                                  <div className="flex items-center gap-1.5 font-medium text-slate-800 truncate">
                                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span className="truncate">{opp.company_name}</span>
                                  </div>
                                ) : opp.contact_name ? (
                                  <div className="flex items-center gap-1.5 font-medium text-slate-800 truncate">
                                    <UserIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span className="truncate">{opp.contact_name}</span>
                                  </div>
                                ) : null}

                                {opp.project_name ? (
                                  <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 truncate">
                                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span className="truncate">Obra: {opp.project_name}</span>
                                  </div>
                                ) : opp.delivery_location ? (
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{opp.delivery_location}</span>
                                  </div>
                                ) : null}

                                {opp.status === 'perdida' && opp.loss_reason && (
                                  <div className="text-[11px] font-medium text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                                    Motivo: {opp.loss_reason}
                                  </div>
                                )}
                              </div>

                              {/* Semáforo NSM de Seguimiento */}
                              {opp.status === 'abierta' && (
                                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                                  {healthBadge}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenActivities(opp)}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                                  >
                                    <ActivityIcon className="w-3 h-3" />
                                    Bitácora
                                  </button>
                                </div>
                              )}

                              {/* Monto Total Presupuestado */}
                              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-slate-400">Total Cotizado</span>
                                  <p className="text-xs font-black text-slate-900">
                                    {formatARS(Number(opp.estimated_value))}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setViewingOpportunity(opp)}
                                  className="text-slate-500 hover:text-blue-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                                  title="Ver desglose de materiales"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Acciones Rápidas de Cambio de Etapa */}
                              <div className="mt-2.5 pt-2 border-t border-slate-50 flex items-center justify-between gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                {/* Retroceder */}
                                {stgIdx > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => triggerStageChange(opp, sortedStages[stgIdx - 1])}
                                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold flex items-center gap-0.5"
                                    title={`Mover atrás a ${sortedStages[stgIdx - 1].name}`}
                                  >
                                    <ChevronLeft className="w-3 h-3" />
                                    Atrás
                                  </button>
                                ) : <div />}

                                <div className="flex items-center gap-1">
                                  {/* Cierre rápido Ganada */}
                                  {!stg.is_closed_won && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const wonStg = sortedStages.find((s) => s.is_closed_won);
                                        if (wonStg) triggerStageChange(opp, wonStg);
                                      }}
                                      className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-0.5"
                                      title="Cerrar como Venta Concretada"
                                    >
                                      <Trophy className="w-3 h-3" />
                                      Ganada
                                    </button>
                                  )}

                                  {/* Cierre rápido Perdida */}
                                  {!stg.is_closed_lost && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const lostStg = sortedStages.find((s) => s.is_closed_lost);
                                        if (lostStg) triggerStageChange(opp, lostStg);
                                      }}
                                      className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold flex items-center gap-0.5"
                                      title="Marcar como Perdida"
                                    >
                                      <XCircle className="w-3 h-3" />
                                    </button>
                                  )}

                                  {/* Avanzar */}
                                  {stgIdx < sortedStages.length - 1 && !stg.is_closed_won && !stg.is_closed_lost && (
                                    <button
                                      type="button"
                                      onClick={() => triggerStageChange(opp, sortedStages[stgIdx + 1])}
                                      className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold flex items-center gap-0.5"
                                      title={`Avanzar a ${sortedStages[stgIdx + 1].name}`}
                                    >
                                      Avanzar
                                      <ChevronRight className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* VISTA LISTA TRADICIONAL */
          filteredOpportunities.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-200">
              <FileSpreadsheet className="w-10 h-10 text-slate-300" />
              <p className="font-semibold text-slate-700">No se encontraron presupuestos</p>
              <p className="text-xs text-slate-400">Intenta con otro término de búsqueda o cambia el filtro de salud.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOpportunities.map((opp) => {
                const currentStage = stages.find((s) => s.id === opp.stage_id);
                return (
                  <div
                    key={opp.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Header de la tarjeta */}
                      <div className="flex items-start justify-between gap-2">
                        <span 
                          className="text-[11px] font-bold px-2 py-0.5 rounded-md text-slate-800"
                          style={{ backgroundColor: `${currentStage?.color || '#3b82f6'}20`, color: currentStage?.color || '#1e40af' }}
                        >
                          {opp.stage_name || 'En negociación'}
                        </span>
                        
                        {opp.status === 'abierta' && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            opp.health_status === 'healthy' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : opp.health_status === 'warning' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {opp.health_status === 'healthy' ? '🟢 Al día' : opp.health_status === 'warning' ? '🟡 En riesgo' : '🔴 Estancada'}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-slate-900 text-base mt-2.5 leading-snug">
                        {opp.title}
                      </h3>

                      {/* Cliente y Obra vinculados */}
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

                        {opp.loss_reason && (
                          <div className="text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                            Motivo de pérdida: {opp.loss_reason}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pie: Monto y Acciones */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monto Total</span>
                        <p className="text-base font-black text-slate-900 leading-tight">
                          {formatARS(Number(opp.estimated_value))}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenActivities(opp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <ActivityIcon className="w-3.5 h-3.5" />
                          Seguimiento
                        </button>

                        <button
                          onClick={() => setViewingOpportunity(opp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Items
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* MODAL: Bitácora de Actividades y Seguimiento Comercial (NSM) */}
        {activityOpp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <ActivityIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Bitácora de Seguimiento Comercial</h2>
                    <p className="text-xs text-slate-500 truncate max-w-sm">{activityOpp.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setActivityOpp(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {/* Formulario para registrar nuevo hecho comercial */}
                <form onSubmit={handleSaveActivity} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                    + Registrar Nueva Interacción
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo de Actividad</label>
                      <select
                        value={newActivityType}
                        onChange={(e) => setNewActivityType(e.target.value as ActivityType)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="llamada">Llamada telefónica</option>
                        <option value="whatsapp">WhatsApp / Mensaje</option>
                        <option value="visita_obra">Visita a la obra</option>
                        <option value="mostrador">Atención en mostrador</option>
                        <option value="email">Correo electrónico</option>
                        <option value="reunion">Reunión con cliente</option>
                        <option value="nota">Nota interna de avance</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Resumen del Hecho *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Confirmó inicio de losa"
                        value={newActivitySummary}
                        onChange={(e) => setNewActivitySummary(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Detalle / Resultado (Opcional)</label>
                    <textarea
                      rows={2}
                      placeholder="Ej. Solicitó 150 bolsas de cemento Loma Negra y flete el viernes a primera hora."
                      value={newActivityDesc}
                      onChange={(e) => setNewActivityDesc(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingActivity}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5"
                    >
                      {isSavingActivity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Registrar Actividad
                    </button>
                  </div>
                </form>

                {/* Línea de tiempo cronológica inversa */}
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-700 mb-3 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Historial de Interacciones ({activitiesList.length})
                  </h3>

                  {isLoadingActivities ? (
                    <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-1.5">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      Cargando bitácora de seguimiento...
                    </div>
                  ) : activitiesList.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                      No hay actividades registradas todavía. Registra la primera arriba para actualizar el semáforo.
                    </div>
                  ) : (
                    <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                      {activitiesList.map((act) => (
                        <div key={act.id} className="relative flex items-start gap-3 pl-1">
                          <div className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 z-10">
                            {getActivityIcon(act.activity_type)}
                          </div>
                          <div className="flex-1 bg-slate-50/80 rounded-xl p-3 border border-slate-200 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">{act.summary}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(act.activity_date).toLocaleDateString('es-AR', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            {act.description && (
                              <p className="mt-1 text-slate-600 leading-relaxed">{act.description}</p>
                            )}
                            <div className="mt-2 text-[10px] text-slate-400">
                              Registrado por: <span className="font-semibold text-slate-600">{act.user_name || 'Vendedor'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setActivityOpp(null)}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Transición a Venta Concretada (Ganada) */}
        {winModalOpp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-emerald-100">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Confirmar Cierre de Venta (Ganada)</h2>
                  <p className="text-xs text-slate-500">Ajusta o confirma el monto final acordado con el cliente.</p>
                </div>
              </div>

              <form onSubmit={handleConfirmWon} className="py-4 space-y-4">
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-emerald-800 space-y-1">
                  <p className="font-bold">Presupuesto: {winModalOpp.title}</p>
                  <p>Cliente: {winModalOpp.company_name || winModalOpp.contact_name || 'Sin especificar'}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Valor Final Acordado ($ ARS) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={winFinalValue}
                      onChange={(e) => setWinFinalValue(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm font-bold text-slate-900 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Se registrará en el historial de ventas concretadas y actualizará los remitos del corralón.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setWinModalOpp(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Concretar Venta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Transición a Presupuesto Perdido */}
        {lostModalOpp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Registrar Causa de Pérdida</h2>
                  <p className="text-xs text-slate-500">Motivo por el cual el contratista no cerró la cotización.</p>
                </div>
              </div>

              <form onSubmit={handleConfirmLost} className="py-4 space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                  <p className="font-bold">Presupuesto: {lostModalOpp.title}</p>
                  <p>Monto cotizado: {formatARS(Number(lostModalOpp.estimated_value))}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Motivo Principal de Pérdida *
                  </label>
                  <select
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white"
                  >
                    {LOSS_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Permite al corralón analizar competitividad de precios, quiebres de stock y demoras logísticas.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setLostModalOpp(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Confirmar Pérdida
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Crear Presupuesto Comercial */}
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

                {/* Selección de Obra / Proyecto */}
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

        {/* MODAL: Ver Detalle de Presupuesto */}
        {viewingOpportunity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
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
                  {viewingOpportunity.project_name && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-500 w-24">Obra / Proyecto:</span>
                      <span className="font-semibold text-emerald-700">{viewingOpportunity.project_name}</span>
                    </div>
                  )}
                  {viewingOpportunity.delivery_location && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-500 w-24">Destino Obra:</span>
                      <span className="text-slate-700">{viewingOpportunity.delivery_location}</span>
                    </div>
                  )}
                  {viewingOpportunity.loss_reason && (
                    <div className="flex items-center gap-2 text-rose-700">
                      <span className="font-bold text-rose-500 w-24">Motivo Pérdida:</span>
                      <span className="font-semibold">{viewingOpportunity.loss_reason}</span>
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
