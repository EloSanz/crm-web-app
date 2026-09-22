'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import type { OpportunityItemCreateData, Product } from '@/types/crm';
import { Button } from '@/components/ui/Button';
import { Field, Stepper } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { PRODUCT_CATEGORIES } from '@/lib/catalogs';
import { formatARS, formatARSCents } from '@/lib/format';
import { applyDiscount, formatUnitQty, hasWholesale, lineSubtotal, priceFor } from '@/lib/pricing';

/** Totales del presupuesto con descuentos por renglón y general. */
export function quoteTotals(items: OpportunityItemCreateData[], discountPct: number) {
  const subtotal = items.reduce((a, it) => a + lineSubtotal(it.quantity, it.unit_price, it.discount_pct ?? 0), 0);
  const total = applyDiscount(subtotal, discountPct);
  const list = items.reduce((a, it) => a + it.quantity * Number(it.list_price ?? it.unit_price), 0);
  return { subtotal, total, discount: subtotal - total, savings: Math.max(0, list - total) };
}

/** Renglón nuevo o recalculado: la escala de precio sale de la cantidad (minorista / mayorista). */
export function itemFor(product: Product, quantity: number, discountPct = 0): OpportunityItemCreateData {
  const price = priceFor(product, quantity);
  return {
    product_id: product.id,
    product_name: product.name,
    unit: product.unit,
    quantity,
    unit_price: price.unitPrice,
    list_price: price.listPrice,
    price_tier: price.tier,
    discount_pct: discountPct,
  };
}

interface QuoteItemsEditorProps {
  products: Product[];
  items: OpportunityItemCreateData[];
  onChange: (items: OpportunityItemCreateData[]) => void;
  discountPct: number;
  onDiscountChange: (pct: number) => void;
}

/** Materiales del presupuesto: catálogo, cantidades, escala mayorista automática y descuentos para negociar. */
export function QuoteItemsEditor({ products, items, onChange, discountPct, onDiscountChange }: QuoteItemsEditorProps) {
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(10);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const totals = quoteTotals(items, discountPct);

  const options = useMemo(
    () =>
      products
        .map((p) => ({
          value: p.id,
          label: p.name,
          hint: `${p.code} · ${formatARSCents(p.unit_price)} / ${p.unit}${hasWholesale(p) ? ` · mayorista ${formatARSCents(p.wholesale_price)}` : ''}`,
          group: PRODUCT_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category,
          order: PRODUCT_CATEGORIES.findIndex((c) => c.value === p.category),
        }))
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'es')),
    [products]
  );

  const setQtyAt = (i: number, quantity: number) =>
    onChange(
      items.map((it, idx) => {
        if (idx !== i) return it;
        const product = it.product_id ? byId.get(it.product_id) : undefined;
        return product && it.price_tier !== 'manual' ? itemFor(product, quantity, it.discount_pct ?? 0) : { ...it, quantity };
      })
    );

  const add = () => {
    const p = byId.get(productId);
    if (!p || qty <= 0) return;
    const i = items.findIndex((it) => it.product_id === p.id);
    if (i >= 0) setQtyAt(i, items[i].quantity + qty);
    else onChange([...items, itemFor(p, qty)]);
    setProductId('');
    setQty(10);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <Field label="Material">
          {({ id }) => (
            <Select id={id} value={productId} onChange={setProductId} placeholder="Buscar en el catálogo" searchable searchPlaceholder="Código o nombre" options={options} />
          )}
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Cantidad</p>
          <Stepper value={qty} onChange={setQty} label="Cantidad" />
        </div>
        <Button variant="secundario" onClick={add} disabled={!productId}>
          <Plus className="w-4 h-4" aria-hidden />
          Agregar
        </Button>
      </div>

      {items.length > 0 && (
        <>
          <ul className="divide-y divide-linea rounded-xl border border-linea">
            {items.map((it, i) => {
              const product = it.product_id ? byId.get(it.product_id) : undefined;
              const minQty = product && hasWholesale(product) ? Number(product.wholesale_min_qty) : null;
              const missing = minQty !== null && it.price_tier === 'minorista' ? minQty - it.quantity : null;
              const gross = it.quantity * it.unit_price;
              const line = lineSubtotal(it.quantity, it.unit_price, it.discount_pct ?? 0);
              return (
                <li key={`${it.product_id ?? it.product_name}-${i}`} className="@container px-3.5 py-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-snug break-words">{it.product_name}</p>
                      <p className="cifra flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-tiza">
                        <span>
                          {formatARSCents(it.unit_price)} / {it.unit}
                        </span>
                        {it.price_tier === 'mayorista' && (
                          <span className="rounded-full bg-pavonado px-2 py-px text-[12px] font-semibold text-white">Mayorista</span>
                        )}
                        {missing !== null && missing > 0 && product && (
                          <span>
                            Mayorista desde {formatUnitQty(minQty ?? 0, it.unit)} ({formatARSCents(product.wholesale_price)})
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="fantasma"
                      size="icono-sm"
                      onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                      aria-label={`Quitar ${it.product_name}`}
                      className="-mr-1 hover:bg-rojo-velo hover:text-rojo-tinta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Stepper size="sm" value={it.quantity} onChange={(v) => setQtyAt(i, v)} label={`Cantidad de ${it.product_name}`} />
                    <PctInput
                      label={`Descuento de ${it.product_name}`}
                      value={it.discount_pct ?? 0}
                      onChange={(v) => onChange(items.map((x, idx) => (idx === i ? { ...x, discount_pct: v } : x)))}
                    />
                    <span className="ml-auto text-right">
                      {line < gross && <span className="cifra block text-[12px] text-tiza line-through">{formatARS(gross)}</span>}
                      <span className="cifra block text-[15px] font-bold">{formatARS(line)}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <dl className="space-y-2 rounded-xl bg-chapa-2 px-4 py-3.5 text-[15px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-tiza">Subtotal</dt>
              <dd className="cifra font-semibold">{formatARS(totals.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-tiza">
                Descuento general
                <PctInput label="Descuento general" value={discountPct} onChange={onDiscountChange} />
              </dt>
              <dd className={clsx('cifra font-semibold', totals.discount > 0 ? 'text-tinta' : 'text-tiza')}>
                {totals.discount > 0 ? `− ${formatARS(totals.discount)}` : '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-linea pt-2">
              <dt className="font-bold">Total</dt>
              <dd className="cifra text-lg font-extrabold">{formatARS(totals.total)}</dd>
            </div>
            {totals.savings > 0 && (
              <p className="text-right text-[13px] text-tiza">
                Ahorro frente a precio de lista: <span className="cifra font-semibold text-tinta">{formatARS(totals.savings)}</span>
              </p>
            )}
          </dl>
        </>
      )}
    </div>
  );
}

/** Porcentaje compacto (0–100) para descuentos. */
function PctInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <label className="relative inline-flex h-9 w-[84px] shrink-0 items-center">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={100}
        step={0.5}
        value={value || ''}
        placeholder="0"
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
        }}
        className="cifra h-9 w-full rounded-[10px] border border-linea-fuerte bg-chapa pl-3 pr-7 text-[15px] font-semibold text-tinta outline-none placeholder:text-tiza focus:border-tinta"
      />
      <span className="pointer-events-none absolute right-2.5 text-sm font-semibold text-tiza">%</span>
    </label>
  );
}
