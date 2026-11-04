-- ==============================================================================
-- 08 · Asistente con IA (borradores y «Ponete al día») y Gmail del vendedor
-- ==============================================================================
-- Idempotente: se puede correr más de una vez. Si todavía no se aplicó, el backend guarda
-- estos datos en memoria (desarrollo local y tests) y todo sigue funcionando.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- Registro de cada consulta al modelo: quién, para qué, sobre qué cliente y cuánto costó.
-- Alimenta el tope de gasto mensual y la auditoría de qué datos de clientes salieron del CRM.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_ai_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature VARCHAR(30) NOT NULL CHECK (feature IN ('borrador', 'ponete_al_dia')),
    user_id UUID REFERENCES crm_users(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL,
    company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    channel VARCHAR(20),                       -- borrador: email | whatsapp
    question TEXT,                             -- ponete al día: la pregunta del vendedor
    answer TEXT,                               -- borrador o respuesta devuelta
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    model VARCHAR(60) NOT NULL,                -- "simulado" cuando no hay clave
    simulated BOOLEAN NOT NULL DEFAULT FALSE,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error', 'sin_fuente', 'rechazado')),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_crm_ai_requests_created_at ON crm_ai_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_crm_ai_requests_user ON crm_ai_requests (user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- Cuentas de Gmail conectadas: una por vendedor. Los tokens se guardan cifrados (Fernet).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_gmail_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES crm_users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    refresh_token_enc TEXT NOT NULL,
    access_token_enc TEXT,
    access_token_expires_at TIMESTAMPTZ,
    scopes TEXT,
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Hilo de correo: sólo entran al CRM las respuestas a hilos iniciados desde el CRM.
-- ------------------------------------------------------------------------------
ALTER TABLE crm_messages ADD COLUMN IF NOT EXISTS thread_id VARCHAR(255);       -- threadId de Gmail
ALTER TABLE crm_messages ADD COLUMN IF NOT EXISTS from_address VARCHAR(255);    -- remitente (entrantes y Gmail)
ALTER TABLE crm_messages ADD COLUMN IF NOT EXISTS rfc_message_id VARCHAR(998);  -- cabecera Message-ID (para responder en hilo)

CREATE INDEX IF NOT EXISTS ix_crm_messages_thread ON crm_messages (thread_id) WHERE thread_id IS NOT NULL;
