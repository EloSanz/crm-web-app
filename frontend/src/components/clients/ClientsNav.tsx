import React from 'react';
import { Segmented } from '@/components/ui/Segmented';

export function ClientsNav({ current }: { current: 'companies' | 'contacts' }) {
  return (
    <Segmented
      label="Tipo de cliente"
      value={current}
      options={[
        { value: 'companies', label: 'Empresas', href: '/companies' },
        { value: 'contacts', label: 'Contactos', href: '/contacts' },
      ]}
    />
  );
}
