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
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    website VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'potencial' CHECK (status IN ('potencial', 'cliente', 'inactivo', 'no_contactar')),
    origin VARCHAR(100),
    notes TEXT,
    assigned_to UUID REFERENCES crm_users(id),
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
    document_number VARCHAR(50),
    email VARCHAR(255),
    phone VARCHAR(50),
    job_title VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'potencial' CHECK (status IN ('potencial', 'cliente', 'inactivo', 'no_contactar')),
    origin VARCHAR(100),
    notes TEXT,
    assigned_to UUID REFERENCES crm_users(id),
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
    delivery_location TEXT,
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
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('llamada', 'whatsapp', 'reunion', 'visita_obra', 'mostrador', 'email', 'nota', 'presupuesto')),
    summary VARCHAR(255) NOT NULL,
    description TEXT,
    activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- DATOS SEMILLA (Seed Data Inicial)
-- ==============================================================================

-- Etapas especializadas del embudo comercial del corralón
INSERT INTO crm_stages (name, slug, position, is_closed_won, is_closed_lost, color)
VALUES
    ('Consulta Recibida', 'consulta-recibida', 1, false, false, '#38bdf8'),
    ('Presupuesto en Preparación', 'presupuesto-preparacion', 2, false, false, '#818cf8'),
    ('Presupuesto Enviado', 'presupuesto-enviado', 3, false, false, '#fbbf24'),
    ('Negociación', 'negociacion', 4, false, false, '#f97316'),
    ('Venta Concretada', 'venta-concretada', 5, true, false, '#22c55e'),
    ('Perdida', 'perdida', 6, false, true, '#ef4444')
ON CONFLICT (slug) DO NOTHING;

-- Usuario administrador y vendedor iniciales
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
