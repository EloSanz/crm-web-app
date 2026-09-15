'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { 
  Building2, 
  Users, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  LogIn, 
  LogOut, 
  Shield, 
  Server,
  Kanban
} from 'lucide-react';
import { User, HealthStatus } from '@/types/auth';

export default function HomePage() {
  const router = useRouter();
  
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('crm_user');
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    let isMounted = true;

    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data: HealthStatus) => {
        if (isMounted) setHealth(data);
      })
      .catch((err) => {
        console.error('Error fetching health check', err);
      })
      .finally(() => {
        if (isMounted) setIsHealthLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiUrl]);

  const handleLogout = () => {
    localStorage.removeItem('crm_access_token');
    localStorage.removeItem('crm_user');
    setCurrentUser(null);
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navbar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              C
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg">CRM Comercial</span>
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                UNLaM GADS II
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-slate-900">{currentUser.full_name}</p>
                  <p className="text-[11px] text-slate-500 capitalize">{currentUser.role.replace('_', ' ')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs">
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  Cerrar Sesión
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button variant="primary" size="sm">
                  <LogIn className="w-3.5 h-3.5 mr-1" />
                  Iniciar Sesión
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner de Bienvenida */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-8 shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-blue-200 text-xs font-medium mb-4">
              <Shield className="w-3.5 h-3.5" />
              Arquitectura Monorepo Next.js 16 + FastAPI + Supabase
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {currentUser ? `¡Hola de nuevo, ${currentUser.full_name.split(' ')[0]}!` : 'Sistema CRM para Gestión Comercial'}
            </h1>
            <p className="mt-2 text-slate-300 text-sm sm:text-base leading-relaxed">
              Plataforma para administración de contactos, empresas, oportunidades de negocio y trazabilidad del embudo de ventas.
            </p>
          </div>
        </div>

        {/* Estado del Sistema (Health Widget) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <Server className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Servidor Backend</p>
              <div className="flex items-center gap-2 mt-1">
                {isHealthLoading ? (
                  <span className="text-xs text-slate-400 animate-pulse">Comprobando API...</span>
                ) : health?.status === 'healthy' ? (
                  <span className="inline-flex items-center text-sm font-semibold text-emerald-600">
                    <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500" /> Operativo (FastAPI)
                  </span>
                ) : (
                  <span className="inline-flex items-center text-sm font-semibold text-amber-600">
                    <AlertCircle className="w-4 h-4 mr-1 text-amber-500" /> Sin conexión con backend
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {health ? `${health.app} v${health.version} (${health.environment})` : 'Puerto 8000'}
              </p>
            </div>
          </Card>

          <Card className="p-5 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Shield className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Autenticación & Roles</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {currentUser ? `Conectado como ${currentUser.role}` : 'Sesión Pública / Invitado'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {currentUser ? currentUser.email : 'Iniciá sesión para operar'}
              </p>
            </div>
          </Card>

          <Card className="p-5 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Base de Datos</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">Supabase / PostgreSQL</p>
              <p className="text-xs text-slate-500 mt-1">Schema CRM listo en migraciones</p>
            </div>
          </Card>
        </div>

        {/* Módulos Principales (Scaffolding preparado) */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Módulos del Sistema Comercial</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Card className="p-5 hover:border-blue-300 transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Kanban className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Embudo Comercial</h3>
              <p className="text-xs text-slate-500 mt-1">
                Pipeline de oportunidades por etapas y estados abierta, ganada o perdida.
              </p>
            </Card>

            <Card className="p-5 hover:border-blue-300 transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Empresas</h3>
              <p className="text-xs text-slate-500 mt-1">
                Padrón de clientes y empresas con baja lógica y trazabilidad de CUIT/rubro.
              </p>
            </Card>

            <Card className="p-5 hover:border-blue-300 transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Contactos</h3>
              <p className="text-xs text-slate-500 mt-1">
                Interlocutores y personas de contacto asociadas a las empresas.
              </p>
            </Card>

            <Card className="p-5 hover:border-blue-300 transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Actividades e Historial</h3>
              <p className="text-xs text-slate-500 mt-1">
                Registro inmutable de llamadas, reuniones y transiciones de etapas.
              </p>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <p>CRM Web App — Trabajo Práctico de Gestión Aplicada al Desarrollo de Software II (UNLaM)</p>
      </footer>
    </div>
  );
}
