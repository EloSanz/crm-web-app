'use client';

import React, { createContext, useContext, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import clsx from 'clsx';
import type { Opportunity, Stage } from '@/types/crm';
import { sentenceCase } from '@/lib/format';
import { OpportunityCard } from './OpportunityCard';

const DraggingContext = createContext<string | null>(null);

interface BoardDndProps {
  opportunities: Opportunity[];
  stages: Stage[];
  onMove: (opp: Opportunity, stage: Stage) => void;
  children: React.ReactNode;
}

/**
 * Contexto de arrastre del embudo: la tarjeta se levanta y sigue al puntero,
 * y se puede soltar en una columna o en los destinos Vendidos / Perdidos.
 */
export function BoardDnd({ opportunities, stages, onMove, children }: BoardDndProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );
  const active = activeId ? opportunities.find((o) => o.id === activeId) ?? null : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const opp = opportunities.find((o) => o.id === e.active.id);
    const stage = stages.find((s) => s.id === e.over?.id);
    if (opp && stage && opp.stage_id !== stage.id) onMove(opp, stage);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active: a }) => `Levantaste ${opportunities.find((o) => o.id === a.id)?.title ?? 'el presupuesto'}.`,
          onDragOver: ({ over }) => (over ? `Sobre ${sentenceCase(stages.find((s) => s.id === over.id)?.name)}.` : 'Fuera de las etapas.'),
          onDragEnd: ({ over }) => (over ? `Soltado en ${sentenceCase(stages.find((s) => s.id === over.id)?.name)}.` : 'Se canceló el movimiento.'),
          onDragCancel: () => 'Se canceló el movimiento.',
        },
        screenReaderInstructions: {
          draggable: 'Para mover el presupuesto, presioná espacio, elegí la etapa con las flechas y presioná espacio de nuevo.',
        },
      }}
    >
      <DraggingContext.Provider value={activeId}>{children}</DraggingContext.Provider>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
        {active ? (
          <div className="w-[284px] max-w-[84vw] rotate-[2.5deg] scale-[1.03] cursor-grabbing">
            <OpportunityCard opp={active} lifted />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function useDraggingId() {
  return useContext(DraggingContext);
}

/** Zona donde se puede soltar un presupuesto (una etapa). */
export function DroppableStage({
  id,
  children,
  className,
}: {
  id: string;
  children: (state: { isOver: boolean; isDragging: boolean }) => React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const dragging = useDraggingId();
  return (
    <div ref={setNodeRef} className={className}>
      {children({ isOver, isDragging: Boolean(dragging) })}
    </div>
  );
}

/** Tarjeta arrastrable: se toma desde cualquier parte con el mouse o el dedo, y con el asa desde el teclado. */
export function DraggableCard({ opp, children }: { opp: Opportunity; children: React.ReactNode }) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({ id: opp.id });
  // Mouse y dedo (mantener apretado) desde toda la tarjeta; teclado sólo desde el asa (así Enter en el título sigue navegando).
  const on = (listeners ?? {}) as Record<string, ((event: unknown) => void) | undefined>;
  return (
    <div
      ref={setNodeRef}
      onMouseDown={on.onMouseDown}
      onTouchStart={on.onTouchStart}
      className={clsx(
        'group/drag relative touch-manipulation',
        isDragging && 'rounded-xl border-2 border-dashed border-linea-fuerte bg-chapa/40 [&>*]:invisible'
      )}
    >
      {children}
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        onKeyDown={on.onKeyDown}
        aria-label={`Mover ${opp.title}`}
        className="absolute right-1.5 top-1.5 z-[2] h-8 w-7 inline-flex items-center justify-center rounded-md text-tiza opacity-0 transition-opacity hover:bg-chapa-2 focus-visible:opacity-100 group-hover/drag:opacity-100 cursor-grab"
      >
        <GripVertical className="w-4 h-4" />
      </button>
    </div>
  );
}
