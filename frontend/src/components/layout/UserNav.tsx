'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { isAdmin, isManager } from '@/lib/roles';
import { useCurrentUser, clearStoredAuth } from '@/lib/useUser';
import { ROLE_LABELS } from '@/lib/catalogs';
import { initials } from '@/lib/format';

function useLogout() {
  const router = useRouter();
  return () => {
    clearStoredAuth();
    router.push('/login');
  };
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="w-10 h-10 shrink-0 rounded-full bg-pavonado-3 border border-pavonado-borde inline-flex items-center justify-center font-bold text-[15px] text-white">
      {initials(name)}
    </span>
  );
}

/** Bloque de usuario al pie del riel de escritorio. */
export function UserNav() {
  const currentUser = useCurrentUser();
  const logout = useLogout();

  if (!currentUser) {
    return (
      <Link href="/login" className="flex h-11 items-center justify-center rounded-lg bg-amarillo text-pavonado font-bold hover:bg-amarillo-2">
        Ingresar
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 px-2 py-2">
      <Avatar name={currentUser.full_name} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-white truncate">{currentUser.full_name}</p>
        <p className="text-sm text-niebla truncate">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</p>
      </div>
      <button
        type="button"
        onClick={logout}
        className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-niebla hover:text-white hover:bg-pavonado-2 cursor-pointer"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
}

/** Avatar con menú desplegable para la barra superior del celular. */
export function UserMenuCompact() {
  const currentUser = useCurrentUser();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!currentUser) {
    return (
      <Link href="/login" className="h-10 px-4 inline-flex items-center rounded-lg bg-amarillo text-pavonado font-bold">
        Ingresar
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-full cursor-pointer"
        aria-label={`Cuenta de ${currentUser.full_name}`}
      >
        <Avatar name={currentUser.full_name} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 w-64 rounded-xl bg-chapa text-tinta shadow-alzada border border-linea p-2 animate-aparecer">
          <div className="px-3 py-2">
            <p className="font-semibold truncate">{currentUser.full_name}</p>
            <p className="text-sm text-tiza truncate">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</p>
          </div>
          {isManager(currentUser) && (
            <Link role="menuitem" href="/equipo" onClick={() => setOpen(false)} className="flex h-11 items-center rounded-lg px-3 text-[15px] font-semibold hover:bg-chapa-2">
              Equipo
            </Link>
          )}
          {isAdmin(currentUser) && (
            <Link role="menuitem" href="/usuarios" onClick={() => setOpen(false)} className="flex h-11 items-center rounded-lg px-3 text-[15px] font-semibold hover:bg-chapa-2">
              Usuarios
            </Link>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2.5 h-11 px-3 rounded-lg text-[15px] font-semibold hover:bg-chapa-2 cursor-pointer"
          >
            <LogOut className="w-5 h-5 text-tiza" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
