'use client';

import React, { useCallback, useState } from 'react';
import { Check, Pencil, Plus, X } from 'lucide-react';
import type { CatalogItem, CatalogKind } from '@/types/config';
import { createCatalogItem, fetchCatalog, reorderCatalog, updateCatalogItem } from '@/lib/api-config';
import { invalidateCatalog } from '@/lib/useCatalogs';
import { useLoad } from '@/lib/useLoad';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { ConfigRow, ConfigRows, MoveButtons, Position, moved } from './ConfigList';

const COPY: Record<CatalogKind, { singular: string; plural: string; placeholder: string; note: string }> = {
  activity_type: {
    singular: 'tipo de actividad',
    plural: 'Tipos de actividad',
    placeholder: 'Ej.: Visita técnica',
    note: 'Los tipos de sistema (llamada, WhatsApp, correo…) los genera el CRM solo: se pueden renombrar y ordenar, pero no desactivar.',
  },
  origin: {
    singular: 'origen',
    plural: 'Orígenes',
    placeholder: 'Ej.: Feria de la construcción',
    note: 'Renombrar o desactivar un origen no cambia a los clientes que ya lo tienen: lo siguen mostrando.',
  },
  loss_reason: {
    singular: 'motivo de pérdida',
    plural: 'Motivos de pérdida',
    placeholder: 'Ej.: Pidió entrega en el día',
    note: 'Renombrar o desactivar un motivo no cambia los presupuestos ya perdidos: lo siguen mostrando.',
  },
};

/** Alta, renombre, orden y baja lógica de un catálogo (tipos de actividad, orígenes o motivos de pérdida). */
export function CatalogPanel({ kind }: { kind: CatalogKind }) {
  const toast = useToast();
  const copy = COPY[kind];
  const loader = useCallback(() => fetchCatalog(kind, true), [kind]);
  const { data, error, loading, reload, setData } = useLoad(loader);
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const items = data ?? [];

  const fail = (title: string, err: unknown) => toast.error(title, err instanceof Error ? err.message : undefined);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = label.trim();
    if (clean.length < 2) return;
    setAdding(true);
    try {
      const item = await createCatalogItem(kind, clean);
      setData([...items, item]);
      setLabel('');
      invalidateCatalog(kind);
      toast.success('Agregado', item.label);
    } catch (err) {
      fail(`No pudimos agregar el ${copy.singular}`, err);
    } finally {
      setAdding(false);
    }
  };

  const patch = async (item: CatalogItem, changes: { label?: string; is_active?: boolean }) => {
    setBusy(item.id);
    try {
      const saved = await updateCatalogItem(item.id, changes);
      setData(items.map((i) => (i.id === saved.id ? saved : i)));
      invalidateCatalog(kind);
      if (changes.is_active !== undefined) toast.success(saved.is_active ? 'Activado' : 'Desactivado', saved.label);
      return true;
    } catch (err) {
      fail('No pudimos guardar el cambio', err);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const move = async (item: CatalogItem, delta: -1 | 1) => {
    const ids = moved(
      items.map((i) => i.id),
      item.id,
      delta
    );
    if (!ids) return;
    setBusy(item.id);
    try {
      setData(await reorderCatalog(kind, ids));
      invalidateCatalog(kind);
    } catch (err) {
      fail('No pudimos guardar el orden', err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label={copy.plural} className="space-y-4">
      <p className="max-w-[70ch] text-[15px] text-tiza">{copy.note}</p>
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label={`Nuevo ${copy.singular}`} className="flex-1 sm:max-w-md">
          {({ id }) => <Input id={id} value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder={copy.placeholder} />}
        </Field>
        <Button type="submit" isLoading={adding} disabled={label.trim().length < 2}>
          <Plus className="w-4.5 h-4.5" aria-hidden />
          Agregar
        </Button>
      </form>

      {loading ? (
        <LoadingBlock label={`Cargando ${copy.plural.toLowerCase()}`} />
      ) : error ? (
        <EmptyState
          illustration="clientes"
          title={`No pudimos cargar ${copy.plural.toLowerCase()}`}
          description={error}
          action={
            <Button variant="secundario" onClick={() => reload()}>
              Reintentar
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState illustration="clientes" title={`Todavía no hay ${copy.plural.toLowerCase()}`} />
      ) : (
        <ConfigRows label={copy.plural}>
          {items.map((item, i) => (
            <CatalogRow
              key={item.id}
              item={item}
              n={i + 1}
              first={i === 0}
              last={i === items.length - 1}
              busy={busy === item.id}
              onMove={(d) => move(item, d)}
              onPatch={(changes) => patch(item, changes)}
            />
          ))}
        </ConfigRows>
      )}
    </section>
  );
}

function CatalogRow({
  item,
  n,
  first,
  last,
  busy,
  onMove,
  onPatch,
}: {
  item: CatalogItem;
  n: number;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onPatch: (changes: { label?: string; is_active?: boolean }) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (clean.length < 2) return;
    if (clean === item.label || (await onPatch({ label: clean }))) setEditing(false);
  };

  return (
    <ConfigRow inactive={!item.is_active}>
      <Position n={n} />
      {editing ? (
        <form onSubmit={save} className="flex min-w-0 flex-1 basis-56 items-center gap-2">
          <Input
            aria-label={`Nuevo nombre para ${item.label}`}
            value={draft}
            maxLength={120}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
            autoFocus
          />
          <Button type="submit" variant="secundario" size="icono" aria-label="Guardar nombre" isLoading={busy} disabled={draft.trim().length < 2}>
            {!busy && <Check className="w-4.5 h-4.5" />}
          </Button>
          <Button variant="fantasma" size="icono" aria-label="Cancelar" onClick={() => setEditing(false)}>
            <X className="w-4.5 h-4.5" />
          </Button>
        </form>
      ) : (
        <div className="flex min-w-0 flex-1 basis-56 flex-wrap items-center gap-2">
          <span className={!item.is_active ? 'font-semibold text-tiza line-through decoration-1' : 'font-semibold'}>{item.label}</span>
          {item.is_system && (
            <Chip tone="tinta" dot={false}>
              Sistema
            </Chip>
          )}
          {!item.is_active && <Chip tone="neutro">Desactivado</Chip>}
          <Button
            variant="fantasma"
            size="icono-sm"
            aria-label={`Renombrar ${item.label}`}
            title="Renombrar"
            onClick={() => {
              setDraft(item.label);
              setEditing(true);
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
        </div>
      )}
      <MoveButtons name={item.label} first={first} last={last} disabled={busy} onMove={onMove} />
      <div className="w-[150px] shrink-0" title={item.is_system ? 'Lo usa el sistema: no se puede desactivar' : undefined}>
        <Switch
          checked={item.is_active}
          label={item.is_active ? 'Activo' : 'Inactivo'}
          disabled={busy || item.is_system}
          onChange={(v) => onPatch({ is_active: v })}
        />
      </div>
    </ConfigRow>
  );
}
