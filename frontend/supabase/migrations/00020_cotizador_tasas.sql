-- =====================================================
-- MIGRACIÓN: 00020_cotizador_tasas.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Tablas para el cotizador determinista con tasas
-- Versión: 2.0 — Marzo 2026
-- =====================================================

-- =====================================================
-- TABLA: aseguradoras
-- Catálogo de aseguradoras para el cotizador
-- (Diferente de insurance_companies para el cotizador específico)
-- =====================================================
CREATE TABLE IF NOT EXISTS aseguradoras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  nombre_corto VARCHAR(20) NOT NULL UNIQUE,
  color_primario VARCHAR(7) DEFAULT '#000000',
  activa_sistema BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aseguradoras_activa ON aseguradoras(activa_sistema);
CREATE INDEX IF NOT EXISTS idx_aseguradoras_orden ON aseguradoras(orden);

-- =====================================================
-- TABLA: cotizador_tasas
-- Tasas de cotización por aseguradora, producto y amparo
-- =====================================================
CREATE TABLE IF NOT EXISTS cotizador_tasas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aseguradora_id UUID NOT NULL REFERENCES aseguradoras(id) ON DELETE CASCADE,
  producto VARCHAR(20) NOT NULL CHECK (producto IN ('PYME', 'HOGAR', 'COPROPIEDAD', 'TRE')),
  amparo VARCHAR(30) NOT NULL CHECK (amparo IN (
    'incendio', 'terremoto', 'hmacc', 'hurtoCalif', 'hurtoSimple', 
    'hurtoDinero', 'eeeDanio', 'eeeMovil', 'rotMaq', 'rotVidrios', 
    'rce', 'transValores', 'mejorasLoc'
  )),
  tasa NUMERIC(10, 6) NOT NULL,
  base_calculo VARCHAR(30) NOT NULL CHECK (base_calculo IN (
    'VA_TOTAL_DM', 'CONTENIDOS', 'BIEN_ESPECIFICO', 'LIMITE_RC', 'PRESUPUESTO_ANUAL'
  )),
  deducible_texto VARCHAR(200),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(aseguradora_id, producto, amparo)
);

CREATE INDEX IF NOT EXISTS idx_cotizador_tasas_aseguradora ON cotizador_tasas(aseguradora_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_tasas_producto ON cotizador_tasas(producto);
CREATE INDEX IF NOT EXISTS idx_cotizador_tasas_amparo ON cotizador_tasas(amparo);
CREATE INDEX IF NOT EXISTS idx_cotizador_tasas_activo ON cotizador_tasas(activo);

-- =====================================================
-- TABLA: cotizador_factores
-- Factores de ajuste por zona, antigüedad, siniestros, etc.
-- =====================================================
CREATE TABLE IF NOT EXISTS cotizador_factores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('ZONA', 'ANTIGUEDAD', 'SINIESTROS', 'PISOS')),
  clave VARCHAR(50) NOT NULL,
  factor NUMERIC(5, 2) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tipo, clave)
);

CREATE INDEX IF NOT EXISTS idx_cotizador_factores_tipo ON cotizador_factores(tipo);
CREATE INDEX IF NOT EXISTS idx_cotizador_factores_activo ON cotizador_factores(activo);

-- =====================================================
-- TABLA: tenant_aseguradoras
-- Aseguradoras activadas por cada tenant para el cotizador
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_aseguradoras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  aseguradora_id UUID NOT NULL REFERENCES aseguradoras(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  codigo_agente VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, aseguradora_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_aseguradoras_tenant ON tenant_aseguradoras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_aseguradoras_aseguradora ON tenant_aseguradoras(aseguradora_id);

-- RLS para tenant_aseguradoras
ALTER TABLE tenant_aseguradoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant ve sus propias aseguradoras cotizador"
  ON tenant_aseguradoras FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

CREATE POLICY "Tenant gestiona sus propias aseguradoras cotizador"
  ON tenant_aseguradoras FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

-- =====================================================
-- TABLA: cotizaciones
-- Cotizaciones generadas por el cotizador determinista
-- =====================================================
CREATE TABLE IF NOT EXISTS cotizaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES users(id),
  client_id UUID REFERENCES clients(id),
  prospect_name VARCHAR(200),
  producto VARCHAR(20) NOT NULL CHECK (producto IN ('PYME', 'HOGAR', 'COPROPIEDAD', 'TRE')),
  
  -- Datos del cliente/riesgo
  datos_cliente JSONB DEFAULT '{}',
  valores_asegurados JSONB DEFAULT '{}',
  factores_aplicados JSONB DEFAULT '{}',
  
  -- Resultados
  resultados JSONB DEFAULT '[]',
  aseguradora_recomendada_id UUID REFERENCES aseguradoras(id),
  
  -- Estado
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'sent', 'accepted', 'rejected')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_tenant ON cotizaciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_agent ON cotizaciones(agent_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_client ON cotizaciones(client_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_producto ON cotizaciones(producto);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_status ON cotizaciones(status);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_created ON cotizaciones(created_at DESC);

-- RLS para cotizaciones
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant ve sus cotizaciones"
  ON cotizaciones FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

CREATE POLICY "Tenant crea cotizaciones"
  ON cotizaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

CREATE POLICY "Tenant actualiza sus cotizaciones"
  ON cotizaciones FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

CREATE POLICY "Tenant elimina sus cotizaciones"
  ON cotizaciones FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================
COMMENT ON TABLE aseguradoras IS 'Catálogo de aseguradoras para el cotizador determinista';
COMMENT ON TABLE cotizador_tasas IS 'Tasas de cotización por aseguradora, producto y amparo';
COMMENT ON TABLE cotizador_factores IS 'Factores de ajuste por zona, antigüedad, siniestros, pisos';
COMMENT ON TABLE tenant_aseguradoras IS 'Aseguradoras activadas por cada tenant para el cotizador';
COMMENT ON TABLE cotizaciones IS 'Cotizaciones generadas por el cotizador determinista';

-- =====================================================
-- DATOS INICIALES: Aseguradoras
-- =====================================================
INSERT INTO aseguradoras (nombre, nombre_corto, color_primario, activa_sistema, orden) VALUES
  ('AXA Colpatria',     'AXA',      '#D0021B', true,  1),
  ('Suramericana',      'SURA',     '#007B40', true,  2),
  ('La Equidad',        'EQUIDAD',  '#F5A623', true,  3),
  ('Seguros del Estado','ESTADO',   '#1A3C6E', true,  4),
  ('HDI Seguros',       'HDI',      '#E30613', true,  5),
  ('Bolívar',           'BOLIVAR',  '#003087', true,  6),
  ('MAPFRE',            'MAPFRE',   '#E2001A', true,  7),
  ('Solidaria',         'SOLIDARIA','#0055A5', true,  8),
  ('BBVA Seguros',      'BBVA',     '#004B9B', true,  9),
  ('Zurich',            'ZURICH',   '#003781', true, 10),
  ('Allianz',           'ALLIANZ',  '#003781', true, 11),
  ('Mundial',           'MUNDIAL',  '#005DAA', true, 12)
ON CONFLICT (nombre_corto) DO NOTHING;

-- =====================================================
-- DATOS INICIALES: Factores de ajuste
-- =====================================================
INSERT INTO cotizador_factores (tipo, clave, factor) VALUES
-- ZONA
('ZONA','Bogotá D.C.',            1.00),
('ZONA','Medellín',               0.98),
('ZONA','Cali',                   1.05),
('ZONA','Barranquilla',           1.08),
('ZONA','Cartagena',              1.12),
('ZONA','Bucaramanga',            0.95),
('ZONA','Pereira / Eje Cafetero', 1.10),
('ZONA','Manizales',              1.15),
('ZONA','Cúcuta',                 1.05),
('ZONA','Ibagué',                 1.08),
('ZONA','Santa Marta',            1.10),
('ZONA','Villavicencio',          1.15),
('ZONA','Otra ciudad principal',  1.05),
('ZONA','Municipio / Zona rural', 1.20),
-- ANTIGUEDAD
('ANTIGUEDAD','Menos de 5 años',  0.90),
('ANTIGUEDAD','5 a 10 años',      0.95),
('ANTIGUEDAD','11 a 20 años',     1.00),
('ANTIGUEDAD','21 a 30 años',     1.10),
('ANTIGUEDAD','31 a 40 años',     1.20),
('ANTIGUEDAD','Más de 40 años',   1.35),
-- SINIESTROS
('SINIESTROS','Sin siniestros',          1.00),
('SINIESTROS','1 siniestro menor',       1.10),
('SINIESTROS','2 siniestros',            1.25),
('SINIESTROS','3 o más siniestros',      1.50),
('SINIESTROS','Siniestro mayor (>$50M)', 1.75),
-- PISOS
('PISOS','1 piso',          0.95),
('PISOS','2 a 3 pisos',     1.00),
('PISOS','4 a 6 pisos',     1.05),
('PISOS','7 a 10 pisos',    1.10),
('PISOS','Más de 10 pisos', 1.20)
ON CONFLICT (tipo, clave) DO NOTHING;
