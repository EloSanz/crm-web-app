'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { RequireRole } from '@/components/users/RequireRole';
import { AuditLog } from '@/components/audit/AuditLog';

export default function AuditPage() {
  return (
    <AppLayout>
      <RequireRole role="manager">
        <AuditLog />
      </RequireRole>
    </AppLayout>
  );
}
