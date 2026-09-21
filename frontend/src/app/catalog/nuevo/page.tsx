'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProductForm } from '@/components/catalog/ProductForm';
import type { ProductCategory } from '@/types/crm';
import { PRODUCT_CATEGORIES } from '@/lib/catalogs';

export default function NewProductPage() {
  const [preset] = useState<ProductCategory | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const r = new URLSearchParams(window.location.search).get('rubro');
    return PRODUCT_CATEGORIES.find((c) => c.value === r)?.value;
  });
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader back={{ href: '/catalog', label: 'Catálogo' }} title="Nuevo material" />
        <ProductForm presetCategory={preset} />
      </div>
    </AppLayout>
  );
}
