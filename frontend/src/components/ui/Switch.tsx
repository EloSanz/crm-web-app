import React from 'react';
import clsx from 'clsx';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}

/** Interruptor de encendido/apagado con su rótulo al costado; el rótulo cambia con el estado. */
export function Switch({ checked, onChange, label, id, disabled }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex min-h-11 items-center gap-3 rounded-[10px] text-left cursor-pointer disabled:opacity-45 disabled:pointer-events-none"
    >
      <span
        className={clsx(
          'inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors duration-150',
          checked ? 'bg-pavonado' : 'bg-linea-fuerte'
        )}
      >
        <span
          className={clsx(
            'block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgb(22_33_43/0.3)] transition-transform duration-200 ease-[var(--ease-salida)]',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </span>
      <span className="text-[15px] font-semibold">{label}</span>
    </button>
  );
}
