-- =====================================================
-- MIGRACIÓN SQL - Módulo 09 FIX: Permitir prospectos sin cliente
-- =====================================================

-- Hacer client_id nullable para permitir prospectos
ALTER TABLE comparisons 
  ALTER COLUMN client_id DROP NOT NULL;

-- Agregar campo prospect_name para identificar prospectos
ALTER TABLE comparisons 
  ADD COLUMN IF NOT EXISTS prospect_name VARCHAR(200) DEFAULT NULL;

-- Agregar constraint: debe tener client_id O prospect_name
ALTER TABLE comparisons 
  DROP CONSTRAINT IF EXISTS comparisons_client_or_prospect;
  
ALTER TABLE comparisons 
  ADD CONSTRAINT comparisons_client_or_prospect 
  CHECK (client_id IS NOT NULL OR prospect_name IS NOT NULL);

-- Comentario
COMMENT ON COLUMN comparisons.prospect_name IS 'Nombre del prospecto cuando no hay cliente registrado';
