// =====================================================
// CLIENTE SUPABASE - Server (Server Components/Actions)
// Para uso en Server Components, Route Handlers, Server Actions
// =====================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database-types';

/**
 * Crea un cliente de Supabase para uso en el servidor
 * Maneja automáticamente las cookies de Next.js
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // El método `setAll` fue llamado desde un Server Component.
          // Esto puede ignorarse si tienes middleware actualizando las sesiones.
        }
      },
    },
  });
}

/**
 * Obtiene la sesión actual del usuario
 * Retorna null si no hay sesión activa
 */
export async function getSession() {
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error obteniendo sesión:', error.message);
    return null;
  }
  
  return session;
}

/**
 * Obtiene el usuario actual
 * Retorna null si no hay usuario autenticado
 */
export async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error obteniendo usuario:', error.message);
    return null;
  }
  
  return user;
}
