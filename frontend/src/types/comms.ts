import type { Activity, ActivityAttachment } from '@/types/crm';

export type MessageChannel = 'email' | 'whatsapp';
export type MessageDirection = 'saliente' | 'entrante';
export type MessageStatus = 'enviado' | 'entregado' | 'leido' | 'fallido' | 'simulado' | 'recibido';

/** Correo o WhatsApp enviado / recibido con un cliente. */
export interface CrmMessage {
  id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  status: MessageStatus;
  opportunity_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  to_addresses: string[];
  cc: string[];
  subject?: string | null;
  body_html?: string | null;
  body_text?: string | null;
  attachments: ActivityAttachment[];
  phone?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  error?: string | null;
  created_at: string;
  /** Sólo en la respuesta del envío: adjuntos que no se pudieron incluir, etc. */
  warnings?: string[];
}

export interface EmailSendPayload {
  to: string[];
  cc: string[];
  subject: string;
  html: string;
  attachments: ActivityAttachment[];
  opportunity_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
}

export interface WhatsAppStatus {
  configured: boolean;
  template_available: boolean;
  provider?: string | null;
}

export interface WhatsAppConversation {
  configured: boolean;
  phone: string;
  contact_id?: string | null;
  contact_name?: string | null;
  window_open: boolean;
  window_expires_at?: string | null;
  last_inbound_at?: string | null;
  template_available: boolean;
  messages: CrmMessage[];
}

/** Destino de un contacto por teléfono: contacto del CRM o número suelto (línea de la empresa). */
export interface PhoneTarget {
  contact_id?: string | null;
  phone?: string | null;
  opportunity_id?: string | null;
  company_id?: string | null;
}

export interface WhatsAppSendPayload extends PhoneTarget {
  text?: string;
  template?: boolean;
}

export type ContactLogResult = Activity;
