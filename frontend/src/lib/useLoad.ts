'use client';

import { useCallback, useEffect, useState } from 'react';

/** Los errores de red del navegador llegan en inglés ("Failed to fetch"): se traducen a algo útil. */
function message(err: unknown): string {
  if (!(err instanceof Error)) return 'No se pudo conectar con el servidor';
  if (err.name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(err.message)) {
    return 'Sin conexión con el servidor. Revisá tu internet y probá de nuevo.';
  }
  return err.message;
}

/** Carga datos al montar y expone `reload`. El loader debe ser estable (fuera del componente o memorizado). */
export function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loader()
      .then((d) => alive && setData(d))
      .catch((err: unknown) => alive && setError(message(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [loader]);

  const reload = useCallback(async () => {
    try {
      setData(await loader());
      setError(null);
    } catch (err) {
      setError(message(err));
    }
  }, [loader]);

  return { data, error, loading, reload, setData };
}
