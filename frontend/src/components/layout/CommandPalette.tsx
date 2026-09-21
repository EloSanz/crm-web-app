'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Boxes, Building2, ClipboardList, CornerDownLeft, HardHat, MapPinned, Palette, Plus, Search } from 'lucide-react';
import { fetchCompanies, fetchContacts, fetchOpportunities, fetchProducts, fetchProjects } from '@/lib/api';
import { formatARS, formatARSCents } from '@/lib/format';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ReactNode;
  keywords?: string;
}

const ACTIONS: Item[] = [
  { id: 'a-p', group: 'Crear', label: 'Nuevo presupuesto', href: '/opportunities/nuevo', icon: <Plus className="w-4 h-4" /> },
  { id: 'a-o', group: 'Crear', label: 'Nueva obra', href: '/projects/nueva', icon: <Plus className="w-4 h-4" /> },
  { id: 'a-e', group: 'Crear', label: 'Nueva empresa', href: '/companies/nueva', icon: <Plus className="w-4 h-4" /> },
  { id: 'a-c', group: 'Crear', label: 'Nuevo contacto', href: '/contacts/nuevo', icon: <Plus className="w-4 h-4" /> },
  { id: 'a-m', group: 'Crear', label: 'Nuevo material', href: '/catalog/nuevo', icon: <Plus className="w-4 h-4" /> },
  { id: 'a-s', group: 'Ir a', label: 'Sistema de diseño', hint: 'Marca, colores y componentes de Corralap', href: '/sistema', icon: <Palette className="w-4 h-4" />, keywords: 'marca diseño componentes' },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Buscador global (⌘K / Ctrl+K): presupuestos, clientes, obras y materiales a un teclazo. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [data, setData] = useState<Item[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || data) return;
    let alive = true;
    Promise.all([fetchOpportunities(), fetchCompanies(), fetchContacts(), fetchProjects(), fetchProducts()])
      .then(([opps, companies, contacts, projects, products]) => {
        if (!alive) return;
        setData([
          ...opps.map((o) => ({
            id: `o-${o.id}`,
            group: 'Presupuestos',
            label: o.title,
            hint: `${o.company_name || o.contact_name || 'Sin cliente'} · ${formatARS(o.estimated_value)}`,
            href: `/opportunities/${o.id}`,
            icon: <ClipboardList className="w-4 h-4" />,
            keywords: o.project_name || '',
          })),
          ...companies.map((c) => ({
            id: `e-${c.id}`,
            group: 'Clientes',
            label: c.name,
            hint: c.cuit || c.industry || 'Empresa',
            href: `/companies/${c.id}`,
            icon: <Building2 className="w-4 h-4" />,
          })),
          ...contacts.map((c) => ({
            id: `c-${c.id}`,
            group: 'Clientes',
            label: `${c.first_name} ${c.last_name}`,
            hint: c.company_name || c.job_title || 'Contacto',
            href: `/contacts/${c.id}`,
            icon: <HardHat className="w-4 h-4" />,
            keywords: c.phone || '',
          })),
          ...projects.map((p) => ({
            id: `p-${p.id}`,
            group: 'Obras',
            label: p.name,
            hint: p.address,
            href: `/projects/${p.id}/editar`,
            icon: <MapPinned className="w-4 h-4" />,
          })),
          ...products.map((p) => ({
            id: `m-${p.id}`,
            group: 'Materiales',
            label: p.name,
            hint: `${p.code} · ${formatARSCents(p.unit_price)} / ${p.unit}`,
            href: `/catalog/${p.id}/editar`,
            icon: <Boxes className="w-4 h-4" />,
          })),
        ]);
      })
      .catch(() => alive && setData([]));
    return () => {
      alive = false;
    };
  }, [open, data]);

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const results = useMemo(() => {
    const q = norm(query.trim());
    const pool = [...ACTIONS, ...(data ?? [])];
    if (!q) return [...ACTIONS.filter((a) => a.group === 'Crear'), ...(data ?? []).filter((i) => i.group === 'Presupuestos').slice(0, 5)];
    return pool.filter((i) => norm(`${i.label} ${i.hint ?? ''} ${i.keywords ?? ''}`).includes(q)).slice(0, 40);
  }, [query, data]);

  const go = useCallback(
    (item: Item) => {
      onClose();
      setQuery('');
      router.push(item.href);
    },
    [onClose, router]
  );

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-start justify-center p-3 pt-[10vh] animate-aparecer">
      <div className="absolute inset-0 bg-pavonado/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en Corralap"
        className="relative flex max-h-[70dvh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-chapa shadow-alzada animate-subir"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            go(results[active]);
          }
        }}
      >
        <div className="relative border-b border-linea">
          <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-tiza" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Buscá un presupuesto, cliente, obra o material"
            aria-label="Buscar"
            className="h-16 w-full bg-transparent pl-14 pr-5 text-[16px] font-medium outline-none placeholder:text-[#7d8a92]"
          />
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2" role="listbox">
          {data === null && query && <p className="px-3 py-6 text-center text-[15px] text-tiza">Cargando…</p>}
          {results.length === 0 && data !== null && <p className="px-3 py-8 text-center text-[15px] text-tiza">Nada con «{query}».</p>}
          {results.map((item, i) => {
            const header = i === 0 || results[i - 1].group !== item.group ? item.group : null;
            return (
              <React.Fragment key={item.id}>
                {header && <p className="rotulo px-3 pb-1.5 pt-3 text-tiza">{header}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onPointerMove={() => i !== active && setActive(i)}
                  onClick={() => go(item)}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left cursor-pointer',
                    i === active ? 'bg-chapa-2' : ''
                  )}
                >
                  <span className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-[#e3e8ed] text-tinta">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{item.label}</span>
                    {item.hint && <span className="block truncate text-[13px] text-tiza">{item.hint}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="w-4 h-4 shrink-0 text-tiza" aria-hidden />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
