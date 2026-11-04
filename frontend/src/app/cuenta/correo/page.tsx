import type { Metadata } from 'next';
import { GmailAccount } from '@/components/gmail/GmailAccount';

export const metadata: Metadata = { title: 'Mi correo' };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const one = (value: string | string[] | undefined) => (typeof value === 'string' && value ? value : undefined);

/** Conectar el Gmail del vendedor. Google vuelve acá con ?gmail=conectado|error|cancelado&motivo= */
export default async function MiCorreoPage({ searchParams }: { searchParams: SearchParams }) {
  const q = await searchParams;
  return <GmailAccount result={one(q.gmail)} reason={one(q.motivo)} />;
}
