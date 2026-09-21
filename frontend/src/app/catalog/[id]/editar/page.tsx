'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { ProductForm } from '@/components/catalog/ProductForm';
import { fetchProduct } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => fetchProduct(id), [id]);
  const { data, error, loading } = useLoad(load);
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader back={{ href: '/catalog', label: 'Catálogo' }} title={data?.name ?? 'Editar material'} />
        {loading ? <LoadingBlock label="Cargando" /> : error || !data ? <EmptyState illustration="catalogo" title="No encontramos el material" /> : <ProductForm product={data} />}
      </div>
    </AppLayout>
  );
}
