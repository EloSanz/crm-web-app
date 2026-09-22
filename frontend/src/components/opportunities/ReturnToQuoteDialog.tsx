'use client';

import React from 'react';
import { ClipboardList } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

interface ReturnToQuoteDialogProps {
  /** "contacto" u "obra": lo que se acaba de cargar. */
  what: 'contacto' | 'obra';
  name: string;
  onBack: () => void;
  onStay: () => void;
}

/** Después de cargar un contacto u obra desde un presupuesto a medio armar: ¿volver a terminarlo? */
export function ReturnToQuoteDialog({ what, name, onBack, onStay }: ReturnToQuoteDialogProps) {
  return (
    <Dialog
      title="¿Volvés al presupuesto?"
      icon={
        <span className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-pavonado text-white">
          <ClipboardList className="w-5 h-5" />
        </span>
      }
      onClose={onStay}
      footer={
        <>
          <Button variant="fantasma" onClick={onStay}>
            No, ver {what === 'contacto' ? 'el contacto' : 'la obra'}
          </Button>
          <Button data-autofocus onClick={onBack}>
            Sí, volver
          </Button>
        </>
      }
    >
      <p className="text-[15px] leading-relaxed text-tiza">
        Tenés un presupuesto a medio armar. {what === 'contacto' ? 'El contacto' : 'La obra'} <span className="font-semibold text-tinta">{name}</span> queda elegid{what === 'contacto' ? 'o' : 'a'} y no se pierde nada de lo cargado.
      </p>
    </Dialog>
  );
}
