-- =====================================================
-- MIGRACIÓN: 00015_prompt_examples.sql
-- Tabla para guardar ejemplos de estructura por ramo
-- Permite adjuntar archivos de cotización de ejemplo
-- =====================================================

-- Tabla de ejemplos de estructura para prompts
CREATE TABLE IF NOT EXISTS prompt_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES ai_prompts(id) ON DELETE CASCADE,
  group_slug VARCHAR(100), -- Slug del ramo (insurance_group)
  name VARCHAR(255) NOT NULL,
  description TEXT,
  content_type VARCHAR(50), -- 'text', 'pdf_extracted', 'structure'
  content TEXT NOT NULL, -- Contenido o texto extraído
  file_name VARCHAR(255), -- Nombre del archivo original si aplica
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_prompt_examples_prompt ON prompt_examples(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_examples_group ON prompt_examples(group_slug);

-- Comentarios
COMMENT ON TABLE prompt_examples IS 'Ejemplos de estructura de cotizaciones para entrenar prompts de IA';
COMMENT ON COLUMN prompt_examples.content_type IS 'Tipo: text (texto manual), pdf_extracted (extraído de PDF), structure (estructura JSON)';
COMMENT ON COLUMN prompt_examples.content IS 'Contenido del ejemplo o texto extraído del archivo';
