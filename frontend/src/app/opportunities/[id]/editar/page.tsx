'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { Segmented } from '@/components/ui/Segmented';
import { FormActions } from '@/components/ui/FormActions';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { QuoteItemsEditor, quoteTotals } from '@/components/opportunities/QuoteItemsEditor';
import type { Company, Contact, Opportunity, OpportunityItemCreateData, OpportunityUpdateData, Product, Project } from '@/types/crm';
import { fetchCompanies, fetchContacts, fetchOpportunity, fetchProducts, fetchProjects, updateOpportunity } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { useCurrentUser } from '@/lib/useUser';
import { isManager } from '@/lib/roles';
import { CLIENT_STATUS } from '@/lib/catalogs';
import { formatARS } from '@/lib/format';

type Section = 'datos' | 'materiales';

/** A estas empresas no se les presupuesta (el backend también lo bloquea). */
const BLOCKED = new Set(['inactivo', 'no_contactar']);

/** Caso de uso 9: editar los datos generales del presupuesto y renegociar los materiales (nueva versión). */
export default function EditOpportunityPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const section: Section = useSearchParams()?.get('seccion') === 'datos' ? 'datos' : 'materiales';
  const me = useCurrentUser();
  const load = useCallback(async () => {
    const [opp, products, companies, contacts, projects] = await Promise.all([
      fetchOpportunity(id),
      fetchProducts(),
      fetchCompanies().catch(() => [] as Company[]),
      fetchContacts().catch(() => [] as Contact[]),
      fetchProjects().catch(() => [] as Project[]),
    ]);
    return { opp, products: products.filter((p) => p.is_active !== false), companies, contacts, projects };
  }, [id]);
  const { data, error, loading } = useLoad(load);
  const isOpen = data?.opp.status === 'abierta';
  // Cerrado: sólo admin y responsable comercial lo modifican (el backend responde 403 al resto).
  const readOnly = !isOpen && !isManager(me);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader back={{ href: `/opportunities/${id}`, label: data?.opp.title ?? 'Presupuesto' }} title="Editar presupuesto" />
        <Segmented
          label="Qué editar"
          value={section}
          options={[
            { value: 'datos', label: 'Datos del presupuesto', href: `/opportunities/${id}/editar?seccion=datos` },
            { value: 'materiales', label: 'Materiales', href: `/opportunities/${id}/editar` },
          ]}
        />
        {loading ? (
          <LoadingBlock label="Cargando presupuesto" rows={3} />
        ) : error || !data ? (
          <EmptyState illustration="presupuestos" title="No encontramos este presupuesto" description={error ?? undefined} />
        ) : section === 'datos' ? (
          <GeneralDataForm key={data.opp.updated_at} opp={data.opp} companies={data.companies} contacts={data.contacts} projects={data.projects} readOnly={readOnly} />
        ) : !isOpen ? (
          <EmptyState
            illustration="presupuestos"
            title="Este presupuesto ya está cerrado"
            description="Los materiales de un presupuesto cerrado no se renegocian. Para cambiarlos, reabrilo."
            action={
              <ButtonLink href={`/opportunities/${id}`} variant="secundario">
                Volver al presupuesto
              </ButtonLink>
            }
          />
        ) : (
          <Editor opp={data.opp} products={data.products} />
        )}
      </div>
    </AppLayout>
  );
}

interface GeneralDataFormProps {
  opp: Opportunity;
  companies: Company[];
  contacts: Contact[];
  projects: Project[];
  readOnly: boolean;
}

/** Título, cliente, obra, entrega, cierre estimado y observaciones (OpportunityUpdate). */
function GeneralDataForm({ opp, companies, contacts, projects, readOnly }: GeneralDataFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [clientType, setClientType] = useState<'company' | 'contact'>(opp.company_id ? 'company' : 'contact');
  const [title, setTitle] = useState(opp.title);
  const [companyId, setCompanyId] = useState(opp.company_id ?? '');
  const [contactId, setContactId] = useState(opp.contact_id ?? '');
  const [projectId, setProjectId] = useState(opp.project_id ?? '');
  const [delivery, setDelivery] = useState(opp.delivery_location ?? '');
  const [closeDate, setCloseDate] = useState(opp.expected_close_date?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(opp.notes ?? '');
  const [errors, setErrors] = useState<{ title?: string; client?: string }>({});
  const [saving, setSaving] = useState(false);

  const companyContacts = useMemo(() => contacts.filter((c) => c.company_id === companyId), [contacts, companyId]);
  // Al cambiar el cliente, la obra elegida se suelta si es de otro cliente (el backend la rechazaría).
  const keepProjectOf = (client: { companyId?: string; contactId?: string }) => {
    const p = projects.find((x) => x.id === projectId);
    if (!p) return;
    const belongs = client.companyId ? p.company_id === client.companyId : !!client.contactId && p.contact_id === client.contactId;
    if (!belongs) setProjectId('');
  };

  const projectOptions = useMemo(() => {
    const list = projects.filter((p) =>
      p.id === projectId || (clientType === 'company' ? !companyId || p.company_id === companyId : !contactId || p.contact_id === contactId)
    );
    return [{ value: '', label: 'Sin obra (compra directa)' }, ...list.map((p) => ({ value: p.id, label: p.name, hint: p.address }))];
  }, [projects, projectId, clientType, companyId, contactId]);

  // Sólo se mandan los campos que cambiaron (en un cerrado, eso es lo que queda registrado).
  const changes = useMemo(() => {
    const next: OpportunityUpdateData = {};
    const newCompany = clientType === 'company' ? companyId || null : null;
    const newContact = clientType === 'company' ? contactId || null : contactId || null;
    if (title.trim() !== opp.title) next.title = title.trim();
    if (newCompany !== (opp.company_id ?? null)) next.company_id = newCompany;
    if (newContact !== (opp.contact_id ?? null)) next.contact_id = newContact;
    if ((projectId || null) !== (opp.project_id ?? null)) next.project_id = projectId || null;
    if (delivery.trim() !== (opp.delivery_location ?? '')) next.delivery_location = delivery.trim() || null;
    if ((closeDate || null) !== (opp.expected_close_date?.slice(0, 10) ?? null)) next.expected_close_date = closeDate || null;
    if (notes.trim() !== (opp.notes ?? '')) next.notes = notes.trim() || null;
    return next;
  }, [clientType, companyId, contactId, title, projectId, delivery, closeDate, notes, opp]);
  const changed = Object.keys(changes).length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !changed) return;
    const next: typeof errors = {};
    if (title.trim().length < 2) next.title = 'Poné un nombre de al menos 2 letras';
    if (clientType === 'company' ? !companyId : !contactId) next.client = 'Elegí el cliente';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await updateOpportunity(opp.id, changes);
      toast.success('Datos del presupuesto guardados', title.trim());
      router.push(`/opportunities/${opp.id}`);
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      {opp.status !== 'abierta' && (
        <section aria-label="Presupuesto cerrado" className="flex items-start gap-3 rounded-2xl border border-linea bg-chapa-2 px-5 py-4">
          <Lock className="mt-0.5 w-4.5 h-4.5 shrink-0 text-tiza" aria-hidden />
          <p className="min-w-0 text-[15px] leading-snug">
            {readOnly
              ? 'Está cerrado: lo ves en solo lectura. Para cambiarlo, pedíselo al responsable comercial.'
              : 'Está cerrado. Lo que cambies queda registrado con tu nombre.'}
          </p>
        </section>
      )}
      <fieldset disabled={readOnly || saving} className="min-w-0 space-y-5">
        <Block title="Presupuesto">
          <Field label="Nombre" required error={errors.title}>
            {({ id, invalid }) => <Input id={id} aria-invalid={invalid} maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cierre estimado">
              {({ id }) => <DatePicker id={id} value={closeDate} onChange={setCloseDate} placeholder="Sin fecha" />}
            </Field>
          </div>
        </Block>

        <Block title="Cliente">
          <Segmented
            label="Tipo de cliente"
            value={clientType}
            onChange={(v) => {
              if (readOnly) return;
              setClientType(v);
              setContactId(v === 'contact' ? opp.contact_id ?? '' : '');
              keepProjectOf(v === 'contact' ? { contactId: opp.contact_id ?? '' } : { companyId });
            }}
            options={[
              { value: 'company', label: 'Empresa' },
              { value: 'contact', label: 'Particular' },
            ]}
          />
          {clientType === 'company' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Empresa" required error={errors.client}>
                {({ id, invalid }) => (
                  <Select
                    id={id}
                    invalid={invalid}
                    disabled={readOnly}
                    value={companyId}
                    onChange={(v) => {
                      setCompanyId(v);
                      setContactId('');
                      keepProjectOf({ companyId: v });
                    }}
                    placeholder="Elegí una empresa"
                    searchable
                    options={companies.map((c) =>
                      BLOCKED.has(c.status) && c.id !== opp.company_id
                        ? { value: c.id, label: c.name, hint: `${CLIENT_STATUS[c.status].label}: no se le puede presupuestar`, disabled: true }
                        : { value: c.id, label: c.name, hint: c.cuit || c.industry || undefined }
                    )}
                  />
                )}
              </Field>
              <Field label="Punto de contacto">
                {({ id }) => (
                  <Select
                    id={id}
                    value={contactId}
                    onChange={setContactId}
                    disabled={readOnly || !companyId}
                    placeholder={companyId ? 'Sin contacto' : 'Elegí la empresa primero'}
                    options={[{ value: '', label: 'Sin contacto' }, ...companyContacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`, hint: c.job_title || undefined }))]}
                  />
                )}
              </Field>
            </div>
          ) : (
            <Field label="Contacto" required error={errors.client}>
              {({ id, invalid }) => (
                <Select
                  id={id}
                  invalid={invalid}
                  disabled={readOnly}
                  value={contactId}
                  onChange={(v) => {
                    setContactId(v);
                    keepProjectOf({ contactId: v });
                  }}
                  placeholder="Elegí un contacto"
                  searchable
                  options={contacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`, hint: c.company_name || c.job_title || undefined }))}
                />
              )}
            </Field>
          )}
        </Block>

        <Block title="Obra y entrega">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Obra">
              {({ id }) => (
                <Select
                  id={id}
                  disabled={readOnly}
                  value={projectId}
                  onChange={(v) => {
                    setProjectId(v);
                    const p = projects.find((x) => x.id === v);
                    if (p && !delivery.trim()) setDelivery(p.address);
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

        <Block title="Observaciones">
          <Field label="Observaciones del presupuesto" hint="Condiciones, plazos o aclaraciones para el cliente.">
            {({ id, describedBy }) => (
              <Textarea id={id} aria-describedby={describedBy} rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: precio sostenido por 7 días" />
            )}
          </Field>
        </Block>
      </fieldset>
      {!readOnly && <FormActions cancelHref={`/opportunities/${opp.id}`} submitLabel="Guardar datos" saving={saving} disabled={!changed} />}
    </form>
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

const toItem = (it: Opportunity['items'][number]): OpportunityItemCreateData => ({
  product_id: it.product_id ?? null,
  product_name: it.product_name,
  unit: it.unit,
  quantity: Number(it.quantity),
  unit_price: Number(it.unit_price),
  list_price: it.list_price != null ? Number(it.list_price) : null,
  price_tier: it.price_tier ?? 'minorista',
  discount_pct: Number(it.discount_pct ?? 0),
});

function Editor({ opp, products }: { opp: Opportunity; products: Product[] }) {
  const router = useRouter();
  const toast = useToast();
  const original = useMemo(() => opp.items.map(toItem), [opp]);
  const [items, setItems] = useState(original);
  const [discountPct, setDiscountPct] = useState(Number(opp.discount_pct ?? 0));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const version = opp.current_version ?? 1;
  const totals = quoteTotals(items, discountPct);
  const before = Number(opp.estimated_value);
  const delta = totals.total - before;
  const changed = discountPct !== Number(opp.discount_pct ?? 0) || JSON.stringify(items) !== JSON.stringify(original);

  const save = async () => {
    if (!changed) return;
    setSaving(true);
    try {
      await updateOpportunity(opp.id, { items, discount_pct: discountPct, version_note: note.trim() || null });
      toast.success(`Versión ${version + 1} guardada`, 'La anterior queda en el historial.');
      router.push(`/opportunities/${opp.id}#versiones`);
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4 rounded-2xl border border-linea bg-chapa p-5 shadow-suave">
        <QuoteItemsEditor products={products} items={items} onChange={setItems} discountPct={discountPct} onDiscountChange={setDiscountPct} />
        <Field label="Qué cambió">
          {({ id }) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: sumaron la platea y se bajó un 5 %" />}
        </Field>
      </section>

      <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Resumen de la nueva versión">
        <div className="overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
          <dl className="divide-y divide-linea">
            <div className="flex items-baseline justify-between gap-3 px-5 py-4">
              <dt className="text-sm text-tiza">Versión {version} (vigente)</dt>
              <dd className="cifra font-semibold">{formatARS(before)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-5 py-4">
              <dt className="text-sm font-semibold">Versión {version + 1}</dt>
              <dd className="cifra titular text-[28px]">{formatARS(totals.total)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-sm text-tiza">Diferencia</dt>
              <dd className="cifra font-semibold">{changed ? `${delta >= 0 ? '+' : '−'} ${formatARS(Math.abs(delta))}` : '—'}</dd>
            </div>
          </dl>
          <div className="border-t border-linea bg-chapa-2 p-4">
            <Button size="lg" className="w-full" isLoading={saving} disabled={!changed || items.length === 0} onClick={save}>
              Guardar versión {version + 1}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
