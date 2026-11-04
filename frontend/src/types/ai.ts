import type { MessageChannel } from './comms';

export interface AIStatus {
  configured: boolean;
  simulated: boolean;
  model: string;
  budget_usd: number;
  spent_usd: number;
  budget_reached: boolean;
  daily_limit: number;
  daily_used: number;
}

/** Borrador sugerido por el asistente: nunca se envía solo, vuelve al editor. */
export interface AIDraft {
  id: string;
  channel: MessageChannel;
  reason: 'respuesta' | 'enfriado' | 'seguimiento';
  reason_label: string;
  subject?: string | null;
  body_text: string;
  body_html?: string | null;
  to_confirm: string[];
  rationale?: string | null;
  simulated: boolean;
  model: string;
}

export interface DraftPayload {
  channel: MessageChannel;
  opportunity_id?: string | null;
  contact_id?: string | null;
  phone?: string | null;
  instruction?: string | null;
}

/** Fuente citada por «Ponete al día»: una actividad, etapa, versión o mensaje del seguimiento. */
export interface Citation {
  ref: string;
  kind: 'presupuesto' | 'etapa' | 'version' | 'actividad' | 'mensaje' | 'ficha';
  kind_label: string;
  at: string;
  title: string;
  detail?: string | null;
  opportunity_id?: string | null;
  opportunity_title?: string | null;
  source_id?: string | null;
  user_name?: string | null;
  link?: string | null;
}

export interface CatchupOverview {
  company_id?: string | null;
  company_name?: string | null;
  opportunities: number;
  open: number;
  won: number;
  lost: number;
  quoted_total: number;
  won_total: number;
  entries: number;
  last_contact?: Citation | null;
  sellers: string[];
  suggested_questions: string[];
  truncated: boolean;
  assistant: AIStatus;
}

export interface CatchupAnswer {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  unknown: boolean;
  unsourced: boolean;
  simulated: boolean;
  model: string;
}

export interface GmailStatus {
  configured: boolean;
  connected: boolean;
  email?: string | null;
  last_sync_at?: string | null;
  last_error?: string | null;
  fallback_provider: string;
}

export interface GmailSyncResult {
  connected: boolean;
  new_messages: number;
  last_sync_at?: string | null;
  error?: string | null;
}
