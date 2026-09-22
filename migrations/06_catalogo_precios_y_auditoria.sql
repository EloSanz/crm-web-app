-- ==============================================================================
-- 06 · Precio minorista / mayorista y historial de cambios del catálogo
-- ==============================================================================
-- Idempotente: se puede correr más de una vez. El backend funciona sin esta
-- migración (guarda el precio mayorista y el historial en memoria) hasta aplicarla.

-- 1. Precio mayorista por material ---------------------------------------------
-- unit_price sigue siendo el precio minorista. El mayorista aplica desde
-- wholesale_min_qty unidades (en la unidad del material: bolsas, barras, m³...).
ALTER TABLE crm_products
    ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12, 2);
ALTER TABLE crm_products
    ADD COLUMN IF NOT EXISTS wholesale_min_qty NUMERIC(10, 2);

-- Van de a par y el mayorista nunca supera al minorista.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_products_wholesale_chk') THEN
        ALTER TABLE crm_products
            ADD CONSTRAINT crm_products_wholesale_chk CHECK (
                (wholesale_price IS NULL AND wholesale_min_qty IS NULL)
                OR (
                    wholesale_price IS NOT NULL
                    AND wholesale_min_qty IS NOT NULL
                    AND wholesale_price > 0
                    AND wholesale_min_qty > 0
                    AND wholesale_price <= unit_price
                )
            );
    END IF;
END $$;

-- 2. Historial de cambios del catálogo ------------------------------------------
-- Una fila por alta, edición o baja. changes = {campo: {"antes": x, "despues": y}}
-- con sólo los campos que cambiaron (updated_at no cuenta). Es inmutable.
CREATE TABLE IF NOT EXISTS crm_catalog_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES crm_products(id) ON DELETE SET NULL,
    product_code VARCHAR(50),
    product_name VARCHAR(255),
    action VARCHAR(20) NOT NULL CHECK (action IN ('alta', 'edicion', 'baja')),
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    user_id UUID REFERENCES crm_users(id),
    user_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_catalog_audit_product ON crm_catalog_audit(product_id);
CREATE INDEX IF NOT EXISTS idx_crm_catalog_audit_created ON crm_catalog_audit(created_at DESC);

-- 3. Precios mayoristas de referencia para el catálogo semilla --------------------
UPDATE crm_products SET wholesale_price = 8900.00, wholesale_min_qty = 50
    WHERE code = 'CEM-50' AND wholesale_price IS NULL AND unit_price >= 8900.00;
UPDATE crm_products SET wholesale_price = 3850.00, wholesale_min_qty = 40
    WHERE code = 'CAL-25' AND wholesale_price IS NULL AND unit_price >= 3850.00;
UPDATE crm_products SET wholesale_price = 7250.00, wholesale_min_qty = 20
    WHERE code = 'HIE-08' AND wholesale_price IS NULL AND unit_price >= 7250.00;
UPDATE crm_products SET wholesale_price = 11400.00, wholesale_min_qty = 20
    WHERE code = 'HIE-10' AND wholesale_price IS NULL AND unit_price >= 11400.00;
UPDATE crm_products SET wholesale_price = 16400.00, wholesale_min_qty = 20
    WHERE code = 'HIE-12' AND wholesale_price IS NULL AND unit_price >= 16400.00;
UPDATE crm_products SET wholesale_price = 640.00, wholesale_min_qty = 1000
    WHERE code = 'LAD-12' AND wholesale_price IS NULL AND unit_price >= 640.00;
UPDATE crm_products SET wholesale_price = 880.00, wholesale_min_qty = 1000
    WHERE code = 'LAD-18' AND wholesale_price IS NULL AND unit_price >= 880.00;
