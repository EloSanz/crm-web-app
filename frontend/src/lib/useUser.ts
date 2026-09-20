import { useSyncExternalStore } from 'react';
import { User } from '@/types/auth';

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  window.addEventListener('storage', callback);
  window.addEventListener('crm-user-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('crm-user-change', callback);
  };
}

function getSnapshot(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem('crm_user');
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function useCurrentUser(): User | null {
  const userJson = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('crm_access_token');
  localStorage.removeItem('crm_user');
  window.dispatchEvent(new Event('crm-user-change'));
}
