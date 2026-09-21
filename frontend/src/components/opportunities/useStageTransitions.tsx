'use client';

import React, { useState } from 'react';
import type { Opportunity, OpportunityUpdateData, Stage } from '@/types/crm';
import { updateOpportunity } from '@/lib/api';
import { sentenceCase } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import { LostDialog, WinDialog } from './CloseDialogs';

/**
 * Mover un presupuesto de etapa. Pasar a "Venta concretada" pide el valor final;
 * pasar a "Perdida" pide el motivo. El resto se guarda directo.
 */
export function useStageTransitions(reload: () => Promise<void> | void) {
  const toast = useToast();
  const [winOpp, setWinOpp] = useState<{ opp: Opportunity; stageId: string } | null>(null);
  const [lostOpp, setLostOpp] = useState<{ opp: Opportunity; stageId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const run = async (oppId: string, update: OpportunityUpdateData, title: string, message?: string) => {
    setSubmitting(true);
    try {
      await updateOpportunity(oppId, update);
      toast.success(title, message);
      await reload();
    } catch (err) {
      toast.error('No se pudo mover el presupuesto', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
      setWinOpp(null);
      setLostOpp(null);
    }
  };

  const moveTo = (opp: Opportunity, stage: Stage) => {
    if (opp.stage_id === stage.id) return;
    if (stage.is_closed_won) return setWinOpp({ opp, stageId: stage.id });
    if (stage.is_closed_lost) return setLostOpp({ opp, stageId: stage.id });
    void run(opp.id, { stage_id: stage.id, status: 'abierta' }, `Pasó a ${sentenceCase(stage.name).toLocaleLowerCase('es-AR')}`, opp.title);
  };

  const dialogs = (
    <>
      {winOpp && (
        <WinDialog
          opp={winOpp.opp}
          submitting={submitting}
          onCancel={() => setWinOpp(null)}
          onConfirm={(value) =>
            run(
              winOpp.opp.id,
              { stage_id: winOpp.stageId, status: 'ganada', estimated_value: value },
              '¡Venta concretada!',
              winOpp.opp.title
            )
          }
        />
      )}
      {lostOpp && (
        <LostDialog
          opp={lostOpp.opp}
          submitting={submitting}
          onCancel={() => setLostOpp(null)}
          onConfirm={(reason) =>
            run(
              lostOpp.opp.id,
              { stage_id: lostOpp.stageId, status: 'perdida', loss_reason: reason },
              'Marcado como perdido',
              `${lostOpp.opp.title} · ${reason}`
            )
          }
        />
      )}
    </>
  );

  return { moveTo, dialogs };
}
