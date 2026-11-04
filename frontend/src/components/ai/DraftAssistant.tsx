'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, RefreshCw, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { controlClasses } from '@/components/ui/Field';
import { requestDraft } from '@/lib/api-ai';
import type { AIDraft, DraftPayload } from '@/types/ai';

interface DraftAssistantProps {
  /** A quién y por qué canal: el presupuesto, el contacto o el teléfono. */
  target: Omit<DraftPayload, 'instruction'>;
  /** Vuelca el borrador en el editor (el vendedor lo revisa y lo envía él). */
  onUse: (draft: AIDraft) => void;
  /** Pedir el borrador apenas se monta (cuando se llega desde «Sugerir respuesta» del presupuesto). */
  autoStart?: boolean;
  /** Botón chico (dentro del chat). */
  compact?: boolean;
  className?: string;
}

/** «Sugerir respuesta»: arma un borrador con el historial del cliente. Nunca se envía solo. */
export function DraftAssistant({ target, onUse, autoStart = false, compact = false, className }: DraftAssistantProps) {
  const [draft, setDraft] = useState<AIDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');

  const ask = async (extra?: string) => {
    setLoading(true);
    setError(null);
    try {
      setDraft(await requestDraft({ ...target, instruction: extra?.trim() || null }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sugerir una respuesta');
    } finally {
      setLoading(false);
    }
  };

  // Arranque automático al montar. El temporizador se cancela si React desmonta y vuelve a montar (modo estricto).
  useEffect(() => {
    if (!autoStart) return;
    const timer = window.setTimeout(() => ask(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const close = () => {
    setDraft(null);
    setError(null);
    setInstruction('');
  };

  if (!draft && !loading && !error) {
    return (
      <Button variant="secundario" size={compact ? 'sm' : 'md'} onMouseDown={(e) => e.preventDefault()} onClick={() => ask()}>
        <Sparkles className="w-4 h-4" aria-hidden />
        Sugerir respuesta
      </Button>
    );
  }

  return (
    <section
      aria-label="Borrador sugerido"
      aria-busy={loading || undefined}
      className={clsx('w-full rounded-xl border border-linea bg-chapa-2 p-3.5 sm:p-4', className)}
    >
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 w-4 h-4 shrink-0 text-tinta" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug">
            {loading ? 'Armando un borrador con el historial del cliente…' : error ? 'No se pudo sugerir una respuesta' : draft?.reason_label}
          </p>
          {!loading && draft && (
            <p className="mt-0.5 text-[13px] leading-snug text-tiza">
              {draft.rationale}
            </p>
          )}
          {error && <p className="mt-0.5 text-[13px] font-semibold text-rojo-tinta">{error}</p>}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar el borrador"
          className="-mr-1 -mt-1 h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-tiza hover:bg-linea hover:text-tinta cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading && (
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="h-3 w-11/12 animate-pulse rounded bg-linea" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-linea" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-linea" />
        </div>
      )}

      {!loading && draft && (
        <>
          <div className="mt-3 rounded-lg border border-linea bg-chapa px-3.5 py-3">
            {draft.subject && (
              <p className="mb-2 text-[13px] text-tiza">
                Asunto: <span className="font-semibold text-tinta">{draft.subject}</span>
              </p>
            )}
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{draft.body_text}</p>
          </div>

          {draft.to_confirm.length > 0 && (
            <div className="mt-2.5 rounded-lg border border-ambar/30 bg-ambar-velo px-3 py-2 text-ambar-tinta">
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
        </>
      )}

      {!loading && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Sin <form>: el asistente vive dentro del formulario del correo y no puede anidarse otro. */}
          <div className="flex min-w-0 flex-1 gap-2">
            <label htmlFor="borrador-pedido" className="sr-only">
              Pedile un cambio al borrador
            </label>
            <input
              id="borrador-pedido"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.stopPropagation();
                  ask(instruction);
                }
              }}
              maxLength={300}
              placeholder="Pedile un cambio: más corto, ofrecé pasar a medir…"
              className={clsx(controlClasses, 'h-10 min-w-0 flex-1 px-3 text-sm')}
            />
            <Button size="sm" variant="secundario" className="h-10" aria-label="Otra versión" onClick={() => ask(instruction)}>
              <RefreshCw className="w-4 h-4" aria-hidden />
              <span className="hidden sm:inline">Otra versión</span>
            </Button>
          </div>
          {draft && (
            <Button
              size="sm"
              className="h-10"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onUse(draft);
                close();
              }}
            >
              Usar borrador
            </Button>
          )}
        </div>
      )}
      {!loading && draft && <p className="mt-2 text-[12px] text-tiza">Se pasa al mensaje para que lo revises y lo edites. No se envía solo.</p>}
    </section>
  );
}
