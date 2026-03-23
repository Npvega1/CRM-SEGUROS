-- =====================================================
-- MIGRACIÓN: Fix RLS Policies - JWT Claims Correction
-- Corrección de las políticas RLS para acceder correctamente
-- al tenant_id desde app_metadata del JWT
-- =====================================================

-- =====================================================
-- CLIENTES - Actualizar políticas RLS
-- =====================================================

DROP POLICY IF EXISTS "Ver clientes del tenant" ON clients;
CREATE POLICY "Ver clientes del tenant" ON clients FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Crear clientes en el tenant" ON clients;
CREATE POLICY "Crear clientes en el tenant" ON clients FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Actualizar clientes del tenant" ON clients;
CREATE POLICY "Actualizar clientes del tenant" ON clients FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Eliminar clientes del tenant" ON clients;
CREATE POLICY "Eliminar clientes del tenant" ON clients FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- =====================================================
-- PÓLIZAS - Actualizar políticas RLS
-- =====================================================

DROP POLICY IF EXISTS "Ver pólizas del tenant" ON policies;
CREATE POLICY "Ver pólizas del tenant" ON policies FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Crear pólizas en el tenant" ON policies;
CREATE POLICY "Crear pólizas en el tenant" ON policies FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Actualizar pólizas del tenant" ON policies;
CREATE POLICY "Actualizar pólizas del tenant" ON policies FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Eliminar pólizas del tenant" ON policies;
CREATE POLICY "Eliminar pólizas del tenant" ON policies FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- =====================================================
-- HISTORIAL DE PÓLIZAS - Actualizar políticas RLS
-- =====================================================

DROP POLICY IF EXISTS "Ver historial de pólizas" ON policy_history;
CREATE POLICY "Ver historial de pólizas" ON policy_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM policies p 
    WHERE p.id = policy_history.policy_id 
    AND p.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  ));

DROP POLICY IF EXISTS "Insertar historial de pólizas" ON policy_history;
CREATE POLICY "Insertar historial de pólizas" ON policy_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM policies p 
    WHERE p.id = policy_history.policy_id 
    AND p.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  ));

-- =====================================================
-- AUTOMATION_QUEUE - Actualizar políticas RLS
-- =====================================================

DROP POLICY IF EXISTS "Ver automation_queue del tenant" ON automation_queue;
CREATE POLICY "Ver automation_queue del tenant" ON automation_queue FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Insertar automation_queue" ON automation_queue;
CREATE POLICY "Insertar automation_queue" ON automation_queue FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- =====================================================
-- AUTOMATION_LOGS - Actualizar políticas RLS
-- =====================================================

DROP POLICY IF EXISTS "Ver automation_logs del tenant" ON automation_logs;
CREATE POLICY "Ver automation_logs del tenant" ON automation_logs FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Insertar automation_logs" ON automation_logs;
CREATE POLICY "Insertar automation_logs" ON automation_logs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- =====================================================
COMMENT ON POLICY "Ver clientes del tenant" ON clients IS 'Política RLS corregida: accede a tenant_id desde app_metadata del JWT';
