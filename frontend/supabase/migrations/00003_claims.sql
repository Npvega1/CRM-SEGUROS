-- =====================================================
-- MIGRACIÓN: 00003_claims.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Módulo 03: Gestión de Siniestros
-- =====================================================

-- =====================================================
-- TIPOS ENUM
-- =====================================================

-- Estado del siniestro
CREATE TYPE claim_status AS ENUM (
  'reported',        -- Reportado
  'investigating',   -- En investigación
  'docs_complete',   -- Documentación completa
  'processing',      -- En procesamiento
  'resolved',        -- Resuelto
  'closed'           -- Cerrado
);

-- =====================================================
-- TABLA: claims
-- Siniestros registrados
-- =====================================================
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status claim_status NOT NULL DEFAULT 'reported',
  incident_date DATE NOT NULL,
  claimed_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  approved_amount NUMERIC(14,2),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint: monto reclamado debe ser positivo
  CONSTRAINT positive_claimed_amount CHECK (claimed_amount >= 0),
  -- Constraint: monto aprobado debe ser positivo o nulo
  CONSTRAINT positive_approved_amount CHECK (approved_amount IS NULL OR approved_amount >= 0)
);

-- Índices para claims
CREATE INDEX idx_claims_tenant_id ON claims(tenant_id);
CREATE INDEX idx_claims_policy_id ON claims(policy_id);
CREATE INDEX idx_claims_client_id ON claims(client_id);
CREATE INDEX idx_claims_agent_id ON claims(agent_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_incident_date ON claims(incident_date);
CREATE INDEX idx_claims_created_at ON claims(created_at);

-- Trigger para updated_at
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: claims_history
-- Historial de cambios de estado de siniestros
-- =====================================================
CREATE TABLE claims_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  old_status claim_status,
  new_status claim_status NOT NULL,
  comment TEXT,
  is_internal BOOLEAN DEFAULT false,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para claims_history
CREATE INDEX idx_claims_history_claim_id ON claims_history(claim_id);
CREATE INDEX idx_claims_history_changed_at ON claims_history(changed_at);
CREATE INDEX idx_claims_history_is_internal ON claims_history(is_internal);

-- =====================================================
-- TABLA: claim_documents
-- Documentos adjuntos a siniestros
-- =====================================================
CREATE TABLE claim_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
  file_name VARCHAR(200) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para claim_documents
CREATE INDEX idx_claim_documents_claim_id ON claim_documents(claim_id);
CREATE INDEX idx_claim_documents_tenant_id ON claim_documents(tenant_id);
CREATE INDEX idx_claim_documents_uploaded_at ON claim_documents(uploaded_at);

-- =====================================================
-- FUNCIÓN: Validar que la póliza esté activa al crear siniestro
-- =====================================================
CREATE OR REPLACE FUNCTION validate_claim_policy_active()
RETURNS TRIGGER AS $$
DECLARE
  v_policy_status policy_status;
BEGIN
  -- Obtener el estado de la póliza
  SELECT status INTO v_policy_status
  FROM policies
  WHERE id = NEW.policy_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Póliza no encontrada: %', NEW.policy_id;
  END IF;
  
  -- Validar que la póliza esté activa
  IF v_policy_status != 'activa' THEN
    RAISE EXCEPTION 'Solo se pueden crear siniestros para pólizas activas. Estado actual de la póliza: %', v_policy_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar póliza activa al crear siniestro
CREATE TRIGGER validate_claim_policy_is_active
  BEFORE INSERT ON claims
  FOR EACH ROW
  EXECUTE FUNCTION validate_claim_policy_active();

-- =====================================================
-- FUNCIÓN: Validar transiciones de estado de siniestro
-- =====================================================
CREATE OR REPLACE FUNCTION validate_claim_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "reported": ["investigating", "closed"],
    "investigating": ["docs_complete", "closed"],
    "docs_complete": ["processing", "investigating", "closed"],
    "processing": ["resolved", "investigating", "closed"],
    "resolved": ["closed"],
    "closed": []
  }'::JSONB;
  allowed_statuses JSONB;
BEGIN
  -- Si el status no cambió, permitir
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Obtener transiciones válidas para el estado actual
  allowed_statuses := valid_transitions -> OLD.status::TEXT;
  
  -- Verificar si la transición es válida
  IF NOT (allowed_statuses ? NEW.status::TEXT) THEN
    RAISE EXCEPTION 'Transición de estado no válida: % -> %. Transiciones permitidas: %',
      OLD.status, NEW.status, allowed_statuses;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar transiciones de estado
CREATE TRIGGER validate_claim_status_change
  BEFORE UPDATE OF status ON claims
  FOR EACH ROW
  EXECUTE FUNCTION validate_claim_status_transition();

-- =====================================================
-- FUNCIÓN: Registrar cambio de estado en historial
-- =====================================================
CREATE OR REPLACE FUNCTION record_claim_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registrar si el status cambió
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO claims_history (claim_id, changed_by, old_status, new_status)
    VALUES (
      NEW.id,
      COALESCE(auth.user_id(), NULL),
      OLD.status,
      NEW.status
    );
    
    -- Insertar en automation_queue para M06 (automatizaciones)
    INSERT INTO automation_queue (tenant_id, trigger_type, entity_type, entity_id, payload)
    VALUES (
      NEW.tenant_id,
      'claim_status_changed',
      'claim',
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'claimed_amount', NEW.claimed_amount,
        'approved_amount', NEW.approved_amount,
        'client_id', NEW.client_id,
        'policy_id', NEW.policy_id,
        'agent_id', NEW.agent_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para registrar cambios de estado
CREATE TRIGGER record_claim_status_history
  AFTER UPDATE OF status ON claims
  FOR EACH ROW
  EXECUTE FUNCTION record_claim_status_change();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_documents ENABLE ROW LEVEL SECURITY;

-- ----- POLÍTICAS PARA claims -----

-- Ver siniestros del tenant
CREATE POLICY "Ver siniestros del tenant"
  ON claims FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

-- Crear siniestros en el tenant
CREATE POLICY "Crear siniestros en el tenant"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent')
  );

-- Actualizar siniestros del tenant
CREATE POLICY "Actualizar siniestros del tenant"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent')
  );

-- Eliminar siniestros (solo admin)
CREATE POLICY "Eliminar siniestros del tenant"
  ON claims FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
  );

-- ----- POLÍTICAS PARA claims_history -----

-- Ver historial de siniestros del tenant
CREATE POLICY "Ver historial de siniestros del tenant"
  ON claims_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claims c 
      WHERE c.id = claims_history.claim_id 
      AND (
        c.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      )
    )
  );

-- Insertar historial (para el tenant)
CREATE POLICY "Insertar historial de siniestros"
  ON claims_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM claims c 
      WHERE c.id = claims_history.claim_id 
      AND c.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    )
  );

-- ----- POLÍTICAS PARA claim_documents -----

-- Ver documentos del tenant
CREATE POLICY "Ver documentos de siniestros del tenant"
  ON claim_documents FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

-- Crear documentos en el tenant
CREATE POLICY "Crear documentos de siniestros"
  ON claim_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent')
  );

-- Eliminar documentos (solo admin y senior_agent)
CREATE POLICY "Eliminar documentos de siniestros"
  ON claim_documents FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
  );

-- =====================================================
-- STORAGE BUCKET para documentos de siniestros
-- =====================================================
-- NOTA: Ejecutar manualmente en el Dashboard de Supabase > Storage
-- 
-- 1. Crear bucket 'claim-documents' (privado)
--    - Ir a Storage > New Bucket
--    - Name: claim-documents
--    - Public bucket: OFF (desmarcar)
--
-- 2. Configurar políticas de acceso (SQL Editor):
/*
-- Política para subir documentos
CREATE POLICY "Usuarios autenticados pueden subir documentos de siniestros"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'claim-documents' 
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Política para ver documentos de su tenant
CREATE POLICY "Usuarios pueden ver documentos de siniestros de su tenant"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'claim-documents' 
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Política para eliminar documentos (admin y senior_agent)
CREATE POLICY "Admin puede eliminar documentos de siniestros"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'claim-documents' 
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
);
*/

-- =====================================================
-- FUNCIÓN: Obtener expediente completo del siniestro
-- =====================================================
CREATE OR REPLACE FUNCTION get_claim_expediente(p_claim_id UUID)
RETURNS TABLE (
  claim JSONB,
  policy JSONB,
  client JSONB,
  history JSONB,
  documents JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Datos del siniestro
    jsonb_build_object(
      'id', c.id,
      'tenant_id', c.tenant_id,
      'policy_id', c.policy_id,
      'client_id', c.client_id,
      'agent_id', c.agent_id,
      'status', c.status,
      'incident_date', c.incident_date,
      'claimed_amount', c.claimed_amount,
      'approved_amount', c.approved_amount,
      'description', c.description,
      'created_at', c.created_at,
      'updated_at', c.updated_at,
      'agent_name', u.full_name
    ) AS claim,
    -- Datos de la póliza
    jsonb_build_object(
      'id', p.id,
      'policy_number', p.policy_number,
      'insurer', p.insurer,
      'line', p.line,
      'status', p.status,
      'premium', p.premium,
      'start_date', p.start_date,
      'end_date', p.end_date
    ) AS policy,
    -- Datos del cliente
    jsonb_build_object(
      'id', cl.id,
      'full_name', cl.full_name,
      'doc_type', cl.doc_type,
      'doc_number', cl.doc_number,
      'email', cl.email,
      'phone', cl.phone,
      'segment', cl.segment
    ) AS client,
    -- Historial de cambios
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'old_status', h.old_status,
          'new_status', h.new_status,
          'comment', h.comment,
          'is_internal', h.is_internal,
          'changed_at', h.changed_at,
          'changed_by', h.changed_by,
          'changed_by_name', hu.full_name
        ) ORDER BY h.changed_at DESC
      )
      FROM claims_history h
      LEFT JOIN users hu ON hu.id = h.changed_by
      WHERE h.claim_id = c.id),
      '[]'::jsonb
    ) AS history,
    -- Documentos
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'file_name', d.file_name,
          'file_url', d.file_url,
          'file_type', d.file_type,
          'file_size', d.file_size,
          'uploaded_at', d.uploaded_at,
          'uploader_id', d.uploader_id,
          'uploader_name', du.full_name
        ) ORDER BY d.uploaded_at DESC
      )
      FROM claim_documents d
      LEFT JOIN users du ON du.id = d.uploader_id
      WHERE d.claim_id = c.id),
      '[]'::jsonb
    ) AS documents
  FROM claims c
  JOIN policies p ON p.id = c.policy_id
  JOIN clients cl ON cl.id = c.client_id
  LEFT JOIN users u ON u.id = c.agent_id
  WHERE c.id = p_claim_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE claims IS 'Siniestros registrados por las agencias';
COMMENT ON TABLE claims_history IS 'Historial de cambios de estado de siniestros';
COMMENT ON TABLE claim_documents IS 'Documentos adjuntos a los siniestros';

COMMENT ON FUNCTION validate_claim_policy_active() IS 'Valida que la póliza esté activa al crear un siniestro';
COMMENT ON FUNCTION validate_claim_status_transition() IS 'Valida las transiciones de estado válidas de siniestros';
COMMENT ON FUNCTION record_claim_status_change() IS 'Registra cambios de estado en claims_history y automation_queue';
COMMENT ON FUNCTION get_claim_expediente(UUID) IS 'Obtiene el expediente completo de un siniestro';
