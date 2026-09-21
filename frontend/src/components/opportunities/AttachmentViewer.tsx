'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import type { ActivityAttachment } from '@/types/crm';

export const isImage = (a: Pick<ActivityAttachment, 'content_type' | 'name'>) =>
  (a.content_type ?? '').startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(a.name);

export function formatBytes(n?: number | null): string {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Visor a pantalla completa: fotos en grande, PDFs con acceso a abrir o descargar. */
export function AttachmentViewer({ file, onClose }: { file: ActivityAttachment; onClose: () => void }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={file.name} className="fixed inset-0 z-[88] flex flex-col bg-pavonado/95 text-white animate-aparecer">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{file.name}</p>
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-niebla hover:bg-white/10 hover:text-white"
          aria-label="Abrir en otra pestaña"
        >
          <ExternalLink className="w-5 h-5" />
        </a>
        <a
          href={file.url}
          download={file.name}
          className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-niebla hover:bg-white/10 hover:text-white"
          aria-label="Descargar"
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-niebla hover:bg-white/10 hover:text-white cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8" onClick={onClose}>
        {isImage(file) && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.name}
            onError={() => setBroken(true)}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain shadow-alzada"
          />
        ) : (
          <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-4 rounded-2xl bg-white/5 px-10 py-12 text-center">
            <FileText className="w-14 h-14 text-niebla" />
            <p className="max-w-[40ch] break-words font-semibold">{file.name}</p>
            <a href={file.url} target="_blank" rel="noreferrer" className="rounded-[10px] bg-white px-4 py-2.5 text-[15px] font-semibold text-pavonado hover:bg-niebla">
              {isImage(file) ? 'Abrir archivo' : 'Abrir PDF'}
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
