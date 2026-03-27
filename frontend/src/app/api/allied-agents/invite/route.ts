import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, full_name, tenantSlug } = body;

    if (!email || !full_name || !tenantSlug) {
      return NextResponse.json(
        { error: 'Email, nombre y tenant son requeridos' },
        { status: 400 }
      );
    }

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

    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('slug', tenantSlug)
      .single();

    if (tenantError || !tenantData) {
      console.error('Error finding tenant:', tenantError);
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    // IMPORTANTE: Usar el callback de aliados, no el de clientes
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name,
          role: 'allied_agent',
          tenant_id: tenantData.id,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/${tenantSlug}/aliado/auth/callback`,
      }
    );

    if (userError) {
      console.error('Error inviting user:', userError);
      
      if (userError.message.includes('already been registered')) {
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const user = existingUser?.users?.find(u => u.email === email);
        
        if (user) {
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            app_metadata: {
              tenant_id: tenantData.id,
              role: 'allied_agent',
            },
            user_metadata: {
              full_name,
            }
          });
          
          return NextResponse.json({
            success: true,
            userId: user.id,
            message: 'Usuario ya existía, se actualizó su configuración'
          });
        }
      }
      
      return NextResponse.json(
        { error: userError.message },
        { status: 400 }
      );
    }

    if (userData?.user?.id) {
      await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
        app_metadata: {
          tenant_id: tenantData.id,
          role: 'allied_agent',
        }
      });
    }

    return NextResponse.json({
      success: true,
      userId: userData.user.id,
      tenantName: tenantData.name,
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
