'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Inbox, Mail, RefreshCw, Unplug } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { disconnectGmail, fetchGmailStatus, gmailConnectUrl, syncGmail } from '@/lib/api-ai';
import { useLoad } from '@/lib/useLoad';
import { formatDateTime } from '@/lib/format';

const PROVIDER_LABEL: Record<string, string> = {
  resend: 'la casilla de Corralap',
  smtp: 'la casilla de Corralap',
  log: 'el CRM en modo simulado (no sale ningún correo)',
};

/** Conectar el Gmail del vendedor: los correos salen de su dirección y las respuestas llegan solas al presupuesto. */
export function GmailAccount({ result, reason }: { result?: string; reason?: string }) {
  const router = useRouter();
  const toast = useToast();
  const load = useCallback(() => fetchGmailStatus(), []);
  const { data, loading, reload } = useLoad(load);
  const [busy, setBusy] = useState<'conectar' | 'desconectar' | 'sync' | null>(null);
  const [confirm, setConfirm] = useState(false);

  // Aviso de lo que pasó en Google y se limpia la URL para que no se repita al recargar.
  useEffect(() => {
    if (!result) return;
    if (result === 'conectado') toast.success('Gmail conectado', 'Los correos que mandes desde el CRM salen de tu casilla.');
    else if (result === 'cancelado') toast.info('No se conectó Gmail', reason);
    else toast.error('No se pudo conectar Gmail', reason);
    router.replace('/cuenta/correo');
  }, [result, reason, router, toast]);

  const connect = async () => {
    setBusy('conectar');
    try {
      window.location.assign(await gmailConnectUrl());
    } catch (err) {
      toast.error('No se pudo conectar Gmail', err instanceof Error ? err.message : undefined);
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setConfirm(false);
    setBusy('desconectar');
    try {
      await disconnectGmail();
      toast.success('Gmail desconectado', 'Los correos vuelven a salir desde la casilla de Corralap.');
      await reload();
    } catch (err) {
      toast.error('No se pudo desconectar', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy('sync');
    try {
      const res = await syncGmail(undefined, true);
      if (res.error) toast.error('No se pudieron buscar respuestas', res.error);
      else if (res.new_messages) toast.success(`Entraron ${res.new_messages} respuestas al CRM`);
      else toast.info('No hay respuestas nuevas');
      await reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <PageHeader title="Mi correo" />
        {loading || !data ? (
          <LoadingBlock label="Consultando tu correo" />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
            <div className="flex items-start gap-4 p-5 sm:p-6">
              <span className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-xl bg-chapa-2 text-tinta" aria-hidden>
                {data.connected ? <CheckCircle2 className="w-5 h-5 text-verde" /> : <Mail className="w-5 h-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="titular text-lg">{data.connected ? 'Gmail conectado' : 'Conectá tu Gmail'}</h2>
                {data.connected ? (
                  <p className="mt-1 text-[15px] leading-relaxed">
                    Los correos que mandás desde el CRM salen de <span className="font-semibold break-all">{data.email}</span>. Las respuestas del
                    cliente aparecen solas en el seguimiento del presupuesto.
                  </p>
                ) : (
                  <p className="mt-1 text-[15px] leading-relaxed">
                    Hoy tus correos salen desde {PROVIDER_LABEL[data.fallback_provider] ?? 'la casilla de Corralap'}. Con tu Gmail conectado salen de tu
                    dirección y la respuesta del cliente llega sola al presupuesto.
                  </p>
                )}
                {data.connected && data.last_sync_at && (
                  <p className="mt-2 text-[13px] text-tiza">Última búsqueda de respuestas: {formatDateTime(data.last_sync_at)}</p>
                )}
                {data.last_error && <p className="mt-2 text-[13px] font-semibold text-rojo-tinta">{data.last_error}</p>}
              </div>
            </div>

            <div className="border-t border-linea bg-chapa-2 px-5 py-4 sm:px-6">
              <p className="flex items-start gap-2 text-[13px] leading-snug text-tiza">
                <Inbox className="mt-0.5 w-4 h-4 shrink-0" aria-hidden />
                <span>
                  Sólo entran al CRM las respuestas a correos que mandaste desde el CRM. El resto de tu casilla no se lee ni se guarda. Podés
                  desconectarla cuando quieras.
                </span>
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-linea px-5 py-4 sm:px-6">
              {!data.configured ? (
                <p className="mr-auto text-sm text-tiza">La conexión con Gmail todavía no está habilitada en este CRM. Pedíselo al administrador.</p>
              ) : data.connected ? (
                <>
                  <Button variant="fantasma" className="text-rojo-tinta" isLoading={busy === 'desconectar'} onClick={() => setConfirm(true)}>
                    {busy !== 'desconectar' && <Unplug className="w-4 h-4" aria-hidden />}
                    Desconectar
                  </Button>
                  <Button variant="secundario" isLoading={busy === 'sync'} onClick={sync}>
                    {busy !== 'sync' && <RefreshCw className="w-4 h-4" aria-hidden />}
                    Buscar respuestas
                  </Button>
                  {data.last_error && (
                    <Button isLoading={busy === 'conectar'} onClick={connect}>
                      Volver a conectar
                    </Button>
                  )}
                </>
              ) : (
                <Button isLoading={busy === 'conectar'} onClick={connect}>
                  {busy !== 'conectar' && <Mail className="w-4 h-4" aria-hidden />}
                  Conectar Gmail
                </Button>
              )}
            </div>
          </section>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title="¿Desconectar tu Gmail?"
          description="Los correos van a salir desde la casilla de Corralap y las respuestas nuevas dejan de llegar al CRM. Lo que ya entró queda en el seguimiento."
          confirmLabel="Desconectar"
          onCancel={() => setConfirm(false)}
          onConfirm={disconnect}
        />
      )}
    </AppLayout>
  );
}
