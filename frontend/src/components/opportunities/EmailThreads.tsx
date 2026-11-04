'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { CornerUpLeft, Inbox, RefreshCw, Send } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { fetchMessages } from '@/lib/api-comms';
import { fetchGmailStatus, syncGmail } from '@/lib/api-ai';
import { formatDateTime } from '@/lib/format';
import type { GmailStatus } from '@/types/ai';
import type { CrmMessage } from '@/types/comms';

interface EmailThreadsProps {
  opportunityId: string;
  /** Cuando entra una respuesta nueva, el seguimiento también cambia. */
  onNewReplies?: () => void;
}

interface Thread {
  key: string;
  subject: string;
  messages: CrmMessage[];
  last: CrmMessage;
}

const STATUS_LABEL: Partial<Record<CrmMessage['status'], string>> = {
  simulado: 'Simulado',
  fallido: 'No se envió',
};

function group(messages: CrmMessage[]): Thread[] {
  const map = new Map<string, CrmMessage[]>();
  for (const m of messages) {
    const key = m.thread_id || m.id;
    map.set(key, [...(map.get(key) ?? []), m]);
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
      return { key, subject: sorted[0].subject || '(sin asunto)', messages: sorted, last: sorted[sorted.length - 1] };
    })
    .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
}

/** Correos del presupuesto agrupados por conversación, con las respuestas que llegaron al Gmail del vendedor. */
export function EmailThreads({ opportunityId, onNewReplies }: EmailThreadsProps) {
  const toast = useToast();
  const [messages, setMessages] = useState<CrmMessage[] | null>(null);
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const notify = useRef(onNewReplies);
  useEffect(() => {
    notify.current = onNewReplies;
  }, [onNewReplies]);

  const load = useCallback(async () => {
    const list = await fetchMessages({ opportunity_id: opportunityId, channel: 'email' }).catch(() => [] as CrmMessage[]);
    setMessages(list);
  }, [opportunityId]);

  const sync = useCallback(
    async (force: boolean) => {
      setSyncing(true);
      try {
        const res = await syncGmail(opportunityId, force);
        if (res.error && force) toast.error('No se pudieron buscar respuestas', res.error);
        if (res.new_messages > 0) {
          toast.success(res.new_messages === 1 ? 'Llegó una respuesta del cliente' : `Llegaron ${res.new_messages} respuestas del cliente`);
          await load();
          notify.current?.();
        } else if (force && !res.error) {
          toast.info('No hay respuestas nuevas');
        }
      } catch (err) {
        if (force) toast.error('No se pudieron buscar respuestas', err instanceof Error ? err.message : undefined);
      } finally {
        setSyncing(false);
      }
    },
    [opportunityId, load, toast]
  );

  // Al abrir el presupuesto se buscan respuestas (el backend no consulta Gmail más de una vez por minuto).
  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      const status = await fetchGmailStatus().catch(() => null);
      if (!alive) return;
      setGmail(status);
      if (status?.configured) await sync(false);
    })();
    return () => {
      alive = false;
    };
  }, [load, sync]);

  const threads = useMemo(() => group(messages ?? []), [messages]);
  if (!messages || (threads.length === 0 && !gmail?.connected)) return null;
  const canSync = gmail?.configured;

  return (
    <section aria-labelledby="correos" className="overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <h2 id="correos" className="titular text-lg">
          Correos
          {threads.length > 0 && <span className="ml-2 text-sm font-semibold text-tiza">{threads.length}</span>}
        </h2>
        {canSync && (
          <Button variant="secundario" size="sm" isLoading={syncing} onClick={() => sync(true)}>
            {!syncing && <RefreshCw className="w-4 h-4" aria-hidden />}
            Buscar respuestas
          </Button>
        )}
      </div>
      {threads.length === 0 ? (
        <p className="px-5 pb-5 pt-2 text-[15px] text-tiza">Todavía no se mandaron correos desde este presupuesto.</p>
      ) : (
        <ul className="mt-3 divide-y divide-linea border-t border-linea">
          {threads.map((t) => {
            const replies = t.messages.filter((m) => m.direction === 'entrante').length;
            const lastInbound = [...t.messages].reverse().find((m) => m.direction === 'entrante');
            const replyTarget = lastInbound ?? t.last;
            return (
              <li key={t.key} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug break-words">{t.subject}</p>
                    <p className="mt-0.5 text-[13px] text-tiza">
                      {t.messages.length} {t.messages.length === 1 ? 'correo' : 'correos'}
                      {replies > 0 && <> · {replies === 1 ? '1 respuesta del cliente' : `${replies} respuestas del cliente`}</>}
                    </p>
                  </div>
                  {t.last.status !== 'fallido' && (
                    <ButtonLink
                      href={`/correo/nuevo?opportunity_id=${opportunityId}&responder=${replyTarget.id}&volver=${encodeURIComponent(`/opportunities/${opportunityId}`)}`}
                      variant="fantasma"
                      size="sm"
                    >
                      <CornerUpLeft className="w-4 h-4" aria-hidden />
                      Responder
                    </ButtonLink>
                  )}
                </div>
                <ol className="mt-3 space-y-2">
                  {t.messages.map((m) => {
                    const inbound = m.direction === 'entrante';
                    return (
                      <li
                        key={m.id}
                        className={clsx(
                          'rounded-xl border px-3.5 py-2.5',
                          inbound ? 'border-pavonado/25 bg-chapa-2' : 'border-linea bg-chapa'
                        )}
                      >
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-tiza">
                          {inbound ? <Inbox className="w-3.5 h-3.5 text-tinta" aria-hidden /> : <Send className="w-3.5 h-3.5" aria-hidden />}
                          <span className="font-semibold text-tinta">{inbound ? m.from_address || 'Cliente' : m.user_name || 'Vendedor'}</span>
                          {!inbound && m.to_addresses.length > 0 && <span className="min-w-0 truncate">a {m.to_addresses.join(', ')}</span>}
                          <time className="cifra" dateTime={m.created_at}>
                            {formatDateTime(m.created_at)}
                          </time>
                          {STATUS_LABEL[m.status] && <span className="font-semibold text-ambar-tinta">{STATUS_LABEL[m.status]}</span>}
                        </p>
                        {m.body_text && <p className="mt-1 line-clamp-6 whitespace-pre-line break-words text-sm leading-snug">{m.body_text}</p>}
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ul>
      )}
      {gmail && gmail.configured && !gmail.connected && (
        <p className="border-t border-linea bg-chapa-2 px-5 py-3 text-[13px] text-tiza">
          Para que las respuestas del cliente lleguen solas,{' '}
          <Link href="/cuenta/correo" className="font-semibold text-tinta underline decoration-linea-fuerte hover:decoration-tinta">
            conectá tu Gmail
          </Link>
          .
        </p>
      )}
    </section>
  );
}
