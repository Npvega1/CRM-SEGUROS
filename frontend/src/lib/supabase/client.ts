// =====================================================
// CLIENTE SUPABASE - Browser (Client Components)
// Para uso en componentes del cliente (use client)
// =====================================================

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database-types';

/**
 * Crea un cliente de Supabase para uso en el navegador
 * Usa las variables de entorno públicas
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Durante el build, las variables pueden no estar disponibles
  // Retornar un cliente dummy que será reemplazado en runtime
  if (!supabaseUrl || !supabaseAnonKey) {
    // En el servidor durante build, retornar null-safe
    if (typeof window === 'undefined') {
      console.warn('Supabase env vars not available during build');
      // Retornar un cliente con URL placeholder que no se usará
      return createBrowserClient<Database>(
        'https://placeholder.supabase.co',
        'placeholder-key'
      );
    }
    throw new Error(
      'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

// Singleton para evitar múltiples instancias en el cliente
let browserClient: ReturnType<typeof createClient> | null = null;

/**
 * Obtiene el cliente singleton de Supabase para el navegador
 * Útil cuando se necesita la misma instancia en múltiples lugares
 */
export function getClient() {
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}

// Alias para compatibilidad
export const getBrowserClient = getClient;
