import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  meta?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** Encabezado de vista: título, acción principal y, si corresponde, volver. Sin bajadas de texto. */
export function PageHeader({ title, actions, back, meta, className, children }: PageHeaderProps) {
  return (
    <header className={clsx('flex flex-col gap-4', className)}>
      {back && (
        <Link href={back.href} className="-ml-1 inline-flex w-fit items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-tiza hover:text-tinta">
          <ArrowLeft className="w-4 h-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="titular text-[28px] sm:text-[34px] text-tinta break-words">{title}</h1>
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
