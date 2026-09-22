import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireRole } from '@/components/users/RequireRole';
import { LoadingBlock } from '@/components/ui/EmptyState';
import { IndicadoresShell } from './_components/Shell';

export const metadata: Metadata = { title: 'Indicadores' };

/** Indicadores: administración y responsables comerciales. El vendedor no ve ningún indicador. */
export default function IndicadoresLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <RequireRole role="manager">
        <Suspense fallback={<LoadingBlock label="Cargando indicadores" />}>
          <IndicadoresShell>{children}</IndicadoresShell>
        </Suspense>
      </RequireRole>
    </AppLayout>
  );
}
