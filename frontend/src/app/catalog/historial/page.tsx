'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { RequireRole } from '@/components/users/RequireRole';
import { CatalogHistory } from '@/components/catalog/CatalogHistory';

export default function CatalogHistoryPage() {
  return (
    <AppLayout>
      <RequireRole role="admin">
        <CatalogHistory />
      </RequireRole>
    </AppLayout>
  );
}
