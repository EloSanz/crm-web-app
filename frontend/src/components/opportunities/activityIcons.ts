import type React from 'react';
import { CircleDot, ClipboardList, FileText, MapPin, Mail, MessageSquare, Phone, Store, Users } from 'lucide-react';
import type { SystemActivityType } from '@/types/crm';

type IconType = React.ComponentType<{ className?: string }>;

export const ACTIVITY_ICON: Record<SystemActivityType, IconType> = {
  llamada: Phone,
  whatsapp: MessageSquare,
  visita_obra: MapPin,
  mostrador: Store,
  email: Mail,
  presupuesto: ClipboardList,
  reunion: Users,
  nota: FileText,
};

/** Los tipos que agrega el administrador desde Configuración usan este ícono genérico. */
export const DEFAULT_ACTIVITY_ICON: IconType = CircleDot;
