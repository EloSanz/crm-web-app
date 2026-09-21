import type { User } from '@/types/auth';

/** Administrador y responsable comercial ven todo el equipo y pueden reasignar. */
export function isManager(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'gerente_comercial';
}

/** Sólo el administrador da de alta usuarios y cambia roles. */
export function isAdmin(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'admin';
}
