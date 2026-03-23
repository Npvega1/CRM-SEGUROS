-- =====================================================
-- MIGRACIÓN SQL - Módulo 09: Comparativos con IA
-- Tablas: comparisons, comparison_files, comparison_criteria, usage_logs
-- =====================================================

-- =====================================================
-- TABLA: comparison_criteria
-- Criterios de comparación por ramo
-- =====================================================
CREATE TABLE IF NOT EXISTS comparison_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    line VARCHAR(20) NOT NULL CHECK (line IN ('vida', 'auto', 'salud', 'hogar', 'soat', 'otro')),
    criteria_name VARCHAR(100) NOT NULL,
    order_index SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, line, criteria_name)
);

-- Índices para comparison_criteria
CREATE INDEX IF NOT EXISTS idx_comparison_criteria_tenant_line 
    ON comparison_criteria(tenant_id, line);

-- RLS para comparison_criteria
ALTER TABLE comparison_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY comparison_criteria_tenant_isolation ON comparison_criteria
    FOR ALL USING (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

-- =====================================================
-- TABLA: comparisons
-- Comparativos de cotizaciones generados por IA
-- =====================================================
CREATE TABLE IF NOT EXISTS comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    line VARCHAR(20) NOT NULL CHECK (line IN ('vida', 'auto', 'salud', 'hogar', 'soat', 'otro')),
    source_files JSONB DEFAULT '[]'::jsonb,
    extracted_data JSONB DEFAULT NULL,
    comparison_table JSONB DEFAULT NULL,
    ai_recommendation TEXT DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'processing' 
        CHECK (status IN ('processing', 'ready', 'error', 'exported')),
    error_message TEXT DEFAULT NULL,
    pdf_url TEXT DEFAULT NULL,
    xlsx_url TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para comparisons
CREATE INDEX IF NOT EXISTS idx_comparisons_tenant ON comparisons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_client ON comparisons(client_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_agent ON comparisons(agent_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_status ON comparisons(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_comparisons_created ON comparisons(tenant_id, created_at DESC);

-- RLS para comparisons
ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY comparisons_tenant_isolation ON comparisons
    FOR ALL USING (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

-- Trigger para updated_at en comparisons
CREATE OR REPLACE FUNCTION update_comparisons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_comparisons_updated_at ON comparisons;
CREATE TRIGGER trigger_comparisons_updated_at
    BEFORE UPDATE ON comparisons
    FOR EACH ROW
    EXECUTE FUNCTION update_comparisons_updated_at();

-- =====================================================
-- TABLA: comparison_files
-- Archivos de cotización subidos para comparar
-- =====================================================
CREATE TABLE IF NOT EXISTS comparison_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comparison_id UUID NOT NULL REFERENCES comparisons(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    original_name VARCHAR(200) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('pdf', 'docx')),
    extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (extraction_status IN ('pending', 'processing', 'done', 'error')),
    extracted_text TEXT DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para comparison_files
CREATE INDEX IF NOT EXISTS idx_comparison_files_comparison 
    ON comparison_files(comparison_id);
CREATE INDEX IF NOT EXISTS idx_comparison_files_tenant 
    ON comparison_files(tenant_id);

-- RLS para comparison_files
ALTER TABLE comparison_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY comparison_files_tenant_isolation ON comparison_files
    FOR ALL USING (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

-- =====================================================
-- TABLA: usage_logs
-- Control de uso mensual por feature
-- =====================================================
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature VARCHAR(50) NOT NULL,
    count_date DATE NOT NULL DEFAULT CURRENT_DATE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, feature, count_date)
);

-- Índices para usage_logs
CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_feature 
    ON usage_logs(tenant_id, feature, count_date);

-- RLS para usage_logs
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_logs_tenant_isolation ON usage_logs
    FOR ALL USING (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

-- =====================================================
-- FUNCIÓN: increment_usage
-- Incrementa el contador de uso para una feature
-- =====================================================
CREATE OR REPLACE FUNCTION increment_usage(
    p_tenant_id UUID,
    p_feature VARCHAR(50)
)
RETURNS INTEGER AS $$
DECLARE
    v_current_count INTEGER;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Insertar o actualizar el contador
    INSERT INTO usage_logs (tenant_id, feature, count_date, usage_count)
    VALUES (p_tenant_id, p_feature, v_today, 1)
    ON CONFLICT (tenant_id, feature, count_date)
    DO UPDATE SET usage_count = usage_logs.usage_count + 1
    RETURNING usage_count INTO v_current_count;
    
    RETURN v_current_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: get_monthly_usage
-- Obtiene el uso del mes actual para una feature
-- =====================================================
CREATE OR REPLACE FUNCTION get_monthly_usage(
    p_tenant_id UUID,
    p_feature VARCHAR(50)
)
RETURNS INTEGER AS $$
DECLARE
    v_total INTEGER;
BEGIN
    SELECT COALESCE(SUM(usage_count), 0) INTO v_total
    FROM usage_logs
    WHERE tenant_id = p_tenant_id
      AND feature = p_feature
      AND count_date >= DATE_TRUNC('month', CURRENT_DATE)
      AND count_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INSERTAR CRITERIOS POR DEFECTO
-- Se ejecuta por cada tenant existente
-- =====================================================
DO $$
DECLARE
    tenant_record RECORD;
BEGIN
    FOR tenant_record IN SELECT id FROM tenants LOOP
        -- Vida
        INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
        VALUES 
            (tenant_record.id, 'vida', 'Prima Anual', 1),
            (tenant_record.id, 'vida', 'Suma Asegurada', 2),
            (tenant_record.id, 'vida', 'Cobertura Principal', 3),
            (tenant_record.id, 'vida', 'Beneficiarios', 4),
            (tenant_record.id, 'vida', 'Exclusiones', 5),
            (tenant_record.id, 'vida', 'Vigencia', 6)
        ON CONFLICT (tenant_id, line, criteria_name) DO NOTHING;
        
        -- Auto
        INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
        VALUES 
            (tenant_record.id, 'auto', 'Prima Anual', 1),
            (tenant_record.id, 'auto', 'Valor Asegurado', 2),
            (tenant_record.id, 'auto', 'Cobertura Daños', 3),
            (tenant_record.id, 'auto', 'Responsabilidad Civil', 4),
            (tenant_record.id, 'auto', 'Deducible', 5),
            (tenant_record.id, 'auto', 'Asistencia', 6)
        ON CONFLICT (tenant_id, line, criteria_name) DO NOTHING;
        
        -- Salud
        INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
        VALUES 
            (tenant_record.id, 'salud', 'Prima Mensual', 1),
            (tenant_record.id, 'salud', 'Cobertura Hospitalaria', 2),
            (tenant_record.id, 'salud', 'Cobertura Ambulatoria', 3),
            (tenant_record.id, 'salud', 'Red de Clínicas', 4),
            (tenant_record.id, 'salud', 'Copago', 5),
            (tenant_record.id, 'salud', 'Preexistencias', 6)
        ON CONFLICT (tenant_id, line, criteria_name) DO NOTHING;
        
        -- Hogar
        INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
        VALUES 
            (tenant_record.id, 'hogar', 'Prima Anual', 1),
            (tenant_record.id, 'hogar', 'Valor Edificación', 2),
            (tenant_record.id, 'hogar', 'Valor Contenido', 3),
            (tenant_record.id, 'hogar', 'Cobertura Incendio', 4),
            (tenant_record.id, 'hogar', 'Robo/Hurto', 5),
            (tenant_record.id, 'hogar', 'Responsabilidad Civil', 6)
        ON CONFLICT (tenant_id, line, criteria_name) DO NOTHING;
        
        -- SOAT
        INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
        VALUES 
            (tenant_record.id, 'soat', 'Prima', 1),
            (tenant_record.id, 'soat', 'Cobertura Médica', 2),
            (tenant_record.id, 'soat', 'Gastos Funerarios', 3),
            (tenant_record.id, 'soat', 'Incapacidad', 4),
            (tenant_record.id, 'soat', 'Vigencia', 5),
            (tenant_record.id, 'soat', 'Aseguradora', 6)
        ON CONFLICT (tenant_id, line, criteria_name) DO NOTHING;
        
        -- Otro
        INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
        VALUES 
            (tenant_record.id, 'otro', 'Prima', 1),
            (tenant_record.id, 'otro', 'Cobertura Principal', 2),
            (tenant_record.id, 'otro', 'Deducible', 3),
            (tenant_record.id, 'otro', 'Exclusiones', 4),
            (tenant_record.id, 'otro', 'Vigencia', 5),
            (tenant_record.id, 'otro', 'Condiciones Especiales', 6)
        ON CONFLICT (tenant_id, line, criteria_name) DO NOTHING;
    END LOOP;
END $$;

-- =====================================================
-- TRIGGER: crear criterios para nuevos tenants
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_comparison_criteria()
RETURNS TRIGGER AS $$
BEGIN
    -- Vida
    INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
    VALUES 
        (NEW.id, 'vida', 'Prima Anual', 1),
        (NEW.id, 'vida', 'Suma Asegurada', 2),
        (NEW.id, 'vida', 'Cobertura Principal', 3),
        (NEW.id, 'vida', 'Beneficiarios', 4),
        (NEW.id, 'vida', 'Exclusiones', 5),
        (NEW.id, 'vida', 'Vigencia', 6);
    
    -- Auto
    INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
    VALUES 
        (NEW.id, 'auto', 'Prima Anual', 1),
        (NEW.id, 'auto', 'Valor Asegurado', 2),
        (NEW.id, 'auto', 'Cobertura Daños', 3),
        (NEW.id, 'auto', 'Responsabilidad Civil', 4),
        (NEW.id, 'auto', 'Deducible', 5),
        (NEW.id, 'auto', 'Asistencia', 6);
    
    -- Salud
    INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
    VALUES 
        (NEW.id, 'salud', 'Prima Mensual', 1),
        (NEW.id, 'salud', 'Cobertura Hospitalaria', 2),
        (NEW.id, 'salud', 'Cobertura Ambulatoria', 3),
        (NEW.id, 'salud', 'Red de Clínicas', 4),
        (NEW.id, 'salud', 'Copago', 5),
        (NEW.id, 'salud', 'Preexistencias', 6);
    
    -- Hogar
    INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
    VALUES 
        (NEW.id, 'hogar', 'Prima Anual', 1),
        (NEW.id, 'hogar', 'Valor Edificación', 2),
        (NEW.id, 'hogar', 'Valor Contenido', 3),
        (NEW.id, 'hogar', 'Cobertura Incendio', 4),
        (NEW.id, 'hogar', 'Robo/Hurto', 5),
        (NEW.id, 'hogar', 'Responsabilidad Civil', 6);
    
    -- SOAT
    INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
    VALUES 
        (NEW.id, 'soat', 'Prima', 1),
        (NEW.id, 'soat', 'Cobertura Médica', 2),
        (NEW.id, 'soat', 'Gastos Funerarios', 3),
        (NEW.id, 'soat', 'Incapacidad', 4),
        (NEW.id, 'soat', 'Vigencia', 5),
        (NEW.id, 'soat', 'Aseguradora', 6);
    
    -- Otro
    INSERT INTO comparison_criteria (tenant_id, line, criteria_name, order_index)
    VALUES 
        (NEW.id, 'otro', 'Prima', 1),
        (NEW.id, 'otro', 'Cobertura Principal', 2),
        (NEW.id, 'otro', 'Deducible', 3),
        (NEW.id, 'otro', 'Exclusiones', 4),
        (NEW.id, 'otro', 'Vigencia', 5),
        (NEW.id, 'otro', 'Condiciones Especiales', 6);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_comparison_criteria ON tenants;
CREATE TRIGGER trigger_create_comparison_criteria
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION create_default_comparison_criteria();

-- =====================================================
-- Comentarios de documentación
-- =====================================================
COMMENT ON TABLE comparisons IS 'Comparativos de cotizaciones generados con IA - Módulo 09';
COMMENT ON TABLE comparison_files IS 'Archivos de cotización para comparativos';
COMMENT ON TABLE comparison_criteria IS 'Criterios de comparación configurables por ramo';
COMMENT ON TABLE usage_logs IS 'Control de uso mensual por feature';
COMMENT ON FUNCTION increment_usage IS 'Incrementa el contador de uso para una feature';
COMMENT ON FUNCTION get_monthly_usage IS 'Obtiene el uso del mes actual para una feature';
