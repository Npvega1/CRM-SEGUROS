-- =====================================================
-- MIGRACIÓN: 00002_pipeline.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Módulo 02: Pipeline de Ventas
-- =====================================================

-- =====================================================
-- TIPOS ENUM
-- =====================================================

CREATE TYPE opportunity_status AS ENUM (
  'active',
  'won',
  'lost'
);

CREATE TYPE activity_type AS ENUM (
  'call',
  'email',
  'meeting',
  'task',
  'note'
);

-- =====================================================
-- TABLA: pipeline_stages
-- =====================================================
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  order_index SMALLINT NOT NULL,
  color CHAR(7) NOT NULL DEFAULT '#6B7280',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_stage_name_per_tenant UNIQUE (tenant_id, name),
  CONSTRAINT unique_stage_order_per_tenant UNIQUE (tenant_id, order_index)
);

CREATE INDEX idx_pipeline_stages_tenant_id ON pipeline_stages(tenant_id);
CREATE INDEX idx_pipeline_stages_order_index ON pipeline_stages(order_index);

-- =====================================================
-- FUNCIÓN: Crear etapas por defecto para nuevos tenants
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_pipeline_stages()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pipeline_stages (tenant_id, name, order_index, color, is_default) VALUES
    (NEW.id, 'Nuevo Lead', 1, '#3B82F6', true),
    (NEW.id, 'Contactado', 2, '#8B5CF6', true),
    (NEW.id, 'Cotización Enviada', 3, '#F59E0B', true),
    (NEW.id, 'Negociación', 4, '#10B981', true),
    (NEW.id, 'Ganado', 5, '#22C55E', true),
    (NEW.id, 'Perdido', 6, '#EF4444', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_pipeline_stages_for_new_tenant
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_default_pipeline_stages();

-- =====================================================
-- TABLA: opportunities
-- =====================================================
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  line policy_line NOT NULL DEFAULT 'otro',
  estimated_premium NUMERIC(12,2) NOT NULL DEFAULT 0,
  close_probability SMALLINT NOT NULL DEFAULT 50,
  expected_close_date DATE,
  status opportunity_status NOT NULL DEFAULT 'active',
  lost_reason TEXT,
  converted_policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_close_probability CHECK (close_probability >= 0 AND close_probability <= 100),
  CONSTRAINT lost_requires_reason CHECK (
    status != 'lost' OR (status = 'lost' AND lost_reason IS NOT NULL AND lost_reason != '')
  )
);

CREATE INDEX idx_opportunities_tenant_id ON opportunities(tenant_id);
CREATE INDEX idx_opportunities_client_id ON opportunities(client_id);
CREATE INDEX idx_opportunities_stage_id ON opportunities(stage_id);
CREATE INDEX idx_opportunities_agent_id ON opportunities(agent_id);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_expected_close_date ON opportunities(expected_close_date);
CREATE INDEX idx_opportunities_created_at ON opportunities(created_at);

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: activities
-- =====================================================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type activity_type NOT NULL,
  subject VARCHAR(200) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT activity_must_have_reference CHECK (
    opportunity_id IS NOT NULL OR client_id IS NOT NULL
  )
);

CREATE INDEX idx_activities_tenant_id ON activities(tenant_id);
CREATE INDEX idx_activities_opportunity_id ON activities(opportunity_id);
CREATE INDEX idx_activities_client_id ON activities(client_id);
CREATE INDEX idx_activities_agent_id ON activities(agent_id);
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_scheduled_at ON activities(scheduled_at);
CREATE INDEX idx_activities_created_at ON activities(created_at);

-- =====================================================
-- VISTA MATERIALIZADA: mv_pipeline_forecast
-- =====================================================
CREATE MATERIALIZED VIEW mv_pipeline_forecast AS
SELECT
  o.tenant_id,
  o.agent_id,
  ps.id AS stage_id,
  ps.name AS stage_name,
  DATE_TRUNC('month', o.expected_close_date) AS forecast_month,
  COUNT(*) AS opportunity_count,
  SUM(o.estimated_premium) AS total_premium,
  SUM(o.estimated_premium * o.close_probability / 100.0) AS weighted_premium,
  AVG(o.close_probability) AS avg_probability
FROM opportunities o
JOIN pipeline_stages ps ON ps.id = o.stage_id
WHERE o.status = 'active'
  AND o.expected_close_date IS NOT NULL
GROUP BY 
  o.tenant_id,
  o.agent_id,
  ps.id,
  ps.name,
  DATE_TRUNC('month', o.expected_close_date);

CREATE INDEX idx_mv_pipeline_forecast_tenant_id ON mv_pipeline_forecast(tenant_id);
CREATE INDEX idx_mv_pipeline_forecast_agent_id ON mv_pipeline_forecast(agent_id);
CREATE INDEX idx_mv_pipeline_forecast_month ON mv_pipeline_forecast(forecast_month);

CREATE OR REPLACE FUNCTION refresh_pipeline_forecast()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pipeline_forecast;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: win_opportunity
-- =====================================================
CREATE OR REPLACE FUNCTION win_opportunity(
  p_opportunity_id UUID,
  p_agent_id UUID,
  p_policy_number VARCHAR(50) DEFAULT NULL,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT NULL,
  p_commission_pct NUMERIC(5,2) DEFAULT 10.00
)
RETURNS policies AS $$
DECLARE
  v_opportunity opportunities%ROWTYPE;
  v_client clients%ROWTYPE;
  v_new_policy policies%ROWTYPE;
  v_policy_number VARCHAR(50);
BEGIN
  SELECT * INTO v_opportunity FROM opportunities WHERE id = p_opportunity_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oportunidad no encontrada: %', p_opportunity_id;
  END IF;
  
  IF v_opportunity.status != 'active' THEN
    RAISE EXCEPTION 'La oportunidad no esta activa. Estado actual: %', v_opportunity.status;
  END IF;
  
  SELECT * INTO v_client FROM clients WHERE id = v_opportunity.client_id;
  
  v_policy_number := COALESCE(
    p_policy_number,
    'POL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(p_opportunity_id::TEXT, 1, 8)
  );
  
  INSERT INTO policies (
    tenant_id, client_id, policy_number, insurer, line, status, premium, currency,
    start_date, end_date, commission_pct, metadata
  ) VALUES (
    v_opportunity.tenant_id, v_opportunity.client_id, v_policy_number, 'Por asignar',
    v_opportunity.line, 'activa', v_opportunity.estimated_premium, 'COP',
    p_start_date, COALESCE(p_end_date, p_start_date + INTERVAL '1 year'), p_commission_pct,
    jsonb_build_object('converted_from_opportunity', p_opportunity_id, 'converted_at', NOW(), 'converted_by', p_agent_id)
  )
  RETURNING * INTO v_new_policy;
  
  UPDATE opportunities SET status = 'won', converted_policy_id = v_new_policy.id, updated_at = NOW()
  WHERE id = p_opportunity_id;
  
  INSERT INTO automation_queue (tenant_id, trigger_type, entity_type, entity_id, payload)
  VALUES (v_opportunity.tenant_id, 'opportunity_won', 'opportunity', p_opportunity_id,
    jsonb_build_object('policy_id', v_new_policy.id, 'policy_number', v_new_policy.policy_number,
      'premium', v_new_policy.premium, 'commission_pct', p_commission_pct,
      'commission_amount', v_new_policy.premium * p_commission_pct / 100,
      'agent_id', p_agent_id, 'client_id', v_opportunity.client_id));
  
  INSERT INTO activities (tenant_id, opportunity_id, client_id, agent_id, type, subject, description, completed_at)
  VALUES (v_opportunity.tenant_id, p_opportunity_id, v_opportunity.client_id, p_agent_id, 'note',
    'Oportunidad convertida a poliza', 'La oportunidad fue ganada y se creo la poliza ' || v_new_policy.policy_number, NOW());
  
  RETURN v_new_policy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: lose_opportunity
-- =====================================================
CREATE OR REPLACE FUNCTION lose_opportunity(
  p_opportunity_id UUID,
  p_lost_reason TEXT,
  p_agent_id UUID DEFAULT NULL
)
RETURNS opportunities AS $$
DECLARE
  v_opportunity opportunities%ROWTYPE;
BEGIN
  IF p_lost_reason IS NULL OR TRIM(p_lost_reason) = '' THEN
    RAISE EXCEPTION 'La razon de perdida es obligatoria';
  END IF;
  
  SELECT * INTO v_opportunity FROM opportunities WHERE id = p_opportunity_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oportunidad no encontrada: %', p_opportunity_id;
  END IF;
  
  IF v_opportunity.status != 'active' THEN
    RAISE EXCEPTION 'La oportunidad no esta activa. Estado actual: %', v_opportunity.status;
  END IF;
  
  UPDATE opportunities SET status = 'lost', lost_reason = TRIM(p_lost_reason), updated_at = NOW()
  WHERE id = p_opportunity_id RETURNING * INTO v_opportunity;
  
  INSERT INTO automation_queue (tenant_id, trigger_type, entity_type, entity_id, payload)
  VALUES (v_opportunity.tenant_id, 'opportunity_lost', 'opportunity', p_opportunity_id,
    jsonb_build_object('lost_reason', p_lost_reason, 'agent_id', p_agent_id,
      'client_id', v_opportunity.client_id, 'estimated_premium', v_opportunity.estimated_premium));
  
  INSERT INTO activities (tenant_id, opportunity_id, client_id, agent_id, type, subject, description, completed_at)
  VALUES (v_opportunity.tenant_id, p_opportunity_id, v_opportunity.client_id,
    COALESCE(p_agent_id, v_opportunity.agent_id), 'note', 'Oportunidad perdida', 'Razon: ' || p_lost_reason, NOW());
  
  RETURN v_opportunity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Registrar cambio de etapa
-- =====================================================
CREATE OR REPLACE FUNCTION record_opportunity_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO automation_queue (tenant_id, trigger_type, entity_type, entity_id, payload)
    VALUES (NEW.tenant_id, 'opportunity_stage_changed', 'opportunity', NEW.id,
      jsonb_build_object('old_stage_id', OLD.stage_id, 'new_stage_id', NEW.stage_id,
        'agent_id', NEW.agent_id, 'client_id', NEW.client_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER record_opportunity_stage_history
  AFTER UPDATE OF stage_id ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION record_opportunity_stage_change();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- pipeline_stages policies
CREATE POLICY "Ver etapas del pipeline del tenant" ON pipeline_stages FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY "Crear etapas del pipeline" ON pipeline_stages FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent'));

CREATE POLICY "Actualizar etapas del pipeline" ON pipeline_stages FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent'));

CREATE POLICY "Eliminar etapas del pipeline" ON pipeline_stages FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND is_default = false);

-- opportunities policies
CREATE POLICY "Ver oportunidades del tenant" ON opportunities FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY "Crear oportunidades en el tenant" ON opportunities FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent'));

CREATE POLICY "Actualizar oportunidades del tenant" ON opportunities FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent'));

CREATE POLICY "Eliminar oportunidades del tenant" ON opportunities FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent'));

-- activities policies
CREATE POLICY "Ver actividades del tenant" ON activities FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY "Crear actividades en el tenant" ON activities FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent'));

CREATE POLICY "Actualizar actividades del tenant" ON activities FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent'));

CREATE POLICY "Eliminar actividades del tenant" ON activities FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid AND ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent') OR agent_id = auth.uid()));

-- =====================================================
-- CREAR ETAPAS PARA TENANTS EXISTENTES
-- =====================================================
INSERT INTO pipeline_stages (tenant_id, name, order_index, color, is_default)
SELECT t.id, s.name, s.order_index, s.color, true
FROM tenants t
CROSS JOIN (VALUES 
  ('Nuevo Lead', 1, '#3B82F6'),
  ('Contactado', 2, '#8B5CF6'),
  ('Cotizacion Enviada', 3, '#F59E0B'),
  ('Negociacion', 4, '#10B981'),
  ('Ganado', 5, '#22C55E'),
  ('Perdido', 6, '#EF4444')
) AS s(name, order_index, color)
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE tenant_id = t.id);
