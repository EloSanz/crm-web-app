'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { CompanyForm } from '@/components/clients/CompanyForm';

export default function NewCompanyPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader back={{ href: '/companies', label: 'Clientes' }} title="Nueva empresa" />
        <CompanyForm />
      </div>
    </AppLayout>
  );
}
