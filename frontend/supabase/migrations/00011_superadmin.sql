-- =====================================================
-- MIGRACIÓN: 00011_superadmin.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Módulo 11: Panel Super Administrador
-- =====================================================

-- =====================================================
-- TIPOS ENUM
-- =====================================================

-- Estados de prompts de IA
CREATE TYPE prompt_status AS ENUM ('active', 'draft', 'deprecated');

-- =====================================================
-- TABLA: ai_prompts
-- Prompts configurables para comparativos de IA
-- SIN RLS - acceso solo vía service_role
-- =====================================================
CREATE TABLE ai_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  line VARCHAR(50), -- Ramo de seguro: auto, vida, salud, etc. NULL = todos
  prompt_system TEXT NOT NULL,
  prompt_recommendation TEXT NOT NULL,
  model_id VARCHAR(60) DEFAULT 'claude-sonnet-4-5-20250929',
  status prompt_status DEFAULT 'draft',
  version SMALLINT DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para ai_prompts
CREATE INDEX idx_ai_prompts_status ON ai_prompts(status);
CREATE INDEX idx_ai_prompts_line ON ai_prompts(line);
CREATE INDEX idx_ai_prompts_name ON ai_prompts(name);

-- Trigger para updated_at
CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: ai_prompt_versions
-- Historial de versiones de prompts
-- =====================================================
CREATE TABLE ai_prompt_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
  prompt_system TEXT NOT NULL,
  prompt_recommendation TEXT NOT NULL,
  model_id VARCHAR(60) NOT NULL,
  version SMALLINT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para ai_prompt_versions
CREATE INDEX idx_ai_prompt_versions_prompt_id ON ai_prompt_versions(prompt_id);
CREATE INDEX idx_ai_prompt_versions_version ON ai_prompt_versions(version);

-- =====================================================
-- TABLA: platform_analytics
-- Métricas globales de la plataforma
-- =====================================================
CREATE TABLE platform_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE UNIQUE NOT NULL,
  total_tenants INTEGER DEFAULT 0,
  active_tenants INTEGER DEFAULT 0,
  trial_tenants INTEGER DEFAULT 0,
  mrr_total NUMERIC(14,2) DEFAULT 0,
  new_tenants_month INTEGER DEFAULT 0,
  total_api_calls INTEGER DEFAULT 0,
  total_tokens_consumed BIGINT DEFAULT 0,
  estimated_ai_cost NUMERIC(10,4) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para platform_analytics
CREATE INDEX idx_platform_analytics_date ON platform_analytics(date);

-- Trigger para updated_at
CREATE TRIGGER update_platform_analytics_updated_at
  BEFORE UPDATE ON platform_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- POLÍTICAS RLS ADICIONALES PARA audit_logs
-- Super Admin puede ver todos los audit_logs
-- =====================================================

-- Ya existe política para superadmin en 00000_foundation.sql
-- Agregar política para inserción desde service_role si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'audit_logs' 
    AND policyname = 'Superadmin inserta audit logs'
  ) THEN
    CREATE POLICY "Superadmin inserta audit logs"
      ON audit_logs FOR INSERT
      TO authenticated
      WITH CHECK (auth.is_superadmin());
  END IF;
END $$;

-- =====================================================
-- NO HABILITAR RLS en tablas de Super Admin
-- Acceso controlado vía service_role
-- =====================================================

-- ai_prompts y ai_prompt_versions NO tienen RLS
-- Solo accesibles vía service_role key

-- platform_analytics NO tiene RLS
-- Solo accesible vía service_role key

-- =====================================================
-- FUNCIÓN: Obtener estadísticas de un tenant
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_stats(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'agents_count', (SELECT COUNT(*) FROM users WHERE tenant_id = p_tenant_id AND is_active = true),
    'clients_count', (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id),
    'policies_count', (SELECT COUNT(*) FROM policies WHERE tenant_id = p_tenant_id),
    'active_policies', (SELECT COUNT(*) FROM policies WHERE tenant_id = p_tenant_id AND status = 'active'),
    'claims_count', (SELECT COUNT(*) FROM claims WHERE tenant_id = p_tenant_id),
    'opportunities_count', (SELECT COUNT(*) FROM opportunities WHERE tenant_id = p_tenant_id),
    'comparisons_count', (SELECT COUNT(*) FROM comparisons WHERE tenant_id = p_tenant_id)
  ) INTO result;
  
  RETURN result;
EXCEPTION
  WHEN undefined_table THEN
    -- Si alguna tabla no existe, retornar valores por defecto
    RETURN json_build_object(
      'agents_count', 0,
      'clients_count', 0,
      'policies_count', 0,
      'active_policies', 0,
      'claims_count', 0,
      'opportunities_count', 0,
      'comparisons_count', 0
    );
END;
$$;

-- =====================================================
-- FUNCIÓN: Calcular analytics de la plataforma
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_platform_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
  v_total_tenants INTEGER;
  v_active_tenants INTEGER;
BEGIN
  -- Contar tenants
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true)
  INTO v_total_tenants, v_active_tenants
  FROM tenants;
  
  -- Insertar o actualizar analytics del día
  INSERT INTO platform_analytics (
    date,
    total_tenants,
    active_tenants,
    trial_tenants,
    updated_at
  ) VALUES (
    v_date,
    v_total_tenants,
    v_active_tenants,
    0, -- trial_tenants se calcularía con subscriptions
    now()
  )
  ON CONFLICT (date) DO UPDATE SET
    total_tenants = EXCLUDED.total_tenants,
    active_tenants = EXCLUDED.active_tenants,
    updated_at = now();
END;
$$;

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE ai_prompts IS 'Prompts configurables para el módulo de comparativos IA';
COMMENT ON TABLE ai_prompt_versions IS 'Historial de versiones de prompts para rollback';
COMMENT ON TABLE platform_analytics IS 'Métricas agregadas de la plataforma por día';
COMMENT ON FUNCTION get_tenant_stats(UUID) IS 'Obtiene estadísticas de uso de un tenant específico';
COMMENT ON FUNCTION calculate_platform_analytics() IS 'Calcula y guarda métricas globales de la plataforma';
