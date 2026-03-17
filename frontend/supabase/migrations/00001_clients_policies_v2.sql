-- =====================================================
-- MIGRACIÓN COMPLETA: Módulo 01 con dependencias
-- CRM Multi-tenant para Agencias de Seguros
-- =====================================================

-- Habilitar extensión para búsqueda fuzzy (pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- FUNCIÓN AUXILIAR: update_updated_at_column
-- (Si no existe del Módulo 00)
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TIPOS ENUM
-- =====================================================

-- Tipo de documento de identidad
DO $$ BEGIN
  CREATE TYPE doc_type AS ENUM ('rut', 'nit', 'cedula', 'pasaporte');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Segmento de cliente
DO $$ BEGIN
  CREATE TYPE client_segment AS ENUM ('individual', 'empresa', 'vip');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Línea de seguro
DO $$ BEGIN
  CREATE TYPE policy_line AS ENUM ('vida', 'auto', 'salud', 'hogar', 'soat', 'otro');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Estado de póliza
DO $$ BEGIN
  CREATE TYPE policy_status AS ENUM ('cotizacion', 'activa', 'vencida', 'cancelada', 'renovacion');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLA: clients
-- =====================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name VARCHAR(200) NOT NULL,
  doc_type doc_type NOT NULL DEFAULT 'cedula',
  doc_number VARCHAR(30) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(20),
  segment client_segment NOT NULL DEFAULT 'individual',
  agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_client_doc_per_tenant UNIQUE (tenant_id, doc_number)
);

-- Índices para clients
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_agent_id ON clients(agent_id);
CREATE INDEX IF NOT EXISTS idx_clients_segment ON clients(segment);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);
CREATE INDEX IF NOT EXISTS idx_clients_tags ON clients USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_clients_full_name_trgm ON clients USING GIN(full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_doc_number_trgm ON clients USING GIN(doc_number gin_trgm_ops);

-- Trigger para updated_at en clients
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: policies
-- =====================================================
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  policy_number VARCHAR(50) NOT NULL,
  insurer VARCHAR(100) NOT NULL,
  line policy_line NOT NULL DEFAULT 'otro',
  status policy_status NOT NULL DEFAULT 'cotizacion',
  premium NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency CHAR(3) DEFAULT 'COP',
  start_date DATE,
  end_date DATE,
  document_url TEXT,
  commission_pct NUMERIC(5,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_policy_number_per_tenant UNIQUE (tenant_id, policy_number)
);

-- Índices para policies
CREATE INDEX IF NOT EXISTS idx_policies_tenant_id ON policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_client_id ON policies(client_id);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_line ON policies(line);
CREATE INDEX IF NOT EXISTS idx_policies_end_date ON policies(end_date);
CREATE INDEX IF NOT EXISTS idx_policies_created_at ON policies(created_at);

-- Trigger para updated_at en policies
DROP TRIGGER IF EXISTS update_policies_updated_at ON policies;
CREATE TRIGGER update_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: policy_history
-- =====================================================
CREATE TABLE IF NOT EXISTS policy_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  old_status policy_status,
  new_status policy_status NOT NULL,
  note TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_history_policy_id ON policy_history(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_history_changed_at ON policy_history(changed_at);

-- =====================================================
-- TABLA: automation_queue (stub para M06)
-- =====================================================
CREATE TABLE IF NOT EXISTS automation_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_queue_status ON automation_queue(status);
CREATE INDEX IF NOT EXISTS idx_automation_queue_tenant_id ON automation_queue(tenant_id);

-- =====================================================
-- TABLA: automation_logs (stub para M06)
-- =====================================================
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  automation_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  result VARCHAR(20) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_tenant_id ON automation_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at);

-- =====================================================
-- FUNCIÓN: Validar transiciones de estado de póliza
-- =====================================================
CREATE OR REPLACE FUNCTION validate_policy_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "cotizacion": ["activa", "cancelada"],
    "activa": ["vencida", "cancelada", "renovacion"],
    "vencida": ["renovacion", "cancelada"],
    "renovacion": ["activa", "cancelada"],
    "cancelada": []
  }'::JSONB;
  allowed_statuses JSONB;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  allowed_statuses := valid_transitions -> OLD.status::TEXT;
  
  IF NOT (allowed_statuses ? NEW.status::TEXT) THEN
    RAISE EXCEPTION 'Transición de estado no válida: % -> %. Transiciones permitidas: %',
      OLD.status, NEW.status, allowed_statuses;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar transiciones de estado
DROP TRIGGER IF EXISTS validate_policy_status_change ON policies;
CREATE TRIGGER validate_policy_status_change
  BEFORE UPDATE OF status ON policies
  FOR EACH ROW
  EXECUTE FUNCTION validate_policy_status_transition();

-- =====================================================
-- FUNCIÓN: Registrar cambio de estado en historial
-- =====================================================
CREATE OR REPLACE FUNCTION record_policy_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO policy_history (policy_id, changed_by, old_status, new_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
    
    IF NEW.status = 'activa' AND OLD.status = 'cotizacion' THEN
      INSERT INTO automation_queue (tenant_id, trigger_type, entity_type, entity_id, payload)
      VALUES (
        NEW.tenant_id,
        'policy_activated',
        'policy',
        NEW.id,
        jsonb_build_object('policy_number', NEW.policy_number, 'premium', NEW.premium, 'client_id', NEW.client_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para registrar cambios de estado
DROP TRIGGER IF EXISTS record_policy_status_history ON policies;
CREATE TRIGGER record_policy_status_history
  AFTER UPDATE OF status ON policies
  FOR EACH ROW
  EXECUTE FUNCTION record_policy_status_change();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para clients
DROP POLICY IF EXISTS "Ver clientes del tenant" ON clients;
CREATE POLICY "Ver clientes del tenant" ON clients FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Crear clientes en el tenant" ON clients;
CREATE POLICY "Crear clientes en el tenant" ON clients FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Actualizar clientes del tenant" ON clients;
CREATE POLICY "Actualizar clientes del tenant" ON clients FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Eliminar clientes del tenant" ON clients;
CREATE POLICY "Eliminar clientes del tenant" ON clients FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Políticas para policies
DROP POLICY IF EXISTS "Ver pólizas del tenant" ON policies;
CREATE POLICY "Ver pólizas del tenant" ON policies FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Crear pólizas en el tenant" ON policies;
CREATE POLICY "Crear pólizas en el tenant" ON policies FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Actualizar pólizas del tenant" ON policies;
CREATE POLICY "Actualizar pólizas del tenant" ON policies FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Eliminar pólizas del tenant" ON policies;
CREATE POLICY "Eliminar pólizas del tenant" ON policies FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Políticas para policy_history
DROP POLICY IF EXISTS "Ver historial de pólizas" ON policy_history;
CREATE POLICY "Ver historial de pólizas" ON policy_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM policies p WHERE p.id = policy_history.policy_id AND p.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid));

DROP POLICY IF EXISTS "Insertar historial de pólizas" ON policy_history;
CREATE POLICY "Insertar historial de pólizas" ON policy_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM policies p WHERE p.id = policy_history.policy_id AND p.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid));

-- Políticas para automation_queue
DROP POLICY IF EXISTS "Ver automation_queue del tenant" ON automation_queue;
CREATE POLICY "Ver automation_queue del tenant" ON automation_queue FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Insertar automation_queue" ON automation_queue;
CREATE POLICY "Insertar automation_queue" ON automation_queue FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Políticas para automation_logs
DROP POLICY IF EXISTS "Ver automation_logs del tenant" ON automation_logs;
CREATE POLICY "Ver automation_logs del tenant" ON automation_logs FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Insertar automation_logs" ON automation_logs;
CREATE POLICY "Insertar automation_logs" ON automation_logs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- =====================================================
-- FUNCIÓN: Búsqueda de clientes con pg_trgm
-- =====================================================
CREATE OR REPLACE FUNCTION search_clients(
  p_tenant_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  full_name VARCHAR(200),
  doc_type doc_type,
  doc_number VARCHAR(30),
  email VARCHAR(150),
  phone VARCHAR(20),
  segment client_segment,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name,
    c.doc_type,
    c.doc_number,
    c.email,
    c.phone,
    c.segment,
    GREATEST(similarity(c.full_name, p_query), similarity(c.doc_number, p_query)) AS similarity_score
  FROM clients c
  WHERE c.tenant_id = p_tenant_id
    AND c.is_active = true
    AND (
      c.full_name ILIKE '%' || p_query || '%'
      OR c.doc_number ILIKE '%' || p_query || '%'
      OR c.email ILIKE '%' || p_query || '%'
      OR similarity(c.full_name, p_query) > 0.2
      OR similarity(c.doc_number, p_query) > 0.3
    )
  ORDER BY similarity_score DESC, c.full_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Obtener pólizas por vencer
-- =====================================================
CREATE OR REPLACE FUNCTION get_expiring_policies(
  p_tenant_id UUID,
  p_days_ahead INT[]
)
RETURNS TABLE (
  id UUID,
  policy_number VARCHAR(50),
  client_id UUID,
  client_name VARCHAR(200),
  insurer VARCHAR(100),
  line policy_line,
  premium NUMERIC(12,2),
  end_date DATE,
  days_until_expiry INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.policy_number,
    p.client_id,
    c.full_name AS client_name,
    p.insurer,
    p.line,
    p.premium,
    p.end_date,
    (p.end_date - CURRENT_DATE)::INT AS days_until_expiry
  FROM policies p
  JOIN clients c ON c.id = p.client_id
  WHERE p.tenant_id = p_tenant_id
    AND p.status = 'activa'
    AND (p.end_date - CURRENT_DATE) = ANY(p_days_ahead)
  ORDER BY p.end_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON TABLE clients IS 'Clientes de las agencias de seguros';
COMMENT ON TABLE policies IS 'Pólizas de seguros de los clientes';
COMMENT ON TABLE policy_history IS 'Historial de cambios de estado de pólizas';
