-- =====================================================
-- MIGRACIÓN: 00004_reports.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Módulo 04: Reportes y Analytics
-- =====================================================

-- =====================================================
-- FUNCIÓN: get_executive_dashboard
-- Dashboard ejecutivo con KPIs principales
-- =====================================================
CREATE OR REPLACE FUNCTION get_executive_dashboard(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  active_policies_count BIGINT,
  total_premium_month NUMERIC,
  open_claims_count BIGINT,
  renewals_next_30_days BIGINT,
  pending_commissions_total NUMERIC,
  -- Comparativas mes anterior
  active_policies_prev BIGINT,
  total_premium_prev NUMERIC,
  open_claims_prev BIGINT
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_prev_start_date DATE;
  v_prev_end_date DATE;
BEGIN
  -- Establecer fechas por defecto (mes actual)
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);
  v_start_date := COALESCE(p_start_date, date_trunc('month', v_end_date)::DATE);
  
  -- Fechas del mes anterior para comparación
  v_prev_end_date := v_start_date - INTERVAL '1 day';
  v_prev_start_date := date_trunc('month', v_prev_end_date)::DATE;

  RETURN QUERY
  SELECT
    -- Pólizas activas actuales
    (SELECT COUNT(*) FROM policies 
     WHERE tenant_id = p_tenant_id AND status = 'activa')::BIGINT,
    
    -- Prima total del período
    COALESCE((SELECT SUM(premium) FROM policies 
     WHERE tenant_id = p_tenant_id 
     AND status = 'activa'
     AND created_at::DATE BETWEEN v_start_date AND v_end_date), 0)::NUMERIC,
    
    -- Siniestros abiertos
    (SELECT COUNT(*) FROM claims 
     WHERE tenant_id = p_tenant_id 
     AND status NOT IN ('resolved', 'closed'))::BIGINT,
    
    -- Renovaciones próximos 30 días
    (SELECT COUNT(*) FROM policies 
     WHERE tenant_id = p_tenant_id 
     AND status = 'activa'
     AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::BIGINT,
    
    -- Comisiones pendientes (pólizas activas)
    COALESCE((SELECT SUM(premium * commission_pct / 100) FROM policies 
     WHERE tenant_id = p_tenant_id 
     AND status = 'activa'), 0)::NUMERIC,
    
    -- Pólizas activas mes anterior
    (SELECT COUNT(*) FROM policies 
     WHERE tenant_id = p_tenant_id 
     AND status = 'activa'
     AND created_at::DATE <= v_prev_end_date)::BIGINT,
    
    -- Prima mes anterior
    COALESCE((SELECT SUM(premium) FROM policies 
     WHERE tenant_id = p_tenant_id 
     AND status = 'activa'
     AND created_at::DATE BETWEEN v_prev_start_date AND v_prev_end_date), 0)::NUMERIC,
    
    -- Siniestros abiertos mes anterior
    (SELECT COUNT(*) FROM claims 
     WHERE tenant_id = p_tenant_id 
     AND created_at::DATE <= v_prev_end_date
     AND status NOT IN ('resolved', 'closed'))::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: get_agent_performance
-- Rendimiento por agente
-- =====================================================
CREATE OR REPLACE FUNCTION get_agent_performance(
  p_tenant_id UUID,
  p_agent_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  agent_id UUID,
  agent_name TEXT,
  policies_created_month BIGINT,
  total_premium NUMERIC,
  pipeline_total BIGINT,
  pipeline_won_month BIGINT,
  close_rate NUMERIC,
  commissions_earned_month NUMERIC
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);
  v_start_date := COALESCE(p_start_date, date_trunc('month', v_end_date)::DATE);

  RETURN QUERY
  SELECT
    u.id AS agent_id,
    u.full_name AS agent_name,
    -- Pólizas creadas en el período
    COALESCE((
      SELECT COUNT(*) FROM policies p 
      JOIN clients c ON c.id = p.client_id 
      WHERE p.tenant_id = p_tenant_id 
      AND c.agent_id = u.id
      AND p.created_at::DATE BETWEEN v_start_date AND v_end_date
    ), 0)::BIGINT AS policies_created_month,
    -- Prima total generada
    COALESCE((
      SELECT SUM(p.premium) FROM policies p 
      JOIN clients c ON c.id = p.client_id 
      WHERE p.tenant_id = p_tenant_id 
      AND c.agent_id = u.id
      AND p.status = 'activa'
    ), 0)::NUMERIC AS total_premium,
    -- Oportunidades totales activas
    COALESCE((
      SELECT COUNT(*) FROM opportunities o 
      WHERE o.tenant_id = p_tenant_id 
      AND o.agent_id = u.id
      AND o.status = 'active'
    ), 0)::BIGINT AS pipeline_total,
    -- Oportunidades ganadas en el período
    COALESCE((
      SELECT COUNT(*) FROM opportunities o 
      WHERE o.tenant_id = p_tenant_id 
      AND o.agent_id = u.id
      AND o.status = 'won'
      AND o.won_at::DATE BETWEEN v_start_date AND v_end_date
    ), 0)::BIGINT AS pipeline_won_month,
    -- Tasa de cierre
    CASE 
      WHEN (SELECT COUNT(*) FROM opportunities o 
            WHERE o.tenant_id = p_tenant_id AND o.agent_id = u.id) = 0 
      THEN 0
      ELSE ROUND(
        (SELECT COUNT(*) FROM opportunities o 
         WHERE o.tenant_id = p_tenant_id AND o.agent_id = u.id AND o.status = 'won')::NUMERIC /
        NULLIF((SELECT COUNT(*) FROM opportunities o 
         WHERE o.tenant_id = p_tenant_id AND o.agent_id = u.id), 0) * 100, 2
      )
    END::NUMERIC AS close_rate,
    -- Comisiones del período
    COALESCE((
      SELECT SUM(p.premium * p.commission_pct / 100) FROM policies p 
      JOIN clients c ON c.id = p.client_id 
      WHERE p.tenant_id = p_tenant_id 
      AND c.agent_id = u.id
      AND p.status = 'activa'
      AND p.created_at::DATE BETWEEN v_start_date AND v_end_date
    ), 0)::NUMERIC AS commissions_earned_month
  FROM users u
  WHERE u.tenant_id = p_tenant_id
  AND u.role IN ('agent', 'senior_agent', 'admin')
  AND u.is_active = true
  AND (p_agent_id IS NULL OR u.id = p_agent_id)
  ORDER BY total_premium DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: get_portfolio_analysis
-- Análisis de cartera
-- =====================================================
CREATE OR REPLACE FUNCTION get_portfolio_analysis(
  p_tenant_id UUID,
  p_line TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  -- Por ramo
  line TEXT,
  line_count BIGINT,
  line_premium NUMERIC,
  line_percentage NUMERIC,
  -- Por aseguradora
  insurer TEXT,
  insurer_count BIGINT,
  insurer_premium NUMERIC,
  insurer_percentage NUMERIC
) AS $$
BEGIN
  -- Esta función retorna datos agregados por ramo y aseguradora
  RETURN QUERY
  WITH policy_totals AS (
    SELECT 
      SUM(premium) as total_premium,
      COUNT(*) as total_count
    FROM policies
    WHERE tenant_id = p_tenant_id AND status = 'activa'
  ),
  by_line AS (
    SELECT 
      p.line::TEXT as line,
      COUNT(*) as line_count,
      COALESCE(SUM(p.premium), 0) as line_premium,
      ROUND(COALESCE(SUM(p.premium), 0) / NULLIF((SELECT total_premium FROM policy_totals), 0) * 100, 2) as line_percentage
    FROM policies p
    WHERE p.tenant_id = p_tenant_id 
    AND p.status = 'activa'
    AND (p_line IS NULL OR p.line::TEXT = p_line)
    GROUP BY p.line
  ),
  by_insurer AS (
    SELECT 
      p.insurer as insurer,
      COUNT(*) as insurer_count,
      COALESCE(SUM(p.premium), 0) as insurer_premium,
      ROUND(COALESCE(SUM(p.premium), 0) / NULLIF((SELECT total_premium FROM policy_totals), 0) * 100, 2) as insurer_percentage
    FROM policies p
    WHERE p.tenant_id = p_tenant_id 
    AND p.status = 'activa'
    AND (p_line IS NULL OR p.line::TEXT = p_line)
    GROUP BY p.insurer
  )
  SELECT 
    l.line,
    l.line_count,
    l.line_premium,
    l.line_percentage,
    i.insurer,
    i.insurer_count,
    i.insurer_premium,
    i.insurer_percentage
  FROM by_line l
  FULL OUTER JOIN by_insurer i ON 1=1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: get_portfolio_by_line
-- Distribución por ramo
-- =====================================================
CREATE OR REPLACE FUNCTION get_portfolio_by_line(p_tenant_id UUID)
RETURNS TABLE (
  line TEXT,
  count BIGINT,
  premium NUMERIC,
  percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH totals AS (
    SELECT COALESCE(SUM(premium), 0) as total_premium
    FROM policies
    WHERE tenant_id = p_tenant_id AND status = 'activa'
  )
  SELECT 
    p.line::TEXT,
    COUNT(*)::BIGINT,
    COALESCE(SUM(p.premium), 0)::NUMERIC,
    ROUND(COALESCE(SUM(p.premium), 0) / NULLIF((SELECT total_premium FROM totals), 0) * 100, 2)::NUMERIC
  FROM policies p
  WHERE p.tenant_id = p_tenant_id AND p.status = 'activa'
  GROUP BY p.line
  ORDER BY SUM(p.premium) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: get_portfolio_by_insurer
-- Distribución por aseguradora
-- =====================================================
CREATE OR REPLACE FUNCTION get_portfolio_by_insurer(p_tenant_id UUID)
RETURNS TABLE (
  insurer TEXT,
  count BIGINT,
  premium NUMERIC,
  percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH totals AS (
    SELECT COALESCE(SUM(premium), 0) as total_premium
    FROM policies
    WHERE tenant_id = p_tenant_id AND status = 'activa'
  )
  SELECT 
    p.insurer,
    COUNT(*)::BIGINT,
    COALESCE(SUM(p.premium), 0)::NUMERIC,
    ROUND(COALESCE(SUM(p.premium), 0) / NULLIF((SELECT total_premium FROM totals), 0) * 100, 2)::NUMERIC
  FROM policies p
  WHERE p.tenant_id = p_tenant_id AND p.status = 'activa'
  GROUP BY p.insurer
  ORDER BY SUM(p.premium) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: get_premium_trend
-- Tendencia de primas por mes (últimos 12 meses)
-- =====================================================
CREATE OR REPLACE FUNCTION get_premium_trend(p_tenant_id UUID)
RETURNS TABLE (
  month TEXT,
  month_date DATE,
  premium NUMERIC,
  policies_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', CURRENT_DATE - INTERVAL '11 months'),
      date_trunc('month', CURRENT_DATE),
      '1 month'::INTERVAL
    )::DATE as month_start
  )
  SELECT 
    to_char(m.month_start, 'Mon YYYY') as month,
    m.month_start as month_date,
    COALESCE(SUM(p.premium), 0)::NUMERIC as premium,
    COUNT(p.id)::BIGINT as policies_count
  FROM months m
  LEFT JOIN policies p ON 
    p.tenant_id = p_tenant_id 
    AND p.status = 'activa'
    AND date_trunc('month', p.created_at)::DATE = m.month_start
  GROUP BY m.month_start
  ORDER BY m.month_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: get_claims_analytics
-- Análisis de siniestros
-- =====================================================
CREATE OR REPLACE FUNCTION get_claims_analytics(p_tenant_id UUID)
RETURNS TABLE (
  total_claims BIGINT,
  open_claims BIGINT,
  resolved_claims BIGINT,
  avg_claimed_amount NUMERIC,
  avg_approved_amount NUMERIC,
  total_claimed NUMERIC,
  total_approved NUMERIC,
  loss_ratio NUMERIC,
  claims_by_status JSONB,
  claims_by_line JSONB
) AS $$
DECLARE
  v_total_premium NUMERIC;
BEGIN
  -- Obtener prima total de pólizas activas
  SELECT COALESCE(SUM(premium), 0) INTO v_total_premium
  FROM policies
  WHERE tenant_id = p_tenant_id AND status = 'activa';

  RETURN QUERY
  SELECT
    -- Total de siniestros
    (SELECT COUNT(*) FROM claims WHERE tenant_id = p_tenant_id)::BIGINT,
    -- Siniestros abiertos
    (SELECT COUNT(*) FROM claims WHERE tenant_id = p_tenant_id AND status NOT IN ('resolved', 'closed'))::BIGINT,
    -- Siniestros resueltos
    (SELECT COUNT(*) FROM claims WHERE tenant_id = p_tenant_id AND status IN ('resolved', 'closed'))::BIGINT,
    -- Promedio monto reclamado
    COALESCE((SELECT AVG(claimed_amount) FROM claims WHERE tenant_id = p_tenant_id), 0)::NUMERIC,
    -- Promedio monto aprobado
    COALESCE((SELECT AVG(approved_amount) FROM claims WHERE tenant_id = p_tenant_id AND approved_amount IS NOT NULL), 0)::NUMERIC,
    -- Total reclamado
    COALESCE((SELECT SUM(claimed_amount) FROM claims WHERE tenant_id = p_tenant_id), 0)::NUMERIC,
    -- Total aprobado
    COALESCE((SELECT SUM(approved_amount) FROM claims WHERE tenant_id = p_tenant_id AND approved_amount IS NOT NULL), 0)::NUMERIC,
    -- Loss ratio (aprobado / prima total)
    CASE 
      WHEN v_total_premium = 0 THEN 0
      ELSE ROUND(COALESCE((SELECT SUM(approved_amount) FROM claims WHERE tenant_id = p_tenant_id), 0) / v_total_premium * 100, 2)
    END::NUMERIC,
    -- Por estado
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('status', status::TEXT, 'count', cnt))
       FROM (SELECT status, COUNT(*) as cnt FROM claims WHERE tenant_id = p_tenant_id GROUP BY status) s),
      '[]'::JSONB
    ),
    -- Por ramo
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('line', line::TEXT, 'count', cnt, 'amount', amt))
       FROM (
         SELECT p.line, COUNT(*) as cnt, COALESCE(SUM(c.claimed_amount), 0) as amt
         FROM claims c
         JOIN policies p ON p.id = c.policy_id
         WHERE c.tenant_id = p_tenant_id
         GROUP BY p.line
       ) l),
      '[]'::JSONB
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: get_renewal_report
-- Reporte de renovaciones
-- =====================================================
CREATE OR REPLACE FUNCTION get_renewal_report(
  p_tenant_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  policy_id UUID,
  policy_number TEXT,
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  insurer TEXT,
  line TEXT,
  premium NUMERIC,
  commission NUMERIC,
  end_date DATE,
  days_remaining INTEGER,
  renewal_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as policy_id,
    p.policy_number,
    c.id as client_id,
    c.full_name as client_name,
    c.email as client_email,
    c.phone as client_phone,
    p.insurer,
    p.line::TEXT,
    p.premium,
    (p.premium * p.commission_pct / 100)::NUMERIC as commission,
    p.end_date::DATE,
    (p.end_date - CURRENT_DATE)::INTEGER as days_remaining,
    CASE
      -- Verificar si ya hay una oportunidad de renovación creada
      WHEN EXISTS (
        SELECT 1 FROM opportunities o 
        WHERE o.client_id = c.id 
        AND o.tenant_id = p_tenant_id
        AND o.status = 'active'
        AND o.notes LIKE '%renovación%'
      ) THEN 'en_contacto'
      -- Verificar si ya se renovó
      WHEN EXISTS (
        SELECT 1 FROM policies p2 
        WHERE p2.client_id = c.id 
        AND p2.tenant_id = p_tenant_id
        AND p2.line = p.line
        AND p2.start_date > p.end_date
        AND p2.status IN ('activa', 'cotizacion')
      ) THEN 'renovado'
      ELSE 'sin_gestion'
    END as renewal_status
  FROM policies p
  JOIN clients c ON c.id = p.client_id
  WHERE p.tenant_id = p_tenant_id
  AND p.status = 'activa'
  AND p.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days || ' days')::INTERVAL
  ORDER BY p.end_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: get_commissions_report
-- Reporte de comisiones
-- =====================================================
CREATE OR REPLACE FUNCTION get_commissions_report(
  p_tenant_id UUID,
  p_agent_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  policy_id UUID,
  policy_number TEXT,
  client_name TEXT,
  insurer TEXT,
  line TEXT,
  premium NUMERIC,
  commission_pct NUMERIC,
  commission_amount NUMERIC,
  policy_status TEXT,
  created_at TIMESTAMPTZ,
  agent_id UUID,
  agent_name TEXT
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_end_date := COALESCE(p_end_date, CURRENT_DATE);
  v_start_date := COALESCE(p_start_date, date_trunc('month', v_end_date)::DATE);

  RETURN QUERY
  SELECT
    p.id as policy_id,
    p.policy_number,
    c.full_name as client_name,
    p.insurer,
    p.line::TEXT,
    p.premium,
    p.commission_pct,
    (p.premium * p.commission_pct / 100)::NUMERIC as commission_amount,
    p.status::TEXT as policy_status,
    p.created_at,
    c.agent_id,
    u.full_name as agent_name
  FROM policies p
  JOIN clients c ON c.id = p.client_id
  LEFT JOIN users u ON u.id = c.agent_id
  WHERE p.tenant_id = p_tenant_id
  AND p.status = 'activa'
  AND p.created_at::DATE BETWEEN v_start_date AND v_end_date
  AND (p_agent_id IS NULL OR c.agent_id = p_agent_id)
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================
COMMENT ON FUNCTION get_executive_dashboard(UUID, DATE, DATE) IS 'Dashboard ejecutivo con KPIs principales del tenant';
COMMENT ON FUNCTION get_agent_performance(UUID, UUID, DATE, DATE) IS 'Rendimiento de agentes con métricas de ventas y conversión';
COMMENT ON FUNCTION get_portfolio_by_line(UUID) IS 'Distribución de cartera por ramo/línea de seguro';
COMMENT ON FUNCTION get_portfolio_by_insurer(UUID) IS 'Distribución de cartera por aseguradora';
COMMENT ON FUNCTION get_premium_trend(UUID) IS 'Tendencia de primas mensuales últimos 12 meses';
COMMENT ON FUNCTION get_claims_analytics(UUID) IS 'Análisis completo de siniestros con métricas y distribuciones';
COMMENT ON FUNCTION get_renewal_report(UUID, INTEGER) IS 'Reporte de pólizas por vencer con estado de gestión';
COMMENT ON FUNCTION get_commissions_report(UUID, UUID, DATE, DATE) IS 'Reporte detallado de comisiones por póliza';
