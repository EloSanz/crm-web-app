'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { Trophy, XCircle } from 'lucide-react';
import type { Opportunity } from '@/types/crm';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { AffixInput, Field } from '@/components/ui/Field';
import { LOSS_REASONS } from '@/lib/catalogs';
import { formatARS } from '@/lib/format';

interface WinDialogProps {
  opp: Opportunity;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (finalValue: number) => void;
}

export function WinDialog({ opp, submitting, onCancel, onConfirm }: WinDialogProps) {
  const [value, setValue] = useState(String(Math.round(Number(opp.estimated_value || 0))));
  const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
  const invalid = value.trim() === '' || Number.isNaN(parsed) || parsed < 0;

  return (
    <Dialog
      title="Venta concretada"
      icon={
        <span className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-verde-velo text-verde">
          <Trophy className="w-5 h-5" />
        </span>
      }
      onClose={onCancel}
      footer={
        <>
          <Button variant="fantasma" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="exito" isLoading={submitting} disabled={invalid} onClick={() => !invalid && onConfirm(parsed)}>
            Confirmar venta
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) onConfirm(parsed);
        }}
      >
        <p className="mb-4 truncate text-[15px] text-tiza">{opp.title}</p>
        <Field label="Valor final" hint={`Presupuestado: ${formatARS(opp.estimated_value)}`} error={invalid ? 'Ingresá un monto válido' : undefined}>
          {({ id, describedBy, invalid: inv }) => (
            <AffixInput
              id={id}
              prefix="$"
              inputMode="decimal"
              aria-describedby={describedBy}
              aria-invalid={inv}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-autofocus
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

interface LostDialogProps {
  opp: Opportunity;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function LostDialog({ opp, submitting, onCancel, onConfirm }: LostDialogProps) {
  const [reason, setReason] = useState('');
  return (
    <Dialog
      title="¿Por qué se perdió?"
      icon={
        <span className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-rojo-velo text-rojo">
          <XCircle className="w-5 h-5" />
        </span>
      }
      onClose={onCancel}
      footer={
        <>
          <Button variant="fantasma" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="peligro" isLoading={submitting} disabled={!reason} onClick={() => reason && onConfirm(reason)}>
            Marcar perdido
          </Button>
        </>
      }
    >
      <p className="mb-3 truncate text-[15px] text-tiza">{opp.title}</p>
      <fieldset>
        <legend className="sr-only">Motivo</legend>
        <div className="grid gap-1.5">
          {LOSS_REASONS.map((r) => (
            <label
              key={r}
              className={clsx(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-2 text-[15px] font-medium transition-colors',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tinta',
                reason === r ? 'border-pavonado bg-chapa-2' : 'border-linea hover:border-linea-fuerte'
              )}
            >
              <span
                className={clsx(
                  'h-[18px] w-[18px] shrink-0 rounded-full border-2 transition-colors',
                  reason === r ? 'border-pavonado bg-[radial-gradient(circle,var(--color-pavonado)_40%,transparent_45%)]' : 'border-linea-fuerte'
                )}
                aria-hidden
              />
              <input type="radio" name="motivo" value={r} checked={reason === r} onChange={() => setReason(r)} className="sr-only" />
              {r}
            </label>
          ))}
        </div>
      </fieldset>
    </Dialog>
  );
}
