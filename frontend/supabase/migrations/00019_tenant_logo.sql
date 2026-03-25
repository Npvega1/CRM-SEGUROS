-- =====================================================
-- MIGRACIÓN: 00019_tenant_logo.sql
-- Agrega campo para logo del tenant
-- =====================================================

-- Agregar columna para logo en tenant_settings
ALTER TABLE tenant_settings 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Comentario
COMMENT ON COLUMN tenant_settings.logo_url IS 'URL del logo del tenant para documentos';
