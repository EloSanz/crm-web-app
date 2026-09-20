-- ==============================================================================
-- SISTEMA CRM PARA GESTIÓN COMERCIAL (UNLaM GADS II)
-- Migración 02: Catálogo de Materiales y Detalle de Presupuestos (Items)
-- ==============================================================================

-- 1. Tabla de Productos y Servicios (Catálogo para Presupuestar)
CREATE TABLE IF NOT EXISTS crm_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'unidad',
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla de Items de Presupuesto / Oportunidad
CREATE TABLE IF NOT EXISTS crm_opportunity_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES crm_opportunities(id) ON DELETE CASCADE,
    product_id UUID REFERENCES crm_products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'unidad',
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices de Búsqueda y Claves Foráneas
CREATE INDEX IF NOT EXISTS idx_crm_products_category ON crm_products(category);
CREATE INDEX IF NOT EXISTS idx_crm_products_is_deleted ON crm_products(is_deleted);
CREATE INDEX IF NOT EXISTS idx_crm_opportunity_items_opp ON crm_opportunity_items(opportunity_id);

-- ==============================================================================
-- DATOS SEMILLA: Catálogo de Materiales para Corralón (Precios de Mercado ARS)
-- ==============================================================================
INSERT INTO crm_products (code, name, category, unit, unit_price, description)
VALUES
    -- Aglomerantes
    ('CEM-50', 'Cemento Portland Loma Negra 50 kg', 'Aglomerantes', 'bolsa 50kg', 9800.00, 'Cemento de uso general para hormigón y mampostería.'),
    ('CAL-25', 'Cal Hidratada Milagro 25 kg', 'Aglomerantes', 'bolsa 25kg', 4200.00, 'Cal aérea hidratada en polvo para revoques y mezclas de asiento.'),
    ('YES-40', 'Yeso Tradicional Tuyango 40 kg', 'Aglomerantes', 'bolsa 40kg', 8500.00, 'Yeso de fragüe lento para enlucidos interiores.'),
    
    -- Áridos
    ('ARE-M3', 'Arena Gruesa Limpia por m³', 'Áridos', 'm3', 28000.00, 'Arena lavada de río para hormigón y mezclas.'),
    ('PIE-620', 'Piedra Partida Granítica 6-20 por m³', 'Áridos', 'm3', 38500.00, 'Agregado grueso para hormigón armado de alta resistencia.'),
    ('CAS-M3', 'Cascote de Ladrillo Triturado por m³', 'Áridos', 'm3', 19000.00, 'Cascote limpio para contrapisos y rellenos.'),

    -- Hierros y Aceros
    ('HIE-06', 'Hierro Aletado Ø 6 mm (Barra 12 m)', 'Hierros y Aceros', 'barra 12m', 4600.00, 'Acero conformado ADN 420 para estribos.'),
    ('HIE-08', 'Hierro Aletado Ø 8 mm (Barra 12 m)', 'Hierros y Aceros', 'barra 12m', 7900.00, 'Acero ADN 420 para armaduras principales y vigas.'),
    ('HIE-10', 'Hierro Aletado Ø 10 mm (Barra 12 m)', 'Hierros y Aceros', 'barra 12m', 12400.00, 'Acero ADN 420 para columnas y losas.'),
    ('HIE-12', 'Hierro Aletado Ø 12 mm (Barra 12 m)', 'Hierros y Aceros', 'barra 12m', 17800.00, 'Acero ADN 420 estructural.'),
    ('MAL-15', 'Malla Sima 15x15 Ø 4.2 mm (2.40 x 6.00 m)', 'Hierros y Aceros', 'paño', 34500.00, 'Malla electrosoldada para plateas y contrapisos.'),

    -- Mampostería
    ('LAD-12', 'Ladrillo Hueco 12x18x33 (6 tubos)', 'Mampostería', 'unidad', 720.00, 'Ladrillo cerámico hueco para tabiques exteriores e interiores.'),
    ('LAD-18', 'Ladrillo Hueco 18x18x33 (9 tubos)', 'Mampostería', 'unidad', 980.00, 'Ladrillo cerámico hueco portante.'),
    ('LAD-COM', 'Ladrillo Común de Campo de Primera', 'Mampostería', 'millar (1000)', 145000.00, 'Ladrillo común para muros macizos y fundaciones.'),

    -- Techos e Hidráulica
    ('CHA-C25', 'Chapa Cincalum Acanalada C25 (por metro)', 'Techos e Hidráulica', 'metro lineal', 14200.00, 'Chapa antigranizo para techos residenciales e industriales.'),
    ('PVC-110', 'Caño PVC Desagüe Ø 110 mm x 4 m', 'Techos e Hidráulica', 'tira 4m', 16800.00, 'Caño para desagües cloacales y pluviales reforzado.'),

    -- Servicios
    ('FLE-HID', 'Servicio de Flete y Descarga con Hidrogrúa en Obra', 'Servicios', 'viaje', 65000.00, 'Transporte y descarga mecanizada al pie de obra (hasta 10 km).')
ON CONFLICT (code) DO NOTHING;
