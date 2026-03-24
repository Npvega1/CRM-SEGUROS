-- =====================================================
-- MIGRACIÓN: 00013_policies_catalog_relations.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Agregar relaciones de catálogos a la tabla policies
-- =====================================================

-- Agregar columnas para relacionar con los catálogos de seguros
ALTER TABLE policies 
ADD COLUMN IF NOT EXISTS insurer_id UUID REFERENCES insurance_companies(id),
ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES insurance_lines(id),
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES insurance_groups(id);

-- Crear índices para las nuevas relaciones
CREATE INDEX IF NOT EXISTS idx_policies_insurer ON policies(insurer_id);
CREATE INDEX IF NOT EXISTS idx_policies_line ON policies(line_id);
CREATE INDEX IF NOT EXISTS idx_policies_group ON policies(group_id);

-- Comentarios
COMMENT ON COLUMN policies.insurer_id IS 'Referencia a la compañía de seguros del catálogo';
COMMENT ON COLUMN policies.line_id IS 'Referencia al grupo/línea de seguro del catálogo';
COMMENT ON COLUMN policies.group_id IS 'Referencia al ramo de seguro del catálogo';
