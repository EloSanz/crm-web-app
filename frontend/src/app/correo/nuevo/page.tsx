import type { Metadata } from 'next';
import { ComposeEmail } from '@/components/contact/ComposeEmail';

export const metadata: Metadata = { title: 'Nuevo correo' };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const one = (value: string | string[] | undefined) => (typeof value === 'string' && value ? value : undefined);

/** Redactar un correo: /correo/nuevo?opportunity_id=&contact_id=&company_id=&para=&volver= */
export default async function NuevoCorreoPage({ searchParams }: { searchParams: SearchParams }) {
  const q = await searchParams;
  return (
    <ComposeEmail
      opportunityId={one(q.opportunity_id)}
      contactId={one(q.contact_id)}
      companyId={one(q.company_id)}
      to={one(q.para)}
      back={one(q.volver)}
    />
  );
}
