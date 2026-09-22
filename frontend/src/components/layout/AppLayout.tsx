'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Boxes, ChartLine, ClipboardList, Home, MapPinned, Search, ShieldCheck, Users, UsersRound } from 'lucide-react';
import { useCurrentUser } from '@/lib/useUser';
import { isAdmin, isManager } from '@/lib/roles';
import { Logo } from '@/components/brand/Logo';
import { UserNav, UserMenuCompact } from './UserNav';
import { CommandPalette } from './CommandPalette';

const NAV = [
  { label: 'Inicio', href: '/', icon: Home, match: (p: string) => p === '/' },
  { label: 'Presupuestos', href: '/opportunities', icon: ClipboardList, match: (p: string) => p.startsWith('/opportunities') },
  { label: 'Obras', href: '/projects', icon: MapPinned, match: (p: string) => p.startsWith('/projects') },
  { label: 'Clientes', href: '/companies', icon: Users, match: (p: string) => p.startsWith('/companies') || p.startsWith('/contacts') },
  { label: 'Catálogo', href: '/catalog', icon: Boxes, match: (p: string) => p.startsWith('/catalog') },
];

/** Secciones de gestión: el responsable comercial ve el equipo; el administrador, además, los usuarios. */
export const MANAGE_NAV = [
  { label: 'Equipo', href: '/equipo', icon: UsersRound, match: (p: string) => p.startsWith('/equipo'), role: 'manager' as const },
  { label: 'Indicadores', href: '/indicadores', icon: ChartLine, match: (p: string) => p.startsWith('/indicadores'), role: 'manager' as const },
  { label: 'Usuarios', href: '/usuarios', icon: ShieldCheck, match: (p: string) => p.startsWith('/usuarios'), role: 'admin' as const },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [searchOpen, setSearchOpen] = useState(false);
  const user = useCurrentUser();
  const manageItems = MANAGE_NAV.filter((i) => (i.role === 'admin' ? isAdmin(user) : isManager(user)));
  const [isMac] = useState(() => typeof navigator === 'undefined' || /Mac|iPhone|iPad/.test(navigator.userAgent));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-suelo text-tinta">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[95] focus:rounded-lg focus:bg-chapa focus:px-4 focus:py-2 focus:shadow-alzada"
      >
        Saltar al contenido
      </a>

      <aside className="sobre-pavonado grano-pavonado fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col text-white lg:flex">
        <div className="px-5 pb-5 pt-7">
          <Link href="/" aria-label="Corralap, ir al inicio" className="inline-block rounded-lg">
            <Logo tone="oscuro" size="md" />
          </Link>
        </div>

        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-11 w-full items-center gap-2.5 rounded-[10px] border border-pavonado-borde bg-pavonado-2 px-3 text-left text-[15px] text-niebla transition-colors hover:border-niebla/50 hover:text-white cursor-pointer"
          >
            <Search className="w-4.5 h-4.5 shrink-0" aria-hidden />
            <span className="flex-1">Buscar</span>
            <kbd className="rounded-md border border-pavonado-borde px-1.5 py-0.5 font-sans text-[13px] font-semibold" suppressHydrationWarning>
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
        </div>

        <nav aria-label="Principal" className="flex-1 px-3">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'group flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-semibold transition-colors',
                      active ? 'bg-amarillo text-pavonado font-bold' : 'text-niebla hover:bg-pavonado-2 hover:text-white'
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {manageItems.length > 0 && (
            <ul className="mt-3 flex flex-col gap-0.5 border-t border-pavonado-borde pt-3" aria-label="Gestión">
              {manageItems.map((item) => {
                const Icon = item.icon;
                const active = item.match(pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={clsx(
                        'group flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-semibold transition-colors',
                        active ? 'bg-amarillo text-pavonado font-bold' : 'text-niebla hover:bg-pavonado-2 hover:text-white'
                      )}
                    >
                      <Icon className="w-5 h-5 shrink-0" aria-hidden />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <div className="border-t border-pavonado-borde p-3">
          <UserNav />
        </div>
      </aside>

      <header className="sobre-pavonado grano-pavonado sticky top-0 z-30 text-white pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <Link href="/" aria-label="Corralap, ir al inicio" className="mr-auto rounded-lg">
            <Logo tone="oscuro" size="sm" />
          </Link>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="h-10 w-10 inline-flex items-center justify-center rounded-full text-niebla hover:bg-pavonado-2 hover:text-white cursor-pointer"
            aria-label="Buscar"
          >
            <Search className="w-5 h-5" />
          </button>
          <UserMenuCompact />
        </div>
      </header>

      <main id="contenido" className="lg:pl-[248px]">
        <div className="mx-auto w-full max-w-[1400px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-10 lg:pb-14 lg:pt-9">
          {children}
        </div>
      </main>

      <nav
        aria-label="Principal"
        className="sobre-pavonado fixed inset-x-0 bottom-0 z-30 border-t border-pavonado-borde bg-pavonado pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid grid-cols-[0.85fr_1.4fr_0.85fr_1fr_1fr]">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx('flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold tracking-[-0.01em]', active ? 'text-white' : 'text-niebla')}
                >
                  <span className={clsx('inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-amarillo text-pavonado')}>
                    <Icon className="w-5 h-5" aria-hidden />
                  </span>
                  <span className="max-w-full whitespace-nowrap">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
