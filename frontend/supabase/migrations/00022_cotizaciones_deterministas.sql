-- =====================================================
-- MIGRACIÓN: Tabla de Cotizaciones Deterministas
-- Almacena el historial de cotizaciones del cotizador matemático
-- (diferente de las cotizaciones IA que usan otra tabla)
-- =====================================================

-- Crear tabla de cotizaciones deterministas
CREATE TABLE IF NOT EXISTS cotizaciones_deterministas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    
    -- Datos del cliente
    nombre_cliente VARCHAR(255) NOT NULL,
    nit_cliente VARCHAR(50),
    email_cliente VARCHAR(255),
    telefono_cliente VARCHAR(50),
    direccion_cliente TEXT,
    ciudad VARCHAR(100),
    actividad_economica VARCHAR(255),
    
    -- Ramo / Producto
    producto VARCHAR(50) NOT NULL CHECK (producto IN ('PYME', 'HOGAR', 'COPROPIEDAD', 'TRE')),
    
    -- Valores asegurados (JSONB para flexibilidad)
    valores_asegurados JSONB NOT NULL DEFAULT '{}',
    
    -- Resultados (JSONB con todas las aseguradoras cotizadas)
    resultados JSONB NOT NULL DEFAULT '[]',
    
    -- Mejor cotización (referencia rápida)
    mejor_aseguradora_id UUID REFERENCES aseguradoras(id),
    mejor_prima_total NUMERIC(15,2),
    
    -- Factores aplicados
    factor_zona NUMERIC(5,4) DEFAULT 1.0,
    factor_antiguedad NUMERIC(5,4) DEFAULT 1.0,
    factor_siniestros NUMERIC(5,4) DEFAULT 1.0,
    
    -- Metadatos
    status VARCHAR(50) DEFAULT 'completada',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_cotizaciones_det_tenant ON cotizaciones_deterministas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_det_producto ON cotizaciones_deterministas(producto);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_det_created ON cotizaciones_deterministas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_det_nombre ON cotizaciones_deterministas(nombre_cliente);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_cotizaciones_det_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cotizaciones_det_updated_at ON cotizaciones_deterministas;
CREATE TRIGGER trigger_cotizaciones_det_updated_at
    BEFORE UPDATE ON cotizaciones_deterministas
    FOR EACH ROW
    EXECUTE FUNCTION update_cotizaciones_det_updated_at();

-- RLS
ALTER TABLE cotizaciones_deterministas ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo ven cotizaciones de su tenant
CREATE POLICY "Usuarios ven cotizaciones de su tenant" ON cotizaciones_deterministas
    FOR SELECT
    USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Política: Los usuarios pueden crear cotizaciones en su tenant
CREATE POLICY "Usuarios crean cotizaciones en su tenant" ON cotizaciones_deterministas
    FOR INSERT
    WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Política: Los usuarios pueden actualizar cotizaciones de su tenant
CREATE POLICY "Usuarios actualizan cotizaciones de su tenant" ON cotizaciones_deterministas
    FOR UPDATE
    USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Comentarios
COMMENT ON TABLE cotizaciones_deterministas IS 'Historial de cotizaciones generadas por el motor de cálculo determinista';
COMMENT ON COLUMN cotizaciones_deterministas.producto IS 'Ramo de seguro: PYME, HOGAR, COPROPIEDAD, TRE';
COMMENT ON COLUMN cotizaciones_deterministas.valores_asegurados IS 'JSON con todos los valores asegurados ingresados';
COMMENT ON COLUMN cotizaciones_deterministas.resultados IS 'JSON con array de resultados por aseguradora';
