import React, { useId } from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Minus, Plus } from 'lucide-react';

export const controlClasses =
  'block w-full min-w-0 rounded-[10px] border border-linea-fuerte bg-chapa text-tinta text-[15px] ' +
  'placeholder:text-[#7d8a92] transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-tiza focus:outline-none focus:border-tinta focus:shadow-[0_0_0_3px_rgb(22_33_43/0.14)] ' +
  'disabled:bg-chapa-2 disabled:text-tiza aria-[invalid=true]:border-rojo';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className={clsx('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1 text-sm font-semibold text-tinta">
        {label}
        {required && (
          <span className="text-rojo" aria-hidden>
            *
          </span>
        )}
      </label>
      {children({ id, describedBy: hintId, invalid: Boolean(error) })}
      {(hint || error) && (
        <p id={hintId} className={clsx('mt-1.5 text-[13px]', error ? 'font-semibold text-rojo-tinta' : 'text-tiza')}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={twMerge(controlClasses, 'h-11 px-3.5', className)} {...props} />
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={twMerge(controlClasses, 'px-3.5 py-2.5 resize-y leading-relaxed', className)} {...props} />
  )
);
Textarea.displayName = 'Textarea';

/** Campo con prefijo (ej. "$") o sufijo (ej. unidad). */
export function AffixInput({
  prefix,
  suffix,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: React.ReactNode; suffix?: React.ReactNode }) {
  return (
    <div className={clsx('relative min-w-0', className)}>
      {prefix && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-tiza">{prefix}</span>}
      <input className={clsx(controlClasses, 'cifra h-11', prefix ? 'pl-8' : 'pl-3.5', suffix ? 'pr-16' : 'pr-3.5')} {...props} />
      {suffix && (
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 max-w-[48px] truncate text-sm text-tiza">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function SearchInput({
  className,
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  return (
    <div className={clsx('relative min-w-0', className)}>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tiza">{icon}</span>
      <input type="search" className={clsx(controlClasses, 'h-11 pl-10 pr-3.5')} {...props} />
    </div>
  );
}

/** Cantidad con botones − / +: pensado para el dedo en el celular. */
export function Stepper({
  value,
  onChange,
  min = 1,
  step = 1,
  label,
  size = 'md',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  label: string;
  size?: 'md' | 'sm';
}) {
  const h = size === 'md' ? 'h-11' : 'h-9';
  return (
    <div role="group" aria-label={label} className={clsx('inline-flex items-stretch rounded-[10px] border border-linea-fuerte bg-chapa', h)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className="w-10 inline-flex items-center justify-center text-tinta hover:bg-chapa-2 rounded-l-[9px] disabled:opacity-35 cursor-pointer"
        aria-label="Restar"
      >
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && n >= min ? n : min);
        }}
        aria-label={label}
        className="cifra w-16 border-x border-linea bg-transparent text-center text-[15px] font-semibold outline-none focus:bg-chapa-2"
      />
      <button
        type="button"
        onClick={() => onChange(value + step)}
        className="w-10 inline-flex items-center justify-center text-tinta hover:bg-chapa-2 rounded-r-[9px] cursor-pointer"
        aria-label="Sumar"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
