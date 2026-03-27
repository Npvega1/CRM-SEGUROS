import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, tenantName, adminName } = body;

    if (!to || !tenantName) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: 'CRM Seguros <noreply@integratech.com.co>',
      to: [to],
      subject: `¡Bienvenido a CRM Seguros! Tu agencia ${tenantName} ha sido aprobada`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bienvenido a CRM Seguros</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px 12px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                        🎉 ¡Felicitaciones!
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                        Hola <strong>${adminName || 'Administrador'}</strong>,
                      </p>
                      
                      <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                        Tu agencia <strong style="color: #3b82f6;">${tenantName}</strong> ha sido aprobada exitosamente en nuestra plataforma CRM Seguros.
                      </p>
                      
                      <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                        Ya puedes iniciar sesión y comenzar a gestionar tu agencia de seguros de manera profesional.
                      </p>
                      
                      <!-- CTA Button -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td align="center">
                            <a href="https://app.integratech.com.co/login" 
                               style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                              Iniciar Sesión
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Features -->
                      <div style="margin-top: 40px; padding: 24px; background-color: #f8fafc; border-radius: 8px;">
                        <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #1f2937;">
                          Con tu cuenta puedes:
                        </p>
                        <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
                          <li>Gestionar clientes y pólizas</li>
                          <li>Controlar siniestros</li>
                          <li>Administrar facturación</li>
                          <li>Generar reportes</li>
                          <li>Y mucho más...</li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; text-align: center;">
                      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                        ¿Tienes preguntas? Contáctanos en
                      </p>
                      <a href="mailto:contact@integratech.com.co" style="color: #3b82f6; text-decoration: none; font-weight: 500;">
                        contact@integratech.com.co
                      </a>
                      <p style="margin: 16px 0 0 0; font-size: 12px; color: #9ca3af;">
                        © 2024 IntegraTech. Todos los derechos reservados.
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

    if (error) {
      console.error('Error sending email:', error);
      return NextResponse.json(
        { error: 'Error al enviar email', details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email enviado exitosamente',
      data
    });

  } catch (error) {
    console.error('Error in welcome email API:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
