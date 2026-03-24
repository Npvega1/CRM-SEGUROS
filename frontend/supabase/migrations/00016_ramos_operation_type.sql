-- =====================================================
-- MIGRACIÓN: 00016_ramos_operation_type.sql
-- Agregar tipo de operación por ramo
-- 'comparison' = Comparativo (2+ archivos)
-- 'quotation' = Cotización (1 archivo)
-- =====================================================

-- Agregar columna operation_type a insurance_groups (Ramos)
ALTER TABLE insurance_groups 
ADD COLUMN IF NOT EXISTS operation_type VARCHAR(20) DEFAULT 'comparison';

-- Agregar columna min_files para indicar mínimo de archivos requeridos
ALTER TABLE insurance_groups 
ADD COLUMN IF NOT EXISTS min_files INTEGER DEFAULT 2;

-- Comentarios
COMMENT ON COLUMN insurance_groups.operation_type IS 'Tipo: comparison (comparativo) o quotation (cotización desde contrato)';
COMMENT ON COLUMN insurance_groups.min_files IS 'Número mínimo de archivos requeridos (1 para cotización, 2 para comparativo)';

-- Actualizar FIANZAS para que sea tipo cotización
UPDATE insurance_groups 
SET operation_type = 'quotation', min_files = 1 
WHERE slug = 'fianzas' OR name ILIKE '%fianza%';
