'use client';

import React, { useState } from 'react';
import type { Opportunity, OpportunityUpdateData, Stage } from '@/types/crm';
import { updateOpportunity } from '@/lib/api';
import { sentenceCase } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import { LostDialog, WinDialog } from './CloseDialogs';

/**
 * Mover un presupuesto de etapa. Pasar a "Venta concretada" pide el valor final (sin pisar el presupuestado);
 * pasar a "Perdida" pide el motivo. El resto se guarda directo.
 */
export function useStageTransitions(
  reload: () => Promise<void> | void,
  /** Refleja el cambio en pantalla al instante, antes de que responda el servidor. */
  applyLocal?: (oppId: string, update: OpportunityUpdateData) => void
) {
  const toast = useToast();
  const [winOpp, setWinOpp] = useState<{ opp: Opportunity; stageId: string } | null>(null);
  const [lostOpp, setLostOpp] = useState<{ opp: Opportunity; stageId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const run = async (opp: Opportunity, update: OpportunityUpdateData, title: string, message?: string) => {
    const oppId = opp.id;
    setSubmitting(true);
    applyLocal?.(oppId, update);
    setWinOpp(null);
    setLostOpp(null);
    try {
      await updateOpportunity(oppId, update);
      toast.success(title, message);
      await reload();
    } catch (err) {
      toast.error('No se pudo mover el presupuesto', err instanceof Error ? err.message : undefined);
      if (applyLocal) {
        // Deshace el movimiento optimista en pantalla, sin depender del servidor (puede no haber conexión).
        applyLocal(oppId, {
          stage_id: opp.stage_id,
          status: opp.status,
          final_value: opp.final_value ?? null,
          loss_reason: opp.loss_reason ?? null,
        } as OpportunityUpdateData);
      } else {
        await reload();
      }
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
    void run(opp, { stage_id: stage.id, status: 'abierta' }, `Pasó a ${sentenceCase(stage.name).toLocaleLowerCase('es-AR')}`, opp.title);
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
              winOpp.opp,
              // El total presupuestado queda como estaba; el valor de la venta va aparte.
              { stage_id: winOpp.stageId, status: 'ganada', final_value: value },
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
              lostOpp.opp,
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
