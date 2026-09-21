import type {
  ActivityType,
  CompanyStatus,
  ProductCategory,
  ProjectStatus,
  ProjectType,
} from '@/types/crm';

export const ORIGIN_OPTIONS = [
  'Vino al local (mostrador)',
  'Recomendación de otro contratista',
  'Cliente existente / recompra',
  'Prospección propia',
  'Redes sociales',
  'Publicidad',
  'Página web',
];

export const LOSS_REASONS = [
  'Precio / Presupuesto más caro',
  'Plazo de entrega prolongado',
  'Eligió otro corralón competidor',
  'Obra frenada o postergada',
  'No hubo acuerdo en condiciones de financiación',
  'Falta de respuesta del contratista',
  'Faltante o quiebre de stock de materiales',
  'Otro motivo particular',
];

export const CONTACT_ROLES = [
  'Maestro Mayor de Obra',
  'Contratista General',
  'Capataz de Obra',
  'Arquitecto / Director de Obra',
  'Jefe de Compras',
  'Particular / Dueño de Obra',
];

/** verde/ambar/rojo quedan para la salud del seguimiento; los estados de ficha usan fuerte/tinta/pausa/neutro. */
export type Tone = 'verde' | 'ambar' | 'rojo' | 'neutro' | 'tinta' | 'fuerte' | 'pausa';

export const CLIENT_STATUS: Record<CompanyStatus, { label: string; tone: Tone }> = {
  potencial: { label: 'Potencial', tone: 'tinta' },
  cliente: { label: 'Cliente', tone: 'fuerte' },
  inactivo: { label: 'Inactivo', tone: 'neutro' },
  no_contactar: { label: 'No contactar', tone: 'rojo' },
};

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  en_curso: { label: 'En curso', tone: 'fuerte' },
  planificacion: { label: 'Planificación', tone: 'tinta' },
  frenada: { label: 'Frenada', tone: 'pausa' },
  finalizada: { label: 'Finalizada', tone: 'neutro' },
};

export const PROJECT_TYPES: Record<ProjectType, string> = {
  vivienda_unifamiliar: 'Vivienda unifamiliar',
  edificio_multifamiliar: 'Edificio multifamiliar',
  comercial_industrial: 'Comercial / industrial',
  refaccion: 'Refacción',
  obra_publica: 'Obra pública',
};

export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'Aglomerantes', label: 'Aglomerantes' },
  { value: 'Áridos', label: 'Áridos' },
  { value: 'Hierros y Aceros', label: 'Hierros y aceros' },
  { value: 'Mampostería', label: 'Mampostería' },
  { value: 'Techos e Hidráulica', label: 'Techos e hidráulica' },
  { value: 'Servicios', label: 'Servicios y fletes' },
];

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'whatsapp', label: 'WhatsApp / mensaje' },
  { value: 'visita_obra', label: 'Visita a la obra' },
  { value: 'mostrador', label: 'Atención en el local' },
  { value: 'email', label: 'Correo' },
  { value: 'presupuesto', label: 'Envío de presupuesto' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'nota', label: 'Nota interna' },
];

export const ROLE_OPTIONS = [
  { value: 'ejecutivo_ventas', label: 'Vendedor' },
  { value: 'gerente_comercial', label: 'Responsable comercial' },
  { value: 'admin', label: 'Administrador' },
] as const;

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  gerente_comercial: 'Responsable comercial',
  ejecutivo_ventas: 'Vendedor',
};
