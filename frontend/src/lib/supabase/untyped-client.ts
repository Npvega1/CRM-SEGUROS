// =====================================================
// CLIENTE SUPABASE - Sin tipos estrictos
// Para tablas que no están en el schema generado
// =====================================================

import { createBrowserClient } from '@supabase/ssr';

/**
 * Crea un cliente de Supabase sin tipos estrictos
 * Útil para tablas nuevas que no están en database-types.ts
 */
export function getUntypedClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window === 'undefined') {
      console.warn('Supabase env vars not available during build');
      return createBrowserClient(
        'https://placeholder.supabase.co',
        'placeholder-key'
      );
    }
    throw new Error(
      'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
