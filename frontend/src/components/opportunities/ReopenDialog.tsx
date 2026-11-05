'use client';

import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Opportunity, Stage } from '@/types/crm';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { sentenceCase } from '@/lib/format';

interface ReopenDialogProps {
  opp: Opportunity;
  /** Etapas abiertas, en orden. */
  stages: Stage[];
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (stageId: string, reason: string) => void;
}

/** Reabrir un presupuesto ganado o perdido: sólo admin y responsable comercial, y siempre con motivo. */
export function ReopenDialog({ opp, stages, submitting, onCancel, onConfirm }: ReopenDialogProps) {
  const [stageId, setStageId] = useState(stages[stages.length - 1]?.id ?? '');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = reason.trim() === '';

  const submit = () => {
    setTouched(true);
    if (!missing && stageId) onConfirm(stageId, reason.trim());
  };

  return (
    <Dialog
      title="Reabrir presupuesto"
      icon={
        <span className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-pavonado text-white">
          <RotateCcw className="w-5 h-5" />
        </span>
      }
      onClose={onCancel}
      footer={
        <>
          <Button variant="fantasma" onClick={onCancel}>
            Cancelar
          </Button>
          <Button isLoading={submitting} disabled={!stageId} onClick={submit}>
            Reabrir
          </Button>
        </>
      }
    >
      <p className="mb-4 truncate text-[15px] text-tiza">{opp.title}</p>
      <div className="space-y-4">
        <Field label="Vuelve a la etapa">
          {({ id }) => <Select id={id} value={stageId} onChange={setStageId} options={stages.map((s) => ({ value: s.id, label: sentenceCase(s.name) }))} />}
        </Field>
        <Field label="Motivo" required hint="Queda en el historial con tu nombre." error={touched && missing ? 'Contá por qué se reabre' : undefined}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              rows={3}
              maxLength={500}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: el cliente volvió y quiere renegociar"
              data-autofocus
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
