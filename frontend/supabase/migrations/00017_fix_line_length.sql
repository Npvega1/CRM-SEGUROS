-- =====================================================
-- FIX: Ampliar campo line en ai_comparisons
-- El slug del ramo puede ser más largo de 20 caracteres
-- =====================================================

-- Ampliar el campo line para que acepte slugs más largos
ALTER TABLE ai_comparisons 
ALTER COLUMN line TYPE VARCHAR(100);

-- También actualizar operation_type si existe
ALTER TABLE ai_comparisons 
ADD COLUMN IF NOT EXISTS operation_type VARCHAR(20) DEFAULT 'comparison';
