'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { Chip } from '@/components/ui/Chip';
import { PAGE_SIZE, Pagination } from '@/components/ui/Pagination';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import type { CrmUser } from '@/types/crm';
import type { AuditAction, AuditEntry, AuditPage } from '@/types/audit';
import { fetchUsers } from '@/lib/api';
import { fetchAudit } from '@/lib/api-audit';
import { useLoad } from '@/lib/useLoad';
import { ROLE_LABELS, type Tone } from '@/lib/catalogs';

/** Opción "todos" de los filtros: con el filtro vacío el desplegable muestra su rótulo corto. */
const ALL = '__todos';

const ACTIONS: Record<AuditAction, { label: string; tone: Tone }> = {
  crear: { label: 'Alta', tone: 'fuerte' },
  modificar: { label: 'Modificación', tone: 'tinta' },
  dar_de_baja: { label: 'Baja', tone: 'pausa' },
  otra: { label: 'Otra', tone: 'neutro' },
};

/** Entidades que registra el backend (ver ENTITIES en backend/audit_middleware.py). */
const ENTITIES: { value: string; label: string }[] = [
  { value: 'empresa', label: 'Empresa' },
  { value: 'contacto', label: 'Contacto' },
  { value: 'presupuesto', label: 'Presupuesto' },
  { value: 'obra', label: 'Obra' },
  { value: 'producto', label: 'Material' },
  { value: 'actividad', label: 'Actividad' },
  { value: 'comunicación', label: 'Comunicación' },
  { value: 'usuario', label: 'Usuario' },
  { value: 'etapa', label: 'Etapa del embudo' },
  { value: 'catálogo', label: 'Catálogo' },
  { value: 'configuración', label: 'Configuración' },
  { value: 'archivo', label: 'Archivo' },
];
const ENTITY_LABEL = new Map(ENTITIES.map((e) => [e.value, e.label]));

/** Pantalla de detalle de cada entidad, si existe una. */
const DETAIL_HREF: Record<string, (id: string) => string> = {
  empresa: (id) => `/companies/${id}`,
  contacto: (id) => `/contacts/${id}`,
  presupuesto: (id) => `/opportunities/${id}`,
  obra: (id) => `/projects/${id}/editar`,
  producto: (id) => `/catalog/${id}/editar`,
  usuario: (id) => `/usuarios/${id}/editar`,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function detailHref(entry: AuditEntry): string | null {
  // Lo dado de baja ya no tiene detalle que abrir.
  if (!entry.entity_id || entry.action === 'dar_de_baja' || !UUID_RE.test(entry.entity_id)) return null;
  return DETAIL_HREF[entry.entity]?.(entry.entity_id) ?? null;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'No se pudo conectar con la API');

interface Results {
  key: string;
  page: AuditPage | null;
  error: string | null;
}

export function AuditLog() {
  const users = useLoad(fetchUsers);
  const [entity, setEntity] = useState('');
  const [userId, setUserId] = useState('');
  // La página vuelve a 0 cuando cambian los filtros (se deriva en el render, sin efectos).
  const filterKey = `${entity}|${userId}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 });
  const page = pageState.key === filterKey ? pageState.page : 0;
  const [results, setResults] = useState<Results | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const key = `${filterKey}|${page}`;
  useEffect(() => {
    let alive = true;
    fetchAudit({ entity, user_id: userId, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((data) => alive && setResults({ key, page: data, error: null }))
      .catch((err: unknown) => alive && setResults({ key, page: null, error: errorText(err) }));
    return () => {
      alive = false;
    };
  }, [key, entity, userId, page]);

  const refreshing = results !== null && results.key !== key;
  const filtered = Boolean(entity || userId);
  const total = results?.page?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = results?.page?.items ?? [];

  const userOptions = useMemo(
    () => [{ value: ALL, label: 'Todos los usuarios' }, ...(users.data ?? []).map((u: CrmUser) => ({ value: u.id, label: u.full_name, hint: ROLE_LABELS[u.role] }))],
    [users.data]
  );
  const entityOptions = useMemo(() => [{ value: ALL, label: 'Todas las entidades' }, ...ENTITIES], []);

  return (
    <div className="space-y-5">
      <PageHeader title="Auditoría" />
      <div role="group" aria-label="Filtros" className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:max-w-xl">
        <Select value={entity} onChange={(v) => setEntity(v === ALL ? '' : v)} options={entityOptions} placeholder="Entidad" aria-label="Entidad" searchable={false} />
        <Select value={userId} onChange={(v) => setUserId(v === ALL ? '' : v)} options={userOptions} placeholder="Usuario" aria-label="Usuario" searchPlaceholder="Buscar usuario…" />
      </div>

      {results === null ? (
        <LoadingBlock label="Cargando auditoría" />
      ) : results.error ? (
        <EmptyState illustration="busqueda" title="No pudimos cargar la auditoría" description={results.error} />
      ) : items.length === 0 ? (
        <EmptyState illustration="busqueda" title={filtered ? 'Sin resultados' : 'Todavía no hay cambios registrados'} />
      ) : (
        <div
          ref={anchorRef}
          className={`scroll-mt-24 overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave transition-opacity ${refreshing ? 'opacity-60' : ''}`}
          aria-busy={refreshing || undefined}
        >
          {/* Escritorio: tabla. */}
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Auditoría de cambios</caption>
              <thead>
                <tr className="border-b border-linea bg-chapa-2">
                  {['Fecha y hora', 'Usuario', 'Acción', 'Entidad', 'Resumen'].map((h) => (
                    <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5 text-sm font-semibold text-tiza first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {items.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="whitespace-nowrap py-3 pl-5 pr-4 text-[15px]">
                      <time dateTime={entry.created_at} className="cifra">
                        {formatWhen(entry.created_at)}
                      </time>
                    </td>
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap text-[15px] font-semibold">{entry.user_name || 'Usuario'}</p>
                      {entry.user_role && <p className="whitespace-nowrap text-[13px] text-tiza">{ROLE_LABELS[entry.user_role as keyof typeof ROLE_LABELS] ?? entry.user_role}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <ActionChip action={entry.action} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[15px]">
                      <EntityLink entry={entry} />
                    </td>
                    <td className="w-full max-w-0 py-3 pl-4 pr-5">
                      <Summary entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular y tablet: lista compacta. */}
          <ul className="divide-y divide-linea xl:hidden">
            {items.map((entry) => (
              <li key={entry.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <ActionChip action={entry.action} />
                  <span className="text-[15px] font-semibold">
                    <EntityLink entry={entry} />
                  </span>
                </div>
                <div className="mt-1.5">
                  <Summary entry={entry} />
                </div>
                <p className="mt-1 truncate text-[13px] text-tiza">
                  <span className="font-semibold text-tinta">{entry.user_name || 'Usuario'}</span>
                  {' · '}
                  <time dateTime={entry.created_at}>{formatWhen(entry.created_at)}</time>
                </p>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={(next) => setPageState({ key: filterKey, page: next })}
            anchorRef={anchorRef}
            className="border-t border-linea px-4 py-3 sm:px-5"
          />
        </div>
      )}
    </div>
  );
}

function ActionChip({ action }: { action: AuditAction }) {
  const meta = ACTIONS[action] ?? ACTIONS.otra;
  return (
    <Chip tone={meta.tone} className="shrink-0">
      {meta.label}
    </Chip>
  );
}

function EntityLink({ entry }: { entry: AuditEntry }) {
  const label = ENTITY_LABEL.get(entry.entity) ?? entry.entity;
  const href = detailHref(entry);
  if (!href) return <span>{label}</span>;
  return (
    <Link href={href} className="font-semibold text-pavonado underline-offset-2 hover:underline">
      {label}
    </Link>
  );
}

/** Resumen del cambio y, desplegable, los datos que se mandaron (con los secretos ya redactados). */
function Summary({ entry }: { entry: AuditEntry }) {
  const changes = entry.changes && typeof entry.changes === 'object' && !Array.isArray(entry.changes) ? Object.entries(entry.changes as Record<string, unknown>) : [];
  return (
    <div className="min-w-0">
      <p className="break-words text-[15px]">{entry.summary || `${entry.method} ${entry.path}`}</p>
      {changes.length > 0 && (
        <details className="mt-1 text-sm">
          <summary className="w-fit cursor-pointer rounded font-semibold text-tiza hover:text-tinta">Ver datos</summary>
          <dl className="mt-1.5 space-y-1">
            {changes.map(([field, value]) => (
              <div key={field} className="min-w-0 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-3">
                <dt className="truncate font-semibold text-tiza">{field}</dt>
                <dd className="line-clamp-3 break-words text-tinta">{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}
