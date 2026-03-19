-- =====================================================
-- MIGRACIÓN: 00005_billing.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Módulo 05: Facturación y Comisiones
-- =====================================================

-- =====================================================
-- TIPOS ENUM
-- =====================================================

-- Estado de factura/cuota
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'waived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Frecuencia de pago
DO $$ BEGIN
  CREATE TYPE payment_frequency AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Estado de comisión
DO $$ BEGIN
  CREATE TYPE commission_status AS ENUM ('pending', 'collected', 'void');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- AGREGAR CAMPO FREQUENCY A POLICIES
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'policies' AND column_name = 'frequency'
  ) THEN
    ALTER TABLE policies ADD COLUMN frequency payment_frequency DEFAULT 'annual';
  END IF;
END $$;

-- =====================================================
-- TABLA: invoices (Cuotas/Facturas)
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status invoice_status NOT NULL DEFAULT 'pending',
  paid_date DATE,
  receipt_url TEXT,
  frequency payment_frequency NOT NULL DEFAULT 'annual',
  installment_number SMALLINT NOT NULL DEFAULT 1,
  total_installments SMALLINT NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT positive_amount CHECK (amount >= 0),
  CONSTRAINT valid_installment CHECK (installment_number > 0 AND installment_number <= total_installments)
);

-- Índices para invoices
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_policy_id ON invoices(policy_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: commission_rates (Tasas de Comisión)
-- =====================================================
CREATE TABLE IF NOT EXISTS commission_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  insurer VARCHAR(100) NOT NULL,
  line policy_line NOT NULL,
  rate_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT positive_rate CHECK (rate_pct >= 0 AND rate_pct <= 100),
  CONSTRAINT valid_date_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Índices para commission_rates
CREATE INDEX IF NOT EXISTS idx_commission_rates_tenant_id ON commission_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_rates_insurer ON commission_rates(insurer);
CREATE INDEX IF NOT EXISTS idx_commission_rates_line ON commission_rates(line);
CREATE INDEX IF NOT EXISTS idx_commission_rates_effective ON commission_rates(effective_from, effective_to);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_commission_rates_updated_at ON commission_rates;
CREATE TRIGGER update_commission_rates_updated_at
  BEFORE UPDATE ON commission_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: commissions (Comisiones)
-- =====================================================
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  rate_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  status commission_status NOT NULL DEFAULT 'pending',
  period_month DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT positive_commission_amount CHECK (amount >= 0),
  CONSTRAINT positive_commission_rate CHECK (rate_pct >= 0 AND rate_pct <= 100)
);

-- Índices para commissions
CREATE INDEX IF NOT EXISTS idx_commissions_tenant_id ON commissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_policy_id ON commissions(policy_id);
CREATE INDEX IF NOT EXISTS idx_commissions_agent_id ON commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_period_month ON commissions(period_month);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_commissions_updated_at ON commissions;
CREATE TRIGGER update_commissions_updated_at
  BEFORE UPDATE ON commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: commission_splits (División de Comisiones)
-- =====================================================
CREATE TABLE IF NOT EXISTS commission_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  split_pct NUMERIC(5,2) NOT NULL DEFAULT 100,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT positive_split_pct CHECK (split_pct > 0 AND split_pct <= 100),
  CONSTRAINT positive_split_amount CHECK (amount >= 0),
  CONSTRAINT unique_commission_agent UNIQUE (commission_id, agent_id)
);

-- Índices para commission_splits
CREATE INDEX IF NOT EXISTS idx_commission_splits_commission_id ON commission_splits(commission_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_agent_id ON commission_splits(agent_id);

-- =====================================================
-- FUNCIÓN: Generar cuotas para una póliza
-- =====================================================
CREATE OR REPLACE FUNCTION generate_installments(p_policy_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_policy RECORD;
  v_num_installments INTEGER;
  v_amount_per_installment NUMERIC(12,2);
  v_due_date DATE;
  v_months_between INTEGER;
  i INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- Obtener datos de la póliza
  SELECT 
    id, tenant_id, client_id, premium, start_date, end_date, 
    COALESCE(frequency, 'annual') as frequency
  INTO v_policy
  FROM policies
  WHERE id = p_policy_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Póliza no encontrada: %', p_policy_id;
  END IF;
  
  -- Si no hay fechas, no generar cuotas
  IF v_policy.start_date IS NULL OR v_policy.end_date IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Eliminar cuotas pendientes existentes
  DELETE FROM invoices 
  WHERE policy_id = p_policy_id 
    AND status = 'pending';
  
  -- Calcular número de cuotas según frecuencia
  CASE v_policy.frequency::text
    WHEN 'monthly' THEN 
      v_num_installments := 12;
      v_months_between := 1;
    WHEN 'quarterly' THEN 
      v_num_installments := 4;
      v_months_between := 3;
    WHEN 'semiannual' THEN 
      v_num_installments := 2;
      v_months_between := 6;
    WHEN 'annual' THEN 
      v_num_installments := 1;
      v_months_between := 12;
    ELSE 
      v_num_installments := 1;
      v_months_between := 12;
  END CASE;
  
  -- Calcular monto por cuota
  v_amount_per_installment := ROUND(v_policy.premium / v_num_installments, 2);
  
  -- Generar cuotas
  v_due_date := v_policy.start_date;
  
  FOR i IN 1..v_num_installments LOOP
    INSERT INTO invoices (
      tenant_id,
      policy_id,
      client_id,
      amount,
      due_date,
      status,
      frequency,
      installment_number,
      total_installments
    ) VALUES (
      v_policy.tenant_id,
      v_policy.id,
      v_policy.client_id,
      v_amount_per_installment,
      v_due_date,
      CASE 
        WHEN v_due_date < CURRENT_DATE THEN 'overdue'::invoice_status
        ELSE 'pending'::invoice_status
      END,
      v_policy.frequency,
      i,
      v_num_installments
    );
    
    v_count := v_count + 1;
    v_due_date := v_due_date + (v_months_between || ' months')::INTERVAL;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Calcular comisión al activar póliza
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_policy_commission(p_policy_id UUID)
RETURNS UUID AS $$
DECLARE
  v_policy RECORD;
  v_rate NUMERIC(5,2) := 0;
  v_commission_amount NUMERIC(12,2);
  v_agent_id UUID;
  v_commission_id UUID;
BEGIN
  -- Obtener datos de la póliza
  SELECT 
    p.id, p.tenant_id, p.premium, p.insurer, p.line, 
    p.commission_pct, c.agent_id
  INTO v_policy
  FROM policies p
  JOIN clients c ON c.id = p.client_id
  WHERE p.id = p_policy_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  v_agent_id := v_policy.agent_id;
  
  -- Buscar tasa de comisión configurada
  SELECT rate_pct INTO v_rate
  FROM commission_rates
  WHERE tenant_id = v_policy.tenant_id
    AND insurer = v_policy.insurer
    AND line = v_policy.line
    AND effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  ORDER BY effective_from DESC
  LIMIT 1;
  
  -- Si no hay tasa configurada, usar la de la póliza
  IF v_rate IS NULL OR v_rate = 0 THEN
    v_rate := COALESCE(v_policy.commission_pct, 0);
  END IF;
  
  -- Si no hay tasa, no crear comisión
  IF v_rate = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Calcular monto de comisión
  v_commission_amount := ROUND(v_policy.premium * v_rate / 100, 2);
  
  -- Crear registro de comisión
  INSERT INTO commissions (
    tenant_id,
    policy_id,
    agent_id,
    amount,
    rate_pct,
    status,
    period_month
  ) VALUES (
    v_policy.tenant_id,
    v_policy.id,
    v_agent_id,
    v_commission_amount,
    v_rate,
    'pending',
    DATE_TRUNC('month', CURRENT_DATE)::DATE
  )
  RETURNING id INTO v_commission_id;
  
  -- Crear split por defecto (100% al agente)
  IF v_agent_id IS NOT NULL THEN
    INSERT INTO commission_splits (
      commission_id,
      agent_id,
      split_pct,
      amount
    ) VALUES (
      v_commission_id,
      v_agent_id,
      100,
      v_commission_amount
    );
  END IF;
  
  RETURN v_commission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Al activar póliza, generar cuotas y comisión
-- =====================================================
CREATE OR REPLACE FUNCTION on_policy_activated()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo ejecutar si el status cambió a 'activa'
  IF NEW.status = 'activa' AND (OLD.status IS NULL OR OLD.status != 'activa') THEN
    -- Generar cuotas
    PERFORM generate_installments(NEW.id);
    
    -- Calcular comisión
    PERFORM calculate_policy_commission(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger (solo si no existe)
DROP TRIGGER IF EXISTS trigger_policy_activated ON policies;
CREATE TRIGGER trigger_policy_activated
  AFTER UPDATE OF status ON policies
  FOR EACH ROW
  EXECUTE FUNCTION on_policy_activated();

-- También para INSERT con status activa
DROP TRIGGER IF EXISTS trigger_policy_inserted_active ON policies;
CREATE TRIGGER trigger_policy_inserted_active
  AFTER INSERT ON policies
  FOR EACH ROW
  WHEN (NEW.status = 'activa')
  EXECUTE FUNCTION on_policy_activated();

-- =====================================================
-- FUNCIÓN: Procesar cuotas vencidas (para cron manual)
-- Reemplaza la Edge Function
-- =====================================================
CREATE OR REPLACE FUNCTION process_overdue_invoices(p_days_overdue INTEGER DEFAULT 0)
RETURNS TABLE (
  processed_count INTEGER,
  tenant_counts JSONB
) AS $$
DECLARE
  v_count INTEGER := 0;
  v_tenant_counts JSONB := '{}'::JSONB;
  v_invoice RECORD;
BEGIN
  -- Actualizar status de cuotas vencidas
  FOR v_invoice IN
    SELECT id, tenant_id, policy_id, client_id, due_date
    FROM invoices
    WHERE status = 'pending'
      AND due_date < (CURRENT_DATE - p_days_overdue)
  LOOP
    -- Actualizar a overdue
    UPDATE invoices 
    SET status = 'overdue', updated_at = now()
    WHERE id = v_invoice.id;
    
    -- Insertar en automation_queue para notificación
    INSERT INTO automation_queue (
      tenant_id, 
      trigger_type, 
      entity_type, 
      entity_id, 
      payload, 
      status
    ) VALUES (
      v_invoice.tenant_id,
      'invoice_overdue',
      'invoice',
      v_invoice.id,
      jsonb_build_object(
        'invoice_id', v_invoice.id,
        'policy_id', v_invoice.policy_id,
        'client_id', v_invoice.client_id,
        'due_date', v_invoice.due_date,
        'days_overdue', CURRENT_DATE - v_invoice.due_date
      ),
      'pending'
    );
    
    -- Registrar en automation_logs
    INSERT INTO automation_logs (
      tenant_id,
      automation_type,
      entity_type,
      entity_id,
      result,
      details
    ) VALUES (
      v_invoice.tenant_id,
      'overdue_invoice_processed',
      'invoice',
      v_invoice.id,
      'success',
      jsonb_build_object(
        'due_date', v_invoice.due_date,
        'days_overdue', CURRENT_DATE - v_invoice.due_date,
        'processed_at', now()
      )
    );
    
    -- Contar por tenant
    v_tenant_counts := v_tenant_counts || jsonb_build_object(
      v_invoice.tenant_id::text, 
      COALESCE((v_tenant_counts ->> v_invoice.tenant_id::text)::INTEGER, 0) + 1
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_count, v_tenant_counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Obtener estado de cuenta del cliente
-- =====================================================
CREATE OR REPLACE FUNCTION get_client_statement(
  p_tenant_id UUID,
  p_client_id UUID
)
RETURNS TABLE (
  policy_id UUID,
  policy_number VARCHAR(50),
  insurer VARCHAR(100),
  line policy_line,
  invoices JSONB,
  total_amount NUMERIC(12,2),
  total_paid NUMERIC(12,2),
  total_pending NUMERIC(12,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS policy_id,
    p.policy_number,
    p.insurer,
    p.line,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'amount', i.amount,
          'due_date', i.due_date,
          'status', i.status,
          'paid_date', i.paid_date,
          'installment_number', i.installment_number,
          'total_installments', i.total_installments
        ) ORDER BY i.installment_number
      )
      FROM invoices i
      WHERE i.policy_id = p.id),
      '[]'::jsonb
    ) AS invoices,
    COALESCE(SUM(i.amount), 0) AS total_amount,
    COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END), 0) AS total_paid,
    COALESCE(SUM(CASE WHEN i.status IN ('pending', 'overdue') THEN i.amount ELSE 0 END), 0) AS total_pending
  FROM policies p
  LEFT JOIN invoices i ON i.policy_id = p.id
  WHERE p.tenant_id = p_tenant_id
    AND p.client_id = p_client_id
  GROUP BY p.id, p.policy_number, p.insurer, p.line
  ORDER BY p.policy_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Obtener comisiones por período
-- =====================================================
CREATE OR REPLACE FUNCTION get_commissions_by_period(
  p_tenant_id UUID,
  p_period_month DATE DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  policy_id UUID,
  policy_number VARCHAR(50),
  client_name VARCHAR(200),
  insurer VARCHAR(100),
  line policy_line,
  agent_id UUID,
  agent_name VARCHAR(200),
  amount NUMERIC(12,2),
  rate_pct NUMERIC(5,2),
  status commission_status,
  period_month DATE,
  paid_at TIMESTAMPTZ,
  premium NUMERIC(12,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.policy_id,
    p.policy_number,
    cl.full_name AS client_name,
    p.insurer,
    p.line,
    c.agent_id,
    u.full_name AS agent_name,
    c.amount,
    c.rate_pct,
    c.status,
    c.period_month,
    c.paid_at,
    p.premium
  FROM commissions c
  JOIN policies p ON p.id = c.policy_id
  JOIN clients cl ON cl.id = p.client_id
  LEFT JOIN users u ON u.id = c.agent_id
  WHERE c.tenant_id = p_tenant_id
    AND (p_period_month IS NULL OR c.period_month = p_period_month)
    AND (p_agent_id IS NULL OR c.agent_id = p_agent_id)
  ORDER BY c.period_month DESC, c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Obtener resumen de comisiones
-- =====================================================
CREATE OR REPLACE FUNCTION get_commissions_summary(
  p_tenant_id UUID,
  p_period_month DATE DEFAULT NULL
)
RETURNS TABLE (
  total_pending NUMERIC(12,2),
  total_collected NUMERIC(12,2),
  total_void NUMERIC(12,2),
  count_pending INTEGER,
  count_collected INTEGER,
  count_void INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS total_pending,
    COALESCE(SUM(CASE WHEN status = 'collected' THEN amount ELSE 0 END), 0) AS total_collected,
    COALESCE(SUM(CASE WHEN status = 'void' THEN amount ELSE 0 END), 0) AS total_void,
    COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER AS count_pending,
    COUNT(CASE WHEN status = 'collected' THEN 1 END)::INTEGER AS count_collected,
    COUNT(CASE WHEN status = 'void' THEN 1 END)::INTEGER AS count_void
  FROM commissions
  WHERE tenant_id = p_tenant_id
    AND (p_period_month IS NULL OR period_month = p_period_month);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_splits ENABLE ROW LEVEL SECURITY;

-- ----- POLÍTICAS PARA invoices -----

DROP POLICY IF EXISTS "Ver cuotas del tenant" ON invoices;
CREATE POLICY "Ver cuotas del tenant"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

DROP POLICY IF EXISTS "Crear cuotas en el tenant" ON invoices;
CREATE POLICY "Crear cuotas en el tenant"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

DROP POLICY IF EXISTS "Actualizar cuotas del tenant" ON invoices;
CREATE POLICY "Actualizar cuotas del tenant"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent', 'agent')
  );

DROP POLICY IF EXISTS "Eliminar cuotas del tenant" ON invoices;
CREATE POLICY "Eliminar cuotas del tenant"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
  );

-- ----- POLÍTICAS PARA commission_rates -----

DROP POLICY IF EXISTS "Ver tasas de comisión del tenant" ON commission_rates;
CREATE POLICY "Ver tasas de comisión del tenant"
  ON commission_rates FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

DROP POLICY IF EXISTS "Crear tasas de comisión" ON commission_rates;
CREATE POLICY "Crear tasas de comisión"
  ON commission_rates FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
  );

DROP POLICY IF EXISTS "Actualizar tasas de comisión" ON commission_rates;
CREATE POLICY "Actualizar tasas de comisión"
  ON commission_rates FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
  );

DROP POLICY IF EXISTS "Eliminar tasas de comisión" ON commission_rates;
CREATE POLICY "Eliminar tasas de comisión"
  ON commission_rates FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ----- POLÍTICAS PARA commissions -----

DROP POLICY IF EXISTS "Ver comisiones del tenant" ON commissions;
CREATE POLICY "Ver comisiones del tenant"
  ON commissions FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

DROP POLICY IF EXISTS "Crear comisiones en el tenant" ON commissions;
CREATE POLICY "Crear comisiones en el tenant"
  ON commissions FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

DROP POLICY IF EXISTS "Actualizar comisiones del tenant" ON commissions;
CREATE POLICY "Actualizar comisiones del tenant"
  ON commissions FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
  );

DROP POLICY IF EXISTS "Eliminar comisiones del tenant" ON commissions;
CREATE POLICY "Eliminar comisiones del tenant"
  ON commissions FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ----- POLÍTICAS PARA commission_splits -----

DROP POLICY IF EXISTS "Ver splits de comisión" ON commission_splits;
CREATE POLICY "Ver splits de comisión"
  ON commission_splits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commissions c 
      WHERE c.id = commission_splits.commission_id 
      AND (
        c.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      )
    )
  );

DROP POLICY IF EXISTS "Crear splits de comisión" ON commission_splits;
CREATE POLICY "Crear splits de comisión"
  ON commission_splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commissions c 
      WHERE c.id = commission_splits.commission_id 
      AND c.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    )
  );

DROP POLICY IF EXISTS "Actualizar splits de comisión" ON commission_splits;
CREATE POLICY "Actualizar splits de comisión"
  ON commission_splits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commissions c 
      WHERE c.id = commission_splits.commission_id 
      AND c.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
      AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
    )
  );

DROP POLICY IF EXISTS "Eliminar splits de comisión" ON commission_splits;
CREATE POLICY "Eliminar splits de comisión"
  ON commission_splits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commissions c 
      WHERE c.id = commission_splits.commission_id 
      AND c.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
      AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

-- =====================================================
-- STORAGE BUCKET: invoice-documents
-- =====================================================
-- NOTA: Ejecutar manualmente en el Dashboard de Supabase > Storage
-- 
-- 1. Crear bucket 'invoice-documents' (privado)
--    - Ir a Storage > New Bucket
--    - Name: invoice-documents
--    - Public bucket: OFF (desmarcar)
--
-- 2. Configurar políticas de acceso (SQL Editor):
/*
-- Política para subir comprobantes de pago
CREATE POLICY "Usuarios autenticados pueden subir comprobantes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-documents' 
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Política para ver comprobantes de su tenant
CREATE POLICY "Usuarios pueden ver comprobantes de su tenant"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-documents' 
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Política para eliminar comprobantes (admin y senior_agent)
CREATE POLICY "Admin puede eliminar comprobantes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-documents' 
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'senior_agent')
);
*/

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE invoices IS 'Cuotas/facturas de pólizas por cobrar';
COMMENT ON TABLE commission_rates IS 'Tasas de comisión por aseguradora y ramo';
COMMENT ON TABLE commissions IS 'Comisiones generadas por pólizas';
COMMENT ON TABLE commission_splits IS 'División de comisiones entre agentes';

COMMENT ON FUNCTION generate_installments(UUID) IS 'Genera cuotas automáticas para una póliza según su frecuencia de pago';
COMMENT ON FUNCTION calculate_policy_commission(UUID) IS 'Calcula y registra la comisión al activar una póliza';
COMMENT ON FUNCTION on_policy_activated() IS 'Trigger function que genera cuotas y comisión al activar póliza';
COMMENT ON FUNCTION process_overdue_invoices(INTEGER) IS 'Procesa cuotas vencidas y las marca como overdue (llamar manualmente o desde cron)';
COMMENT ON FUNCTION get_client_statement(UUID, UUID) IS 'Obtiene el estado de cuenta de un cliente con todas sus cuotas';
COMMENT ON FUNCTION get_commissions_by_period(UUID, DATE, UUID) IS 'Obtiene comisiones filtradas por período y/o agente';
COMMENT ON FUNCTION get_commissions_summary(UUID, DATE) IS 'Resumen de comisiones pendientes vs cobradas';
