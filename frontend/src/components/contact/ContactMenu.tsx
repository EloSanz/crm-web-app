'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { ChevronDown, Mail, MessageCircle, MessagesSquare, Phone } from 'lucide-react';
import { buttonClasses } from '@/components/ui/Button';
import { popoverStyle, usePopover } from '@/components/ui/usePopover';
import { useToast } from '@/components/ui/Toast';
import { fetchWhatsAppStatus, logCall, logWhatsAppOpen } from '@/lib/api-comms';
import { telHref } from '@/lib/format';
import type { Activity, Company, Contact } from '@/types/crm';
import type { PhoneTarget, WhatsAppStatus } from '@/types/comms';
import { waLink, whatsappNumber } from './phone';

export interface ContactMenuProps {
  opportunityId?: string;
  contact?: Contact | null;
  company?: Company | null;
  phone?: string | null;
  email?: string | null;
  className?: string;
  /** Se llama cuando la llamada o el WhatsApp externo quedaron registrados en el seguimiento. */
  onLogged?: (activity: Activity) => void;
}

interface Item {
  key: string;
  label: string;
  detail: string;
  icon: React.ReactNode;
  disabled: boolean;
  href?: string;
  onSelect: () => void;
}

/** "Contactar": elegir cómo hablarle al cliente (llamada, WhatsApp o correo) sin salir del CRM. */
export function ContactMenu({ opportunityId, contact, company, phone, email, className, onLogged }: ContactMenuProps) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const toast = useToast();
  const menuId = useId();
  const { triggerRef, panelRef, open, setOpen, close, pos } = usePopover<HTMLButtonElement>({ minWidth: 300, maxHeight: 360, align: 'end' });
  const itemsRef = useRef<(HTMLElement | null)[]>([]);
  const [wa, setWa] = useState<WhatsAppStatus | null>(null);

  useEffect(() => {
    let alive = true;
    fetchWhatsAppStatus().then((s) => alive && setWa(s));
    return () => {
      alive = false;
    };
  }, []);

  const phoneRaw = phone ?? contact?.phone ?? company?.phone ?? null;
  const emailRaw = email ?? contact?.email ?? company?.email ?? null;
  const tel = telHref(phoneRaw);
  const waNumber = whatsappNumber(phoneRaw);
  const companyId = company?.id ?? contact?.company_id ?? null;
  const target: PhoneTarget = {
    contact_id: contact?.id ?? null,
    phone: phoneRaw,
    opportunity_id: opportunityId ?? null,
    company_id: companyId,
  };
  // Sin correo cargado igual se puede redactar si hay un presupuesto o empresa de donde elegir destinatarios.
  const canCompose = Boolean(emailRaw || opportunityId || companyId);

  const registered = (activity: Activity) => onLogged?.(activity);
  const logFailed = (err: unknown) => toast.error('No se pudo registrar en el seguimiento', err instanceof Error ? err.message : undefined);

  const items: Item[] = [
    {
      key: 'llamar',
      label: 'Llamar',
      detail: phoneRaw || 'Sin teléfono cargado',
      icon: <Phone className="w-[18px] h-[18px]" aria-hidden />,
      disabled: !tel,
      href: tel ?? undefined,
      onSelect: () => {
        logCall(target).then(registered).catch(logFailed);
      },
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      detail: waNumber ? phoneRaw || '' : phoneRaw ? 'Celular inválido' : 'Sin celular cargado',
      icon: <MessageCircle className="w-[18px] h-[18px]" aria-hidden />,
      disabled: !waNumber,
      onSelect: () => {
        if (!waNumber) return;
        if (wa?.configured) {
          const q = new URLSearchParams({ volver: pathname });
          if (opportunityId) q.set('opportunity_id', opportunityId);
          if (!contact?.id && companyId) q.set('company_id', companyId);
          router.push(`/whatsapp/${contact?.id ?? `tel-${waNumber}`}?${q.toString()}`);
          return;
        }
        const link = waLink(phoneRaw);
        if (link) window.open(link, '_blank', 'noopener,noreferrer');
        logWhatsAppOpen(target).then(registered).catch(logFailed);
      },
    },
    {
      key: 'correo',
      label: 'Correo',
      detail: emailRaw || (canCompose ? 'Elegís el destinatario' : 'Sin correo cargado'),
      icon: <Mail className="w-[18px] h-[18px]" aria-hidden />,
      disabled: !canCompose,
      onSelect: () => {
        const q = new URLSearchParams({ volver: pathname });
        if (opportunityId) q.set('opportunity_id', opportunityId);
        if (contact?.id) q.set('contact_id', contact.id);
        if (companyId) q.set('company_id', companyId);
        if (emailRaw) q.set('para', emailRaw);
        router.push(`/correo/nuevo?${q.toString()}`);
      },
    },
  ];

  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const focusAt = (i: number) => itemsRef.current[i]?.focus();
  const move = (delta: number) => {
    if (!enabled.length) return;
    const current = itemsRef.current.findIndex((el) => el === document.activeElement);
    const at = enabled.indexOf(current);
    const next = at === -1 ? (delta > 0 ? 0 : enabled.length - 1) : (at + delta + enabled.length) % enabled.length;
    focusAt(enabled[next]);
  };

  const itemClass = (disabled: boolean) =>
    clsx(
      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none',
      disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-chapa-2 focus-visible:bg-chapa-2'
    );

  const body = (it: Item) => (
    <>
      <span className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-[10px] border border-linea bg-chapa-2 text-tinta">{it.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight text-tinta">{it.label}</span>
        <span className="mt-0.5 block truncate text-[13px] text-tiza">{it.detail}</span>
      </span>
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (open) close();
          else {
            setOpen(true);
            requestAnimationFrame(() => focusAt(enabled[0] ?? 0));
          }
        }}
        className={buttonClasses('secundario', 'md', clsx(open && 'border-tiza bg-chapa-2', className))}
      >
        <MessagesSquare className="w-4 h-4" aria-hidden />
        Contactar
        <ChevronDown className={clsx('-mr-1 w-4 h-4 text-tiza transition-transform duration-150', open && 'rotate-180')} aria-hidden />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-label="Contactar al cliente"
            style={popoverStyle(pos)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                move(1);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                move(-1);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
              } else if (e.key === 'Tab') {
                close(false);
              }
            }}
            className="z-[80] overflow-y-auto rounded-xl border border-linea bg-chapa p-1.5 shadow-alzada animate-desplegar"
          >
            {items.map((it, i) => {
              const ref = (el: HTMLElement | null) => {
                itemsRef.current[i] = el;
              };
              if (it.href && !it.disabled) {
                return (
                  <a
                    key={it.key}
                    ref={ref}
                    role="menuitem"
                    href={it.href}
                    onClick={() => {
                      close(false);
                      it.onSelect();
                    }}
                    className={itemClass(false)}
                  >
                    {body(it)}
                  </a>
                );
              }
              return (
                <button
                  key={it.key}
                  ref={ref}
                  type="button"
                  role="menuitem"
                  aria-disabled={it.disabled || undefined}
                  tabIndex={it.disabled ? -1 : 0}
                  onClick={() => {
                    if (it.disabled) return;
                    close(false);
                    it.onSelect();
                  }}
                  className={itemClass(it.disabled)}
                >
                  {body(it)}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
