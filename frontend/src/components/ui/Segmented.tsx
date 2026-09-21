import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';

interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  count?: number;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange?: (value: T) => void;
  label: string;
  className?: string;
}

/** Selector de vista o sub-sección: botones (onChange) o enlaces (href). */
export function Segmented<T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={clsx('inline-flex max-w-full p-1 rounded-xl bg-chapa border border-linea', className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        const cls = clsx(
          'inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer',
          active ? 'bg-pavonado text-white shadow-suave' : 'text-tiza hover:text-tinta'
        );
        const content = (
          <>
            {opt.icon}
            {opt.label}
            {opt.count !== undefined && (
              <span className={clsx('cifra text-sm', active ? 'text-niebla' : 'text-tiza/80')}>{opt.count}</span>
            )}
          </>
        );
        return opt.href ? (
          <Link key={opt.value} href={opt.href} className={cls} aria-current={active ? 'page' : undefined}>
            {content}
          </Link>
        ) : (
          <button key={opt.value} type="button" className={cls} aria-pressed={active} onClick={() => onChange?.(opt.value)}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
