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

export function ProductForm({ product, presetCategory }: { product?: Product | null; presetCategory?: ProductCategory }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; name?: string; unit?: string }>({});
  const [price, setPrice] = useState(product ? String(Number(product.unit_price)) : '');
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      code: data.code.trim() ? undefined : 'Falta el código',
      name: data.name.trim() ? undefined : 'Falta el nombre',
      unit: data.unit.trim() ? undefined : 'Falta la unidad',
    };
    setErrors(next);
    if (next.code || next.name || next.unit) return;
    const payload = { ...data, unit_price: Number(price.replace(',', '.')) || 0 };
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
        <Field label="Precio">
          {({ id }) => <AffixInput id={id} prefix="$" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />}
        </Field>
        <Field label="Detalle" className="sm:col-span-2">
          {({ id }) => <Textarea id={id} rows={2} value={data.description || ''} onChange={(e) => set('description', e.target.value)} />}
        </Field>
      </FormCard>
      <FormActions cancelHref="/catalog" submitLabel={product ? 'Guardar cambios' : 'Agregar al catálogo'} saving={saving} />
    </form>
  );
}
