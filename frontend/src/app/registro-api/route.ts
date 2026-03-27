import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema de validación
const registroSchema = z.object({
  agencyName: z.string().min(2).max(200),
  agencySlug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  fullName: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(8)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar datos
    const validationResult = registroSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { agencyName, agencySlug, fullName, email, password } = validationResult.data;

    // Crear cliente admin con service role (bypasa RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 1. Verificar si el slug ya existe
    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', agencySlug)
      .single();

    if (existingTenant) {
      return NextResponse.json(
        { error: 'Este identificador de agencia ya existe' },
        { status: 400 }
      );
    }

    // 2. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'Este correo ya está registrado' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `Error al crear usuario: ${authError.message}` },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Error al crear usuario' },
        { status: 500 }
      );
    }

    // 3. Crear tenant (agencia) con status PENDING
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: agencyName,
        slug: agencySlug,
        status: 'pending',
        is_active: false
      })
      .select('id')
      .single();

    if (tenantError) {
      // Rollback: eliminar usuario
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Error al crear agencia: ${tenantError.message}` },
        { status: 500 }
      );
    }

    // 4. Crear registro en tabla users
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        tenant_id: tenantData.id,
        email: email,
        full_name: fullName,
        role: 'admin'
      });

    if (userError) {
      // Rollback: eliminar tenant y usuario
      await supabaseAdmin.from('tenants').delete().eq('id', tenantData.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Error al crear perfil: ${userError.message}` },
        { status: 500 }
      );
    }

    // 5. Actualizar app_metadata del usuario con tenant_id y role
    await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
      app_metadata: {
        tenant_id: tenantData.id,
        role: 'admin',
        agent_id: authData.user.id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Solicitud de agencia enviada exitosamente',
      user: {
        id: authData.user.id,
        email: authData.user.email
      },
      tenant: {
        id: tenantData.id,
        slug: agencySlug
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
