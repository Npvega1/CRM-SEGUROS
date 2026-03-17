// =====================================================
// CLIENTE SUPABASE - Admin (Service Role)
// SOLO para uso en Edge Functions, webhooks, y operaciones administrativas
// NUNCA exponer en el cliente
// =====================================================

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Tipo helper para manejar operaciones admin
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>;

/**
 * Crea un cliente de Supabase con permisos de service_role
 * ADVERTENCIA: Este cliente bypasea RLS - usar con extremo cuidado
 * Solo usar en:
 * - Edge Functions
 * - Webhooks
 * - Tareas de administración del sistema
 */
export function createAdminClient(): AnySupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Falta variable de entorno: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!supabaseServiceKey) {
    throw new Error(
      'Falta variable de entorno: SUPABASE_SERVICE_ROLE_KEY. ' +
      'Esta clave solo debe estar disponible en el servidor.'
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Actualiza los claims personalizados en el JWT de un usuario
 * Útil después del login para agregar tenant_id y role
 */
export async function updateUserClaims(
  userId: string,
  claims: {
    tenant_id: string;
    role: string;
    agent_id: string;
  }
) {
  const supabase = createAdminClient();
  
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: claims
  });

  if (error) {
    throw new Error(`Error actualizando claims del usuario: ${error.message}`);
  }
}

/**
 * Crea un nuevo usuario y lo asocia a un tenant
 * Usado para invitaciones y onboarding
 */
export async function createUserWithTenant(
  email: string,
  password: string,
  userData: {
    full_name: string;
    tenant_id: string;
    role: string;
  }
) {
  const supabase = createAdminClient();

  // Crear usuario en auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      tenant_id: userData.tenant_id,
      role: userData.role,
      agent_id: '' // Se actualizará después de crear el registro en users
    }
  });

  if (authError) {
    throw new Error(`Error creando usuario: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error('No se pudo crear el usuario');
  }

  // Crear registro en tabla users
  const { error: userError } = await supabase.from('users').insert({
    id: authData.user.id,
    email,
    full_name: userData.full_name,
    tenant_id: userData.tenant_id,
    role: userData.role as 'admin' | 'senior_agent' | 'agent' | 'readonly'
  });

  if (userError) {
    // Rollback: eliminar usuario de auth si falla la inserción
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(`Error creando perfil de usuario: ${userError.message}`);
  }

  // Actualizar agent_id en claims
  await updateUserClaims(authData.user.id, {
    tenant_id: userData.tenant_id,
    role: userData.role,
    agent_id: authData.user.id
  });

  return authData.user;
}
