import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, full_name, tenantSlug } = body;

    if (!email || !full_name) {
      return NextResponse.json(
        { error: 'Email y nombre son requeridos' },
        { status: 400 }
      );
    }

    // Cliente admin de Supabase (usa las variables de entorno del servidor)
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

    // Crear usuario e invitarlo
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name,
          role: 'allied_agent',
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/${tenantSlug}/aliado`,
      }
    );

    if (userError) {
      console.error('Error inviting user:', userError);
      return NextResponse.json(
        { error: userError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: userData.user.id,
      message: 'Invitación enviada exitosamente'
    });

  } catch (error) {
    console.error('Error in invite API:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
