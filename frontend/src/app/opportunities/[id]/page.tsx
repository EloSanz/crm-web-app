'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { safeBackHref } from '@/components/contact/useLeaveGuard';
import clsx from 'clsx';
import { Check, Lock, MessageCircle, Pencil, RotateCcw, Sparkles, Trophy, XCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { Punta, HealthChip } from '@/components/punta/Punta';
import { ActivityLog } from '@/components/opportunities/ActivityLog';
import { VersionHistory } from '@/components/opportunities/VersionHistory';
import { EmailThreads } from '@/components/opportunities/EmailThreads';
import { ContactMenu } from '@/components/contact/ContactMenu';
import { useStageTransitions } from '@/components/opportunities/useStageTransitions';
import { ReopenDialog } from '@/components/opportunities/ReopenDialog';
import {
  fetchCompany,
  fetchCompanyContacts,
  fetchContact,
  fetchOpportunity,
  fetchOpportunityActivities,
  fetchOpportunityTimeline,
  fetchOpportunityVersions,
  fetchStages,
  fetchUsers,
  updateOpportunity,
} from '@/lib/api';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useCurrentUser } from '@/lib/useUser';
import { isManager } from '@/lib/roles';
import { ORIGIN_OPTIONS } from '@/lib/catalogs';
import type { Contact } from '@/types/crm';
import { useLoad } from '@/lib/useLoad';
import { healthOf } from '@/lib/health';
import { formatARS, formatDate, formatQty, sentenceCase, shortRef } from '@/lib/format';

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  // Al llegar desde una cita de «Ponete al día», volver lleva de nuevo al chat.
  const volver = useSearchParams()?.get('volver');
  const back = volver ? { href: safeBackHref(volver, '/opportunities'), label: volver.endsWith('/ponete-al-dia') ? 'Ponete al día' : 'Volver' } : { href: '/opportunities', label: 'Presupuestos' };

  const load = useCallback(async () => {
    const [opp, stages, activities, users, events, versions] = await Promise.all([
      fetchOpportunity(id),
      fetchStages(),
      fetchOpportunityActivities(id).catch(() => []),
      fetchUsers().catch(() => []),
      fetchOpportunityTimeline(id).catch(() => []),
      fetchOpportunityVersions(id).catch(() => []),
    ]);
    const [contact, company, companyContacts] = await Promise.all([
      opp.contact_id ? fetchContact(opp.contact_id).catch(() => null) : null,
      opp.company_id ? fetchCompany(opp.company_id).catch(() => null) : null,
      opp.company_id ? fetchCompanyContacts(opp.company_id).catch(() => [] as Contact[]) : Promise.resolve([] as Contact[]),
    ]);
    const contacts = [...companyContacts];
    if (contact && !contacts.some((c) => c.id === contact.id)) contacts.unshift(contact);
    return {
      opp,
      activities,
      events,
      versions,
      users,
      contacts,
      stages: [...stages].sort((a, b) => a.position - b.position),
      contact,
      company,
      phone: contact?.phone || company?.phone || null,
    };
  }, [id]);

  const { data, error, loading, reload } = useLoad(load);
  const { moveTo, dialogs } = useStageTransitions(reload);
  const toast = useToast();
  const me = useCurrentUser();
  const canReassign = isManager(me);
  const [reopening, setReopening] = useState(false);
  const [reopenSubmitting, setReopenSubmitting] = useState(false);

  const assign = async (field: 'assigned_to' | 'contact_id' | 'origin', value: string) => {
    if (!data) return;
    try {
      await updateOpportunity(data.opp.id, { [field]: value || null });
      toast.success(field === 'assigned_to' ? 'Responsable actualizado' : field === 'origin' ? 'Origen actualizado' : 'Punto de contacto actualizado');
      await reload();
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
    }
  };

  const reopen = async (stageId: string, reason: string) => {
    if (!data) return;
    setReopenSubmitting(true);
    try {
      await updateOpportunity(data.opp.id, { stage_id: stageId, status: 'abierta', reopen_reason: reason });
      toast.success('Presupuesto reabierto', reason);
      setReopening(false);
      await reload();
    } catch (err) {
      toast.error('No se pudo reabrir', err instanceof Error ? err.message : undefined);
    } finally {
      setReopenSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <LoadingBlock label="Cargando presupuesto" rows={4} />
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <EmptyState illustration="presupuestos"
          title="No encontramos este presupuesto"
          description={error ?? undefined}
          action={
            <ButtonLink href="/opportunities" variant="secundario">
              Volver a presupuestos
            </ButtonLink>
          }
        />
      </AppLayout>
    );
  }

  const { opp, stages, activities, events, versions, phone, users, contacts, contact, company } = data;
  const itemsSubtotal = opp.items.reduce((a, it) => a + Number(it.subtotal), 0);
  const globalDiscount = Number(opp.discount_pct ?? 0);
  const showVersions = () => document.getElementById('versiones')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const health = healthOf(opp);
  const isOpen = opp.status === 'abierta';
  // Cerrado: el vendedor lo ve en solo lectura; admin y responsable comercial lo pueden tocar o reabrir.
  const readOnly = !isOpen && !canReassign;
  const openStages = stages.filter((s) => !s.is_closed_won && !s.is_closed_lost);
  const currentIdx = openStages.findIndex((s) => s.id === opp.stage_id);
  const won = stages.find((s) => s.is_closed_won);
  const lost = stages.find((s) => s.is_closed_lost);
  const clientHref = opp.company_id ? `/companies/${opp.company_id}` : opp.contact_id ? `/contacts/${opp.contact_id}` : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          back={back}
          meta={
            <>
              <Punta health={health} status={opp.status} size={20} />
              <span className="rotulo text-tiza">{shortRef(opp.id)}</span>
              {isOpen ? (
                <HealthChip health={health} days={opp.days_since_last_activity} />
              ) : (
                <Chip tone={opp.status === 'ganada' ? 'verde' : 'neutro'}>{opp.status === 'ganada' ? 'Venta concretada' : 'Perdido'}</Chip>
              )}
            </>
          }
          title={opp.title}
          actions={
            isOpen ? (
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                <ContactMenu opportunityId={opp.id} contact={contact} company={company} phone={phone} email={contact?.email ?? company?.email ?? null} onLogged={() => reload()} />
                {lost && (
                  <Button variant="secundario" className="text-rojo-tinta" onClick={() => moveTo(opp, lost)}>
                    <XCircle className="w-4 h-4" aria-hidden />
                    Perdido
                  </Button>
                )}
                {won && (
                  <Button variant="exito" className="order-first col-span-2 sm:order-none" onClick={() => moveTo(opp, won)}>
                    <Trophy className="w-4 h-4" aria-hidden />
                    Venta concretada
                  </Button>
                )}
              </div>
            ) : canReassign ? (
              <Button variant="secundario" onClick={() => setReopening(true)}>
                <RotateCcw className="w-4 h-4" aria-hidden />
                Reabrir
              </Button>
            ) : undefined
          }
        />

        {!isOpen && (
          <section aria-label="Presupuesto cerrado" className="flex items-start gap-3 rounded-2xl border border-linea bg-chapa-2 px-5 py-4">
            <Lock className="mt-0.5 w-4.5 h-4.5 shrink-0 text-tiza" aria-hidden />
            <div className="min-w-0 text-[15px] leading-snug">
              <p className="font-semibold">
                {opp.status === 'ganada' ? 'Venta concretada' : 'Perdido'}
                {opp.closed_at ? ` el ${formatDate(opp.closed_at)}` : ''}
                {opp.status === 'perdida' && opp.loss_reason ? ` · ${opp.loss_reason}` : ''}
              </p>
              <p className="text-sm text-tiza">
                {readOnly
                  ? 'Está cerrado: lo ves en solo lectura. Para cambiarlo, pedíselo al responsable comercial.'
                  : 'Está cerrado. Lo que cambies queda registrado con tu nombre; para moverlo de etapa, reabrilo.'}
              </p>
            </div>
          </section>
        )}

        {isOpen && openStages.length > 0 && (
          <nav aria-label="Etapa del presupuesto">
            <ol className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              {openStages.map((s, i) => {
                const done = i < currentIdx;
                const current = i === currentIdx;
                return (
                  <li key={s.id} className="min-w-0">
                    <button
                      type="button"
                      disabled={current}
                      aria-current={current ? 'step' : undefined}
                      onClick={() => moveTo(opp, s)}
                      className={clsx(
                        'flex h-full w-full items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer disabled:cursor-default',
                        current && 'border-pavonado bg-pavonado text-white',
                        done && 'border-linea bg-chapa text-tinta hover:border-linea-fuerte',
                        !current && !done && 'border-dashed border-linea-fuerte text-tiza hover:border-tiza hover:text-tinta'
                      )}
                    >
                      <span
                        className={clsx(
                          'cifra h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-full text-[12px] font-bold',
                          current ? 'bg-white text-pavonado' : done ? 'bg-verde text-white' : 'bg-chapa-2 text-tiza'
                        )}
                      >
                        {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="min-w-0 text-sm font-semibold leading-tight">{sentenceCase(s.name)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        {isOpen && (opp.days_since_last_activity ?? 0) >= COLD_DAYS && (
          <ReviveCard oppId={opp.id} days={opp.days_since_last_activity ?? 0} contactId={contact?.id ?? null} hasEmail={Boolean(contact?.email || company?.email)} hasPhone={Boolean(phone)} />
        )}

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-6">
            <section aria-label="Resumen" className="overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
              <div className="sobre-pavonado grano-pavonado px-5 py-5 text-white">
                <div className="min-w-0">
                  <p className="text-sm text-niebla">{opp.status === 'ganada' ? 'Valor final' : 'Total'}</p>
                  <p className="cifra titular truncate text-[34px] leading-none">{formatARS(opp.estimated_value)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 border-b border-linea p-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="responsable" className="mb-1.5 block text-sm font-semibold">
                    Responsable
                  </label>
                  <Select
                    id="responsable"
                    value={opp.assigned_to}
                    onChange={(v) => v !== opp.assigned_to && assign('assigned_to', v)}
                    disabled={!canReassign}
                    options={users
                      .filter((u) => u.is_active || u.id === opp.assigned_to)
                      .map((u) => ({ value: u.id, label: u.full_name, hint: u.role === 'ejecutivo_ventas' ? 'Vendedor' : u.role === 'admin' ? 'Administrador' : 'Responsable comercial' }))}
                    placeholder={opp.assigned_to_name || 'Sin responsable'}
                  />
                  {!canReassign && <p className="mt-1.5 text-[13px] text-tiza">Sólo el responsable comercial o el administrador reasignan.</p>}
                </div>
                <div>
                  <label htmlFor="punto-contacto" className="mb-1.5 block text-sm font-semibold">
                    Punto de contacto
                  </label>
                  <Select
                    id="punto-contacto"
                    value={opp.contact_id ?? ''}
                    onChange={(v) => v !== (opp.contact_id ?? '') && assign('contact_id', v)}
                    disabled={readOnly}
                    placeholder="Sin contacto"
                    options={[{ value: '', label: 'Sin contacto' }, ...contacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`, hint: [c.job_title, c.phone].filter(Boolean).join(' · ') || undefined }))]}
                  />
                </div>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
                <Datum label="Cliente">
                  {clientHref ? (
                    <Link href={clientHref} className="font-semibold underline decoration-linea-fuerte hover:decoration-tinta">
                      {opp.company_name || opp.contact_name}
                    </Link>
                  ) : (
                    'Sin cliente'
                  )}
                </Datum>
                <Datum label="Obra">{opp.project_name || '—'}</Datum>
                <Datum label="Entrega">{opp.delivery_location || '—'}</Datum>
                <Datum label="Cierre estimado">{opp.expected_close_date ? formatDate(opp.expected_close_date) : '—'}</Datum>
                <Datum label="Teléfono">{phone || '—'}</Datum>
                <Datum label="Creado">{formatDate(opp.created_at)}</Datum>
                <Datum label="Origen">
                  {readOnly ? (
                    opp.origin || '—'
                  ) : (
                    <Select
                      size="sm"
                      aria-label="Origen"
                      value={opp.origin ?? ''}
                      onChange={(v) => v !== (opp.origin ?? '') && assign('origin', v)}
                      placeholder="Sin origen"
                      options={[{ value: '', label: 'Sin origen' }, ...originOptions(opp.origin).map((o) => ({ value: o, label: o }))]}
                    />
                  )}
                </Datum>
                {!isOpen && <Datum label="Fecha de cierre">{opp.closed_at ? formatDate(opp.closed_at) : '—'}</Datum>}
                {opp.status === 'perdida' && <Datum label="Motivo de pérdida">{opp.loss_reason || '—'}</Datum>}
              </dl>
            </section>

            <section aria-labelledby="materiales" className="overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
                <h2 id="materiales" className="titular text-lg">
                  Materiales
                  {(opp.current_version ?? 1) > 1 && <span className="ml-2 text-sm font-semibold text-tiza">versión {opp.current_version}</span>}
                </h2>
                {isOpen && (
                  <ButtonLink href={`/opportunities/${opp.id}/editar`} variant="secundario" size="sm">
                    <Pencil className="w-4 h-4" aria-hidden />
                    Editar materiales
                  </ButtonLink>
                )}
              </div>
              {opp.items.length === 0 ? (
                <p className="px-5 pb-5 pt-2 text-[15px] text-tiza">Sin materiales cargados.</p>
              ) : (
                <>
                  <ul className="mt-3 divide-y divide-linea border-t border-linea">
                    {opp.items.map((it) => (
                      <li key={it.id} className="flex items-start gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold leading-snug break-words">{it.product_name}</p>
                          <p className="cifra flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-tiza">
                            <span>
                              {formatQty(it.quantity, it.unit)} × {formatARS(it.unit_price)}
                            </span>
                            {it.price_tier === 'mayorista' && <span className="rounded-full bg-pavonado px-2 py-px text-[12px] font-semibold text-white">Mayorista</span>}
                            {Number(it.discount_pct ?? 0) > 0 && <span className="font-semibold text-tinta">−{Number(it.discount_pct)}%</span>}
                          </p>
                        </div>
                        <span className="cifra shrink-0 text-[15px] font-bold">{formatARS(it.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-1.5 border-t border-linea bg-chapa-2 px-5 py-3.5">
                    {globalDiscount > 0 && (
                      <>
                        <p className="flex items-center justify-between text-[15px]">
                          <span className="text-tiza">Subtotal</span>
                          <span className="cifra">{formatARS(itemsSubtotal)}</span>
                        </p>
                        <p className="flex items-center justify-between text-[15px]">
                          <span className="text-tiza">Descuento {globalDiscount}%</span>
                          <span className="cifra">− {formatARS(itemsSubtotal - Number(opp.estimated_value))}</span>
                        </p>
                      </>
                    )}
                    <p className="flex items-center justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="cifra text-lg font-extrabold">{formatARS(opp.estimated_value)}</span>
                    </p>
                  </div>
                </>
              )}
            </section>

            <EmailThreads opportunityId={opp.id} onNewReplies={reload} />

            {versions.length > 1 && <VersionHistory versions={versions} />}
          </div>

          <ActivityLog opp={opp} activities={activities} events={events} contacts={contacts} onSaved={reload} onShowVersions={versions.length > 1 ? showVersions : undefined} />
        </div>
      </div>
      {dialogs}
      {reopening && (
        <ReopenDialog opp={opp} stages={openStages} submitting={reopenSubmitting} onCancel={() => setReopening(false)} onConfirm={reopen} />
      )}
    </AppLayout>
  );
}

/** Orígenes del catálogo más el que ya tenga el presupuesto (si se cargó uno fuera de la lista). */
function originOptions(current: string | null | undefined): string[] {
  return current && !ORIGIN_OPTIONS.includes(current) ? [...ORIGIN_OPTIONS, current] : ORIGIN_OPTIONS;
}

function Datum({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] font-semibold text-tiza">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-medium break-words">{children}</dd>
    </div>
  );
}

/** Mismo umbral que el backend (draft_service.COLD_DAYS): semáforo amarillo o rojo. */
const COLD_DAYS = 8;

/** El presupuesto se enfría: el vendedor encuentra un borrador listo para retomar el contacto. */
function ReviveCard({ oppId, days, contactId, hasEmail, hasPhone }: { oppId: string; days: number; contactId: string | null; hasEmail: boolean; hasPhone: boolean }) {
  if (!hasEmail && !(hasPhone && contactId)) return null;
  const back = encodeURIComponent(`/opportunities/${oppId}`);
  return (
    <section aria-label="Retomar el contacto" className="flex flex-col gap-3 rounded-2xl border border-ambar/30 bg-ambar-velo px-5 py-4 text-ambar-tinta sm:flex-row sm:items-center">
      <Sparkles className="hidden w-5 h-5 shrink-0 sm:block" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug">Hace {days} días que no hay contacto con el cliente</p>
        <p className="text-sm leading-snug">El asistente arma un borrador con el presupuesto y el seguimiento. Lo revisás y lo mandás vos.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {hasEmail && (
          <ButtonLink href={`/correo/nuevo?opportunity_id=${oppId}&sugerir=1&volver=${back}`} variant="secundario" size="sm">
            <Sparkles className="w-4 h-4" aria-hidden />
            Borrador de correo
          </ButtonLink>
        )}
        {hasPhone && contactId && (
          <ButtonLink href={`/whatsapp/${contactId}?opportunity_id=${oppId}&volver=${back}`} variant="secundario" size="sm">
            <MessageCircle className="w-4 h-4" aria-hidden />
            Ir al WhatsApp
          </ButtonLink>
        )}
      </div>
    </section>
  );
}
