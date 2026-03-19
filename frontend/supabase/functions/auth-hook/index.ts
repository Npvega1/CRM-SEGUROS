// =====================================================
// EDGE FUNCTION: Auth Hook
// Se ejecuta después del login para agregar claims al JWT
// Desplegar en Supabase Edge Functions
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthHookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: {
    id: string;
    email: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw_app_meta_data: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw_user_meta_data: Record<string, any>;
  };
  schema: string;
  old_record: null | Record<string, unknown>;
}

serve(async (req: Request) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar que es una petición POST
    if (req.method !== 'POST') {
      throw new Error('Método no permitido');
    }

    // Parsear el payload del webhook
    const payload: AuthHookPayload = await req.json();
    
    // Solo procesar inserciones (nuevos logins/signups)
    if (payload.type !== 'INSERT' && payload.type !== 'UPDATE') {
      return new Response(
        JSON.stringify({ message: 'Evento ignorado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = payload.record.id;

    // Crear cliente admin de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Faltan variables de entorno de Supabase');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Buscar información del usuario en la tabla users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id, role, id')
      .eq('id', userId)
      .single();

    if (userError) {
      // Usuario no encontrado en tabla users - puede ser nuevo
      console.log(`Usuario ${userId} no encontrado en tabla users`);
      return new Response(
        JSON.stringify({ 
          message: 'Usuario sin perfil - claims no actualizados',
          userId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar claims para el JWT
    const claims = {
      tenant_id: userData.tenant_id,
      role: userData.role,
      agent_id: userData.id
    };

    // Actualizar app_metadata del usuario (se incluirá en el JWT)
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { app_metadata: claims }
    );

    if (updateError) {
      throw new Error(`Error actualizando claims: ${updateError.message}`);
    }

    // Actualizar last_login_at
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId);

    console.log(`Claims actualizados para usuario ${userId}:`, claims);

    return new Response(
      JSON.stringify({ 
        message: 'Claims actualizados correctamente',
        userId,
        claims 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en auth-hook:', message);

    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

/*
 * INSTRUCCIONES DE DESPLIEGUE:
 * 
 * 1. Instalar Supabase CLI: npm install -g supabase
 * 2. Iniciar proyecto: supabase init
 * 3. Login: supabase login
 * 4. Desplegar función: supabase functions deploy auth-hook
 * 5. Configurar webhook en Supabase Dashboard:
 *    - Ir a Database > Webhooks
 *    - Crear nuevo webhook
 *    - Tabla: auth.users
 *    - Eventos: INSERT, UPDATE
 *    - URL: https://<project-ref>.supabase.co/functions/v1/auth-hook
 *    - Headers: Authorization: Bearer <SUPABASE_ANON_KEY>
 */
