'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    try {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Error al iniciar sesión');
      }

      // Guardar token y datos del usuario en localStorage para la sesión
      if (typeof window !== 'undefined') {
        localStorage.setItem('crm_access_token', data.access_token);
        localStorage.setItem('crm_user', JSON.stringify(data.user));
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado al conectar con el servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <Card className="w-full max-w-md p-8 shadow-xl border-slate-200">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-3">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Acceso al CRM</h1>
        <p className="text-sm text-slate-500 mt-1">Gestión Comercial y Embudo de Ventas</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <div>
            <p className="font-semibold">Fallo en la autenticación</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Input
            label="Correo Electrónico"
            type="email"
            required
            placeholder="admin@crm.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div>
          <Input
            label="Contraseña"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full font-semibold" isLoading={isLoading}>
          Ingresar al Sistema
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
          Credenciales de Demostración
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleDemoFill('admin@crm.com', 'admin123')}
            className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-left transition-colors"
          >
            <span className="font-semibold text-slate-800 block">Admin</span>
            <span className="text-slate-500 text-[11px]">admin@crm.com</span>
          </button>
          <button
            type="button"
            onClick={() => handleDemoFill('vendedor@crm.com', 'vendedor123')}
            className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-left transition-colors"
          >
            <span className="font-semibold text-slate-800 block">Vendedor</span>
            <span className="text-slate-500 text-[11px]">vendedor@crm.com</span>
          </button>
        </div>
      </div>
    </Card>
  );
}
