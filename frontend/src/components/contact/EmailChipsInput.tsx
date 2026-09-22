'use client';

import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

const EMAIL_RE = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/;

const EMAIL_IN_TEXT = /[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[^\s@,;<>()"']{2,}/g;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** "Juan <juan@obra.com>" → "juan@obra.com"; lo demás queda como vino. */
function cleanToken(raw: string): string {
  const t = raw.trim().replace(/^mailto:/i, '');
  const angled = t.match(/<([^>]+)>/);
  return (angled ? angled[1] : t).trim().replace(/^["']|["']$/g, '');
}

interface EmailChipsInputProps {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  describedBy?: string;
  invalid?: boolean;
  label?: string;
}

/** Destinatarios como pastillas: Enter, coma o pegar agrega; Retroceso con el campo vacío borra la última. */
export function EmailChipsInput({ id, value, onChange, placeholder, describedBy, invalid, label }: EmailChipsInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string[]) => {
    const next = [...value];
    for (const r of raw) {
      const email = cleanToken(r);
      if (email && !next.some((e) => e.toLowerCase() === email.toLowerCase())) next.push(email);
    }
    if (next.length !== value.length) onChange(next);
  };

  const commit = () => {
    if (!draft.trim()) return;
    add(draft.split(/[,;\s]+/));
    setDraft('');
  };

  const remove = (email: string) => onChange(value.filter((e) => e !== email));

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={clsx(
        'flex min-h-11 w-full min-w-0 cursor-text flex-wrap items-center gap-1.5 rounded-[10px] border bg-chapa px-2 py-1.5 transition-[border-color,box-shadow] duration-150',
        'focus-within:border-tinta focus-within:shadow-[0_0_0_3px_rgb(22_33_43/0.14)]',
        invalid ? 'border-rojo' : 'border-linea-fuerte hover:border-tiza'
      )}
    >
      {value.map((email) => {
        const ok = isValidEmail(email);
        return (
          <span
            key={email}
            className={clsx(
              'inline-flex h-8 max-w-full items-center gap-1 rounded-full pl-3 pr-1 text-sm font-semibold',
              ok ? 'bg-chapa-2 text-tinta ring-1 ring-linea' : 'bg-rojo-velo text-rojo-tinta ring-1 ring-rojo/40'
            )}
          >
            <span className="min-w-0 truncate">{email}</span>
            {!ok && <span className="sr-only">(correo inválido)</span>}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(email);
                inputRef.current?.focus();
              }}
              className="h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-full opacity-70 hover:bg-black/5 hover:opacity-100 cursor-pointer"
              aria-label={`Quitar ${email}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={draft}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        placeholder={value.length ? undefined : placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (/[,;]/.test(v)) {
            add(v.split(/[,;]+/).slice(0, -1));
            setDraft(v.split(/[,;]+/).pop() ?? '');
          } else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || (e.key === 'Tab' && draft.trim()) || e.key === ' ') {
            if (draft.trim()) {
              e.preventDefault();
              commit();
            } else if (e.key === 'Enter') e.preventDefault();
          } else if (e.key === 'Backspace' && !draft && value.length) {
            e.preventDefault();
            remove(value[value.length - 1]);
          }
        }}
        onPaste={(e) => {
          // Listas pegadas de otro correo ("Juan <juan@obra.com>, Ana <ana@obra.com>"): se toman las direcciones.
          const text = e.clipboardData.getData('text');
          if (!/[,;\s<]/.test(text.trim())) return;
          e.preventDefault();
          add(text.match(EMAIL_IN_TEXT) ?? text.split(/[,;\s]+/));
        }}
        onBlur={commit}
        className="h-8 min-w-[10ch] flex-1 bg-transparent px-1.5 text-[15px] text-tinta outline-none placeholder:text-[#7d8a92]"
      />
    </div>
  );
}
