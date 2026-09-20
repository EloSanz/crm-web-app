-- ==============================================================================
-- SISTEMA CRM PARA GESTIÓN COMERCIAL (UNLaM GADS II)
-- Migración 03: Entidad Obra / Proyecto y Entregas en Locación
-- ==============================================================================

-- 1. Tabla de Obras / Proyectos (crm_projects)
CREATE TABLE IF NOT EXISTS crm_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company_id UUID REFERENCES crm_companies(id) ON DELETE RESTRICT,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    address TEXT NOT NULL,
    project_type VARCHAR(100) NOT NULL DEFAULT 'vivienda_unifamiliar' 
        CHECK (project_type IN ('vivienda_unifamiliar', 'edificio_multifamiliar', 'comercial_industrial', 'refaccion', 'obra_publica')),
    status VARCHAR(50) NOT NULL DEFAULT 'en_curso' 
        CHECK (status IN ('planificacion', 'en_curso', 'frenada', 'finalizada')),
    observations TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Vinculación en Oportunidades / Presupuestos
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crm_opportunities' AND column_name = 'project_id'
    ) THEN
        ALTER TABLE crm_opportunities 
        ADD COLUMN project_id UUID REFERENCES crm_projects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Índices de Búsqueda y Claves Foráneas
CREATE INDEX IF NOT EXISTS idx_crm_projects_company ON crm_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_projects_contact ON crm_projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_projects_status ON crm_projects(status);
CREATE INDEX IF NOT EXISTS idx_crm_projects_is_deleted ON crm_projects(is_deleted);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_project ON crm_opportunities(project_id);

-- ==============================================================================
-- DATOS SEMILLA: Obras reales para contratistas y maestros mayores de obra
-- ==============================================================================
INSERT INTO crm_projects (name, company_id, address, project_type, status, observations)
SELECT 
    'Torre Residencial Belgrano 450',
    c.id,
    'Av. Belgrano 450, Ramos Mejía, Buenos Aires',
    'edificio_multifamiliar',
    'en_curso',
    'Descarga con hidrogrúa programada. Coordinar entregas de cemento y hierro antes de las 11:00 hs por tránsito.'
FROM crm_companies c
WHERE c.name = 'Gómez Construcciones SRL'
LIMIT 1;

INSERT INTO crm_projects (name, company_id, address, project_type, status, observations)
SELECT 
    'Vivienda Unifamiliar Lote 42 - Barrio Las Acacias',
    c.id,
    'Ruta 58 Km 9.5, Lote 42, Canning, Buenos Aires',
    'vivienda_unifamiliar',
    'en_curso',
    'Entrada de camión con acoplado autorizada por guardia previa presentación de remito.'
FROM crm_companies c
WHERE c.name = 'Estudio & Obras Arq. Rossi'
LIMIT 1;

INSERT INTO crm_projects (name, company_id, address, project_type, status, observations)
SELECT 
    'Ampliación Nave Logística Oeste',
    c.id,
    'Camino de Cintura 2800, San Justo, Buenos Aires',
    'comercial_industrial',
    'en_curso',
    'Requerimiento de entregas masivas de áridos (arena y piedra partida) para contrapisos industriales.'
FROM crm_companies c
WHERE c.name = 'Hormigones & Estructuras del Oeste'
LIMIT 1;

INSERT INTO crm_projects (name, company_id, address, project_type, status, observations)
SELECT 
    'Refacción Integral Sede Social Club Alem',
    c.id,
    'Av. San Martín 1120, Haedo, Buenos Aires',
    'refaccion',
    'frenada',
    'Obra pausada temporalmente por aprobación de planos municipales. Retoman el mes próximo.'
FROM crm_companies c
WHERE c.name = 'Construcciones & Desarrollos del Sur'
LIMIT 1;
