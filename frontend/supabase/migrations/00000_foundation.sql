-- =====================================================
-- MIGRACIÓN: 00000_foundation.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Fase 0: Fundación - Tablas base y RLS
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TIPOS ENUM
-- =====================================================

-- Roles de usuario en el sistema
CREATE TYPE user_role AS ENUM (
  'superadmin',
  'admin',
  'senior_agent',
  'agent',
  'readonly'
);

-- =====================================================
-- TABLA: tenants
-- Representa cada agencia de seguros (inquilino)
-- =====================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  stripe_customer_id VARCHAR(100),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para tenants
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_is_active ON tenants(is_active);

-- =====================================================
-- TABLA: users
-- Usuarios del sistema vinculados a auth.users
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  email VARCHAR(150) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role user_role NOT NULL DEFAULT 'agent',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para users
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- =====================================================
-- TABLA: user_roles
-- Historial y roles adicionales por tenant
-- =====================================================
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  
  CONSTRAINT unique_active_user_tenant_role UNIQUE (user_id, tenant_id, role)
);

-- Índices para user_roles
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_tenant_id ON user_roles(tenant_id);

-- =====================================================
-- TABLA: invitations
-- Invitaciones pendientes para nuevos usuarios
-- =====================================================
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(150) NOT NULL,
  role user_role NOT NULL DEFAULT 'agent',
  token VARCHAR(200) NOT NULL UNIQUE,
  invited_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_pending_invitation UNIQUE (tenant_id, email)
);

-- Índices para invitations
CREATE INDEX idx_invitations_tenant_id ON invitations(tenant_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);

-- =====================================================
-- TABLA: audit_logs
-- Registro de auditoría para acciones importantes
-- =====================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para audit_logs
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para obtener el tenant_id del JWT actual
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
    NULL
  );
$$ LANGUAGE sql STABLE;

-- Función para obtener el user_id del JWT actual
CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    auth.uid(),
    NULL
  );
$$ LANGUAGE sql STABLE;

-- Función para obtener el role del JWT actual
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'role')::user_role,
    'readonly'::user_role
  );
$$ LANGUAGE sql STABLE;

-- Función para verificar si el usuario es superadmin
CREATE OR REPLACE FUNCTION auth.is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'superadmin';
$$ LANGUAGE sql STABLE;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para actualizar updated_at en tenants
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para actualizar updated_at en users
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ----- POLÍTICAS PARA tenants -----

-- Superadmin puede ver todos los tenants
CREATE POLICY "Superadmin puede ver todos los tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (auth.is_superadmin());

-- Usuarios pueden ver su propio tenant
CREATE POLICY "Usuarios pueden ver su tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (id = auth.tenant_id());

-- Superadmin puede insertar tenants
CREATE POLICY "Superadmin puede crear tenants"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_superadmin());

-- Superadmin puede actualizar tenants
CREATE POLICY "Superadmin puede actualizar tenants"
  ON tenants FOR UPDATE
  TO authenticated
  USING (auth.is_superadmin());

-- Admin puede actualizar su propio tenant (solo settings)
CREATE POLICY "Admin puede actualizar su tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (id = auth.tenant_id() AND auth.user_role() = 'admin');

-- ----- POLÍTICAS PARA users -----

-- Superadmin puede ver todos los usuarios
CREATE POLICY "Superadmin puede ver todos los usuarios"
  ON users FOR SELECT
  TO authenticated
  USING (auth.is_superadmin());

-- Usuarios pueden ver usuarios de su tenant
CREATE POLICY "Usuarios pueden ver usuarios de su tenant"
  ON users FOR SELECT
  TO authenticated
  USING (tenant_id = auth.tenant_id());

-- Usuario puede ver su propio perfil
CREATE POLICY "Usuario puede ver su perfil"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.user_id());

-- Superadmin puede crear usuarios
CREATE POLICY "Superadmin puede crear usuarios"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_superadmin());

-- Admin puede crear usuarios en su tenant
CREATE POLICY "Admin puede crear usuarios en su tenant"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth.tenant_id() 
    AND auth.user_role() IN ('admin', 'senior_agent')
  );

-- Usuario puede actualizar su propio perfil
CREATE POLICY "Usuario puede actualizar su perfil"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.user_id());

-- Admin puede actualizar usuarios de su tenant
CREATE POLICY "Admin puede actualizar usuarios de su tenant"
  ON users FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth.tenant_id() 
    AND auth.user_role() IN ('admin', 'senior_agent')
  );

-- ----- POLÍTICAS PARA user_roles -----

-- Usuarios pueden ver roles de su tenant
CREATE POLICY "Ver roles del tenant"
  ON user_roles FOR SELECT
  TO authenticated
  USING (tenant_id = auth.tenant_id() OR auth.is_superadmin());

-- Admin puede gestionar roles de su tenant
CREATE POLICY "Admin gestiona roles del tenant"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    tenant_id = auth.tenant_id() 
    AND auth.user_role() = 'admin'
  );

-- Superadmin puede gestionar todos los roles
CREATE POLICY "Superadmin gestiona todos los roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (auth.is_superadmin());

-- ----- POLÍTICAS PARA invitations -----

-- Admin puede ver invitaciones de su tenant
CREATE POLICY "Ver invitaciones del tenant"
  ON invitations FOR SELECT
  TO authenticated
  USING (tenant_id = auth.tenant_id() OR auth.is_superadmin());

-- Admin puede crear invitaciones
CREATE POLICY "Admin crea invitaciones"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth.tenant_id() 
    AND auth.user_role() IN ('admin', 'senior_agent')
  );

-- Permitir lectura pública de invitaciones por token (para aceptar)
CREATE POLICY "Lectura pública por token"
  ON invitations FOR SELECT
  TO anon
  USING (
    expires_at > now() 
    AND accepted_at IS NULL
  );

-- Admin puede eliminar invitaciones
CREATE POLICY "Admin elimina invitaciones"
  ON invitations FOR DELETE
  TO authenticated
  USING (
    tenant_id = auth.tenant_id() 
    AND auth.user_role() IN ('admin', 'senior_agent')
  );

-- ----- POLÍTICAS PARA audit_logs -----

-- Solo lectura de audit logs del tenant
CREATE POLICY "Ver audit logs del tenant"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth.tenant_id() 
    AND auth.user_role() IN ('admin', 'senior_agent')
  );

-- Superadmin puede ver todos los audit logs
CREATE POLICY "Superadmin ve todos los audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (auth.is_superadmin());

-- Inserción de audit logs (vía service role únicamente)
CREATE POLICY "Service role inserta audit logs"
  ON audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- DATOS INICIALES (Seed)
-- =====================================================

-- Crear tenant de demostración (opcional, comentar si no se necesita)
-- INSERT INTO tenants (name, slug) VALUES ('Agencia Demo', 'demo');

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE tenants IS 'Agencias de seguros (multi-tenant)';
COMMENT ON TABLE users IS 'Usuarios del sistema vinculados a Supabase Auth';
COMMENT ON TABLE user_roles IS 'Roles adicionales y historial de permisos';
COMMENT ON TABLE invitations IS 'Invitaciones pendientes para nuevos usuarios';
COMMENT ON TABLE audit_logs IS 'Registro de auditoría de acciones del sistema';

COMMENT ON FUNCTION auth.tenant_id() IS 'Obtiene tenant_id del JWT actual';
COMMENT ON FUNCTION auth.user_role() IS 'Obtiene el role del JWT actual';
COMMENT ON FUNCTION auth.is_superadmin() IS 'Verifica si el usuario es superadmin';
