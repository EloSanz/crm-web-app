/** Tipos de hecho del historial comercial de un cliente. */
export type HistoryKind = 'actividad' | 'etapa' | 'version' | 'presupuesto' | 'mensaje';

/** Un hecho del historial: qué pasó, cuándo, quién y en qué presupuesto. */
export interface HistoryEntry {
  /** Clave estable: <tipo>-<id de origen>. */
  id: string;
  kind: HistoryKind;
  kind_label: string;
  at: string;
  title: string;
  detail?: string | null;
  /** Sólo en actividades: llamada, visita_obra, etc. */
  activity_type?: string | null;
  opportunity_id?: string | null;
  opportunity_title?: string | null;
  source_id?: string | null;
  /** Quién lo hizo (o el remitente, en los mensajes del cliente). */
  user_name?: string | null;
  /** Seguimiento del presupuesto con el hecho resaltado; null si es del propio cliente. */
  link?: string | null;
}

export interface HistoryPage {
  items: HistoryEntry[];
  /** Total con el filtro aplicado. */
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  /** Cantidad por tipo, sin filtrar (para los chips). */
  counts: Partial<Record<HistoryKind, number>>;
}

export type HistoryScope = 'companies' | 'contacts';
