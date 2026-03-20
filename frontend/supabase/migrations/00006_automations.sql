-- =====================================================
-- MIGRACIÓN: 00006_automations.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Módulo 06: Automatizaciones y Workflows
-- =====================================================

-- =====================================================
-- TIPOS ENUM
-- =====================================================

-- Eventos que disparan automatizaciones
DO $$ BEGIN
  CREATE TYPE automation_trigger_event AS ENUM (
    'policy.expiring',
    'policy.activated',
    'invoice.overdue',
    'claim.created',
    'claim.status_changed',
    'opportunity.stage_changed',
    'client.created'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tipos de acciones
DO $$ BEGIN
  CREATE TYPE automation_action_type AS ENUM (
    'send_email',
    'create_task',
    'in_app_notification',
    'move_pipeline_stage'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Estado de la cola de automatizaciones
DO $$ BEGIN
  CREATE TYPE automation_queue_status AS ENUM (
    'pending',
    'processing',
    'done',
    'error'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Estado de ejecución en logs
DO $$ BEGIN
  CREATE TYPE automation_log_status AS ENUM (
    'success',
    'error'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLA: automations (Automatizaciones)
-- =====================================================
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_event automation_trigger_event NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_conditions CHECK (jsonb_typeof(conditions) = 'array')
);

-- Índices para automations
CREATE INDEX IF NOT EXISTS idx_automations_tenant_id ON automations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_event ON automations(trigger_event);
CREATE INDEX IF NOT EXISTS idx_automations_is_active ON automations(is_active);
CREATE INDEX IF NOT EXISTS idx_automations_created_at ON automations(created_at);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_automations_updated_at ON automations;
CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: automation_actions (Acciones de Automatización)
-- =====================================================
CREATE TABLE IF NOT EXISTS automation_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  action_type automation_action_type NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}',
  order_index SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_action_config CHECK (jsonb_typeof(action_config) = 'object')
);

-- Índices para automation_actions
CREATE INDEX IF NOT EXISTS idx_automation_actions_automation_id ON automation_actions(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_actions_order ON automation_actions(automation_id, order_index);

-- =====================================================
-- TABLA: automation_queue (Cola de Procesamiento)
-- =====================================================
CREATE TABLE IF NOT EXISTS automation_queue_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES automations(id) ON DELETE SET NULL,
  trigger_event automation_trigger_event NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status automation_queue_status NOT NULL DEFAULT 'pending',
  error_msg TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Índices para automation_queue_v2
CREATE INDEX IF NOT EXISTS idx_automation_queue_v2_tenant_id ON automation_queue_v2(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_queue_v2_status ON automation_queue_v2(status);
CREATE INDEX IF NOT EXISTS idx_automation_queue_v2_created_at ON automation_queue_v2(created_at);
CREATE INDEX IF NOT EXISTS idx_automation_queue_v2_pending ON automation_queue_v2(status, created_at) 
  WHERE status = 'pending';

-- =====================================================
-- TABLA: automation_logs (Historial de Ejecuciones)
-- =====================================================
CREATE TABLE IF NOT EXISTS automation_logs_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES automations(id) ON DELETE SET NULL,
  queue_id UUID REFERENCES automation_queue_v2(id) ON DELETE SET NULL,
  action_id UUID REFERENCES automation_actions(id) ON DELETE SET NULL,
  status automation_log_status NOT NULL,
  response JSONB DEFAULT '{}',
  error_msg TEXT,
  executed_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para automation_logs_v2
CREATE INDEX IF NOT EXISTS idx_automation_logs_v2_tenant_id ON automation_logs_v2(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_v2_automation_id ON automation_logs_v2(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_v2_executed_at ON automation_logs_v2(executed_at);

-- =====================================================
-- TABLA: email_templates (Plantillas de Email)
-- =====================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  subject VARCHAR(300) NOT NULL,
  html_body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para email_templates
CREATE INDEX IF NOT EXISTS idx_email_templates_tenant_id ON email_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: notifications (Notificaciones In-App)
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  entity_type VARCHAR(50),
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read, created_at) 
  WHERE is_read = false;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_queue_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ----- POLÍTICAS PARA automations -----

DROP POLICY IF EXISTS "Ver automatizaciones del tenant" ON automations;
CREATE POLICY "Ver automatizaciones del tenant"
  ON automations FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

DROP POLICY IF EXISTS "Crear automatizaciones en el tenant" ON automations;
CREATE POLICY "Crear automatizaciones en el tenant"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
  );

DROP POLICY IF EXISTS "Actualizar automatizaciones del tenant" ON automations;
CREATE POLICY "Actualizar automatizaciones del tenant"
  ON automations FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
  );

DROP POLICY IF EXISTS "Eliminar automatizaciones del tenant" ON automations;
CREATE POLICY "Eliminar automatizaciones del tenant"
  ON automations FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ----- POLÍTICAS PARA automation_actions -----

DROP POLICY IF EXISTS "Ver acciones de automatización" ON automation_actions;
CREATE POLICY "Ver acciones de automatización"
  ON automation_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations a 
      WHERE a.id = automation_actions.automation_id 
      AND (
        a.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      )
    )
  );

DROP POLICY IF EXISTS "Crear acciones de automatización" ON automation_actions;
CREATE POLICY "Crear acciones de automatización"
  ON automation_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations a 
      WHERE a.id = automation_actions.automation_id 
      AND a.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
      AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
    )
  );

DROP POLICY IF EXISTS "Actualizar acciones de automatización" ON automation_actions;
CREATE POLICY "Actualizar acciones de automatización"
  ON automation_actions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations a 
      WHERE a.id = automation_actions.automation_id 
      AND a.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
      AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
    )
  );

DROP POLICY IF EXISTS "Eliminar acciones de automatización" ON automation_actions;
CREATE POLICY "Eliminar acciones de automatización"
  ON automation_actions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations a 
      WHERE a.id = automation_actions.automation_id 
      AND a.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
      AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

-- ----- POLÍTICAS PARA automation_queue_v2 -----

DROP POLICY IF EXISTS "Ver cola de automatización del tenant" ON automation_queue_v2;
CREATE POLICY "Ver cola de automatización del tenant"
  ON automation_queue_v2 FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

DROP POLICY IF EXISTS "Crear items en cola del tenant" ON automation_queue_v2;
CREATE POLICY "Crear items en cola del tenant"
  ON automation_queue_v2 FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

DROP POLICY IF EXISTS "Actualizar cola del tenant" ON automation_queue_v2;
CREATE POLICY "Actualizar cola del tenant"
  ON automation_queue_v2 FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

-- ----- POLÍTICAS PARA automation_logs_v2 -----

DROP POLICY IF EXISTS "Ver logs de automatización del tenant" ON automation_logs_v2;
CREATE POLICY "Ver logs de automatización del tenant"
  ON automation_logs_v2 FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

DROP POLICY IF EXISTS "Crear logs de automatización" ON automation_logs_v2;
CREATE POLICY "Crear logs de automatización"
  ON automation_logs_v2 FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

-- ----- POLÍTICAS PARA email_templates -----

DROP POLICY IF EXISTS "Ver plantillas de email del tenant" ON email_templates;
CREATE POLICY "Ver plantillas de email del tenant"
  ON email_templates FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

DROP POLICY IF EXISTS "Crear plantillas de email" ON email_templates;
CREATE POLICY "Crear plantillas de email"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
  );

DROP POLICY IF EXISTS "Actualizar plantillas de email" ON email_templates;
CREATE POLICY "Actualizar plantillas de email"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
  );

DROP POLICY IF EXISTS "Eliminar plantillas de email" ON email_templates;
CREATE POLICY "Eliminar plantillas de email"
  ON email_templates FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ----- POLÍTICAS PARA notifications -----

DROP POLICY IF EXISTS "Ver notificaciones propias" ON notifications;
CREATE POLICY "Ver notificaciones propias"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

DROP POLICY IF EXISTS "Crear notificaciones en el tenant" ON notifications;
CREATE POLICY "Crear notificaciones en el tenant"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

DROP POLICY IF EXISTS "Actualizar notificaciones propias" ON notifications;
CREATE POLICY "Actualizar notificaciones propias"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Eliminar notificaciones propias" ON notifications;
CREATE POLICY "Eliminar notificaciones propias"
  ON notifications FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- =====================================================
-- FUNCIONES DE UTILIDAD
-- =====================================================

-- Función para obtener automatizaciones con último log
CREATE OR REPLACE FUNCTION get_automations_with_stats(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(200),
  description TEXT,
  is_active BOOLEAN,
  trigger_event automation_trigger_event,
  conditions JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  actions_count INTEGER,
  last_execution_at TIMESTAMPTZ,
  last_execution_status automation_log_status,
  total_executions INTEGER,
  successful_executions INTEGER,
  failed_executions INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.description,
    a.is_active,
    a.trigger_event,
    a.conditions,
    a.created_at,
    a.updated_at,
    (SELECT COUNT(*)::INTEGER FROM automation_actions aa WHERE aa.automation_id = a.id) AS actions_count,
    (SELECT MAX(al.executed_at) FROM automation_logs_v2 al WHERE al.automation_id = a.id) AS last_execution_at,
    (SELECT al.status FROM automation_logs_v2 al WHERE al.automation_id = a.id ORDER BY al.executed_at DESC LIMIT 1) AS last_execution_status,
    (SELECT COUNT(*)::INTEGER FROM automation_logs_v2 al WHERE al.automation_id = a.id) AS total_executions,
    (SELECT COUNT(*)::INTEGER FROM automation_logs_v2 al WHERE al.automation_id = a.id AND al.status = 'success') AS successful_executions,
    (SELECT COUNT(*)::INTEGER FROM automation_logs_v2 al WHERE al.automation_id = a.id AND al.status = 'error') AS failed_executions
  FROM automations a
  WHERE a.tenant_id = p_tenant_id
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para contar notificaciones no leídas
CREATE OR REPLACE FUNCTION get_unread_notifications_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM notifications 
    WHERE user_id = p_user_id AND is_read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar todas las notificaciones como leídas
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications 
  SET is_read = true 
  WHERE user_id = p_user_id AND is_read = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS PARA ENCOLAR AUTOMATIZACIONES
-- =====================================================

-- Trigger para policy.activated
CREATE OR REPLACE FUNCTION trigger_automation_policy_activated()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'activa' AND (OLD.status IS NULL OR OLD.status != 'activa') THEN
    INSERT INTO automation_queue_v2 (
      tenant_id,
      trigger_event,
      entity_id,
      payload,
      status
    ) VALUES (
      NEW.tenant_id,
      'policy.activated',
      NEW.id,
      jsonb_build_object(
        'policy_id', NEW.id,
        'policy_number', NEW.policy_number,
        'client_id', NEW.client_id,
        'insurer', NEW.insurer,
        'line', NEW.line,
        'premium', NEW.premium,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date
      ),
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_policy_activated ON policies;
CREATE TRIGGER trigger_auto_policy_activated
  AFTER UPDATE OF status ON policies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_policy_activated();

-- Trigger para claim.created
CREATE OR REPLACE FUNCTION trigger_automation_claim_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO automation_queue_v2 (
    tenant_id,
    trigger_event,
    entity_id,
    payload,
    status
  ) VALUES (
    NEW.tenant_id,
    'claim.created',
    NEW.id,
    jsonb_build_object(
      'claim_id', NEW.id,
      'policy_id', NEW.policy_id,
      'client_id', NEW.client_id,
      'incident_date', NEW.incident_date,
      'claimed_amount', NEW.claimed_amount,
      'description', NEW.description
    ),
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_claim_created ON claims;
CREATE TRIGGER trigger_auto_claim_created
  AFTER INSERT ON claims
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_claim_created();

-- Trigger para claim.status_changed
CREATE OR REPLACE FUNCTION trigger_automation_claim_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO automation_queue_v2 (
      tenant_id,
      trigger_event,
      entity_id,
      payload,
      status
    ) VALUES (
      NEW.tenant_id,
      'claim.status_changed',
      NEW.id,
      jsonb_build_object(
        'claim_id', NEW.id,
        'policy_id', NEW.policy_id,
        'client_id', NEW.client_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      ),
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_claim_status ON claims;
CREATE TRIGGER trigger_auto_claim_status
  AFTER UPDATE OF status ON claims
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_claim_status_changed();

-- Trigger para opportunity.stage_changed
CREATE OR REPLACE FUNCTION trigger_automation_opportunity_stage()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO automation_queue_v2 (
      tenant_id,
      trigger_event,
      entity_id,
      payload,
      status
    ) VALUES (
      NEW.tenant_id,
      'opportunity.stage_changed',
      NEW.id,
      jsonb_build_object(
        'opportunity_id', NEW.id,
        'client_id', NEW.client_id,
        'old_stage_id', OLD.stage_id,
        'new_stage_id', NEW.stage_id,
        'estimated_premium', NEW.estimated_premium,
        'line', NEW.line
      ),
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_opportunity_stage ON opportunities;
CREATE TRIGGER trigger_auto_opportunity_stage
  AFTER UPDATE OF stage_id ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_opportunity_stage();

-- Trigger para client.created
CREATE OR REPLACE FUNCTION trigger_automation_client_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO automation_queue_v2 (
    tenant_id,
    trigger_event,
    entity_id,
    payload,
    status
  ) VALUES (
    NEW.tenant_id,
    'client.created',
    NEW.id,
    jsonb_build_object(
      'client_id', NEW.id,
      'full_name', NEW.full_name,
      'email', NEW.email,
      'phone', NEW.phone,
      'segment', NEW.segment
    ),
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_client_created ON clients;
CREATE TRIGGER trigger_auto_client_created
  AFTER INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_client_created();

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE automations IS 'Automatizaciones configuradas por el tenant';
COMMENT ON TABLE automation_actions IS 'Acciones a ejecutar por cada automatización';
COMMENT ON TABLE automation_queue_v2 IS 'Cola de eventos pendientes de procesar';
COMMENT ON TABLE automation_logs_v2 IS 'Historial de ejecuciones de automatizaciones';
COMMENT ON TABLE email_templates IS 'Plantillas de email con variables Handlebars';
COMMENT ON TABLE notifications IS 'Notificaciones in-app para usuarios';

COMMENT ON FUNCTION get_automations_with_stats(UUID) IS 'Obtiene automatizaciones con estadísticas de ejecución';
COMMENT ON FUNCTION get_unread_notifications_count(UUID) IS 'Cuenta notificaciones no leídas de un usuario';
COMMENT ON FUNCTION mark_all_notifications_read(UUID) IS 'Marca todas las notificaciones de un usuario como leídas';
