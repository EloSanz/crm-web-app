'use client';

import React, { useState } from 'react';
import type { Contact } from '@/types/crm';
import type { HistoryScope } from '@/types/history';
import { ActivityForm } from '@/components/opportunities/ActivityForm';
import { ClientHistory } from './ClientHistory';
import { DetailSection } from './DetailBits';

interface ClientActivityProps {
  scope: HistoryScope;
  id: string;
  /** Empresa a la que queda vinculada la actividad (la propia, o la del contacto). */
  companyId?: string | null;
  /** Contacto fijo (ficha de contacto): no se muestra el selector «Con quién». */
  contactId?: string | null;
  /** Contactos de la empresa para elegir con quién se habló. */
  contacts?: Contact[];
}

/**
 * Caso de uso 11 (regla 9): registrar un contacto o actividad desde la ficha de la empresa o del contacto,
 * sin presupuesto, y verlo al instante en el historial de esa ficha.
 */
export function ClientActivity({ scope, id, companyId, contactId, contacts = [] }: ClientActivityProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <>
      <DetailSection title="Registrar contacto/actividad">
        <div className="px-5 pb-5">
          <ActivityForm
            companyId={companyId}
            defaultContactId={contactId}
            contacts={contactId ? [] : contacts}
            onSaved={() => setRefreshKey((n) => n + 1)}
          />
        </div>
      </DetailSection>
      <ClientHistory scope={scope} id={id} refreshKey={refreshKey} />
    </>
  );
}
