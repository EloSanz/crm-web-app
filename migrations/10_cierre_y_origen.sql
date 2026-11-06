-- ==============================================================================
-- 10 · Cierre de presupuestos y origen propio
-- ==============================================================================
-- closed_at: fecha real de cierre (ganado o perdido); al reabrir vuelve a NULL.
-- origin:    origen del presupuesto, precargado con el del cliente y editable.
-- Idempotente: se puede correr más de una vez. Sin estas columnas, el backend guarda sin ellas.

ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS origin VARCHAR(100);

-- Fecha de cierre de los cerrados existentes: el último paso a la etapa de ganado o perdido.
UPDATE crm_opportunities o
SET closed_at = h.closed_at
FROM (
    SELECT sh.opportunity_id, MAX(sh.created_at) AS closed_at
    FROM crm_stage_history sh
    JOIN crm_stages s ON s.id = sh.to_stage_id
    WHERE s.is_closed_won OR s.is_closed_lost
    GROUP BY sh.opportunity_id
) h
WHERE o.id = h.opportunity_id
  AND o.status IN ('ganada', 'perdida')
  AND o.closed_at IS NULL;

-- Cerrados sin historial: se toma la última modificación como mejor aproximación.
UPDATE crm_opportunities
SET closed_at = updated_at
WHERE status IN ('ganada', 'perdida') AND closed_at IS NULL;

-- Origen de los presupuestos existentes: el de la empresa o, si no hay, el del contacto.
UPDATE crm_opportunities o
SET origin = c.origin
FROM crm_companies c
WHERE o.company_id = c.id AND o.origin IS NULL AND c.origin IS NOT NULL;

UPDATE crm_opportunities o
SET origin = k.origin
FROM crm_contacts k
WHERE o.contact_id = k.id AND o.origin IS NULL AND k.origin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_opportunities_origin ON crm_opportunities (origin);
