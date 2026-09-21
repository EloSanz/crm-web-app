'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, Phone, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { PipelineFunnel } from '@/components/opportunities/PipelineFunnel';
import { Punta } from '@/components/punta/Punta';
import { fetchActivePipelineMetric, fetchCompanies, fetchContacts, fetchOpportunities, fetchStages } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { useCurrentUser } from '@/lib/useUser';
import { healthOf, HEALTH_TONE } from '@/lib/health';
import { formatARS, formatARSCompact, formatDaysAgo, telHref } from '@/lib/format';

const load = async () => {
  const [opportunities, companies, contacts, metric, stages] = await Promise.all([
    fetchOpportunities(),
    fetchCompanies(),
    fetchContacts(),
    fetchActivePipelineMetric(7).catch(() => null),
    fetchStages().catch(() => []),
  ]);
  return { opportunities, companies, contacts, metric, stages };
};

const dayTone = { verde: 'text-verde-tinta', ambar: 'text-ambar-tinta', rojo: 'text-rojo-tinta' } as const;

export default function HomePage() {
  const user = useCurrentUser();
  const { data, error, loading, reload } = useLoad(load);

  const view = useMemo(() => {
    if (!data) return null;
    const open = data.opportunities.filter((o) => o.status === 'abierta');
    const cooling = open.filter((o) => healthOf(o) !== 'healthy');
    const healthy = open.filter((o) => healthOf(o) === 'healthy');
    const phoneOf = (companyId?: string | null, contactId?: string | null) =>
      (contactId && data.contacts.find((c) => c.id === contactId)?.phone) || (companyId && data.companies.find((c) => c.id === companyId)?.phone) || null;
    const followUp = [...open]
      .sort((a, b) => (b.days_since_last_activity ?? 999) - (a.days_since_last_activity ?? 999) || Number(b.estimated_value) - Number(a.estimated_value))
      .slice(0, 6)
      .map((o) => ({ opp: o, phone: phoneOf(o.company_id, o.contact_id) }));
    return {
      open,
      followUp,
      activeAmount: data.metric?.active_opportunities_amount ?? healthy.reduce((a, o) => a + Number(o.estimated_value || 0), 0),
      coolingAmount: cooling.reduce((a, o) => a + Number(o.estimated_value || 0), 0),
      coolingCount: cooling.length,
    };
  }, [data]);

  const firstName = user?.full_name?.split(' ')[0];

  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="titular truncate text-[28px] sm:text-[34px]" suppressHydrationWarning>
              {firstName ? `Hola, ${firstName}` : 'Hola'}
            </h1>
          </div>
          <ButtonLink href="/opportunities/nuevo" size="lg">
            <Plus className="w-5 h-5" aria-hidden />
            Nuevo presupuesto
          </ButtonLink>
        </header>

        {loading ? (
          <LoadingBlock label="Cargando el tablero" rows={3} />
        ) : error || !data || !view ? (
          <EmptyState illustration="presupuestos"
            title="No pudimos traer los datos"
            description={error ?? undefined}
            action={
              <Button variant="secundario" onClick={() => reload()}>
                Reintentar
              </Button>
            }
          />
        ) : (
          <>
            <section aria-label="Pipeline activo" className="sobre-pavonado grano-pavonado overflow-hidden rounded-2xl px-6 py-6 text-white sm:px-8 sm:py-7">
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                <div className="min-w-0">
                  <p className="text-[15px] text-niebla">Pipeline activo</p>
                  <p className="cifra titular mt-1 whitespace-nowrap text-[clamp(26px,8.6vw,64px)] leading-none">{formatARS(view.activeAmount)}</p>
                </div>
                <div className="flex gap-8">
                  <div>
                    <p className="text-sm text-niebla">Al día</p>
                    <p className="cifra text-2xl font-extrabold">
                      {view.open.length - view.coolingCount}
                      <span className="text-base font-semibold text-niebla"> de {view.open.length}</span>
                    </p>
                  </div>
                  {view.coolingCount > 0 && (
                    <div>
                      <p className="text-sm text-niebla">Se enfría</p>
                      <p className="cifra text-2xl font-extrabold text-ambar-claro">{formatARSCompact(view.coolingAmount)}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <section aria-labelledby="embudo" className="rounded-2xl border border-linea bg-chapa p-5 shadow-suave sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 id="embudo" className="titular text-lg">
                    Embudo
                  </h2>
                  <Link href="/opportunities" className="text-sm font-semibold text-tiza hover:text-tinta">
                    Ver todo
                  </Link>
                </div>
                <PipelineFunnel opportunities={data.opportunities} stages={data.stages} />
              </section>

              <section aria-labelledby="hoy" className="rounded-2xl border border-linea bg-chapa p-5 shadow-suave sm:p-6">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 id="hoy" className="titular text-lg">
                    A quién llamar hoy
                  </h2>
                </div>
                {view.followUp.length === 0 ? (
                  <p className="py-8 text-center text-[15px] text-tiza">Todo al día.</p>
                ) : (
                  <ul className="divide-y divide-linea">
                    {view.followUp.map(({ opp, phone }) => {
                      const health = healthOf(opp);
                      const tel = telHref(phone);
                      return (
                        <li key={opp.id} className="relative flex items-center gap-3 py-3">
                          <Punta health={health} size={18} />
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/opportunities/${opp.id}`}
                              className="line-clamp-2 text-[15px] font-bold leading-snug after:absolute after:inset-0 focus-visible:outline-none"
                            >
                              {opp.title}
                            </Link>
                            <p className="line-clamp-2 text-sm leading-snug text-tiza">
                              {opp.company_name || opp.contact_name || 'Sin cliente'}
                              {'\u00a0·\u00a0'}
                              <span className="cifra whitespace-nowrap font-semibold text-tinta">{formatARSCompact(opp.estimated_value)}</span>
                            </p>
                          </div>
                          <span className={clsx('shrink-0 text-[13px] font-bold', dayTone[HEALTH_TONE[health]])}>
                            <span className="sm:hidden">{opp.days_since_last_activity ?? '—'} d</span>
                            <span className="hidden sm:inline">{formatDaysAgo(opp.days_since_last_activity)}</span>
                          </span>
                          {tel && (
                            <a
                              href={tel}
                              className="relative z-[1] h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-[10px] border border-linea text-tinta hover:border-linea-fuerte hover:bg-chapa-2"
                              aria-label={`Llamar por ${opp.title}`}
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {view.open.length > view.followUp.length && (
                  <Link href="/opportunities" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-tinta hover:underline">
                    Ver los {view.open.length}
                    <ArrowRight className="w-4 h-4" aria-hidden />
                  </Link>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
