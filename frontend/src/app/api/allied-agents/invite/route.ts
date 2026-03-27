import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Función para generar contraseña aleatoria
function generatePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%';
  
  const allChars = uppercase + lowercase + numbers + special;
  
  // Asegurar al menos uno de cada tipo
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Completar el resto
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Mezclar la contraseña
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

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

    // Obtener el tenant
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('slug', tenantSlug)
      .single();

    if (tenantError || !tenantData) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    // Generar contraseña aleatoria
    const generatedPassword = generatePassword(12);

    // Crear usuario con contraseña (no invitación)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: generatedPassword,
      email_confirm: true, // Confirmar email automáticamente
      user_metadata: {
        full_name,
      },
      app_metadata: {
        tenant_id: tenantData.id,
        role: 'allied_agent',
      },
    });

    if (userError) {
      // Si el usuario ya existe, actualizar su metadata
      if (userError.message.includes('already been registered')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);
        
        if (existingUser) {
          // Actualizar metadata y resetear contraseña
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            password: generatedPassword,
            app_metadata: {
              tenant_id: tenantData.id,
              role: 'allied_agent',
            },
            user_metadata: {
              full_name,
            }
          });

          // Enviar email de bienvenida
          await sendWelcomeEmail(
            email,
            full_name,
            tenantData.name,
            tenantSlug,
            generatedPassword
          );

          return NextResponse.json({
            success: true,
            userId: existingUser.id,
            message: 'Usuario actualizado y email enviado'
          });
        }
      }
      
      return NextResponse.json(
        { error: userError.message },
        { status: 400 }
      );
    }

    // Enviar email de bienvenida con credenciales
    await sendWelcomeEmail(
      email,
      full_name,
      tenantData.name,
      tenantSlug,
      generatedPassword
    );

    return NextResponse.json({
      success: true,
      userId: userData.user.id,
      message: 'Aliado creado y email enviado'
    });

  } catch (error) {
    console.error('Error in invite API:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función para enviar email de bienvenida
async function sendWelcomeEmail(
  email: string,
  fullName: string,
  tenantName: string,
  tenantSlug: string,
  password: string
) {
  const { Resend } = await import('resend');
  
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured');
    return;
  }

  const resend = new Resend(apiKey);
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${tenantSlug}/aliado/login`;

  await resend.emails.send({
    from: `${tenantName} <noreply@integratech.com.co>`,
    to: [email],
    subject: `¡Bienvenido al Portal de Aliados de ${tenantName}!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                      ¡Bienvenido al Portal de Aliados!
                    </h1>
                    <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">
                      ${tenantName}
                    </p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hola <strong>${fullName}</strong>,
                    </p>
                    
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Has sido registrado como Agente Aliado de <strong>${tenantName}</strong>. 
                      A continuación encontrarás tus credenciales de acceso:
                    </p>
                    
                    <!-- Credentials Box -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
                      <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;">
                        <strong>Usuario:</strong>
                      </p>
                      <p style="margin: 0 0 20px 0; font-size: 18px; color: #1e293b; font-family: monospace; background: #e2e8f0; padding: 8px 12px; border-radius: 4px;">
                        ${email}
                      </p>
                      
                      <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;">
                        <strong>Contraseña:</strong>
                      </p>
                      <p style="margin: 0; font-size: 18px; color: #1e293b; font-family: monospace; background: #e2e8f0; padding: 8px 12px; border-radius: 4px;">
                        ${password}
                      </p>
                    </div>
                    
                    <p style="margin: 0 0 30px 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      Te recomendamos cambiar tu contraseña después de iniciar sesión por primera vez.
                    </p>
                    
                    <!-- CTA Button -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td align="center">
                          <a href="${portalUrl}"
                             style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                            Ingresar al Portal
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Features -->
                    <div style="margin-top: 40px; padding: 24px; background-color: #f0f9ff; border-radius: 8px;">
                      <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #1e40af;">
                        En tu portal podrás:
                      </p>
                      <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.8;">
                        <li>Ver tus clientes referidos</li>
                        <li>Consultar las pólizas de tus referidos</li>
                        <li>Revisar tus comisiones</li>
                        <li>Actualizar tu información</li>
                      </ul>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                      ¿Tienes preguntas? Contacta a ${tenantName}
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      Este es un correo automático, por favor no respondas directamente.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });
}
