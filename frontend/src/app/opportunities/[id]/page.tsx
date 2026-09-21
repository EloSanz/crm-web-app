'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import { Check, Phone, Trophy, XCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { Punta, HealthChip } from '@/components/punta/Punta';
import { ActivityLog } from '@/components/opportunities/ActivityLog';
import { useStageTransitions } from '@/components/opportunities/useStageTransitions';
import {
  fetchCompany,
  fetchCompanyContacts,
  fetchContact,
  fetchOpportunity,
  fetchOpportunityActivities,
  fetchStages,
  fetchUsers,
  updateOpportunity,
} from '@/lib/api';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useCurrentUser } from '@/lib/useUser';
import { isManager } from '@/lib/roles';
import type { Contact } from '@/types/crm';
import { useLoad } from '@/lib/useLoad';
import { healthOf } from '@/lib/health';
import { formatARS, formatDate, formatQty, sentenceCase, shortRef, telHref } from '@/lib/format';

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const load = useCallback(async () => {
    const [opp, stages, activities, users] = await Promise.all([
      fetchOpportunity(id),
      fetchStages(),
      fetchOpportunityActivities(id).catch(() => []),
      fetchUsers().catch(() => []),
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
      users,
      contacts,
      stages: [...stages].sort((a, b) => a.position - b.position),
      phone: contact?.phone || company?.phone || null,
    };
  }, [id]);

  const { data, error, loading, reload } = useLoad(load);
  const { moveTo, dialogs } = useStageTransitions(reload);
  const toast = useToast();
  const me = useCurrentUser();
  const canReassign = isManager(me);

  const assign = async (field: 'assigned_to' | 'contact_id', value: string) => {
    if (!data) return;
    try {
      await updateOpportunity(data.opp.id, { [field]: value || null });
      toast.success(field === 'assigned_to' ? 'Responsable actualizado' : 'Punto de contacto actualizado');
      await reload();
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
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

  const { opp, stages, activities, phone, users, contacts } = data;
  const health = healthOf(opp);
  const isOpen = opp.status === 'abierta';
  const openStages = stages.filter((s) => !s.is_closed_won && !s.is_closed_lost);
  const currentIdx = openStages.findIndex((s) => s.id === opp.stage_id);
  const won = stages.find((s) => s.is_closed_won);
  const lost = stages.find((s) => s.is_closed_lost);
  const tel = telHref(phone);
  const clientHref = opp.company_id ? `/companies/${opp.company_id}` : opp.contact_id ? `/contacts/${opp.contact_id}` : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          back={{ href: '/opportunities', label: 'Presupuestos' }}
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
                {tel && (
                  <ButtonLink href={tel} variant="secundario">
                    <Phone className="w-4 h-4" aria-hidden />
                    Llamar
                  </ButtonLink>
                )}
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
            ) : undefined
          }
        />

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
                {opp.status === 'perdida' && opp.loss_reason && <Datum label="Motivo">{opp.loss_reason}</Datum>}
              </dl>
            </section>

            <section aria-labelledby="materiales" className="overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
              <h2 id="materiales" className="titular px-5 pt-5 text-lg">
                Materiales
              </h2>
              {opp.items.length === 0 ? (
                <p className="px-5 pb-5 pt-2 text-[15px] text-tiza">Sin materiales cargados.</p>
              ) : (
                <>
                  <ul className="mt-3 divide-y divide-linea border-t border-linea">
                    {opp.items.map((it) => (
                      <li key={it.id} className="flex items-start gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold leading-snug break-words">{it.product_name}</p>
                          <p className="cifra text-[13px] text-tiza">
                            {formatQty(it.quantity, it.unit)} × {formatARS(it.unit_price)}
                          </p>
                        </div>
                        <span className="cifra shrink-0 text-[15px] font-bold">{formatARS(it.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between border-t border-linea bg-chapa-2 px-5 py-3.5">
                    <span className="font-semibold">Total</span>
                    <span className="cifra text-lg font-extrabold">{formatARS(opp.estimated_value)}</span>
                  </div>
                </>
              )}
            </section>
          </div>

          <ActivityLog opp={opp} activities={activities} contacts={contacts} onSaved={reload} />
        </div>
      </div>
      {dialogs}
    </AppLayout>
  );
}

function Datum({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] font-semibold text-tiza">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-medium break-words">{children}</dd>
    </div>
  );
}
