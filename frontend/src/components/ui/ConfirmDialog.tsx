'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Dialog } from './Dialog';
import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ title, description, confirmLabel, submitting, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      icon={
        <span className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-rojo-velo text-rojo">
          <Trash2 className="w-5 h-5" />
        </span>
      }
      onClose={onCancel}
      footer={
        <>
          <Button variant="fantasma" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="peligro" isLoading={submitting} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[15px] leading-relaxed text-tiza">{description}</div>
    </Dialog>
  );
}
