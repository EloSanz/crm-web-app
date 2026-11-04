import type { Metadata } from 'next';
import { CatchupChat } from '@/components/ai/CatchupChat';

export const metadata: Metadata = { title: 'Ponete al día' };

type Params = Promise<{ id: string }>;

/** «Ponete al día» con un cliente: preguntas sobre su historia, con la fuente de cada dato. */
export default async function PoneteAlDiaPage({ params }: { params: Params }) {
  const { id } = await params;
  return <CatchupChat companyId={id} />;
}
