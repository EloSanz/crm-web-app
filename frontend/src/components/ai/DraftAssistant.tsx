'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Editor } from '@tiptap/react';
import { AlertTriangle, Sparkles, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { controlClasses } from '@/components/ui/Field';
import { requestDraft } from '@/lib/api-ai';
import type { PresupuestoTablaData } from '@/components/contact/MailEditor';
import type { AIDraft, DraftPayload } from '@/types/ai';
import { buildDoc, serializeDoc } from './draftContent';

type Target = Omit<DraftPayload, 'instruction' | 'current_text' | 'previous_draft'>;

/**
 * Sesión con el asistente: recuerda la última versión que escribió para que, en cada ajuste, el backend
 * compare contra lo que hay ahora en el editor y conserve los cambios que hizo el vendedor a mano.
 */
function useDraftSession(target: Target) {
  const [draft, setDraft] = useState<AIDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAi = useRef<string | null>(null);

  const ask = useCallback(
    async (instruction: string | null, current: string | null): Promise<AIDraft | null> => {
      setLoading(true);
      setError(null);
      try {
        const next = await requestDraft({
          ...target,
          instruction: instruction?.trim() || null,
          current_text: current?.trim() || null,
          previous_draft: current?.trim() ? lastAi.current : null,
        });
        setDraft(next);
        return next;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo sugerir una respuesta');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [target]
  );

  const reset = () => {
    setDraft(null);
    setError(null);
  };
  /** Guarda la versión del asistente tal como quedó en el editor (para comparar en el próximo ajuste). */
  const remember = useCallback((text: string) => {
    lastAi.current = text;
  }, []);
  const hasDraft = useCallback(() => Boolean(lastAi.current), []);
  return { draft, loading, error, ask, remember, hasDraft, reset };
}

/** Pedido de cambio + avisos. Comparte diseño entre el correo y WhatsApp. */
function AdjustBar({
  draft,
  loading,
  error,
  onAdjust,
  onClose,
  compact,
  hint,
}: {
  draft: AIDraft | null;
  loading: boolean;
  error: string | null;
  onAdjust: (instruction: string) => void;
  onClose: () => void;
  compact?: boolean;
  hint?: string;
}) {
  const [instruction, setInstruction] = useState('');
  const inputId = compact ? 'asistente-pedido-wa' : 'asistente-pedido';
  const submit = () => {
    if (!instruction.trim() || loading) return;
    onAdjust(instruction);
    setInstruction('');
  };
  return (
    <section aria-label="Asistente" aria-busy={loading || undefined} className={clsx('rounded-xl border border-linea bg-chapa-2', compact ? 'p-2.5' : 'p-3 sm:p-3.5')}>
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 w-4 h-4 shrink-0 text-tinta" aria-hidden />
        <p className="min-w-0 flex-1 text-[13px] leading-snug" aria-live="polite">
          {loading ? (
            <span className="font-semibold">Escribiendo en el mensaje…</span>
          ) : error ? (
            <span className="font-semibold text-rojo-tinta">{error}</span>
          ) : draft ? (
            <>
              <span className="font-semibold">{draft.reason_label}.</span> <span className="text-tiza">{draft.rationale}</span>
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar el asistente"
          className="-mr-1 -mt-1 h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg text-tiza hover:bg-linea hover:text-tinta cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!loading && draft && draft.to_confirm.length > 0 && (
        <div className="mt-2 rounded-lg border border-ambar/30 bg-ambar-velo px-3 py-2 text-ambar-tinta">
          <p className="flex items-center gap-1.5 text-[13px] font-bold">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
            Confirmá antes de enviar
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] leading-snug">
            {draft.to_confirm.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sin <form>: vive dentro del formulario del correo y no puede anidarse otro. */}
      <div className="mt-2 flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Pedile un cambio al asistente
        </label>
        <input
          id={inputId}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.stopPropagation();
              submit();
            }
          }}
          disabled={loading}
          maxLength={300}
          placeholder={hint ?? 'Pedile un cambio: más corto, insertá el detalle del presupuesto…'}
          className={clsx(controlClasses, 'h-10 min-w-0 flex-1 px-3 text-sm')}
        />
        <Button size="sm" variant="secundario" className="h-10" onClick={submit} disabled={!instruction.trim()} isLoading={loading}>
          {!loading && <Wand2 className="w-4 h-4" aria-hidden />}
          Ajustar
        </Button>
      </div>
      <p className="mt-1.5 text-[12px] text-tiza">Editá el mensaje como quieras: el asistente respeta tus cambios en cada ajuste. Nunca se envía solo.</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Correo: escribe y ajusta directo en el editor
// ---------------------------------------------------------------------------

interface EditorDraftAssistantProps {
  editor: Editor | null;
  target: Target;
  /** Datos de la tabla del presupuesto (para cuando el asistente o el vendedor piden el detalle). */
  detail: PresupuestoTablaData | null;
  /** Lo que hay en el editor todavía es lo precargado (saludo): se escribe de cero. */
  isPristine: () => boolean;
  onApplied: (draft: AIDraft) => void;
  onBusyChange?: (busy: boolean) => void;
  autoStart?: boolean;
}

export function EditorDraftAssistant({ editor, target, detail, isPristine, onApplied, onBusyChange, autoStart = false }: EditorDraftAssistantProps) {
  const { draft, loading, error, ask, remember, hasDraft, reset } = useDraftSession(target);
  const [open, setOpen] = useState(false);

  const run = async (instruction: string | null) => {
    if (!editor) return;
    setOpen(true);
    const current = isPristine() && !hasDraft() ? null : serializeDoc(editor.getJSON());
    editor.setEditable(false);
    onBusyChange?.(true);
    const next = await ask(instruction, current);
    editor.setEditable(true);
    onBusyChange?.(false);
    if (!next) return;
    editor.commands.setContent(buildDoc(next.paragraphs, detail));
    // Se guarda en el mismo formato con el que se va a comparar en el próximo ajuste.
    remember(serializeDoc(editor.getJSON()));
    onApplied(next);
    editor.commands.focus('end');
  };

  // Arranque automático al montar. El temporizador se cancela si React desmonta y vuelve a montar (modo estricto).
  useEffect(() => {
    if (!autoStart || !editor) return;
    const timer = window.setTimeout(() => run(null), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, editor]);

  if (!open) {
    return (
      <Button variant="secundario" onMouseDown={(e) => e.preventDefault()} onClick={() => run(null)} disabled={!editor}>
        <Sparkles className="w-4 h-4" aria-hidden />
        Sugerir respuesta
      </Button>
    );
  }
  return (
    <div className="w-full">
      <AdjustBar
        draft={draft}
        loading={loading}
        error={error}
        onAdjust={(instruction) => run(instruction)}
        onClose={() => {
          setOpen(false);
          reset();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp: escribe y ajusta directo en el cuadro de texto
// ---------------------------------------------------------------------------

interface TextDraftAssistantProps {
  target: Target;
  getText: () => string;
  setText: (text: string) => void;
  onApplied: (draft: AIDraft) => void;
}

export function TextDraftAssistant({ target, getText, setText, onApplied }: TextDraftAssistantProps) {
  const { draft, loading, error, ask, remember, reset } = useDraftSession(target);
  const [open, setOpen] = useState(false);

  const run = async (instruction: string | null) => {
    setOpen(true);
    const now = getText().trim();
    const next = await ask(instruction, now || null);
    if (!next) return;
    setText(next.body_text);
    remember(next.body_text);
    onApplied(next);
  };

  if (!open) {
    return (
      <Button variant="secundario" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => run(null)}>
        <Sparkles className="w-4 h-4" aria-hidden />
        Sugerir respuesta
      </Button>
    );
  }
  return (
    <AdjustBar
      compact
      draft={draft}
      loading={loading}
      error={error}
      hint="Pedile un cambio: más corto, más formal…"
      onAdjust={(instruction) => run(instruction)}
      onClose={() => {
        setOpen(false);
        reset();
      }}
    />
  );
}
