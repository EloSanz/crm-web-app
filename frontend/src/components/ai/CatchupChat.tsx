'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { AlertTriangle, ArrowUpRight, HelpCircle, SendHorizontal, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { controlClasses } from '@/components/ui/Field';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { askCatchup, fetchCatchup } from '@/lib/api-ai';
import { useLoad } from '@/lib/useLoad';
import { formatARS, formatDate } from '@/lib/format';
import type { CatchupAnswer, CatchupOverview, Citation } from '@/types/ai';

type Turn = { id: string; question: string; answer?: CatchupAnswer; error?: string; pending?: boolean };

/** «Ponete al día»: el vendedor pregunta por la historia del cliente y cada dato viene con su fuente. */
export function CatchupChat({ companyId }: { companyId: string }) {
  const load = useCallback(() => fetchCatchup(companyId), [companyId]);
  const { data, error, loading } = useLoad(load);

  if (loading) {
    return (
      <AppLayout>
        <LoadingBlock label="Leyendo el historial del cliente" rows={4} />
      </AppLayout>
    );
  }
  if (error || !data) {
    return (
      <AppLayout>
        <EmptyState
          illustration="clientes"
          title="No se puede abrir el historial de este cliente"
          description={error ?? undefined}
          action={
            <ButtonLink href={`/companies/${companyId}`} variant="secundario">
              Volver al cliente
            </ButtonLink>
          }
        />
      </AppLayout>
    );
  }
  return (
    <AppLayout>
      <Conversation companyId={companyId} overview={data} />
    </AppLayout>
  );
}

function Summary({ o }: { o: CatchupOverview }) {
  const items = [
    { label: 'Presupuestos', value: String(o.opportunities), hint: `${o.open} abiertos · ${o.won} ganados · ${o.lost} perdidos` },
    { label: 'Cotizado', value: formatARS(o.quoted_total), hint: o.won_total > 0 ? `${formatARS(o.won_total)} vendido` : 'Sin ventas concretadas' },
    {
      label: 'Último contacto',
      value: o.last_contact ? formatDate(o.last_contact.at) : '—',
      hint: o.last_contact?.title ?? 'Sin contactos registrados',
    },
    { label: 'Lo atendieron', value: o.sellers.length ? o.sellers.join(', ') : '—', hint: null },
  ];
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 rounded-2xl border border-linea bg-chapa px-4 py-3.5 shadow-suave">
          <dt className="text-[13px] font-semibold text-tiza">{it.label}</dt>
          <dd className="mt-0.5">
            <span className="cifra block truncate text-[19px] font-extrabold">{it.value}</span>
            {it.hint && <span className="block truncate text-[13px] text-tiza">{it.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Texto de la respuesta con las marcas [F12] convertidas en números que llevan a su fuente. */
function AnswerText({ answer, turnId }: { answer: CatchupAnswer; turnId: string }) {
  const order = answer.citations.map((c) => c.ref);
  const parts = answer.answer.split(/(\[F\d+\])/g);
  return (
    <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">
      {parts.map((part, i) => {
        const m = part.match(/^\[(F\d+)\]$/);
        if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
        const n = order.indexOf(m[1]) + 1;
        if (n === 0) return null;
        return (
          <a
            key={i}
            href={`#${turnId}-${m[1]}`}
            className="cifra mx-0.5 inline-flex h-5 min-w-5 -translate-y-px items-center justify-center rounded-md bg-pavonado px-1 align-middle text-[11px] font-bold text-white hover:bg-pavonado-3"
            aria-label={`Fuente ${n}`}
          >
            {n}
          </a>
        );
      })}
    </p>
  );
}

function Sources({ citations, turnId }: { citations: Citation[]; turnId: string }) {
  if (citations.length === 0) return null;
  return (
    <ol className="mt-3 space-y-1.5 border-t border-linea pt-3" aria-label="Fuentes">
      {citations.map((c, i) => (
        <li key={c.ref} id={`${turnId}-${c.ref}`} className="flex scroll-mt-24 gap-2.5 text-[13px] leading-snug">
          <span className="cifra mt-px h-5 min-w-5 shrink-0 inline-flex items-center justify-center rounded-md bg-chapa-2 px-1 text-[11px] font-bold">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="break-words">
              <span className="font-semibold">{c.kind_label}</span> · <span className="cifra">{formatDate(c.at)}</span>
              {c.user_name && <> · {c.user_name}</>}
            </p>
            <p className="break-words text-tiza">
              {c.title}
              {c.opportunity_title && c.kind !== 'presupuesto' && <> · «{c.opportunity_title}»</>}
            </p>
          </div>
          {c.link && (
            <Link href={c.link} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 font-semibold text-tinta hover:bg-chapa-2">
              Ver
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
              <span className="sr-only"> en el seguimiento</span>
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}

function Conversation({ companyId, overview }: { companyId: string; overview: CatchupOverview }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = turns.some((t) => t.pending);
  const blocked = overview.assistant.budget_reached;

  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [turns.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (question.length < 3 || busy || blocked) return;
    const id = `t${Date.now()}`;
    const history = turns.filter((t) => t.answer).map((t) => ({ question: t.question, answer: t.answer!.answer }));
    setTurns((prev) => [...prev, { id, question, pending: true }]);
    setText('');
    try {
      const answer = await askCatchup(companyId, question, history);
      setTurns((prev) => prev.map((t) => (t.id === id ? { id, question, answer } : t)));
    } catch (err) {
      setTurns((prev) => prev.map((t) => (t.id === id ? { id, question, error: err instanceof Error ? err.message : 'No se pudo responder' } : t)));
    }
  };

  const asked = new Set(turns.map((t) => t.question));
  const suggestions = overview.suggested_questions.filter((q) => !asked.has(q));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader back={{ href: `/companies/${companyId}`, label: overview.company_name || 'Cliente' }} title="Ponete al día" />
      <Summary o={overview} />

      <section aria-label="Preguntas sobre el cliente" className="rounded-2xl border border-linea bg-chapa shadow-suave">
        <div className="space-y-5 p-4 sm:p-6">
          {turns.length === 0 && (
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full bg-pavonado text-white" aria-hidden>
                <Sparkles className="w-4 h-4" />
              </span>
              <div className="min-w-0 text-[15px] leading-relaxed">
                <p>
                  Preguntá lo que necesites saber de <span className="font-semibold">{overview.company_name}</span>. Respondo sólo con lo que está
                  cargado en el CRM ({overview.entries} registros) y te marco de dónde sale cada dato.
                </p>
                {overview.assistant.simulated && (
                  <p className="mt-1 text-[13px] text-tiza">Modo de prueba: sin IA real, respondo qué se le cotizó, por qué se perdió el último y cuál fue el último contacto.</p>
                )}
              </div>
            </div>
          )}

          {turns.map((t) => (
            <div key={t.id} className="space-y-3">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-pavonado px-3.5 py-2 text-[15px] text-white sm:max-w-[70%]">{t.question}</p>
              </div>
              <div className="flex items-start gap-3" aria-live="polite">
                <span className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full bg-chapa-2 text-tinta" aria-hidden>
                  <Sparkles className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-linea bg-chapa px-4 py-3">
                  {t.pending && (
                    <div className="space-y-2 py-1" aria-label="Buscando en el historial">
                      <div className="h-3 w-4/5 animate-pulse rounded bg-linea" />
                      <div className="h-3 w-3/5 animate-pulse rounded bg-linea" />
                    </div>
                  )}
                  {t.error && <p className="text-[15px] font-semibold text-rojo-tinta">{t.error}</p>}
                  {t.answer && (
                    <>
                      {t.answer.unknown && (
                        <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-tiza">
                          <HelpCircle className="w-3.5 h-3.5" aria-hidden />
                          No está en el historial
                        </p>
                      )}
                      <AnswerText answer={t.answer} turnId={t.id} />
                      {t.answer.unsourced && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-ambar-velo px-2.5 py-1.5 text-[13px] font-semibold text-ambar-tinta">
                          <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" aria-hidden />
                          Esta respuesta no cita ninguna fuente del CRM: verificala antes de usarla.
                        </p>
                      )}
                      <Sources citations={t.answer.citations} turnId={t.id} />
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {suggestions.length > 0 && !blocked && (
          <ul className="flex flex-wrap gap-1.5 border-t border-linea px-4 py-3 sm:px-6" aria-label="Preguntas sugeridas">
            {suggestions.slice(0, turns.length ? 4 : 10).map((q) => (
              <li key={q}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => ask(q)}
                  className="h-9 rounded-full border border-dashed border-linea-fuerte px-3 text-[13px] font-medium text-tinta transition-colors hover:border-tiza hover:bg-chapa-2 disabled:opacity-45 cursor-pointer"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        )}

        {blocked ? (
          <p className="border-t border-ambar/30 bg-ambar-velo px-4 py-3 text-sm font-semibold text-ambar-tinta sm:px-6">
            Se alcanzó el tope de gasto del asistente para este mes.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(text);
            }}
            className="flex items-end gap-2 border-t border-linea p-3 sm:px-6"
          >
            <label htmlFor="pregunta" className="sr-only">
              Tu pregunta
            </label>
            <textarea
              ref={inputRef}
              id="pregunta"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(text);
                }
              }}
              rows={1}
              maxLength={500}
              placeholder="¿Qué se le cotizó? ¿Por qué se perdió el último?"
              className={clsx(controlClasses, 'max-h-32 min-h-11 resize-none px-3.5 py-2.5 leading-snug')}
            />
            <Button type="submit" size="icono" aria-label="Preguntar" disabled={text.trim().length < 3 || busy}>
              <SendHorizontal className="w-5 h-5" />
            </Button>
          </form>
        )}
      </section>
      {overview.truncated && <p className="text-center text-[13px] text-tiza">El cliente tiene mucha historia: se leen los registros más recientes y el alta de cada presupuesto.</p>}
    </div>
  );
}
