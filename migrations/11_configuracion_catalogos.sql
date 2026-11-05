-- ==============================================================================
-- 11 · Configuración del embudo y de los catálogos (pantallas del administrador)
-- ==============================================================================
-- Etapas configurables (alta, orden, baja lógica) y un catálogo único para tipos de
-- actividad, orígenes y motivos de pérdida. Nada se borra físicamente: se desactiva.
-- Idempotente: se puede correr más de una vez sin romper nada.

-- 1. Etapas: baja lógica y fecha de última edición
ALTER TABLE crm_stages ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE crm_stages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Catálogos configurables
CREATE TABLE IF NOT EXISTS crm_catalog_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('activity_type', 'origin', 'loss_reason')),
    code VARCHAR(60) NOT NULL,
    label VARCHAR(120) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crm_catalog_items_kind_code_key UNIQUE (kind, code)
);

CREATE INDEX IF NOT EXISTS idx_crm_catalog_items_kind ON crm_catalog_items (kind, position);

-- 3. Valores iniciales (los que hoy usa el sistema). Los tipos de actividad existentes
--    son de sistema: se pueden renombrar y reordenar, pero no desactivar.
INSERT INTO crm_catalog_items (kind, code, label, position, is_system)
VALUES
    ('activity_type', 'llamada', 'Llamada', 1, true),
    ('activity_type', 'whatsapp', 'WhatsApp / mensaje', 2, true),
    ('activity_type', 'visita_obra', 'Visita a la obra', 3, true),
    ('activity_type', 'mostrador', 'Atención en el local', 4, true),
    ('activity_type', 'email', 'Correo', 5, true),
    ('activity_type', 'presupuesto', 'Envío de presupuesto', 6, true),
    ('activity_type', 'reunion', 'Reunión', 7, true),
    ('activity_type', 'nota', 'Nota interna', 8, true),
    ('origin', 'vino-al-local-mostrador', 'Vino al local (mostrador)', 1, false),
    ('origin', 'recomendacion-de-otro-contratista', 'Recomendación de otro contratista', 2, false),
    ('origin', 'cliente-existente-recompra', 'Cliente existente / recompra', 3, false),
    ('origin', 'prospeccion-propia', 'Prospección propia', 4, false),
    ('origin', 'redes-sociales', 'Redes sociales', 5, false),
    ('origin', 'publicidad', 'Publicidad', 6, false),
    ('origin', 'pagina-web', 'Página web', 7, false),
    ('loss_reason', 'precio-presupuesto-mas-caro', 'Precio / Presupuesto más caro', 1, false),
    ('loss_reason', 'plazo-de-entrega-prolongado', 'Plazo de entrega prolongado', 2, false),
    ('loss_reason', 'eligio-otro-corralon-competidor', 'Eligió otro corralón competidor', 3, false),
    ('loss_reason', 'obra-frenada-o-postergada', 'Obra frenada o postergada', 4, false),
    ('loss_reason', 'no-hubo-acuerdo-en-condiciones-de-financiacion', 'No hubo acuerdo en condiciones de financiación', 5, false),
    ('loss_reason', 'falta-de-respuesta-del-contratista', 'Falta de respuesta del contratista', 6, false),
    ('loss_reason', 'faltante-o-quiebre-de-stock-de-materiales', 'Faltante o quiebre de stock de materiales', 7, false),
    ('loss_reason', 'otro-motivo-particular', 'Otro motivo particular', 8, false)
ON CONFLICT (kind, code) DO NOTHING;

-- 4. Tipos de actividad abiertos: se quita el CHECK fijo de crm_activities.activity_type.
--    El backend valida el tipo contra el catálogo activo. Se busca el nombre real de la
--    constraint porque Postgres lo generó automáticamente en la migración 01.
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'crm_activities'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%activity_type%'
    LOOP
        EXECUTE format('ALTER TABLE crm_activities DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END LOOP;
END $$;
