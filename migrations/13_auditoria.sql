-- ==============================================================================
-- 13 · Auditoría general de cambios (regla 15: identificar quién hizo cada cambio)
-- ==============================================================================
-- Idempotente: se puede correr más de una vez. El backend funciona sin esta
-- migración (guarda la auditoría en memoria) hasta aplicarla.
--
-- Una fila por cada alta, modificación o baja exitosa hecha por la API
-- (POST/PUT/PATCH/DELETE sobre /api/*). La registra un middleware, así que
-- cubre empresas, contactos, presupuestos, obras, materiales, usuarios,
-- etapas, catálogos y actividades sin tocar cada endpoint.
--
-- Es un registro inmutable: no hay políticas de borrado ni de edición.
-- user_id no tiene FK a crm_users a propósito: la fila tiene que sobrevivir
-- aunque el usuario se dé de baja, y user_name / user_role guardan cómo se
-- llamaba y qué rol tenía en el momento del cambio.

CREATE TABLE IF NOT EXISTS crm_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_name TEXT,
    user_role TEXT,
    action TEXT NOT NULL CHECK (action IN ('crear', 'modificar', 'dar_de_baja', 'otra')),
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    summary TEXT,
    -- Cuerpo del pedido con contraseñas, tokens y claves redactados.
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    status_code INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_audit_log_created ON crm_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_audit_log_entity ON crm_audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_audit_log_user ON crm_audit_log (user_id);
