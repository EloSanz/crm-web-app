'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { buildApiUrl, CRM_CLIENT_API_KEY } from '@/lib/api';

const DEMO_USERS = [
  { role: 'Administrador', email: 'admin@crm.com', password: 'admin123' },
  { role: 'Responsable comercial', email: 'gerente@crm.com', password: 'gerente123' },
  { role: 'Vendedor', email: 'vendedor@crm.com', password: 'vendedor123' },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': CRM_CLIENT_API_KEY,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'No pudimos iniciar sesión.');
      }

      // Guardar token y datos del usuario en localStorage para la sesión
      if (typeof window !== 'undefined') {
        localStorage.setItem('crm_access_token', data.access_token);
        localStorage.setItem('crm_user', JSON.stringify(data.user));
        window.dispatchEvent(new Event('crm-user-change'));
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos conectar con el servidor. Revisá la conexión y probá de nuevo.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px]">
      <h1 className="titular text-[28px] sm:text-[34px]">Ingresar</h1>

      {error && (
        <div role="alert" className="mt-6 rounded-xl border border-rojo/30 bg-rojo-velo px-4 py-3 text-rojo-tinta">
          <p className="font-bold">No pudimos ingresar</p>
          <p className="mt-0.5 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field label="Correo" required>
          {({ id }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              required
              placeholder="nombre@corralon.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          )}
        </Field>

        <Field label="Contraseña" required>
          {({ id }) => (
            <div className="relative">
              <Input
                id={id}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-md text-tiza hover:text-tinta hover:bg-chapa-2 cursor-pointer"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          )}
        </Field>

        <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
          Ingresar
          {!isLoading && <ArrowRight className="w-5 h-5" aria-hidden />}
        </Button>
      </form>

      <div className="mt-10 border-t border-linea pt-6">
        <div className="grid grid-cols-1 gap-2">
          {DEMO_USERS.map((u) => (
            <button
              key={u.email}
              type="button"
              onClick={() => {
                setEmail(u.email);
                setPassword(u.password);
                setError(null);
              }}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-linea bg-chapa px-4 py-3 text-left transition-colors hover:border-linea-fuerte cursor-pointer"
            >
              <span className="shrink-0 font-bold">{u.role}</span>
              <span className="min-w-0 truncate text-sm text-tiza">{u.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
