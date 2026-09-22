'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { QuoteItemsEditor, quoteTotals } from '@/components/opportunities/QuoteItemsEditor';
import type { Opportunity, OpportunityItemCreateData, Product } from '@/types/crm';
import { fetchOpportunity, fetchProducts, updateOpportunity } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { formatARS } from '@/lib/format';

export default function EditQuoteItemsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const load = useCallback(async () => {
    const [opp, products] = await Promise.all([fetchOpportunity(id), fetchProducts()]);
    return { opp, products: products.filter((p) => p.is_active !== false) };
  }, [id]);
  const { data, error, loading } = useLoad(load);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader back={{ href: `/opportunities/${id}`, label: data?.opp.title ?? 'Presupuesto' }} title="Editar materiales" />
        {loading ? (
          <LoadingBlock label="Cargando materiales" rows={3} />
        ) : error || !data ? (
          <EmptyState illustration="presupuestos" title="No encontramos este presupuesto" description={error ?? undefined} />
        ) : data.opp.status !== 'abierta' ? (
          <EmptyState
            illustration="presupuestos"
            title="Este presupuesto ya está cerrado"
            action={
              <ButtonLink href={`/opportunities/${id}`} variant="secundario">
                Volver al presupuesto
              </ButtonLink>
            }
          />
        ) : (
          <Editor opp={data.opp} products={data.products} />
        )}
      </div>
    </AppLayout>
  );
}

const toItem = (it: Opportunity['items'][number]): OpportunityItemCreateData => ({
  product_id: it.product_id ?? null,
  product_name: it.product_name,
  unit: it.unit,
  quantity: Number(it.quantity),
  unit_price: Number(it.unit_price),
  list_price: it.list_price != null ? Number(it.list_price) : null,
  price_tier: it.price_tier ?? 'minorista',
  discount_pct: Number(it.discount_pct ?? 0),
});

function Editor({ opp, products }: { opp: Opportunity; products: Product[] }) {
  const router = useRouter();
  const toast = useToast();
  const original = useMemo(() => opp.items.map(toItem), [opp]);
  const [items, setItems] = useState(original);
  const [discountPct, setDiscountPct] = useState(Number(opp.discount_pct ?? 0));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const version = opp.current_version ?? 1;
  const totals = quoteTotals(items, discountPct);
  const before = Number(opp.estimated_value);
  const delta = totals.total - before;
  const changed = discountPct !== Number(opp.discount_pct ?? 0) || JSON.stringify(items) !== JSON.stringify(original);

  const save = async () => {
    if (!changed) return;
    setSaving(true);
    try {
      await updateOpportunity(opp.id, { items, discount_pct: discountPct, version_note: note.trim() || null });
      toast.success(`Versión ${version + 1} guardada`, 'La anterior queda en el historial.');
      router.push(`/opportunities/${opp.id}#versiones`);
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4 rounded-2xl border border-linea bg-chapa p-5 shadow-suave">
        <QuoteItemsEditor products={products} items={items} onChange={setItems} discountPct={discountPct} onDiscountChange={setDiscountPct} />
        <Field label="Qué cambió">
          {({ id }) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: sumaron la platea y se bajó un 5 %" />}
        </Field>
      </section>

      <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Resumen de la nueva versión">
        <div className="overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
          <dl className="divide-y divide-linea">
            <div className="flex items-baseline justify-between gap-3 px-5 py-4">
              <dt className="text-sm text-tiza">Versión {version} (vigente)</dt>
              <dd className="cifra font-semibold">{formatARS(before)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-5 py-4">
              <dt className="text-sm font-semibold">Versión {version + 1}</dt>
              <dd className="cifra titular text-[28px]">{formatARS(totals.total)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-sm text-tiza">Diferencia</dt>
              <dd className="cifra font-semibold">{changed ? `${delta >= 0 ? '+' : '−'} ${formatARS(Math.abs(delta))}` : '—'}</dd>
            </div>
          </dl>
          <div className="border-t border-linea bg-chapa-2 p-4">
            <Button size="lg" className="w-full" isLoading={saving} disabled={!changed || items.length === 0} onClick={save}>
              Guardar versión {version + 1}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
