-- ==============================================================================
-- 12 · Observaciones del presupuesto, resultado de la actividad y valor final
-- ==============================================================================
-- crm_opportunities.notes:       observaciones del presupuesto (condiciones, aclaraciones).
-- crm_opportunities.final_value: valor final de la venta concretada; el total presupuestado
--                                (estimated_value) ya no se pisa al ganar.
-- crm_activities.result:         resultado de la interacción (qué se logró o acordó).
-- Idempotente: se puede correr más de una vez. Sin estas columnas, el backend guarda sin ellas.

ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS final_value NUMERIC(14,2);
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS result TEXT;

-- Ganados existentes: hasta ahora el valor final quedaba en estimated_value.
UPDATE crm_opportunities
SET final_value = estimated_value
WHERE status = 'ganada' AND final_value IS NULL;
