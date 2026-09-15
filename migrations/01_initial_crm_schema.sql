-- ==============================================================================
-- SISTEMA CRM PARA GESTIÓN COMERCIAL (UNLaM GADS II)
-- Migración Inicial de Base de Datos para Supabase / PostgreSQL
-- ==============================================================================

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Usuarios y Perfiles (crm_users)
CREATE TABLE IF NOT EXISTS crm_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE, -- Vínculo opcional con auth.users de Supabase
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'ejecutivo_ventas' CHECK (role IN ('admin', 'gerente_comercial', 'ejecutivo_ventas')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabla de Empresas / Clientes Corporativos (crm_companies)
CREATE TABLE IF NOT EXISTS crm_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    cuit VARCHAR(20),
    industry VARCHAR(100),
    website VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES crm_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabla de Contactos (crm_contacts)
CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    job_title VARCHAR(100),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES crm_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabla de Etapas del Embudo Comercial (crm_stages)
CREATE TABLE IF NOT EXISTS crm_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    position INT NOT NULL DEFAULT 0,
    is_closed_won BOOLEAN NOT NULL DEFAULT false,
    is_closed_lost BOOLEAN NOT NULL DEFAULT false,
    color VARCHAR(20) DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tabla de Oportunidades Comerciales (crm_opportunities)
CREATE TABLE IF NOT EXISTS crm_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    company_id UUID REFERENCES crm_companies(id) ON DELETE RESTRICT,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    assigned_to UUID NOT NULL REFERENCES crm_users(id),
    stage_id UUID NOT NULL REFERENCES crm_stages(id),
    status VARCHAR(50) NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'ganada', 'perdida')),
    estimated_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'ARS',
    expected_close_date DATE,
    loss_reason TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Historial Inmutable de Cambios de Etapa (crm_stage_history)
CREATE TABLE IF NOT EXISTS crm_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES crm_opportunities(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES crm_stages(id),
    to_stage_id UUID NOT NULL REFERENCES crm_stages(id),
    changed_by UUID NOT NULL REFERENCES crm_users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Bitácora Inmutable de Actividades Comerciales (crm_activities)
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES crm_users(id),
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('llamada', 'reunion', 'email', 'nota', 'tarea')),
    summary VARCHAR(255) NOT NULL,
    description TEXT,
    activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- DATOS SEMILLA (Seed Data Inicial)
-- ==============================================================================

-- Etapas estándar del embudo comercial
INSERT INTO crm_stages (name, slug, position, is_closed_won, is_closed_lost, color)
VALUES
    ('Prospección', 'prospeccion', 1, false, false, '#94a3b8'),
    ('Contacto Inicial', 'contacto-inicial', 2, false, false, '#38bdf8'),
    ('Calificación', 'calificacion', 3, false, false, '#818cf8'),
    ('Propuesta Comercial', 'propuesta', 4, false, false, '#fbbf24'),
    ('Negociación', 'negociacion', 5, false, false, '#f97316'),
    ('Cierre Ganado', 'cierre-ganado', 6, true, false, '#22c55e'),
    ('Cierre Perdido', 'cierre-perdido', 7, false, true, '#ef4444')
ON CONFLICT (slug) DO NOTHING;

-- Usuario administrador inicial
INSERT INTO crm_users (id, email, full_name, role, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@crm.com', 'Administrador General', 'admin', true),
    ('00000000-0000-0000-0000-000000000002', 'vendedor@crm.com', 'Ejecutivo Comercial', 'ejecutivo_ventas', true)
ON CONFLICT (email) DO NOTHING;

-- ==============================================================================
-- ÍNDICES DE PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_crm_companies_is_deleted ON crm_companies(is_deleted);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company_id ON crm_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_assigned ON crm_opportunities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage ON crm_opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_status ON crm_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_crm_stage_history_opp ON crm_stage_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opp ON crm_activities(opportunity_id);
