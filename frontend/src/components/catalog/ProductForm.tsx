'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product, ProductCategory, ProductFormData } from '@/types/crm';
import { createProduct, updateProduct } from '@/lib/api';
import { AffixInput, Field, Input, Textarea } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { FormActions, FormCard } from '@/components/ui/FormActions';
import { useToast } from '@/components/ui/Toast';
import { PRODUCT_CATEGORIES } from '@/lib/catalogs';
import { percentOff, unitSuffix } from '@/lib/pricing';

type Errors = Partial<Record<'code' | 'name' | 'unit' | 'unit_price' | 'wholesale_price' | 'wholesale_min_qty', string>>;

/** "8.900", "8900,50" o "8900.5" → número. Vacío → null; texto inválido → NaN. */
function parseAmount(raw: string): number | null {
  const s = raw.replace(/[\s$]/g, '');
  if (!s) return null;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}

const toInput = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? '' : String(Number(v)));

export function ProductForm({ product, presetCategory }: { product?: Product | null; presetCategory?: ProductCategory }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [price, setPrice] = useState(toInput(product?.unit_price));
  const [wholesalePrice, setWholesalePrice] = useState(toInput(product?.wholesale_price));
  const [wholesaleQty, setWholesaleQty] = useState(toInput(product?.wholesale_min_qty));
  const [data, setData] = useState<ProductFormData>({
    code: product?.code ?? '',
    name: product?.name ?? '',
    category: product?.category ?? presetCategory ?? 'Aglomerantes',
    unit: product?.unit ?? 'bolsa 50kg',
    unit_price: product ? Number(product.unit_price) : 0,
    description: product?.description ?? '',
    is_active: product?.is_active ?? true,
  });
  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) => setData((d) => ({ ...d, [k]: v }));

  const retail = parseAmount(price);
  const wholesale = parseAmount(wholesalePrice);
  const off = retail !== null && wholesale !== null ? percentOff(retail, wholesale) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseAmount(wholesaleQty);
    const retailPrice = retail ?? 0;
    const next: Errors = {
      code: data.code.trim() ? undefined : 'Falta el código',
      name: data.name.trim() ? undefined : 'Falta el nombre',
      unit: data.unit.trim() ? undefined : 'Falta la unidad',
      unit_price: Number.isFinite(retailPrice) && retailPrice >= 0 ? undefined : 'Revisá el precio',
    };
    if (wholesale !== null || qty !== null) {
      if (wholesale === null) next.wholesale_price = 'Falta el precio mayorista';
      else if (!Number.isFinite(wholesale) || wholesale <= 0) next.wholesale_price = 'Revisá el precio';
      else if (wholesale > retailPrice) next.wholesale_price = 'No puede superar al minorista';
      if (qty === null) next.wholesale_min_qty = 'Falta la cantidad';
      else if (!Number.isFinite(qty) || qty <= 0) next.wholesale_min_qty = 'Revisá la cantidad';
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const payload: ProductFormData = {
      ...data,
      unit_price: retailPrice,
      wholesale_price: wholesale,
      wholesale_min_qty: qty,
    };
    setSaving(true);
    try {
      if (product) await updateProduct(product.id, payload);
      else await createProduct(payload);
      toast.success(product ? 'Material actualizado' : 'Material agregado', data.name);
      router.push('/catalog');
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormCard>
        <Field label="Código" required error={errors.code}>
          {({ id, invalid }) => (
            <Input id={id} aria-invalid={invalid} className="cifra uppercase" value={data.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="CEM-50" />
          )}
        </Field>
        <Field label="Rubro">
          {({ id }) => <Select id={id} value={data.category} onChange={(v) => set('category', v as ProductCategory)} options={PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />}
        </Field>
        <Field label="Nombre" required error={errors.name} className="sm:col-span-2">
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={data.name} onChange={(e) => set('name', e.target.value)} placeholder="Cemento Portland 50 kg" />}
        </Field>
        <Field label="Unidad" required error={errors.unit}>
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={data.unit} onChange={(e) => set('unit', e.target.value)} placeholder="bolsa 50kg, m³, barra 12 m" />}
        </Field>
        <Field label="Precio minorista" error={errors.unit_price}>
          {({ id, invalid, describedBy }) => (
            <AffixInput id={id} aria-invalid={invalid} aria-describedby={describedBy} prefix="$" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          )}
        </Field>
        <Field label="Precio mayorista" error={errors.wholesale_price} hint={off > 0 ? `${off} % menos que el minorista` : undefined}>
          {({ id, invalid, describedBy }) => (
            <AffixInput
              id={id}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              prefix="$"
              inputMode="decimal"
              value={wholesalePrice}
              onChange={(e) => setWholesalePrice(e.target.value)}
              placeholder="Opcional"
            />
          )}
        </Field>
        <Field label="Mayorista desde" error={errors.wholesale_min_qty}>
          {({ id, invalid, describedBy }) => (
            <AffixInput
              id={id}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              suffix={unitSuffix(data.unit)}
              inputMode="decimal"
              value={wholesaleQty}
              onChange={(e) => setWholesaleQty(e.target.value)}
              placeholder="Cantidad"
            />
          )}
        </Field>
        <Field label="Detalle" className="sm:col-span-2">
          {({ id }) => <Textarea id={id} rows={2} value={data.description || ''} onChange={(e) => set('description', e.target.value)} />}
        </Field>
      </FormCard>
      <FormActions cancelHref="/catalog" submitLabel={product ? 'Guardar cambios' : 'Agregar al catálogo'} saving={saving} />
    </form>
  );
}
