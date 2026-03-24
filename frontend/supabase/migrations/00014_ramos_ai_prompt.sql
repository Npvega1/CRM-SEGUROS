-- =====================================================
-- MIGRACIÓN: 00014_ramos_ai_prompt.sql
-- Agregar has_ai_prompt a la tabla insurance_groups (Ramos)
-- Para control granular de IA por producto específico
-- =====================================================

-- Agregar columna has_ai_prompt a insurance_groups (Ramos)
ALTER TABLE insurance_groups 
ADD COLUMN IF NOT EXISTS has_ai_prompt BOOLEAN DEFAULT false;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_insurance_groups_ai_prompt 
ON insurance_groups(has_ai_prompt) WHERE has_ai_prompt = true;

-- Comentario
COMMENT ON COLUMN insurance_groups.has_ai_prompt IS 'Indica si este ramo tiene prompt de IA configurado para comparativos';
