'use client';

import React from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { RequireRole } from '@/components/users/RequireRole';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { StatTile } from '@/components/charts/StatTile';
import { CHART } from '@/components/charts/palette';
import { fmtInt, fmtMoney, fmtPct } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { fetchCatalogMetrics } from '@/lib/api-metrics';
import { PRODUCT_CATEGORIES } from '@/lib/catalogs';
import { formatARS, formatQty } from '@/lib/format';
import type { CatalogMaterial, CatalogMetrics } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../_components/data';
import { ChartGrid, ListTable, TileRow } from '../_components/ListTable';
import { Num, plural, RowMain, RowValue } from '../_components/bits';

const col = createColumnHelper<TableSetup, CatalogMaterial>();
const categoryLabel = (c: string) => PRODUCT_CATEGORIES.find((p) => p.value === c)?.label ?? c;
const productHref = (m: CatalogMaterial) => (m.product_id ? `/catalog/${m.product_id}` : undefined);

export default function CatalogoPage() {
  return (
    <RequireRole role="admin">
      <CatalogoData />
    </RequireRole>
  );
}

function CatalogoData() {
  const result = useMetrics(fetchCatalogMetrics);
  return (
    <MetricsBody result={result} label="Cargando catálogo">
      {(d) => <Catalogo d={d} />}
    </MetricsBody>
  );
}

function Catalogo({ d }: { d: CatalogMetrics }) {
  const s = d.summary;
  const categories = d.by_category.filter((c) => c.quoted_amount > 0 || c.sold_amount > 0);

  const columns = col.columns([
    col.accessor('name', { header: 'Material', sortFn: 'text', cell: (i) => <RowMain title={i.getValue()} sub={i.row.original.code ?? undefined} /> }),
    col.accessor((r) => categoryLabel(r.category), { id: 'rubro', header: 'Rubro', sortFn: 'text', cell: (i) => <span className="whitespace-nowrap">{i.getValue()}</span> }),
    col.accessor('quoted_quotes', { header: 'Presupuestos', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtInt(i.getValue())}</Num> }),
    col.accessor('quoted_qty', { header: 'Cantidad cotizada', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{formatQty(i.getValue(), i.row.original.unit)}</Num> }),
    col.accessor('quoted_amount', { header: 'Cotizado', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtMoney(i.getValue())}</Num> }),
    col.accessor('sold_amount', { header: 'Vendido', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num strong>{fmtMoney(i.getValue())}</Num> }),
  ]);

  const materialTable = (rows: CatalogMaterial[], kind: 'quoted' | 'sold') => ({
    head: ['Material', 'Rubro', 'Presupuestos', 'Cantidad', 'Monto'],
    rows: rows.map((m) => [m.name, categoryLabel(m.category), fmtInt(m[`${kind}_quotes`]), formatQty(m[`${kind}_qty`], m.unit), formatARS(m[`${kind}_amount`])]),
  });

  return (
    <>
      <TileRow label="Resumen del catálogo">
        <StatTile dark label="Cotizado" value={s.quoted_amount} format={fmtMoney} caption={plural(s.materials_quoted, 'material', 'materiales')} />
        <StatTile label="Vendido" value={s.sold_amount} format={fmtMoney} caption={plural(s.materials_sold, 'material', 'materiales')} />
        <StatTile label="Vendido sobre cotizado" value={s.quoted_amount ? s.sold_amount / s.quoted_amount : null} format={fmtPct} />
        <StatTile label="Rubros cotizados" value={categories.length} format={fmtInt} caption={s.top_category ? `Lidera ${categoryLabel(s.top_category).toLocaleLowerCase('es-AR')}` : undefined} />
      </TileRow>

      <ChartGrid>
        <ChartCard title="Más cotizados" hint="En pesos" empty={d.top_quoted.length === 0} emptyText="Sin materiales cotizados en este período" table={materialTable(d.top_quoted, 'quoted')}>
          <BarChart
            label="Materiales más cotizados"
            valueLabel="cotizado"
            format={fmtMoney}
            data={d.top_quoted.map((m) => ({
              key: m.product_id ?? m.name,
              label: m.name,
              sub: `${formatQty(m.quoted_qty, m.unit)} · ${plural(m.quoted_quotes, 'presupuesto', 'presupuestos')}`,
              value: m.quoted_amount,
              href: productHref(m),
            }))}
          />
        </ChartCard>
        <ChartCard title="Más vendidos" hint="En pesos" empty={d.top_sold.length === 0} emptyText="Sin ventas concretadas en este período" table={materialTable(d.top_sold, 'sold')}>
          <BarChart
            label="Materiales más vendidos"
            valueLabel="vendido"
            format={fmtMoney}
            data={d.top_sold.map((m) => ({
              key: m.product_id ?? m.name,
              label: m.name,
              sub: `${formatQty(m.sold_qty, m.unit)} · ${plural(m.sold_quotes, 'venta', 'ventas')}`,
              value: m.sold_amount,
              href: productHref(m),
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Por rubro"
          hint="En pesos"
          className="xl:col-span-2"
          empty={categories.length === 0}
          emptyText="Sin materiales cotizados en este período"
          legend={[
            { label: 'Cotizado', color: CHART.soft },
            { label: 'Vendido', color: CHART.ink, shape: 'tick' },
          ]}
          table={{ head: ['Rubro', 'Cotizado', 'Vendido', 'Materiales'], rows: categories.map((c) => [categoryLabel(c.category), formatARS(c.quoted_amount), formatARS(c.sold_amount), fmtInt(c.materials)]) }}
        >
          <BarChart
            label="Cotizado y vendido por rubro"
            valueLabel="cotizado"
            markerLabel="Vendido"
            color={CHART.soft}
            format={fmtMoney}
            data={categories.map((c) => ({ key: c.category, label: categoryLabel(c.category), value: c.quoted_amount, marker: c.sold_amount }))}
          />
        </ChartCard>
      </ChartGrid>

      <ListTable
        title="Materiales"
        rows={d.materials}
        columns={columns}
        rowKey={(r) => r.product_id ?? r.name}
        rowLabel={(r) => `${r.name}: cotizado ${fmtMoney(r.quoted_amount)}`}
        href={(r) => productHref(r) ?? '/catalog'}
        initialSort={[{ id: 'quoted_amount', desc: true }]}
        alignRight={['quoted_quotes', 'quoted_qty', 'quoted_amount', 'sold_amount']}
        grow="name"
        emptyText="Sin materiales cotizados en este período"
        item={(r) => (
          <>
            <RowMain title={r.name} sub={categoryLabel(r.category)} />
            <RowValue value={fmtMoney(r.quoted_amount)} sub={r.sold_amount ? `${fmtMoney(r.sold_amount)} vendido` : undefined} />
          </>
        )}
      />
    </>
  );
}
