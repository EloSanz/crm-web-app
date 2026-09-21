'use client';

import React, { useState } from 'react';
import { Kanban, List, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { AffixInput, Field, Input, SearchInput, Stepper, Textarea } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { FilterChips } from '@/components/ui/FilterChips';
import { Chip } from '@/components/ui/Chip';
import { Menu } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { BrandManual } from '@/components/brand/BrandManual';
import { Punta, HealthChip } from '@/components/punta/Punta';

const COLORS: { group: string; items: { name: string; token: string; hex: string; dark?: boolean }[] }[] = [
  {
    group: 'Marca',
    items: [
      { name: 'Amarillo vial', token: 'amarillo', hex: '#FFC20E' },
      { name: 'Pavonado', token: 'pavonado', hex: '#16212B', dark: true },
      { name: 'Pavonado 3', token: 'pavonado-3', hex: '#2C3F51', dark: true },
      { name: 'Niebla', token: 'niebla', hex: '#A9B8C2' },
    ],
  },
  {
    group: 'Superficies',
    items: [
      { name: 'Suelo', token: 'suelo', hex: '#ECEEED' },
      { name: 'Chapa', token: 'chapa', hex: '#FFFFFF' },
      { name: 'Línea', token: 'linea', hex: '#DCE1DF' },
      { name: 'Tiza', token: 'tiza', hex: '#5A666F', dark: true },
    ],
  },
  {
    group: 'Semáforo',
    items: [
      { name: 'Verde · al día', token: 'verde', hex: '#1B8049', dark: true },
      { name: 'Naranja · en riesgo', token: 'ambar', hex: '#E8830C' },
      { name: 'Rojo · estancado', token: 'rojo', hex: '#CF3A2C', dark: true },
    ],
  },
];

const OPTIONS = [
  { value: 'cem', label: 'Cemento Portland 50 kg', hint: 'CEM-50 · $ 9.800 / bolsa', group: 'Aglomerantes' },
  { value: 'cal', label: 'Cal hidratada 25 kg', hint: 'CAL-25 · $ 4.200 / bolsa', group: 'Aglomerantes' },
  { value: 'are', label: 'Arena gruesa', hint: 'ARE-M3 · $ 28.000 / m³', group: 'Áridos' },
  { value: 'pie', label: 'Piedra partida 6-20', hint: 'PIE-620 · $ 38.500 / m³', group: 'Áridos' },
  { value: 'h12', label: 'Hierro aletado Ø 12 mm', hint: 'HIE-12 · $ 17.800 / barra', group: 'Hierros y aceros' },
  { value: 'h08', label: 'Hierro aletado Ø 8 mm', hint: 'HIE-08 · $ 7.900 / barra', group: 'Hierros y aceros' },
  { value: 'lad', label: 'Ladrillo hueco 12×18×33', hint: 'LAD-12 · $ 720 / unidad', group: 'Mampostería' },
  { value: 'fle', label: 'Flete con hidrogrúa', hint: 'FLE-HID · $ 65.000 / viaje', group: 'Servicios' },
];

export default function DesignSystemPage() {
  const toast = useToast();
  const [sel, setSel] = useState('');
  const [simple, setSimple] = useState('abierta');
  const [date, setDate] = useState('');
  const [qty, setQty] = useState(12);
  const [active, setActive] = useState(true);
  const [seg, setSeg] = useState<'tablero' | 'lista'>('tablero');
  const [chip, setChip] = useState<'todos' | 'cliente' | 'potencial'>('todos');
  const [confirm, setConfirm] = useState(false);

  return (
    <AppLayout>
      <div className="space-y-10">
        <PageHeader title="Sistema de diseño" />

        <Section title="Marca">
          <BrandManual />
        </Section>

        <Section title="Color">
          <div className="space-y-5">
            {COLORS.map((g) => (
              <div key={g.group}>
                <h3 className="mb-2 text-[15px] font-bold">{g.group}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {g.items.map((c) => (
                    <div key={c.token} className="overflow-hidden rounded-xl border border-linea bg-chapa">
                      <div className="h-16" style={{ background: c.hex }} />
                      <div className="px-3 py-2">
                        <p className="truncate text-sm font-bold">{c.name}</p>
                        <p className="cifra text-[13px] text-tiza">{c.hex}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tipografía · Montserrat">
          <div className="space-y-4 rounded-2xl border border-linea bg-chapa p-6">
            <p className="titular whitespace-nowrap text-[clamp(30px,9vw,64px)] leading-none">$ 338.095.000</p>
            <p className="titular text-[34px]">Presupuestos</p>
            <p className="titular text-xl">A quién llamar hoy</p>
            <p className="max-w-[60ch] text-[15px]">Cuerpo de 15 a 16 px, peso regular, para listas, formularios y datos.</p>
            <p className="text-sm font-semibold text-tiza">Encabezado de tabla</p>
            <p className="rotulo text-tiza">Grupo de opciones</p>
          </div>
        </Section>

        <Section title="Botones">
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              <Plus className="w-4 h-4" />
              Primario
            </Button>
            <Button variant="secundario">Secundario</Button>
            <Button variant="fantasma">Fantasma</Button>
            <Button variant="exito">Venta concretada</Button>
            <Button variant="peligro">Dar de baja</Button>
            <Button isLoading>Guardando</Button>
            <Button disabled>Deshabilitado</Button>
            <Button size="sm" variant="secundario">
              Chico
            </Button>
            <Button size="icono" variant="secundario" aria-label="Editar">
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        </Section>

        <Section title="Campos">
          <div className="grid grid-cols-1 gap-5 rounded-2xl border border-linea bg-chapa p-6 md:grid-cols-2">
            <Field label="Texto">{({ id }) => <Input id={id} placeholder="Construcciones del Oeste SRL" />}</Field>
            <Field label="Con error" error="Falta la razón social">
              {({ id, invalid }) => <Input id={id} aria-invalid={invalid} />}
            </Field>
            <Field label="Monto">{({ id }) => <AffixInput id={id} prefix="$" placeholder="0" inputMode="decimal" />}</Field>
            <Field label="Buscador">{({ id }) => <SearchInput id={id} icon={<Search className="w-4.5 h-4.5" />} placeholder="Buscar" />}</Field>
            <Field label="Desplegable con búsqueda y grupos">
              {({ id }) => <Select id={id} value={sel} onChange={setSel} options={OPTIONS} searchable placeholder="Buscar en el catálogo" />}
            </Field>
            <Field label="Desplegable simple">
              {({ id }) => (
                <Select
                  id={id}
                  value={simple}
                  onChange={setSimple}
                  options={[
                    { value: 'abierta', label: 'Abierta' },
                    { value: 'ganada', label: 'Ganada' },
                    { value: 'perdida', label: 'Perdida' },
                  ]}
                />
              )}
            </Field>
            <Field label="Fecha">{({ id }) => <DatePicker id={id} value={date} onChange={setDate} />}</Field>
            <div>
              <p className="mb-1.5 text-sm font-semibold">Cantidad</p>
              <Stepper value={qty} onChange={setQty} label="Cantidad" />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold">Estado</p>
              <Switch checked={active} onChange={setActive} label={active ? 'Activo' : 'Dado de baja'} />
            </div>
            <Field label="Notas" className="md:col-span-2">
              {({ id }) => <Textarea id={id} rows={2} placeholder="Hidrogrúa, horario, acceso" />}
            </Field>
          </div>
        </Section>

        <Section title="Estados y navegación">
          <div className="flex flex-wrap items-center gap-3">
            <span className="mr-2 inline-flex items-center gap-2">
              <Punta health="healthy" size={24} />
              <Punta health="warning" size={24} />
              <Punta health="stale" size={24} />
              <Punta status="ganada" size={24} />
            </span>
            <HealthChip health="healthy" days={2} />
            <HealthChip health="warning" days={9} />
            <HealthChip health="stale" days={18} />
            <Chip tone="tinta">Potencial</Chip>
            <Chip tone="neutro">Inactivo</Chip>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Segmented
              label="Vista"
              value={seg}
              onChange={setSeg}
              options={[
                { value: 'tablero', label: 'Tablero', icon: <Kanban className="w-4 h-4" /> },
                { value: 'lista', label: 'Lista', icon: <List className="w-4 h-4" /> },
              ]}
            />
            <FilterChips
              label="Estado"
              value={chip}
              onChange={setChip}
              options={[
                { value: 'todos', label: 'Todos', count: 12 },
                { value: 'cliente', label: 'Cliente', count: 7 },
                { value: 'potencial', label: 'Potencial', count: 5 },
              ]}
            />
            <Menu
              label="Acciones"
              items={[
                { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onSelect: () => toast.info('Editar') },
                { label: 'Dar de baja', icon: <Trash2 className="w-4 h-4" />, tone: 'peligro', onSelect: () => setConfirm(true) },
              ]}
            />
          </div>
        </Section>

        <Section title="Avisos y diálogos">
          <div className="flex flex-wrap gap-3">
            <Button variant="secundario" onClick={() => toast.success('Presupuesto guardado', 'Hormigón y hierros · Torre Belgrano')}>
              Éxito
            </Button>
            <Button variant="secundario" onClick={() => toast.info('Pasó a Negociación', 'Cemento para fundaciones')}>
              Información
            </Button>
            <Button variant="secundario" onClick={() => toast.warning('3 presupuestos se enfrían', 'Llamalos hoy')}>
              Aviso
            </Button>
            <Button variant="secundario" onClick={() => toast.error('No se pudo guardar', 'Revisá la conexión')}>
              Error
            </Button>
            <Button variant="secundario" onClick={() => setConfirm(true)}>
              Diálogo de confirmación
            </Button>
          </div>
          <EmptyState illustration="presupuestos" className="mt-5" title="Todavía no hay presupuestos" />
        </Section>
      </div>
      {confirm && (
        <ConfirmDialog
          title="¿Dar de baja esta empresa?"
          description="Deja de aparecer en los listados. Su historial se conserva."
          confirmLabel="Dar de baja"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            toast.success('Empresa dada de baja');
          }}
        />
      )}
    </AppLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="titular mb-4 text-xl">{title}</h2>
      {children}
    </section>
  );
}
