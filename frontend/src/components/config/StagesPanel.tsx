'use client';

import React, { useState } from 'react';
import { Check, Pencil, Plus, X } from 'lucide-react';
import type { Stage } from '@/types/crm';
import type { StageKind } from '@/types/config';
import { createStage, fetchAllStages, reorderStages, updateStage } from '@/lib/api-config';
import { useLoad } from '@/lib/useLoad';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import type { Tone } from '@/lib/catalogs';
import { ConfigRow, ConfigRows, MoveButtons, Position, moved } from './ConfigList';

const KIND_OPTIONS: { value: StageKind; label: string; hint: string }[] = [
  { value: 'open', label: 'Abierta', hint: 'El presupuesto sigue en curso' },
  { value: 'won', label: 'Ganada', hint: 'Venta concretada' },
  { value: 'lost', label: 'Perdida', hint: 'Se cierra con motivo de pérdida' },
];
const KIND_CHIP: Record<StageKind, { label: string; tone: Tone }> = {
  open: { label: 'Abierta', tone: 'tinta' },
  won: { label: 'Ganada', tone: 'verde' },
  lost: { label: 'Perdida', tone: 'rojo' },
};

const kindOf = (s: Stage): StageKind => (s.is_closed_won ? 'won' : s.is_closed_lost ? 'lost' : 'open');

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="color"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-14 shrink-0 cursor-pointer rounded-[10px] border border-linea-fuerte bg-chapa p-1"
    />
  );
}

/** Embudo configurable: alta, renombre, color, tipo, orden y baja lógica de etapas. */
export function StagesPanel() {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useLoad(fetchAllStages);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [kind, setKind] = useState<StageKind>('open');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const stages = data ?? [];
  const fail = (title: string, err: unknown) => toast.error(title, err instanceof Error ? err.message : undefined);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) return;
    setAdding(true);
    try {
      const created = await createStage({ name: clean, color, kind });
      setName('');
      // La etapa abierta nueva se ubica antes de los cierres: se relee el orden completo.
      setData(await fetchAllStages());
      toast.success('Etapa creada', created.name);
    } catch (err) {
      fail('No pudimos crear la etapa', err);
    } finally {
      setAdding(false);
    }
  };

  const patch = async (stage: Stage, changes: { name?: string; color?: string; kind?: StageKind; is_active?: boolean }) => {
    setBusy(stage.id);
    try {
      const saved = await updateStage(stage.id, changes);
      setData(stages.map((s) => (s.id === saved.id ? saved : s)));
      if (changes.is_active !== undefined) toast.success(saved.is_active ? 'Etapa activada' : 'Etapa desactivada', saved.name);
      return true;
    } catch (err) {
      fail('No pudimos guardar la etapa', err);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const move = async (stage: Stage, delta: -1 | 1) => {
    const ids = moved(
      stages.map((s) => s.id),
      stage.id,
      delta
    );
    if (!ids) return;
    setBusy(stage.id);
    try {
      setData(await reorderStages(ids));
    } catch (err) {
      fail('No pudimos guardar el orden', err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Etapas del embudo" className="space-y-4">
      <p className="max-w-[70ch] text-[15px] text-tiza">
        El tablero y el embudo respetan este orden. Una etapa con presupuestos abiertos no se puede desactivar, y siempre tiene que quedar al menos una abierta, una ganada y una perdida.
      </p>
      <form onSubmit={add} className="flex flex-col gap-2 md:flex-row md:items-end">
        <Field label="Nueva etapa" className="flex-1 md:max-w-sm">
          {({ id }) => <Input id={id} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Visita a la obra" />}
        </Field>
        <Field label="Tipo" className="md:w-44">
          {({ id }) => <Select id={id} value={kind} onChange={(v) => setKind(v as StageKind)} options={KIND_OPTIONS} />}
        </Field>
        <div className="flex items-end gap-2">
          <ColorInput value={color} onChange={setColor} label="Color de la etapa nueva" />
          <Button type="submit" isLoading={adding} disabled={name.trim().length < 2}>
            <Plus className="w-4.5 h-4.5" aria-hidden />
            Agregar
          </Button>
        </div>
      </form>

      {loading ? (
        <LoadingBlock label="Cargando etapas" />
      ) : error ? (
        <EmptyState
          illustration="clientes"
          title="No pudimos cargar las etapas"
          description={error}
          action={
            <Button variant="secundario" onClick={() => reload()}>
              Reintentar
            </Button>
          }
        />
      ) : stages.length === 0 ? (
        <EmptyState illustration="clientes" title="Todavía no hay etapas" />
      ) : (
        <ConfigRows label="Etapas del embudo">
          {stages.map((stage, i) => (
            <StageRow
              key={stage.id}
              stage={stage}
              n={i + 1}
              first={i === 0}
              last={i === stages.length - 1}
              busy={busy === stage.id}
              onMove={(d) => move(stage, d)}
              onPatch={(changes) => patch(stage, changes)}
            />
          ))}
        </ConfigRows>
      )}
    </section>
  );
}

function StageRow({
  stage,
  n,
  first,
  last,
  busy,
  onMove,
  onPatch,
}: {
  stage: Stage;
  n: number;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onPatch: (changes: { name?: string; color?: string; kind?: StageKind; is_active?: boolean }) => Promise<boolean>;
}) {
  const active = stage.is_active !== false;
  const kind = kindOf(stage);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: stage.name, color: stage.color, kind });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.name.trim();
    if (clean.length < 2) return;
    const changes: { name?: string; color?: string; kind?: StageKind } = {};
    if (clean !== stage.name) changes.name = clean;
    if (draft.color !== stage.color) changes.color = draft.color;
    if (draft.kind !== kind) changes.kind = draft.kind;
    if (!Object.keys(changes).length || (await onPatch(changes))) setEditing(false);
  };

  return (
    <ConfigRow inactive={!active}>
      <Position n={n} />
      {editing ? (
        <form onSubmit={save} className="flex min-w-0 flex-1 basis-72 flex-wrap items-center gap-2">
          <ColorInput value={draft.color} onChange={(c) => setDraft((d) => ({ ...d, color: c }))} label={`Color de ${stage.name}`} />
          <Input
            aria-label={`Nuevo nombre para ${stage.name}`}
            className="min-w-40 flex-1"
            value={draft.name}
            maxLength={100}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
            autoFocus
          />
          <Select
            aria-label={`Tipo de ${stage.name}`}
            className="w-36"
            value={draft.kind}
            onChange={(v) => setDraft((d) => ({ ...d, kind: v as StageKind }))}
            options={KIND_OPTIONS}
          />
          <Button type="submit" variant="secundario" size="icono" aria-label="Guardar etapa" isLoading={busy} disabled={draft.name.trim().length < 2}>
            {!busy && <Check className="w-4.5 h-4.5" />}
          </Button>
          <Button variant="fantasma" size="icono" aria-label="Cancelar" onClick={() => setEditing(false)}>
            <X className="w-4.5 h-4.5" />
          </Button>
        </form>
      ) : (
        <div className="flex min-w-0 flex-1 basis-72 flex-wrap items-center gap-2">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden />
          <span className={!active ? 'font-semibold text-tiza line-through decoration-1' : 'font-semibold'}>{stage.name}</span>
          <Chip tone={KIND_CHIP[kind].tone}>{KIND_CHIP[kind].label}</Chip>
          {!active && <Chip tone="neutro">Desactivada</Chip>}
          <Button
            variant="fantasma"
            size="icono-sm"
            aria-label={`Editar ${stage.name}`}
            title="Editar"
            onClick={() => {
              setDraft({ name: stage.name, color: stage.color, kind });
              setEditing(true);
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
        </div>
      )}
      <MoveButtons name={stage.name} first={first} last={last} disabled={busy} onMove={onMove} />
      <div className="w-[150px] shrink-0">
        <Switch checked={active} label={active ? 'Activa' : 'Inactiva'} disabled={busy} onChange={(v) => onPatch({ is_active: v })} />
      </div>
    </ConfigRow>
  );
}
