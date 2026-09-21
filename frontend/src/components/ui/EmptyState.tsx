import React from 'react';
import clsx from 'clsx';
import { LogoLoader } from '@/components/brand/LogoLoader';
import { ILLUSTRATIONS, type IllustrationName } from '@/components/brand/Illustrations';

interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Ilustración del rubro: obra, clientes, presupuestos, catálogo o búsqueda. */
  illustration?: IllustrationName;
}

export function EmptyState({ title, description, action, className, illustration = 'busqueda' }: EmptyStateProps) {
  const Art = ILLUSTRATIONS[illustration];
  return (
    <div className={clsx('flex flex-col items-center gap-2 rounded-2xl border border-linea bg-chapa px-6 pb-10 pt-6 text-center shadow-suave', className)}>
      <Art className="h-auto w-[220px] max-w-full" />
      <h3 className="titular mt-1 text-xl">{title}</h3>
      {description && <p className="max-w-[40ch] text-[15px] text-tiza">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label, className }: { label: string; rows?: number; className?: string }) {
  return (
    <div className={clsx('flex min-h-[40vh] items-center justify-center', className)}>
      <LogoLoader label={label} showLabel />
    </div>
  );
}
