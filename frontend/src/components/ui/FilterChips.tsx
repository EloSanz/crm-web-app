import React from 'react';
import clsx from 'clsx';

interface FilterChipsProps<T extends string> {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}

/** Filtros en pastillas; en el celular se desplazan de costado, desde tablet bajan de renglón. */
export function FilterChips<T extends string>({ options, value, onChange, label }: FilterChipsProps<T>) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0 md:overflow-visible [&::-webkit-scrollbar]:hidden">
      <div role="group" aria-label={label} className="flex w-max gap-1.5 md:w-auto md:flex-wrap">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              className={clsx(
                'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition-colors cursor-pointer',
                active ? 'border-pavonado bg-pavonado text-white' : 'border-linea bg-chapa text-tinta hover:border-linea-fuerte'
              )}
            >
              {opt.label}
              {opt.count !== undefined && <span className={clsx('cifra', active ? 'text-niebla' : 'text-tiza')}>{opt.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
