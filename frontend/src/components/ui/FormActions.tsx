import React from 'react';
import { Button, ButtonLink } from './Button';

/** Pie de formulario: fijo abajo en el celular, al final del formulario en escritorio. */
export function FormActions({ cancelHref, submitLabel, saving, disabled }: { cancelHref: string; submitLabel: string; saving?: boolean; disabled?: boolean }) {
  return (
    <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 -mx-4 flex justify-end gap-2 border-t border-linea bg-suelo/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
      <ButtonLink href={cancelHref} variant="fantasma">
        Cancelar
      </ButtonLink>
      <Button type="submit" isLoading={saving} disabled={disabled}>
        {submitLabel}
      </Button>
    </div>
  );
}

export function FormCard({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 rounded-2xl border border-linea bg-chapa p-5 shadow-suave sm:grid-cols-2 sm:p-6">{children}</div>;
}
