/** Historial de cambios del catálogo (GET /api/products/audit, sólo administrador). */

export type CatalogAuditAction = 'alta' | 'edicion' | 'baja';

/** Campos del material que registra el historial. */
export type CatalogAuditField =
  | 'code'
  | 'name'
  | 'category'
  | 'unit'
  | 'unit_price'
  | 'wholesale_price'
  | 'wholesale_min_qty'
  | 'description'
  | 'is_active';

export type CatalogAuditValue = string | number | boolean | null;

export interface CatalogAuditChange {
  antes: CatalogAuditValue;
  despues: CatalogAuditValue;
}

export interface CatalogAuditEntry {
  id: string;
  product_id: string | null;
  product_code: string | null;
  product_name: string | null;
  action: CatalogAuditAction;
  /** Sólo los campos que cambiaron. En un alta, `antes` es null. En una baja viene vacío. */
  changes: Partial<Record<CatalogAuditField, CatalogAuditChange>>;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

export interface CatalogAuditQuery {
  product_id?: string;
  user_id?: string;
  q?: string;
  limit?: number;
  offset?: number;
}
