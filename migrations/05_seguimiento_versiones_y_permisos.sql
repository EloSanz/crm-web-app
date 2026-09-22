-- ==============================================================================
-- 05 · Seguimiento con hitos, versiones de presupuesto, descuentos y permisos
-- ==============================================================================
-- Idempotente: se puede correr más de una vez.

-- Adjuntos del seguimiento (repite la 04 por si no se aplicó).
ALTER TABLE crm_activities
    ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Descuento general y versión vigente de los materiales cotizados.
ALTER TABLE crm_opportunities
    ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0
        CHECK (discount_pct >= 0 AND discount_pct <= 100),
    ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version >= 1);

-- Negociación por renglón: precio de lista, escala aplicada (minorista / mayorista / manual) y descuento.
ALTER TABLE crm_opportunity_items
    ADD COLUMN IF NOT EXISTS list_price NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS price_tier VARCHAR(20) NOT NULL DEFAULT 'minorista'
        CHECK (price_tier IN ('minorista', 'mayorista', 'manual')),
    ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0
        CHECK (discount_pct >= 0 AND discount_pct <= 100);

-- Historial de versiones: cada vez que cambian los materiales o el descuento queda la foto completa.
CREATE TABLE IF NOT EXISTS crm_opportunity_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES crm_opportunities(id) ON DELETE CASCADE,
    version INTEGER NOT NULL CHECK (version >= 1),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    note TEXT,
    created_by UUID REFERENCES crm_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (opportunity_id, version)
);

CREATE INDEX IF NOT EXISTS idx_crm_opportunity_versions_opp ON crm_opportunity_versions(opportunity_id, version DESC);

-- Hitos del seguimiento y tiempo por etapa (indicadores).
CREATE INDEX IF NOT EXISTS idx_crm_stage_history_opp ON crm_stage_history(opportunity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_crm_stage_history_created ON crm_stage_history(created_at);

-- Cada vendedor ve sólo sus presupuestos: se filtra por responsable.
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_assigned ON crm_opportunities(assigned_to) WHERE is_deleted = FALSE;

-- Búsqueda de duplicados de contactos (DNI / teléfono / correo).
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email_lower ON crm_contacts(LOWER(email)) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_document ON crm_contacts(document_number) WHERE is_deleted = FALSE;
