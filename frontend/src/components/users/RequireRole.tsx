'use client';

import React from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { useCurrentUser } from '@/lib/useUser';
import { isAdmin, isManager } from '@/lib/roles';
import { ShieldAlert } from 'lucide-react';

/** Muestra el contenido sólo al rol habilitado; el backend valida igual cada acción. */
export function RequireRole({ role, children }: { role: 'admin' | 'manager'; children: React.ReactNode }) {
  const user = useCurrentUser();
  const allowed = role === 'admin' ? isAdmin(user) : isManager(user);
  if (!user) return null;
  if (!allowed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-linea bg-chapa px-6 py-14 text-center shadow-suave">
        <span className="h-12 w-12 inline-flex items-center justify-center rounded-full bg-chapa-2 text-tiza">
          <ShieldAlert className="w-6 h-6" />
        </span>
        <h2 className="titular text-xl">Esta sección es para {role === 'admin' ? 'administradores' : 'el responsable comercial'}</h2>
        <ButtonLink href="/" variant="secundario">
          Volver al inicio
        </ButtonLink>
      </div>
    );
  }
  return <>{children}</>;
}
