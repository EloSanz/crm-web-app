import { redirect } from 'next/navigation';

export default async function IndicadoresPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias } = await searchParams;
  redirect(dias ? `/indicadores/ventas?dias=${encodeURIComponent(dias)}` : '/indicadores/ventas');
}
