'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { AlertCircle, ArrowDown, ArrowLeft, Check, CheckCheck, Clock, ExternalLink, SendHorizontal } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink, buttonClasses } from '@/components/ui/Button';
import { controlClasses } from '@/components/ui/Field';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { fetchCompany, fetchContact } from '@/lib/api';
import { CommsError, fetchWhatsAppConversation, fetchWhatsAppStatus, logWhatsAppOpen, sendWhatsApp } from '@/lib/api-comms';
import { useLoad } from '@/lib/useLoad';
import { initials } from '@/lib/format';
import type { CrmMessage, PhoneTarget, WhatsAppConversation } from '@/types/comms';
import { formatWhatsApp, waLink } from './phone';
import { safeBackHref } from './useLeaveGuard';

const POLL_MS = 8000;

export interface WhatsAppChatProps {
  /** Id del contacto, o "tel-<dígitos>" para una línea sin contacto (teléfono de la empresa). */
  target: string;
  opportunityId?: string;
  companyId?: string;
  back?: string;
}

type Loaded =
  | { mode: 'fallback'; name: string; phone: string | null }
  | { mode: 'chat'; name: string; conv: WhatsAppConversation }
  | { mode: 'error'; name: string; message: string };

type ChatMessage = CrmMessage & { pending?: boolean };

/** Conversación de WhatsApp dentro de Corralap; sin la integración conectada, abre wa.me. */
export function WhatsAppChat({ target, opportunityId, companyId, back }: WhatsAppChatProps) {
  const contactId = target.startsWith('tel-') ? null : target;
  const phoneParam = target.startsWith('tel-') ? target.slice(4).replace(/\D/g, '') : null;
  const backHref = safeBackHref(back, contactId ? `/contacts/${contactId}` : companyId ? `/companies/${companyId}` : '/opportunities');

  const load = useCallback(async (): Promise<Loaded> => {
    const [status, contact, company] = await Promise.all([
      fetchWhatsAppStatus(),
      contactId ? fetchContact(contactId).catch(() => null) : Promise.resolve(null),
      companyId ? fetchCompany(companyId).catch(() => null) : Promise.resolve(null),
    ]);
    const name = contact ? `${contact.first_name} ${contact.last_name}` : company?.name || (phoneParam ? formatWhatsApp(phoneParam) : 'Cliente');
    if (!status.configured) return { mode: 'fallback', name, phone: phoneParam ? `+${phoneParam}` : (contact?.phone ?? null) };
    try {
      const conv = await fetchWhatsAppConversation(
        contactId ? { contact_id: contactId, opportunity_id: opportunityId } : { phone: phoneParam ?? '', opportunity_id: opportunityId }
      );
      return { mode: 'chat', name, conv };
    } catch (err) {
      return { mode: 'error', name, message: err instanceof Error ? err.message : 'No se pudo cargar la conversación' };
    }
  }, [contactId, phoneParam, companyId, opportunityId]);
  const { data, loading } = useLoad(load);

  if (loading || !data) {
    return (
      <AppLayout>
        <LoadingBlock label="Abriendo la conversación" />
      </AppLayout>
    );
  }

  if (data.mode === 'chat') {
    return (
      <AppLayout>
        <ChatView
          initial={data.conv}
          name={data.name}
          backHref={backHref}
          target={{ contact_id: contactId, phone: contactId ? null : data.conv.phone, opportunity_id: opportunityId ?? null, company_id: companyId ?? null }}
        />
      </AppLayout>
    );
  }

  const phone = data.mode === 'fallback' ? data.phone : null;
  const link = waLink(phone);
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader back={{ href: backHref, label: 'Volver' }} title={data.name} />
        {data.mode === 'error' ? (
          <EmptyState illustration="clientes" title="No se pudo abrir la conversación" description={data.message} action={<ButtonLink href={backHref} variant="secundario">Volver</ButtonLink>} />
        ) : (
          <EmptyState
            illustration="clientes"
            title="WhatsApp todavía no está conectado"
            description={link ? 'Escribile desde tu WhatsApp: el contacto queda en el seguimiento.' : 'No hay un celular válido cargado.'}
            action={
              link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    logWhatsAppOpen({ contact_id: contactId, phone, opportunity_id: opportunityId ?? null, company_id: companyId ?? null }).catch(() => undefined);
                  }}
                  className={buttonClasses('primario')}
                >
                  <ExternalLink className="w-4 h-4" aria-hidden />
                  Abrir en WhatsApp
                </a>
              ) : (
                <ButtonLink href={backHref} variant="secundario">
                  Volver
                </ButtonLink>
              )
            }
          />
        )}
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Conversación
// ---------------------------------------------------------------------------

const timeFmt = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Hoy';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Ayer';
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {}),
  });
}

/** Enlaces tocables dentro del texto del mensaje. */
function Linkified({ text, onDark }: { text: string; onDark: boolean }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={clsx('break-all underline underline-offset-2', onDark ? 'text-white' : 'text-tinta')}>
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

function Ticks({ message }: { message: ChatMessage }) {
  if (message.pending) return <Clock className="w-3.5 h-3.5" aria-label="Enviando" />;
  switch (message.status) {
    case 'leido':
      return <CheckCheck className="w-4 h-4 text-white" strokeWidth={2.5} aria-label="Leído" />;
    case 'entregado':
      return <CheckCheck className="w-4 h-4" aria-label="Entregado" />;
    case 'fallido':
      return <AlertCircle className="w-3.5 h-3.5 text-rojo-claro" aria-label="No se envió" />;
    default:
      return <Check className="w-3.5 h-3.5" aria-label="Enviado" />;
  }
}

function ChatView({ initial, name, backHref, target }: { initial: WhatsAppConversation; name: string; backHref: string; target: PhoneTarget }) {
  const toast = useToast();
  const [conv, setConv] = useState(initial);
  const [pendingMsgs, setPendingMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const inboundCount = (list: CrmMessage[]) => list.filter((m) => m.direction === 'entrante').length;
  const [seenInbound, setSeenInbound] = useState(() => inboundCount(initial.messages));
  const [templateSending, setTemplateSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const query = useMemo(
    () => (target.contact_id ? { contact_id: target.contact_id, opportunity_id: target.opportunity_id ?? undefined } : { phone: target.phone ?? '', opportunity_id: target.opportunity_id ?? undefined }),
    [target.contact_id, target.phone, target.opportunity_id]
  );
  const messages: ChatMessage[] = useMemo(() => [...conv.messages, ...pendingMsgs], [conv.messages, pendingMsgs]);
  const unread = inboundCount(conv.messages) - seenInbound;
  const wa = waLink(`+${conv.phone}`);

  const nearBottom = () => {
    const el = listRef.current;
    return el ? el.scrollHeight - el.scrollTop - el.clientHeight < 80 : true;
  };

  const refresh = useCallback(async () => {
    try {
      const next = await fetchWhatsAppConversation(query);
      const near = nearBottom();
      stickRef.current = near;
      setConv(next);
      if (near) setSeenInbound(inboundCount(next.messages));
    } catch {
      // Se reintenta en el próximo ciclo.
    }
  }, [query]);

  // Consulta mensajes nuevos cada 8 s mientras la pestaña está visible.
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const tick = async () => {
      if (document.visibilityState === 'visible') await refresh();
      if (alive) timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // Queda abajo del todo si el usuario ya estaba leyendo lo último.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const onScroll = () => {
    const near = nearBottom();
    stickRef.current = near;
    if (near !== atBottom) setAtBottom(near);
    if (near && unread > 0) setSeenInbound(inboundCount(conv.messages));
  };

  const toBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !conv.window_open) return;
    const tmp: ChatMessage = {
      id: `tmp-${Date.now()}-${Math.random()}`,
      channel: 'whatsapp',
      direction: 'saliente',
      status: 'enviado',
      pending: true,
      body_text: body,
      created_at: new Date().toISOString(),
      to_addresses: [],
      cc: [],
      attachments: [],
    };
    stickRef.current = true;
    setPendingMsgs((prev) => [...prev, tmp]);
    setText('');
    try {
      const saved = await sendWhatsApp({ ...target, text: body });
      setConv((c) => (c.messages.some((m) => m.id === saved.id) ? c : { ...c, messages: [...c.messages, saved] }));
    } catch (err) {
      if (!(err instanceof CommsError)) setText((prev) => prev || body);
      toast.error('No se envió el mensaje', err instanceof Error ? err.message : undefined);
      refresh();
    } finally {
      setPendingMsgs((prev) => prev.filter((m) => m.id !== tmp.id));
    }
  };

  const sendTemplate = async () => {
    setTemplateSending(true);
    try {
      await sendWhatsApp({ ...target, template: true });
      stickRef.current = true;
      await refresh();
      toast.success('Plantilla enviada', 'Cuando el cliente responda, vas a poder escribirle.');
    } catch (err) {
      toast.error('No se envió la plantilla', err instanceof Error ? err.message : undefined);
    } finally {
      setTemplateSending(false);
    }
  };

  // Separadores por día.
  const rows: ({ kind: 'day'; key: string; label: string } | { kind: 'msg'; key: string; m: ChatMessage })[] = [];
  let lastDay = '';
  for (const m of messages) {
    const k = dayKey(m.created_at);
    if (k !== lastDay) {
      rows.push({ kind: 'day', key: `d-${k}`, label: dayLabel(m.created_at) });
      lastDay = k;
    }
    rows.push({ kind: 'msg', key: m.id, m });
  }

  return (
    <section
      aria-label={`WhatsApp con ${name}`}
      className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave h-[calc(100dvh-176px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-92px)]"
    >
      <header className="flex items-center gap-2.5 border-b border-linea px-2 py-2 sm:gap-3 sm:px-3">
        <Link href={backHref} aria-label="Volver" className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-[10px] text-tiza hover:bg-chapa-2 hover:text-tinta">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full bg-pavonado text-[14px] font-bold text-white" aria-hidden>
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="titular truncate text-[17px]">{name}</h1>
          <p className="cifra truncate text-[13px] text-tiza">{formatWhatsApp(conv.phone)}</p>
        </div>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Abrir en WhatsApp" title="Abrir en WhatsApp" className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-[10px] text-tiza hover:bg-chapa-2 hover:text-tinta">
            <ExternalLink className="w-5 h-5" />
          </a>
        )}
      </header>

      <div className="relative min-h-0 flex-1 bg-suelo">
        <div ref={listRef} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain px-3 py-4 sm:px-6">
          {messages.length === 0 ? (
            <p className="mt-10 text-center text-sm text-tiza">Todavía no hay mensajes con este número.</p>
          ) : (
            <ol role="log" aria-live="polite" aria-label="Mensajes" className="mx-auto flex max-w-3xl flex-col gap-1.5">
              {rows.map((row) => {
                if (row.kind === 'day') {
                  return (
                    <li key={row.key} className="my-2 flex justify-center first:mt-0">
                      <span className="rounded-full bg-chapa px-3 py-1 text-[12px] font-semibold text-tiza shadow-[0_1px_1px_rgb(22_33_43/0.06)] first-letter:uppercase">{row.label}</span>
                    </li>
                  );
                }
                const m = row.m;
                const out = m.direction === 'saliente';
                const author = out ? m.user_name?.split(' ')[0] : null;
                return (
                  <li key={row.key} className={clsx('flex flex-col', out ? 'items-end' : 'items-start')}>
                    <div
                      className={clsx(
                        'max-w-[85%] rounded-2xl px-3.5 pb-1.5 pt-2 shadow-[0_1px_1px_rgb(22_33_43/0.08)] sm:max-w-[70%]',
                        out ? 'rounded-br-md bg-pavonado text-white' : 'rounded-bl-md border border-linea bg-chapa text-tinta',
                        m.pending && 'opacity-75'
                      )}
                    >
                      <span className="sr-only">{out ? 'Enviado:' : `${name}:`} </span>
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
                        <Linkified text={m.body_text || ''} onDark={out} />
                      </p>
                      <p className={clsx('cifra mt-1 flex items-center justify-end gap-1 text-[12px]', out ? 'text-niebla' : 'text-tiza')}>
                        {author && <span className="truncate">{author} ·</span>}
                        <time dateTime={m.created_at}>{timeFmt(m.created_at)}</time>
                        {out && <Ticks message={m} />}
                      </p>
                    </div>
                    {m.status === 'fallido' && (
                      <p className="mt-1 flex max-w-[85%] items-start gap-1 text-[13px] font-semibold text-rojo-tinta sm:max-w-[70%]">
                        <AlertCircle className="mt-0.5 w-3.5 h-3.5 shrink-0" aria-hidden />
                        <span>{m.error || 'No se envió'}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        {!atBottom && unread > 0 && (
          <button
            type="button"
            onClick={toBottom}
            className="absolute bottom-3 left-1/2 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full bg-pavonado px-3.5 text-sm font-semibold text-white shadow-alzada animate-subir cursor-pointer"
          >
            <ArrowDown className="w-4 h-4" aria-hidden />
            Nuevos mensajes
          </button>
        )}
      </div>

      {!conv.window_open && (
        <div className="border-t border-ambar/30 bg-ambar-velo px-4 py-3 text-ambar-tinta">
          <p className="text-sm font-semibold leading-snug">
            {conv.last_inbound_at ? 'Pasaron más de 24 h desde su último mensaje.' : 'El cliente todavía no escribió a este número.'} WhatsApp sólo deja escribirle con una plantilla aprobada.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {conv.template_available && (
              <Button size="sm" variant="secundario" isLoading={templateSending} onClick={sendTemplate}>
                Enviar plantilla
              </Button>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  logWhatsAppOpen(target).catch(() => undefined);
                }}
                className={buttonClasses('secundario', 'sm')}
              >
                <ExternalLink className="w-4 h-4" aria-hidden />
                Abrir en WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t border-linea bg-chapa p-2.5 sm:p-3"
      >
        <label htmlFor="whatsapp-texto" className="sr-only">
          Mensaje
        </label>
        <textarea
          id="whatsapp-texto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
            // En pantallas táctiles Enter hace un renglón nuevo, como en WhatsApp.
            if (window.matchMedia('(pointer: coarse)').matches) return;
            e.preventDefault();
            send();
          }}
          rows={Math.min(5, Math.max(1, text.split('\n').length))}
          maxLength={4096}
          disabled={!conv.window_open}
          placeholder={conv.window_open ? 'Escribí un mensaje' : 'Conversación cerrada'}
          className={clsx(controlClasses, 'max-h-40 min-h-11 resize-none px-3.5 py-2.5 leading-snug')}
        />
        <Button type="submit" size="icono" aria-label="Enviar" disabled={!text.trim() || !conv.window_open}>
          <SendHorizontal className="w-5 h-5" />
        </Button>
      </form>
    </section>
  );
}
