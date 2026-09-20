'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { 
  Building2, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Server,
  ArrowRight,
  HardHat,
  Sparkles,
  FileSpreadsheet,
  Boxes
} from 'lucide-react';
import { HealthStatus } from '@/types/auth';
import { fetchCompanies, fetchContacts, fetchProducts, fetchOpportunities, buildApiUrl } from '@/lib/api';
import { useCurrentUser } from '@/lib/useUser';

export default function HomePage() {
  const currentUser = useCurrentUser();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);
  const [companiesCount, setCompaniesCount] = useState<number | null>(null);
  const [contactsCount, setContactsCount] = useState<number | null>(null);
  const [productsCount, setProductsCount] = useState<number | null>(null);
  const [opportunitiesCount, setOpportunitiesCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetch(buildApiUrl('/api/health'))
      .then((res) => res.json())
      .then((data: HealthStatus) => {
        if (isMounted) setHealth(data);
      })
      .catch((err) => console.error('Error health check', err))
      .finally(() => {
        if (isMounted) setIsHealthLoading(false);
      });

    // Cargar conteos rápidos
    fetchCompanies()
      .then((data) => {
        if (isMounted) setCompaniesCount(data.length);
      })
      .catch(() => {
        if (isMounted) setCompaniesCount(0);
      });

    fetchContacts()
      .then((data) => {
        if (isMounted) setContactsCount(data.length);
      })
      .catch(() => {
        if (isMounted) setContactsCount(0);
      });

    fetchProducts()
      .then((data) => {
        if (isMounted) setProductsCount(data.length);
      })
      .catch(() => {
        if (isMounted) setProductsCount(0);
      });

    fetchOpportunities()
      .then((data) => {
        if (isMounted) setOpportunitiesCount(data.length);
      })
      .catch(() => {
        if (isMounted) setOpportunitiesCount(0);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Banner Principal de Bienvenida */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-2xl p-8 shadow-md relative overflow-hidden border border-slate-800">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-4">
              <HardHat className="w-3.5 h-3.5" />
              Especialización: Corralón de Materiales de Construcción
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight" suppressHydrationWarning>
              {currentUser ? `¡Hola, ${currentUser.full_name.split(' ')[0]}!` : 'CRM para Gestión Comercial'}
            </h1>
            <p className="mt-2 text-slate-300 text-sm sm:text-base leading-relaxed">
              Administración centralizada de clientes contratistas, empresas constructoras y cotizaciones de materiales para obra.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/opportunities"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Presupuestos (Cotizador)
              </Link>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-sm font-semibold transition-colors"
              >
                <Boxes className="w-4 h-4" />
                Catálogo de Materiales
              </Link>
              <Link
                href="/companies"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-sm font-semibold transition-colors"
              >
                <Building2 className="w-4 h-4" />
                Empresas Contratistas
              </Link>
              <Link
                href="/contacts"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-sm font-semibold transition-colors"
              >
                <Users className="w-4 h-4" />
                Contactos de Obra
              </Link>
            </div>
          </div>
        </div>

        {/* Tarjetas de Módulos Principales */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Módulos Comerciales
            </h2>
            <span className="text-xs font-semibold text-slate-500">Primera Entrega — UNLaM</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tarjeta Presupuestos */}
            <Link href="/opportunities" className="group">
              <Card className="p-5 hover:border-blue-300 hover:shadow-md transition-all h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {opportunitiesCount !== null ? `${opportunitiesCount} presupuestos` : 'Cargando...'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-4 group-hover:text-blue-600 transition-colors">
                    Presupuestos de Obra
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cotizaciones armadas con materiales del catálogo asociadas a contratistas o contactos.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
                  <span>Ir a presupuestos</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>
            {/* Tarjeta Catálogo de Materiales */}
            <Link href="/catalog" className="group">
              <Card className="p-5 hover:border-blue-300 hover:shadow-md transition-all h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {productsCount !== null ? `${productsCount} materiales` : 'Cargando...'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-4 group-hover:text-blue-600 transition-colors">
                    Catálogo de Materiales
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Precios de referencia y rubros para obras: aglomerantes, hierros, áridos, mampostería y fletes.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
                  <span>Ver catálogo completo</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>

            {/* Tarjeta Empresas */}
            <Link href="/companies" className="group">
              <Card className="p-5 hover:border-blue-300 hover:shadow-md transition-all h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {companiesCount !== null ? `${companiesCount} empresas` : 'Cargando...'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-4 group-hover:text-indigo-600 transition-colors">
                    Empresas Contratistas
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Constructoras, hormigoneras y desarrolladoras de obra. Gestión con baja lógica y estados comerciales.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
                  <span>Ir a empresas</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>

            {/* Tarjeta Contactos */}
            <Link href="/contacts" className="group">
              <Card className="p-5 hover:border-blue-300 hover:shadow-md transition-all h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {contactsCount !== null ? `${contactsCount} contactos` : 'Cargando...'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-4 group-hover:text-purple-600 transition-colors">
                    Contactos de Obra
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Maestros mayores de obra, capataces y particulares vinculados a empresas o compras directas.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-purple-600">
                  <span>Ir a contactos</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>
          </div>
        </div>

        {/* Estado del Backend y Diagnóstico */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Server className="w-5 h-5" />
            </div>
            <div className="flex-1 text-xs">
              <p className="font-semibold text-slate-700">API FastAPI</p>
              <p className="text-slate-500">
                {isHealthLoading ? 'Comprobando estado...' : health?.status === 'healthy' ? 'En línea en http://localhost:8000' : 'Desconectado'}
              </p>
            </div>
            {health?.status === 'healthy' ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Activo
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                <AlertCircle className="w-4 h-4 text-amber-500" /> Sin conexión
              </span>
            )}
          </Card>

          <Card className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex-1 text-xs">
              <p className="font-semibold text-slate-700">Base de Datos Supabase</p>
              <p className="text-slate-500">Tablas de CRM migradas con esquemas de baja lógica e índices</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Conectado
            </span>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
