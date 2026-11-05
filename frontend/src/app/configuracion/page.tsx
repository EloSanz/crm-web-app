'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { RequireRole } from '@/components/users/RequireRole';
import { StagesPanel } from '@/components/config/StagesPanel';
import { CatalogPanel } from '@/components/config/CatalogPanel';

type Tab = 'etapas' | 'activity_type' | 'origin' | 'loss_reason';

const TABS: { value: Tab; label: string }[] = [
  { value: 'etapas', label: 'Etapas' },
  { value: 'activity_type', label: 'Tipos de actividad' },
  { value: 'origin', label: 'Orígenes' },
  { value: 'loss_reason', label: 'Motivos de pérdida' },
];

/** Configuración del embudo y de los catálogos: sólo el administrador. */
export default function ConfiguracionPage() {
  return (
    <AppLayout>
      <RequireRole role="admin">
        <Configuracion />
      </RequireRole>
    </AppLayout>
  );
}

function Configuracion() {
  const [tab, setTab] = useState<Tab>('etapas');
  return (
    <div className="space-y-5">
      <PageHeader title="Configuración" />
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented label="Sección de configuración" options={TABS} value={tab} onChange={setTab} />
      </div>
      {tab === 'etapas' ? <StagesPanel /> : <CatalogPanel key={tab} kind={tab} />}
    </div>
  );
}
