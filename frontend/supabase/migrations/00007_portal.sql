-- =====================================================
-- MIGRACIÓN: 00007_portal.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Módulo 07: Portal del Cliente (White-Label)
-- =====================================================

-- =====================================================
-- TIPOS ENUM
-- =====================================================

-- Rol del remitente en mensajes
DO $$ BEGIN
  CREATE TYPE message_sender_role AS ENUM ('client', 'agent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tipo de solicitud del cliente
DO $$ BEGIN
  CREATE TYPE client_request_type AS ENUM ('new_claim', 'info_request', 'complaint');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Estado de solicitud del cliente
DO $$ BEGIN
  CREATE TYPE client_request_status AS ENUM ('open', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLA: tenant_settings (Placeholder para M08)
-- Configuración visual y branding del tenant
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Branding
  logo_url TEXT,
  favicon_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#3b82f6',
  secondary_color VARCHAR(7) DEFAULT '#1e40af',
  font_family VARCHAR(100) DEFAULT 'Inter',
  font_size_base INTEGER DEFAULT 14,
  
  -- Portal settings
  portal_enabled BOOLEAN DEFAULT true,
  portal_welcome_message TEXT,
  
  -- Contact info
  support_email VARCHAR(150),
  support_phone VARCHAR(20),
  
  -- Additional settings
  settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_tenant_settings UNIQUE (tenant_id)
);

-- Índices para tenant_settings
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_tenant_settings_updated_at ON tenant_settings;
CREATE TRIGGER update_tenant_settings_updated_at
  BEFORE UPDATE ON tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: portal_sessions
-- Sesiones de clientes en el portal
-- =====================================================
CREATE TABLE IF NOT EXISTS portal_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ DEFAULT now(),
  device_info JSONB DEFAULT '{}',
  ip_address INET,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para portal_sessions
CREATE INDEX IF NOT EXISTS idx_portal_sessions_tenant_id ON portal_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_client_id ON portal_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_auth_user_id ON portal_sessions(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_last_seen ON portal_sessions(last_seen);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_is_active ON portal_sessions(is_active);

-- =====================================================
-- TABLA: messages
-- Mensajes de chat entre cliente y agente
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_role message_sender_role NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para messages
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_role ON messages(sender_role);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);

-- Índice compuesto para chat ordenado
CREATE INDEX IF NOT EXISTS idx_messages_client_sent ON messages(client_id, sent_at DESC);

-- =====================================================
-- TABLA: client_requests
-- Solicitudes del cliente (siniestros, información, quejas)
-- =====================================================
CREATE TABLE IF NOT EXISTS client_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type client_request_type NOT NULL,
  status client_request_status NOT NULL DEFAULT 'open',
  description TEXT NOT NULL,
  policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para client_requests
CREATE INDEX IF NOT EXISTS idx_client_requests_tenant_id ON client_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_client_id ON client_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_type ON client_requests(type);
CREATE INDEX IF NOT EXISTS idx_client_requests_status ON client_requests(status);
CREATE INDEX IF NOT EXISTS idx_client_requests_created_at ON client_requests(created_at);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_client_requests_updated_at ON client_requests;
CREATE TRIGGER update_client_requests_updated_at
  BEFORE UPDATE ON client_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCIÓN: Obtener cliente por email del portal
-- =====================================================
CREATE OR REPLACE FUNCTION get_portal_client_by_email(
  p_tenant_slug TEXT,
  p_email TEXT
)
RETURNS TABLE (
  client_id UUID,
  client_name VARCHAR(200),
  tenant_id UUID,
  tenant_name VARCHAR(200),
  agent_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS client_id,
    c.full_name AS client_name,
    t.id AS tenant_id,
    t.name AS tenant_name,
    c.agent_id
  FROM clients c
  JOIN tenants t ON t.id = c.tenant_id
  WHERE t.slug = p_tenant_slug
    AND t.is_active = true
    AND c.email = p_email
    AND c.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Obtener resumen del portal para cliente
-- =====================================================
CREATE OR REPLACE FUNCTION get_portal_summary(
  p_tenant_id UUID,
  p_client_id UUID
)
RETURNS TABLE (
  active_policies_count INTEGER,
  next_renewal DATE,
  active_claims_count INTEGER,
  pending_invoices_count INTEGER,
  unread_messages_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Pólizas activas
    (SELECT COUNT(*)::INTEGER FROM policies 
     WHERE client_id = p_client_id AND tenant_id = p_tenant_id AND status = 'activa'),
    
    -- Próxima renovación
    (SELECT MIN(end_date) FROM policies 
     WHERE client_id = p_client_id AND tenant_id = p_tenant_id 
     AND status = 'activa' AND end_date >= CURRENT_DATE),
    
    -- Siniestros en proceso
    (SELECT COUNT(*)::INTEGER FROM claims 
     WHERE client_id = p_client_id AND tenant_id = p_tenant_id 
     AND status NOT IN ('resolved', 'closed')),
    
    -- Cuotas pendientes
    (SELECT COUNT(*)::INTEGER FROM invoices 
     WHERE client_id = p_client_id AND tenant_id = p_tenant_id 
     AND status IN ('pending', 'overdue')),
    
    -- Mensajes no leídos
    (SELECT COUNT(*)::INTEGER FROM messages 
     WHERE client_id = p_client_id AND tenant_id = p_tenant_id 
     AND sender_role = 'agent' AND is_read = false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Registrar sesión del portal
-- =====================================================
CREATE OR REPLACE FUNCTION register_portal_session(
  p_tenant_id UUID,
  p_client_id UUID,
  p_auth_user_id UUID,
  p_device_info JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Desactivar sesiones anteriores del mismo auth_user
  UPDATE portal_sessions
  SET is_active = false
  WHERE auth_user_id = p_auth_user_id AND is_active = true;
  
  -- Crear nueva sesión
  INSERT INTO portal_sessions (
    tenant_id,
    client_id,
    auth_user_id,
    device_info,
    last_seen
  ) VALUES (
    p_tenant_id,
    p_client_id,
    p_auth_user_id,
    p_device_info,
    now()
  )
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Actualizar último visto en sesión
-- =====================================================
CREATE OR REPLACE FUNCTION update_portal_session_activity(p_auth_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE portal_sessions
  SET last_seen = now()
  WHERE auth_user_id = p_auth_user_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Verificar si agente está en línea
-- =====================================================
CREATE OR REPLACE FUNCTION is_agent_online(
  p_tenant_id UUID,
  p_agent_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_last_activity TIMESTAMPTZ;
BEGIN
  -- Verificar actividad reciente del agente (últimos 5 minutos)
  SELECT last_login_at INTO v_last_activity
  FROM users
  WHERE id = p_agent_id AND tenant_id = p_tenant_id;
  
  IF v_last_activity IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN (now() - v_last_activity) < INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_requests ENABLE ROW LEVEL SECURITY;

-- ----- POLÍTICAS PARA tenant_settings -----

-- Usuarios autenticados pueden ver settings de su tenant
DROP POLICY IF EXISTS "Ver tenant_settings del tenant" ON tenant_settings;
CREATE POLICY "Ver tenant_settings del tenant"
  ON tenant_settings FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

-- Lectura pública de settings para el portal (por slug del tenant)
DROP POLICY IF EXISTS "Lectura pública de tenant_settings para portal" ON tenant_settings;
CREATE POLICY "Lectura pública de tenant_settings para portal"
  ON tenant_settings FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants t 
      WHERE t.id = tenant_settings.tenant_id 
      AND t.is_active = true
    )
  );

-- Admin puede crear/actualizar settings
DROP POLICY IF EXISTS "Admin gestiona tenant_settings" ON tenant_settings;
CREATE POLICY "Admin gestiona tenant_settings"
  ON tenant_settings FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
  )
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
  );

-- ----- POLÍTICAS PARA portal_sessions -----

-- Ver sesiones del tenant (solo admin/agentes)
DROP POLICY IF EXISTS "Ver portal_sessions del tenant" ON portal_sessions;
CREATE POLICY "Ver portal_sessions del tenant"
  ON portal_sessions FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

-- Cliente puede ver su propia sesión
DROP POLICY IF EXISTS "Cliente ve su sesión" ON portal_sessions;
CREATE POLICY "Cliente ve su sesión"
  ON portal_sessions FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Insertar sesiones (via función)
DROP POLICY IF EXISTS "Insertar portal_sessions" ON portal_sessions;
CREATE POLICY "Insertar portal_sessions"
  ON portal_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- Actualizar sesiones propias
DROP POLICY IF EXISTS "Actualizar portal_sessions propias" ON portal_sessions;
CREATE POLICY "Actualizar portal_sessions propias"
  ON portal_sessions FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid());

-- ----- POLÍTICAS PARA messages -----

-- Cliente puede ver sus mensajes
DROP POLICY IF EXISTS "Cliente ve sus mensajes" ON messages;
CREATE POLICY "Cliente ve sus mensajes"
  ON messages FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND c.tenant_id = messages.tenant_id
    )
  );

-- Agente puede ver mensajes de sus clientes
DROP POLICY IF EXISTS "Agente ve mensajes de clientes del tenant" ON messages;
CREATE POLICY "Agente ve mensajes de clientes del tenant"
  ON messages FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent')
  );

-- Cliente puede enviar mensajes
DROP POLICY IF EXISTS "Cliente puede enviar mensajes" ON messages;
CREATE POLICY "Cliente puede enviar mensajes"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_role = 'client'
    AND client_id IN (
      SELECT c.id FROM clients c
      WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND c.tenant_id = messages.tenant_id
    )
  );

-- Agente puede enviar mensajes a clientes del tenant
DROP POLICY IF EXISTS "Agente puede enviar mensajes" ON messages;
CREATE POLICY "Agente puede enviar mensajes"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_role = 'agent'
    AND tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent')
  );

-- Cliente puede marcar mensajes como leídos
DROP POLICY IF EXISTS "Cliente puede marcar mensajes leídos" ON messages;
CREATE POLICY "Cliente puede marcar mensajes leídos"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    sender_role = 'agent'
    AND client_id IN (
      SELECT c.id FROM clients c
      WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND c.tenant_id = messages.tenant_id
    )
  );

-- Agente puede marcar mensajes como leídos
DROP POLICY IF EXISTS "Agente puede marcar mensajes leídos" ON messages;
CREATE POLICY "Agente puede marcar mensajes leídos"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    sender_role = 'client'
    AND tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent')
  );

-- ----- POLÍTICAS PARA client_requests -----

-- Cliente puede ver sus solicitudes
DROP POLICY IF EXISTS "Cliente ve sus solicitudes" ON client_requests;
CREATE POLICY "Cliente ve sus solicitudes"
  ON client_requests FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND c.tenant_id = client_requests.tenant_id
    )
  );

-- Agente puede ver solicitudes del tenant
DROP POLICY IF EXISTS "Agente ve solicitudes del tenant" ON client_requests;
CREATE POLICY "Agente ve solicitudes del tenant"
  ON client_requests FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent')
  );

-- Cliente puede crear solicitudes
DROP POLICY IF EXISTS "Cliente puede crear solicitudes" ON client_requests;
CREATE POLICY "Cliente puede crear solicitudes"
  ON client_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM clients c
      WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND c.tenant_id = client_requests.tenant_id
    )
  );

-- Agente puede actualizar solicitudes del tenant
DROP POLICY IF EXISTS "Agente puede actualizar solicitudes" ON client_requests;
CREATE POLICY "Agente puede actualizar solicitudes"
  ON client_requests FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent')
  );

-- =====================================================
-- HABILITAR REALTIME PARA MESSAGES
-- =====================================================

-- Nota: Ejecutar en el Dashboard de Supabase > Database > Replication
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE tenant_settings IS 'Configuración visual y branding del tenant para el portal (M08)';
COMMENT ON TABLE portal_sessions IS 'Sesiones de clientes en el portal del cliente';
COMMENT ON TABLE messages IS 'Mensajes de chat entre clientes y agentes';
COMMENT ON TABLE client_requests IS 'Solicitudes del cliente (siniestros, información, quejas)';

COMMENT ON FUNCTION get_portal_client_by_email(TEXT, TEXT) IS 'Obtiene el cliente asociado a un email en un tenant';
COMMENT ON FUNCTION get_portal_summary(UUID, UUID) IS 'Resumen del portal para el cliente (pólizas, siniestros, etc)';
COMMENT ON FUNCTION register_portal_session(UUID, UUID, UUID, JSONB) IS 'Registra una nueva sesión del cliente en el portal';
COMMENT ON FUNCTION update_portal_session_activity(UUID) IS 'Actualiza el timestamp de última actividad';
COMMENT ON FUNCTION is_agent_online(UUID, UUID) IS 'Verifica si un agente está en línea';
