'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Punta } from '@/components/punta/Punta';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-suelo">
      <div className="max-w-md w-full rounded-2xl bg-chapa border border-linea shadow-suave p-8">
        <Punta health="stale" size={40} label="Error" />
        <h1 className="titular mt-4 text-2xl">Algo se trabó</h1>
        <p className="mt-2 text-[15px] text-tiza">{error.message || 'No pudimos mostrar esta pantalla.'}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => reset()} variant="primario">
            <RefreshCw className="w-4 h-4" aria-hidden />
            Reintentar
          </Button>
          <ButtonLink href="/" variant="secundario">
            Ir al inicio
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
