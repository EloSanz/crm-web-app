/** Auditoría general de cambios (regla 15): quién hizo cada alta, modificación o baja por la API. */

export type AuditAction = 'crear' | 'modificar' | 'dar_de_baja' | 'otra';

export interface AuditEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  action: AuditAction;
  method: string;
  path: string;
  /** empresa, contacto, presupuesto, obra, producto, usuario, etapa, catálogo, actividad… */
  entity: string;
  entity_id: string | null;
  summary: string | null;
  /** Cuerpo del pedido con contraseñas y tokens redactados. */
  changes: unknown;
  status_code: number | null;
  created_at: string;
}

export interface AuditPage {
  items: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditQuery {
  entity?: string;
  entity_id?: string;
  user_id?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}
