/** Catálogos que configura el administrador (pantalla /configuracion). */
export type CatalogKind = 'activity_type' | 'origin' | 'loss_reason';

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  /** Código interno: es lo que se guarda en las actividades. Orígenes y motivos guardan el nombre (label). */
  code: string;
  label: string;
  position: number;
  is_active: boolean;
  /** Lo usa el sistema (ej. llamada, correo): se renombra y reordena pero no se desactiva. */
  is_system: boolean;
}

/** Tipo de etapa del embudo. */
export type StageKind = 'open' | 'won' | 'lost';

export interface StageFormData {
  name?: string;
  color?: string;
  kind?: StageKind;
  is_active?: boolean;
}
