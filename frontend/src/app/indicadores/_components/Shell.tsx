'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { usePathname, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { useCurrentUser } from '@/lib/useUser';
import { isAdmin, isManager } from '@/lib/roles';
import { DaysContext, parseDays, PeriodFilter } from './period';

/** Pestañas de Indicadores. El responsable comercial ve las comerciales; el administrador, todas. */
export const TABS = [
  { slug: 'ventas', label: 'Ventas', role: 'manager' },
  { slug: 'vendedores', label: 'Vendedores', role: 'manager' },
  { slug: 'etapas', label: 'Etapas', role: 'manager' },
  { slug: 'presupuestos', label: 'Presupuestos', role: 'manager' },
  { slug: 'clientes', label: 'Clientes', role: 'admin' },
  { slug: 'obras', label: 'Obras', role: 'admin' },
  { slug: 'contacto', label: 'Contacto', role: 'manager' },
  { slug: 'catalogo', label: 'Catálogo', role: 'admin' },
] as const;

export function IndicadoresShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/indicadores';
  const params = useSearchParams();
  const days = parseDays(params.get('dias'));
  const user = useCurrentUser();
  const tabs = TABS.filter((t) => (t.role === 'admin' ? isAdmin(user) : isManager(user)));
  const segments = pathname.split('/').filter(Boolean);
  const isTabRoot = segments.length <= 2;

  return (
    <DaysContext.Provider value={days}>
      <div className="space-y-6">
        {isTabRoot && (
          <div className="space-y-4">
            <PageHeader title="Indicadores" actions={<PeriodFilter />} />
            <TabBar tabs={tabs} active={segments[1]} days={days} />
          </div>
        )}
        {children}
      </div>
    </DaysContext.Provider>
  );
}

function TabBar({ tabs, active, days }: { tabs: readonly (typeof TABS)[number][]; active?: string; days: number }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const current = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const strip = ref.current;
    if (!current || !strip || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: current.offsetLeft - 16, behavior: 'instant' as ScrollBehavior });
  }, [active]);

  return (
    <nav
      ref={ref}
      aria-label="Secciones de indicadores"
      className="-mx-4 overflow-x-auto border-b border-linea px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-1">
        {tabs.map((tab) => {
          const current = tab.slug === active;
          return (
            <li key={tab.slug}>
              <Link
                href={`/indicadores/${tab.slug}?dias=${days}`}
                aria-current={current ? 'page' : undefined}
                className={clsx(
                  'relative inline-flex h-11 items-center whitespace-nowrap rounded-t-lg px-3 text-[15px] font-semibold transition-colors lg:max-xl:px-2 lg:max-xl:text-[14px]',
                  current ? 'text-tinta' : 'text-tiza hover:text-tinta'
                )}
              >
                {tab.label}
                {current && <span className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-pavonado" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
