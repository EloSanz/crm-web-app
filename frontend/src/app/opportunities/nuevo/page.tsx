'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { DatePicker, toISODate } from '@/components/ui/DatePicker';
import { Segmented } from '@/components/ui/Segmented';
import { LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { LogoMark } from '@/components/brand/Logo';
import { QuoteItemsEditor, quoteTotals } from '@/components/opportunities/QuoteItemsEditor';
import type { OpportunityItemCreateData } from '@/types/crm';
import { createOpportunity, fetchCompanies, fetchContacts, fetchProducts, fetchProjects, fetchStages, fetchUsers } from '@/lib/api';
import { isManager } from '@/lib/roles';
import { useLoad } from '@/lib/useLoad';
import { useCurrentUser } from '@/lib/useUser';
import { CLIENT_STATUS } from '@/lib/catalogs';
import { formatARS, formatQty, sentenceCase } from '@/lib/format';

const load = async () => {
  const [companies, contacts, projects, products, stages, users] = await Promise.all([
    fetchCompanies(),
    fetchContacts(),
    fetchProjects(),
    fetchProducts(),
    fetchStages(),
    fetchUsers().catch(() => []),
  ]);
  return {
    users: users.filter((u) => u.is_active),
    companies,
    contacts,
    projects,
    products: products.filter((p) => p.is_active !== false),
    stages: [...stages].sort((a, b) => a.position - b.position).filter((s) => !s.is_closed_won && !s.is_closed_lost),
  };
};

const DRAFT_KEY = 'corralap:borrador-presupuesto';
const NEW = '__nuevo__';
/** A estas empresas no se les presupuesta (el backend también lo bloquea). */
const BLOCKED = new Set(['inactivo', 'no_contactar']);

interface Draft {
  clientType: 'company' | 'contact';
  companyId: string;
  contactId: string;
  pointContactId: string;
  assignedTo: string;
  projectId: string;
  delivery: string;
  title: string;
  stageId: string;
  closeDate: string;
  items: OpportunityItemCreateData[];
  discountPct?: number;
}

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
const TODAY = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

type QuoteData = Awaited<ReturnType<typeof load>>;

export default function NewOpportunityPage() {
  const { data, loading } = useLoad(load);
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader back={{ href: '/opportunities', label: 'Presupuestos' }} title="Nuevo presupuesto" />
        {loading || !data ? <LoadingBlock label="Preparando el formulario" rows={4} /> : <QuoteBuilder data={data} />}
      </div>
    </AppLayout>
  );
}

function QuoteBuilder({ data }: { data: QuoteData }) {
  const router = useRouter();
  const toast = useToast();
  const user = useCurrentUser();

  // Llegar desde una obra (?project_id=), desde la ficha del cliente (?company_id= / ?contact_id=)
  // o volviendo de crear una obra o un contacto (?borrador=1&nueva_obra= / &nuevo_contacto=).
  const [preset] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const draft = q.get('borrador') ? readDraft() : null;
    const newProject = q.get('nueva_obra') || q.get('project_id');
    const project = newProject ? data.projects.find((p) => p.id === newProject) ?? null : null;
    const newContact = q.get('nuevo_contacto');
    const base: Draft = draft ?? {
      clientType: 'company',
      companyId: project?.company_id ?? q.get('company_id') ?? '',
      contactId: project?.contact_id ?? q.get('contact_id') ?? '',
      pointContactId: '',
      assignedTo: '',
      projectId: '',
      delivery: '',
      title: '',
      stageId: '',
      closeDate: '',
      items: [],
    };
    if (!draft && !base.companyId && base.contactId) base.clientType = 'contact';
    if (project) {
      base.projectId = project.id;
      base.delivery = project.address;
    }
    if (newContact) {
      if (base.clientType === 'company') base.pointContactId = newContact;
      else base.contactId = newContact;
    }
    return base;
  });

  const [clientType, setClientType] = useState<'company' | 'contact'>(preset.clientType);
  const [companyId, setCompanyId] = useState(preset.companyId);
  const [contactId, setContactId] = useState(preset.contactId);
  const [pointContactId, setPointContactId] = useState(preset.pointContactId);
  const [assignedTo, setAssignedTo] = useState(preset.assignedTo || user?.id || '');
  const [projectId, setProjectId] = useState(preset.projectId);
  const [delivery, setDelivery] = useState(preset.delivery);
  const [title, setTitle] = useState(preset.title);
  const [stageId, setStageId] = useState(preset.stageId);
  const [closeDate, setCloseDate] = useState(preset.closeDate);
  const [items, setItems] = useState<OpportunityItemCreateData[]>(preset.items);
  const [discountPct, setDiscountPct] = useState(preset.discountPct ?? 0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ client?: string; title?: string }>({});

  const project = data.projects.find((p) => p.id === projectId) ?? null;
  const company = data.companies.find((c) => c.id === companyId) ?? null;
  const contact = data.contacts.find((c) => c.id === contactId) ?? null;
  const clientName = clientType === 'company' ? company?.name : contact ? `${contact.first_name} ${contact.last_name}` : undefined;
  const totals = quoteTotals(items, discountPct);
  const autoTitle = project ? `Materiales · ${project.name}` : '';
  const effectiveStage = stageId || data.stages[0]?.id || '';
  const canAssign = isManager(user);

  const projectOptions = useMemo(() => {
    const list = data.projects.filter((p) =>
      clientType === 'company' && companyId ? p.company_id === companyId : clientType === 'contact' && contactId ? p.contact_id === contactId : true
    );
    return [
      { value: '', label: 'Sin obra (compra directa)' },
      ...list.map((p) => ({ value: p.id, label: p.name, hint: p.address })),
      { value: NEW, label: 'Nueva obra', hint: 'Cargarla y volver a este presupuesto', icon: <Plus className="w-4 h-4 text-tiza" /> },
    ];
  }, [data, clientType, companyId, contactId]);

  const companyContacts = useMemo(() => data.contacts.filter((c) => c.company_id === companyId), [data, companyId]);

  /** Guarda lo cargado y va al alta de obra o contacto; al terminar vuelve acá con lo nuevo elegido. */
  const goCreate = (kind: 'obra' | 'contacto') => {
    const draft: Draft = { clientType, companyId, contactId, pointContactId, assignedTo, projectId, delivery, title, stageId, closeDate, items, discountPct };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* sin almacenamiento: se vuelve igual, sin borrador */
    }
    const params = new URLSearchParams({ volver: '/opportunities/nuevo' });
    if (clientType === 'company' && companyId) params.set('company_id', companyId);
    if (clientType === 'contact' && contactId && kind === 'obra') params.set('contact_id', contactId);
    router.push(`${kind === 'obra' ? '/projects/nueva' : '/contacts/nuevo'}?${params.toString()}`);
  };

  const save = async () => {
    const finalTitle = title.trim() || autoTitle;
    const next: typeof errors = {};
    if (clientType === 'company' ? !companyId : !contactId) next.client = 'Elegí el cliente';
    if (!finalTitle) next.title = 'Poné un nombre';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const created = await createOpportunity({
        title: finalTitle,
        company_id: clientType === 'company' ? companyId : undefined,
        contact_id: clientType === 'contact' ? contactId : pointContactId || undefined,
        project_id: projectId || undefined,
        // El vendedor siempre queda como responsable; admin y responsable comercial pueden asignar.
        assigned_to: canAssign ? assignedTo || undefined : undefined,
        stage_id: effectiveStage,
        status: 'abierta',
        currency: 'ARS',
        expected_close_date: closeDate || undefined,
        delivery_location: delivery.trim() || undefined,
        discount_pct: discountPct,
        items,
      });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* nada que limpiar */
      }
      toast.success('Presupuesto guardado', finalTitle);
      router.push(`/opportunities/${created.id}`);
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
      setSaving(false);
    }
  };

  return (
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="space-y-5"
            >
              <Block title="Cliente">
                <Segmented
                  label="Tipo de cliente"
                  value={clientType}
                  onChange={(v) => {
                    setClientType(v);
                    setProjectId('');
                  }}
                  options={[
                    { value: 'company', label: 'Empresa' },
                    { value: 'contact', label: 'Particular' },
                  ]}
                />
                {clientType === 'company' ? (
                  <Field label="Empresa" required error={errors.client}>
                    {({ id, invalid }) => (
                      <Select
                        id={id}
                        invalid={invalid}
                        value={companyId}
                        onChange={(v) => {
                          setCompanyId(v);
                          setProjectId('');
                          setPointContactId('');
                        }}
                        placeholder="Elegí una empresa"
                        searchable
                        options={data.companies.map((c) =>
                          BLOCKED.has(c.status)
                            ? { value: c.id, label: c.name, hint: `${CLIENT_STATUS[c.status].label}: no se le puede presupuestar`, disabled: true }
                            : { value: c.id, label: c.name, hint: c.cuit || c.industry || undefined }
                        )}
                      />
                    )}
                  </Field>
                ) : (
                  <Field label="Contacto" required error={errors.client}>
                    {({ id, invalid }) => (
                      <Select
                        id={id}
                        invalid={invalid}
                        value={contactId}
                        onChange={(v) => {
                          if (v === NEW) return goCreate('contacto');
                          setContactId(v);
                          setProjectId('');
                        }}
                        placeholder="Elegí un contacto"
                        searchable
                        options={[
                          ...data.contacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`, hint: c.company_name || c.job_title || undefined })),
                          { value: NEW, label: 'Nuevo contacto', hint: 'Cargarlo y volver', icon: <Plus className="w-4 h-4 text-tiza" /> },
                        ]}
                      />
                    )}
                  </Field>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {clientType === 'company' && (
                    <Field label="Punto de contacto">
                      {({ id }) => (
                        <Select
                          id={id}
                          value={pointContactId}
                          onChange={(v) => (v === NEW ? goCreate('contacto') : setPointContactId(v))}
                          disabled={!companyId}
                          placeholder={companyId ? 'Sin contacto' : 'Elegí la empresa primero'}
                          options={[
                            { value: '', label: 'Sin contacto' },
                            ...companyContacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`, hint: c.job_title || undefined })),
                            { value: NEW, label: 'Nuevo contacto', hint: 'Cargarlo y volver', icon: <Plus className="w-4 h-4 text-tiza" /> },
                          ]}
                        />
                      )}
                    </Field>
                  )}
                  {canAssign && (
                    <Field label="Responsable">
                      {({ id }) => (
                        <Select
                          id={id}
                          value={assignedTo}
                          onChange={setAssignedTo}
                          options={data.users.map((u) => ({ value: u.id, label: u.full_name, hint: u.role === 'ejecutivo_ventas' ? 'Vendedor' : u.role === 'admin' ? 'Administrador' : 'Responsable comercial' }))}
                        />
                      )}
                    </Field>
                  )}
                </div>
              </Block>

              <Block title="Obra y entrega">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Obra">
                    {({ id }) => (
                      <Select
                        id={id}
                        value={projectId}
                        onChange={(v) => {
                          if (v === NEW) return goCreate('obra');
                          setProjectId(v);
                          const p = data.projects.find((x) => x.id === v);
                          if (p) setDelivery(p.address);
                        }}
                        options={projectOptions}
                      />
                    )}
                  </Field>
                  <Field label="Dirección de entrega">
                    {({ id }) => <Input id={id} value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="Calle y número, localidad" />}
                  </Field>
                </div>
              </Block>

              <Block title="Presupuesto">
                <Field label="Nombre" required={!autoTitle} error={errors.title}>
                  {({ id, invalid }) => (
                    <Input
                      id={id}
                      aria-invalid={invalid}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={autoTitle || 'Ej.: Cemento y hierros · Edificio Mitre'}
                    />
                  )}
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Etapa">
                    {({ id }) => (
                      <Select id={id} value={effectiveStage} onChange={setStageId} options={data.stages.map((s) => ({ value: s.id, label: sentenceCase(s.name) }))} />
                    )}
                  </Field>
                  <Field label="Cierre estimado">
                    {({ id }) => <DatePicker id={id} value={closeDate} onChange={setCloseDate} min={toISODate(new Date())} placeholder="Sin fecha" />}
                  </Field>
                </div>
              </Block>

              <Block title="Materiales">
                <QuoteItemsEditor products={data.products} items={items} onChange={setItems} discountPct={discountPct} onDiscountChange={setDiscountPct} />
              </Block>
              <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
            </form>

            <aside className="xl:sticky xl:top-6" aria-label="Vista previa del presupuesto">
              <div className="overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
                <div className="sobre-pavonado grano-pavonado flex items-center gap-3 px-5 py-4 text-white">
                  <LogoMark className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-extrabold tracking-[-0.02em]">Presupuesto</p>
                    <p className="text-[13px] text-niebla">{TODAY.format(new Date())}</p>
                  </div>
                </div>
                <div className="space-y-4 px-5 py-5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-tiza">Para</p>
                    <p className="truncate text-[15px] font-bold">{clientName || '—'}</p>
                    {(project || delivery) && <p className="mt-0.5 text-[13px] text-tiza break-words">{project?.name ? `${project.name} · ` : ''}{delivery}</p>}
                  </div>
                  <div className="border-t border-dashed border-linea-fuerte pt-3">
                    {items.length === 0 ? (
                      <p className="py-6 text-center text-sm text-tiza">Agregá materiales</p>
                    ) : (
                      <ul className="space-y-2">
                        {items.map((it, i) => (
                          <li key={i} className="flex items-baseline gap-2 text-sm">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{it.product_name}</span>
                              <span className="cifra block text-[13px] text-tiza">{formatQty(it.quantity, it.unit)}</span>
                            </span>
                            <span className="cifra shrink-0 font-semibold">{formatARS(it.quantity * it.unit_price * (1 - (it.discount_pct ?? 0) / 100))}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {totals.discount > 0 && (
                    <div className="space-y-1 border-t border-linea pt-3 text-sm">
                      <p className="flex justify-between gap-3">
                        <span className="text-tiza">Subtotal</span>
                        <span className="cifra">{formatARS(totals.subtotal)}</span>
                      </p>
                      <p className="flex justify-between gap-3">
                        <span className="text-tiza">Descuento {discountPct}%</span>
                        <span className="cifra">− {formatARS(totals.discount)}</span>
                      </p>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-3 border-t border-linea pt-4">
                    <span className="font-semibold">Total</span>
                    <span className="cifra titular min-w-0 truncate text-[28px]">{formatARS(totals.total)}</span>
                  </div>
                </div>
                <div className="border-t border-linea bg-chapa-2 p-4">
                  <Button size="lg" className="w-full" isLoading={saving} onClick={save}>
                    Guardar presupuesto
                  </Button>
                </div>
              </div>
            </aside>
          </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-linea bg-chapa p-5 shadow-suave">
      <h2 className="titular text-lg">{title}</h2>
      {children}
    </section>
  );
}
