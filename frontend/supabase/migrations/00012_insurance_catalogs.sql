-- =====================================================
-- MIGRACIÓN: 00012_insurance_catalogs.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Catálogos globales de Compañías, Ramos y Grupos
-- =====================================================

-- =====================================================
-- TIPOS ENUM
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insurance_unit') THEN
    CREATE TYPE insurance_unit AS ENUM ('generales', 'vida');
  END IF;
END$$;

-- =====================================================
-- TABLA: insurance_companies
-- Catálogo global de compañías de seguros
-- =====================================================
CREATE TABLE IF NOT EXISTS insurance_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_companies_slug ON insurance_companies(slug);
CREATE INDEX IF NOT EXISTS idx_insurance_companies_active ON insurance_companies(is_active);

-- =====================================================
-- TABLA: insurance_lines
-- Catálogo global de ramos de seguro
-- =====================================================
CREATE TABLE IF NOT EXISTS insurance_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  unit insurance_unit NOT NULL,
  is_active BOOLEAN DEFAULT true,
  has_ai_prompt BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_lines_slug ON insurance_lines(slug);
CREATE INDEX IF NOT EXISTS idx_insurance_lines_unit ON insurance_lines(unit);
CREATE INDEX IF NOT EXISTS idx_insurance_lines_active ON insurance_lines(is_active);

-- =====================================================
-- TABLA: insurance_groups
-- Catálogo global de grupos/productos
-- =====================================================
CREATE TABLE IF NOT EXISTS insurance_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  line_id UUID NOT NULL REFERENCES insurance_lines(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(slug, line_id)
);

CREATE INDEX IF NOT EXISTS idx_insurance_groups_line ON insurance_groups(line_id);
CREATE INDEX IF NOT EXISTS idx_insurance_groups_active ON insurance_groups(is_active);

-- =====================================================
-- TABLA: company_lines
-- Relación entre compañías y ramos disponibles
-- =====================================================
CREATE TABLE IF NOT EXISTS company_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES insurance_companies(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES insurance_lines(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, line_id)
);

CREATE INDEX IF NOT EXISTS idx_company_lines_company ON company_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_company_lines_line ON company_lines(line_id);

-- =====================================================
-- TABLA: tenant_companies
-- Compañías activadas por cada tenant
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES insurance_companies(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  company_code VARCHAR(100), -- Clave/código del tenant con esta compañía
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_companies_tenant ON tenant_companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_companies_company ON tenant_companies(company_id);

-- RLS para tenant_companies
ALTER TABLE tenant_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant ve sus propias compañías"
  ON tenant_companies FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

CREATE POLICY "Tenant gestiona sus propias compañías"
  ON tenant_companies FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

-- =====================================================
-- DATOS INICIALES: Ramos de seguro
-- =====================================================
INSERT INTO insurance_lines (name, slug, unit, display_order) VALUES
  ('Automóviles', 'automoviles', 'generales', 1),
  ('Fianzas', 'fianzas', 'generales', 2),
  ('Generales', 'generales', 'generales', 3),
  ('RC Pasajeros', 'rc-pasajeros', 'generales', 4),
  ('SOAT', 'soat', 'generales', 5),
  ('Vida', 'vida', 'vida', 6),
  ('ARL', 'arl', 'vida', 7)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- DATOS INICIALES: Grupos por ramo
-- =====================================================

-- Grupos de Automóviles
INSERT INTO insurance_groups (name, slug, line_id, display_order)
SELECT name, slug, line_id, display_order FROM (
  VALUES
    ('Auto individual', 'auto-individual', (SELECT id FROM insurance_lines WHERE slug = 'automoviles'), 1),
    ('Auto colectivo', 'auto-colectivo', (SELECT id FROM insurance_lines WHERE slug = 'automoviles'), 2),
    ('Auto RCE', 'auto-rce', (SELECT id FROM insurance_lines WHERE slug = 'automoviles'), 3)
) AS t(name, slug, line_id, display_order)
ON CONFLICT (slug, line_id) DO NOTHING;

-- Grupos de Fianzas
INSERT INTO insurance_groups (name, slug, line_id, display_order)
SELECT name, slug, line_id, display_order FROM (
  VALUES
    ('Cumplimiento Particular', 'cumplimiento-particular', (SELECT id FROM insurance_lines WHERE slug = 'fianzas'), 1),
    ('Cumplimiento Estatal', 'cumplimiento-estatal', (SELECT id FROM insurance_lines WHERE slug = 'fianzas'), 2),
    ('Judicial', 'judicial', (SELECT id FROM insurance_lines WHERE slug = 'fianzas'), 3),
    ('Seriedad de la oferta', 'seriedad-oferta', (SELECT id FROM insurance_lines WHERE slug = 'fianzas'), 4),
    ('RCE Cumplimiento', 'rce-cumplimiento', (SELECT id FROM insurance_lines WHERE slug = 'fianzas'), 5)
) AS t(name, slug, line_id, display_order)
ON CONFLICT (slug, line_id) DO NOTHING;

-- Grupos de Generales
INSERT INTO insurance_groups (name, slug, line_id, display_order)
SELECT name, slug, line_id, display_order FROM (
  VALUES
    ('Hogar', 'hogar', (SELECT id FROM insurance_lines WHERE slug = 'generales'), 1),
    ('Pyme', 'pyme', (SELECT id FROM insurance_lines WHERE slug = 'generales'), 2),
    ('Copropiedad', 'copropiedad', (SELECT id FROM insurance_lines WHERE slug = 'generales'), 3),
    ('TRC', 'trc', (SELECT id FROM insurance_lines WHERE slug = 'generales'), 4),
    ('Decenal', 'decenal', (SELECT id FROM insurance_lines WHERE slug = 'generales'), 5),
    ('Maquinaria', 'maquinaria', (SELECT id FROM insurance_lines WHERE slug = 'generales'), 6),
    ('Transportes', 'transportes', (SELECT id FROM insurance_lines WHERE slug = 'generales'), 7),
    ('Manejo Global', 'manejo-global', (SELECT id FROM insurance_lines WHERE slug = 'generales'), 8),
    ('Cyber', 'cyber', (SELECT id FROM insurance_lines WHERE slug = 'generales'), 9),
    ('RC PLO', 'rc-plo', (SELECT id FROM insurance_lines WHERE slug = 'generales'), 10)
) AS t(name, slug, line_id, display_order)
ON CONFLICT (slug, line_id) DO NOTHING;

-- Grupos de RC Pasajeros
INSERT INTO insurance_groups (name, slug, line_id, display_order)
SELECT name, slug, line_id, display_order FROM (
  VALUES
    ('RCC - RCE', 'rcc-rce', (SELECT id FROM insurance_lines WHERE slug = 'rc-pasajeros'), 1)
) AS t(name, slug, line_id, display_order)
ON CONFLICT (slug, line_id) DO NOTHING;

-- Grupos de SOAT
INSERT INTO insurance_groups (name, slug, line_id, display_order)
SELECT name, slug, line_id, display_order FROM (
  VALUES
    ('SOAT', 'soat-grupo', (SELECT id FROM insurance_lines WHERE slug = 'soat'), 1)
) AS t(name, slug, line_id, display_order)
ON CONFLICT (slug, line_id) DO NOTHING;

-- Grupos de Vida
INSERT INTO insurance_groups (name, slug, line_id, display_order)
SELECT name, slug, line_id, display_order FROM (
  VALUES
    ('Vida Individual', 'vida-individual', (SELECT id FROM insurance_lines WHERE slug = 'vida'), 1),
    ('Colectivos', 'colectivos', (SELECT id FROM insurance_lines WHERE slug = 'vida'), 2),
    ('Salud', 'salud', (SELECT id FROM insurance_lines WHERE slug = 'vida'), 3),
    ('Vida Grupo', 'vida-grupo', (SELECT id FROM insurance_lines WHERE slug = 'vida'), 4),
    ('Accidentes Personales', 'accidentes-personales', (SELECT id FROM insurance_lines WHERE slug = 'vida'), 5)
) AS t(name, slug, line_id, display_order)
ON CONFLICT (slug, line_id) DO NOTHING;

-- Grupos de ARL
INSERT INTO insurance_groups (name, slug, line_id, display_order)
SELECT name, slug, line_id, display_order FROM (
  VALUES
    ('ARL', 'arl-grupo', (SELECT id FROM insurance_lines WHERE slug = 'arl'), 1)
) AS t(name, slug, line_id, display_order)
ON CONFLICT (slug, line_id) DO NOTHING;

-- =====================================================
-- DATOS INICIALES: Compañías de seguros
-- =====================================================
INSERT INTO insurance_companies (name, slug, display_order) VALUES
  ('Seguros del Estado', 'seguros-del-estado', 1),
  ('Equidad Seguros', 'equidad-seguros', 2),
  ('Axa Colpatria', 'axa-colpatria', 3),
  ('BBVA Seguros', 'bbva-seguros', 4),
  ('HDI', 'hdi', 5),
  ('Bolívar', 'bolivar', 6),
  ('Solidaria', 'solidaria', 7),
  ('Mapfre', 'mapfre', 8),
  ('Suramericana', 'suramericana', 9),
  ('Mundial', 'mundial', 10),
  ('Allianz', 'allianz', 11),
  ('Previsora', 'previsora', 12),
  ('Zurich', 'zurich', 13),
  ('Colsanitas', 'colsanitas', 14)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- DATOS INICIALES: Relación compañía-ramos
-- =====================================================

-- Función helper para insertar relaciones compañía-ramo
DO $$
DECLARE
  v_comp_id UUID;
  v_line_id UUID;
  company_slugs TEXT[] := ARRAY['seguros-del-estado', 'equidad-seguros', 'axa-colpatria', 'bbva-seguros', 'hdi', 'bolivar', 'solidaria', 'mapfre', 'suramericana', 'mundial', 'allianz', 'previsora', 'zurich'];
  all_lines_slugs TEXT[] := ARRAY['automoviles', 'fianzas', 'generales', 'rc-pasajeros', 'soat', 'vida'];
  comp_slug TEXT;
  line_slug TEXT;
BEGIN
  -- Compañías con todos los ramos (menos ARL)
  FOREACH comp_slug IN ARRAY company_slugs LOOP
    SELECT id INTO v_comp_id FROM insurance_companies WHERE slug = comp_slug;
    FOREACH line_slug IN ARRAY all_lines_slugs LOOP
      SELECT id INTO v_line_id FROM insurance_lines WHERE slug = line_slug;
      INSERT INTO company_lines (company_id, line_id)
      VALUES (v_comp_id, v_line_id)
      ON CONFLICT (company_id, line_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  -- Axa Colpatria y Suramericana tienen ARL
  SELECT id INTO v_comp_id FROM insurance_companies WHERE slug = 'axa-colpatria';
  SELECT id INTO v_line_id FROM insurance_lines WHERE slug = 'arl';
  INSERT INTO company_lines (company_id, line_id) VALUES (v_comp_id, v_line_id) ON CONFLICT DO NOTHING;
  
  SELECT id INTO v_comp_id FROM insurance_companies WHERE slug = 'suramericana';
  INSERT INTO company_lines (company_id, line_id) VALUES (v_comp_id, v_line_id) ON CONFLICT DO NOTHING;
  
  -- Colsanitas solo tiene Vida y ARL
  SELECT id INTO v_comp_id FROM insurance_companies WHERE slug = 'colsanitas';
  SELECT id INTO v_line_id FROM insurance_lines WHERE slug = 'vida';
  INSERT INTO company_lines (company_id, line_id) VALUES (v_comp_id, v_line_id) ON CONFLICT DO NOTHING;
  SELECT id INTO v_line_id FROM insurance_lines WHERE slug = 'arl';
  INSERT INTO company_lines (company_id, line_id) VALUES (v_comp_id, v_line_id) ON CONFLICT DO NOTHING;
END $$;

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================
COMMENT ON TABLE insurance_companies IS 'Catálogo global de compañías de seguros';
COMMENT ON TABLE insurance_lines IS 'Catálogo global de ramos de seguro';
COMMENT ON TABLE insurance_groups IS 'Catálogo global de grupos/productos por ramo';
COMMENT ON TABLE company_lines IS 'Relación entre compañías y ramos disponibles';
COMMENT ON TABLE tenant_companies IS 'Compañías activadas por cada tenant con su código';
