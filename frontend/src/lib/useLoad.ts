'use client';

import { useCallback, useEffect, useState } from 'react';

/** Carga datos al montar y expone `reload`. El loader debe ser estable (fuera del componente o memorizado). */
export function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loader()
      .then((d) => alive && setData(d))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : 'No se pudo conectar con la API'))
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
      setError(err instanceof Error ? err.message : 'No se pudo conectar con la API');
    }
  }, [loader]);

  return { data, error, loading, reload, setData };
}
