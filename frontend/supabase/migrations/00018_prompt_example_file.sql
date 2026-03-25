-- =====================================================
-- MIGRACIÓN: 00018_prompt_example_file.sql
-- Agrega campo para URL de archivo de ejemplo en ai_prompts
-- =====================================================

-- Agregar columna para archivo de ejemplo directamente en ai_prompts
ALTER TABLE ai_prompts 
ADD COLUMN IF NOT EXISTS example_file_url TEXT,
ADD COLUMN IF NOT EXISTS example_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS example_file_content TEXT;

-- Comentarios
COMMENT ON COLUMN ai_prompts.example_file_url IS 'URL del archivo de ejemplo en Storage';
COMMENT ON COLUMN ai_prompts.example_file_name IS 'Nombre original del archivo de ejemplo';
COMMENT ON COLUMN ai_prompts.example_file_content IS 'Texto extraído del archivo de ejemplo';

-- Crear bucket de Storage para ejemplos (ejecutar en Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('prompt-examples', 'prompt-examples', true);
