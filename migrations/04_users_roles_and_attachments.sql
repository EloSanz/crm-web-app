-- ==============================================================================
-- 04 · Usuarios demo por rol y adjuntos en el seguimiento
-- ==============================================================================

-- Adjuntos (fotos de obra, remitos, planos) de cada hecho comercial.
-- Guarda [{ url, name, content_type, size_bytes }]; los archivos viven en S3.
ALTER TABLE crm_activities
    ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Responsable comercial de demostración (supervisa el embudo y reasigna presupuestos).
INSERT INTO crm_users (id, email, full_name, role, is_active)
VALUES ('00000000-0000-0000-0000-000000000003', 'gerente@crm.com', 'Responsable Comercial', 'gerente_comercial', TRUE)
ON CONFLICT DO NOTHING;
