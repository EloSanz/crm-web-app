-- ==============================================================================
-- 07 · Comunicaciones con clientes: correos enviados y conversación de WhatsApp
-- ==============================================================================
-- Cada correo o WhatsApp (saliente o entrante) queda registrado acá. El seguimiento del
-- presupuesto y los indicadores se siguen alimentando desde crm_activities: por cada envío
-- el backend también registra una actividad de tipo 'email' o 'whatsapp'.
-- Si esta migración todavía no se aplicó, el backend guarda los mensajes en memoria y las
-- actividades igual quedan en crm_activities.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS crm_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('saliente', 'entrante')),
    status VARCHAR(20) NOT NULL DEFAULT 'enviado'
        CHECK (status IN ('enviado', 'entregado', 'leido', 'fallido', 'simulado', 'recibido')),
    opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    user_id UUID REFERENCES crm_users(id) ON DELETE SET NULL,
    to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,     -- ["cliente@obra.com"] o ["5491122334455"]
    cc JSONB NOT NULL DEFAULT '[]'::jsonb,
    subject VARCHAR(255),
    body_html TEXT,                                      -- HTML ya saneado (sin la plantilla de marca)
    body_text TEXT,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,      -- [{ url, name, content_type, size_bytes }] en S3
    phone VARCHAR(20),                                   -- WhatsApp: número E.164 sólo dígitos (5491122334455)
    provider VARCHAR(30),                                -- log | resend | smtp | meta
    provider_message_id VARCHAR(255),                    -- id de Resend / Message-ID SMTP / wamid de Meta
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- El webhook de estados de Meta busca por wamid; también evita duplicar reintentos del webhook.
CREATE UNIQUE INDEX IF NOT EXISTS ux_crm_messages_provider_message_id
    ON crm_messages (provider_message_id)
    WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_crm_messages_opportunity ON crm_messages (opportunity_id);
CREATE INDEX IF NOT EXISTS ix_crm_messages_contact ON crm_messages (contact_id);
CREATE INDEX IF NOT EXISTS ix_crm_messages_phone ON crm_messages (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_crm_messages_created_at ON crm_messages (created_at DESC);
