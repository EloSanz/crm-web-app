'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, X } from 'lucide-react';
import type { ActivityAttachment } from '@/types/crm';

export const isImage = (a: Pick<ActivityAttachment, 'content_type' | 'name'>) =>
  (a.content_type ?? '').startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(a.name);

export function formatBytes(n?: number | null): string {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

type ViewerProps = { onClose: () => void } & ({ file: ActivityAttachment; files?: never; index?: never } | { files: ActivityAttachment[]; index: number; file?: never });

/** Visor a pantalla completa: fotos en grande, PDFs con acceso a abrir o descargar; recorre todos los archivos del registro. */
export function AttachmentViewer(props: ViewerProps) {
  const { onClose } = props;
  const files = props.files ?? [props.file];
  const [i, setI] = useState(props.index ?? 0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const file = files[Math.min(i, files.length - 1)];
  const many = files.length > 1;

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((n) => (n + 1) % files.length);
      if (e.key === 'ArrowLeft') setI((n) => (n - 1 + files.length) % files.length);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, files.length]);

  const iconBtn = 'h-10 w-10 inline-flex items-center justify-center rounded-lg text-niebla hover:bg-white/10 hover:text-white cursor-pointer';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={file.name} className="fixed inset-0 z-[88] flex flex-col bg-pavonado/95 text-white animate-aparecer">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{file.name}</p>
          {many && (
            <p className="cifra text-[13px] text-niebla">
              {i + 1} de {files.length}
            </p>
          )}
        </div>
        <a href={file.url} target="_blank" rel="noreferrer" className={iconBtn} aria-label="Abrir en otra pestaña">
          <ExternalLink className="w-5 h-5" />
        </a>
        <a href={file.url} download={file.name} className={iconBtn} aria-label="Descargar">
          <Download className="w-5 h-5" />
        </a>
        <button type="button" autoFocus onClick={onClose} className={iconBtn} aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:px-16 sm:py-8" onClick={onClose}>
        {isImage(file) && !broken[file.url] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={file.url}
            src={file.url}
            alt={file.name}
            onError={() => setBroken((b) => ({ ...b, [file.url]: true }))}
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
        {many && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setI((n) => (n - 1 + files.length) % files.length);
              }}
              className="absolute left-2 top-1/2 h-12 w-12 -translate-y-1/2 inline-flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer sm:left-4"
              aria-label="Archivo anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setI((n) => (n + 1) % files.length);
              }}
              className="absolute right-2 top-1/2 h-12 w-12 -translate-y-1/2 inline-flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer sm:right-4"
              aria-label="Archivo siguiente"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
