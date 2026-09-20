'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useCurrentUser, clearStoredAuth } from '@/lib/useUser';

export function UserNav() {
  const router = useRouter();
  const currentUser = useCurrentUser();

  const handleLogout = () => {
    clearStoredAuth();
    router.push('/login');
  };

  if (!currentUser) {
    return (
      <Link
        href="/login"
        className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
      >
        Ingresar
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <p className="text-xs font-semibold text-slate-900 flex items-center gap-1 justify-end">
          <UserIcon className="w-3 h-3 text-slate-500" />
          {currentUser.full_name}
        </p>
        <p className="text-[11px] text-slate-500 capitalize flex items-center gap-1 justify-end">
          <ShieldCheck className="w-3 h-3 text-blue-500" />
          {currentUser.role.replace('_', ' ')}
        </p>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5 text-slate-500" />
        <span className="hidden sm:inline">Cerrar Sesión</span>
      </button>
    </div>
  );
}
