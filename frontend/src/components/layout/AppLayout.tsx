'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Building2, 
  Users, 
  Home, 
  HardHat,
  Boxes,
  FileSpreadsheet
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Cargar UserNav solo en el cliente (ssr: false) para evitar discrepancias de hidratación con localStorage
const UserNav = dynamic(
  () => import('./UserNav').then((mod) => mod.UserNav),
  {
    ssr: false,
    loading: () => <div className="w-20 h-8 bg-slate-100 rounded-lg animate-pulse" />,
  }
);

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Inicio', href: '/', icon: Home },
    { label: 'Presupuestos', href: '/opportunities', icon: FileSpreadsheet },
    { label: 'Catálogo de Materiales', href: '/catalog', icon: Boxes },
    { label: 'Empresas (Contratistas)', href: '/companies', icon: Building2 },
    { label: 'Contactos', href: '/contacts', icon: Users },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header Principal */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                <HardHat className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-lg tracking-tight">CRM Corralón</span>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  GADS II
                </span>
              </div>
            </Link>

            {/* Navegación Desktop */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Perfil y Acciones (Cargado en cliente con ssr: false) */}
          <div className="flex items-center gap-3" suppressHydrationWarning>
            <UserNav />
          </div>
        </div>

        {/* Barra de Navegación Mobile */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-100 px-2 py-1.5 bg-slate-50">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md ${
                  isActive ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label.split(' ')[0]}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <p>CRM Comercial especializado para Corralones — Ingeniería en Informática, UNLaM (GADS II)</p>
      </footer>
    </div>
  );
}
