import type { Metadata } from 'next';
import { WhatsAppChat } from '@/components/contact/WhatsAppChat';

export const metadata: Metadata = { title: 'WhatsApp' };

type Params = Promise<{ contactId: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const one = (value: string | string[] | undefined) => (typeof value === 'string' && value ? value : undefined);

/** Chat de WhatsApp con un contacto (/whatsapp/<id>) o con un número suelto (/whatsapp/tel-5491122334455). */
export default async function WhatsAppPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ contactId }, q] = await Promise.all([params, searchParams]);
  return <WhatsAppChat target={decodeURIComponent(contactId)} opportunityId={one(q.opportunity_id)} companyId={one(q.company_id)} back={one(q.volver)} />;
}
