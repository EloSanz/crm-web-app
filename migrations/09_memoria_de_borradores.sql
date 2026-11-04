-- ==============================================================================
-- 09 · Memoria de borradores: lo que el vendedor terminó enviando a partir de cada borrador
-- ==============================================================================
-- Comparando el borrador del asistente (answer) con lo enviado (final_text) el asistente aprende
-- cómo escribe cada vendedor. Idempotente. Sin esta columna, el backend lo recuerda en memoria.

ALTER TABLE crm_ai_requests ADD COLUMN IF NOT EXISTS final_text TEXT;
