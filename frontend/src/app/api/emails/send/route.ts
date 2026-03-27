import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailRequest {
  tenant_id: string;
  template_id: string;
  template_name: string;
  subject: string;
  html_body: string;
  recipient_type: 'clients' | 'allies' | 'both';
  recipient_ids?: string[];
  send_to_all: boolean;
  sent_by: string;
}

interface Recipient {
  id: string;
  email: string;
  name: string;
  type: 'client' | 'ally';
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json();
    const {
      tenant_id,
      template_id,
      template_name,
      subject,
      html_body,
      recipient_type,
      recipient_ids,
      send_to_all,
      sent_by
    } = body;

    if (!tenant_id || !subject || !html_body) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Obtener información del tenant
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name, slug')
      .eq('id', tenant_id)
      .single();

    // Construir lista de destinatarios
    const recipients: Recipient[] = [];

    // Obtener clientes si aplica
    if (recipient_type === 'clients' || recipient_type === 'both') {
      let clientQuery = supabaseAdmin
        .from('clients')
        .select('id, email, full_name')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true)
        .not('email', 'is', null);

      if (!send_to_all && recipient_ids && recipient_ids.length > 0) {
        clientQuery = clientQuery.in('id', recipient_ids);
      }

      const { data: clients } = await clientQuery;
      
      if (clients) {
        clients.forEach(client => {
          if (client.email) {
            recipients.push({
              id: client.id,
              email: client.email,
              name: client.full_name || 'Cliente',
              type: 'client'
            });
          }
        });
      }
    }

    // Obtener aliados si aplica
    if (recipient_type === 'allies' || recipient_type === 'both') {
      let allyQuery = supabaseAdmin
        .from('allied_agents')
        .select('id, email, full_name')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true)
        .not('email', 'is', null);

      if (!send_to_all && recipient_ids && recipient_ids.length > 0) {
        allyQuery = allyQuery.in('id', recipient_ids);
      }

      const { data: allies } = await allyQuery;
      
      if (allies) {
        allies.forEach(ally => {
          if (ally.email) {
            recipients.push({
              id: ally.id,
              email: ally.email,
              name: ally.full_name || 'Aliado',
              type: 'ally'
            });
          }
        });
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No hay destinatarios válidos' },
        { status: 400 }
      );
    }

    // Enviar emails y registrar logs
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const recipient of recipients) {
      try {
        // Reemplazar variables en el contenido
        const personalizedSubject = replaceVariables(subject, recipient, tenant);
        const personalizedBody = replaceVariables(html_body, recipient, tenant);

        // Convertir texto plano a HTML si no tiene tags HTML
        const htmlContent = personalizedBody.includes('<') 
          ? personalizedBody 
          : `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${personalizedBody.replace(/\n/g, '<br>')}</div>`;

        // Enviar email con Resend
        const { error: sendError } = await resend.emails.send({
          from: `${tenant?.name || 'CRM Seguros'} <noreply@integratech.com.co>`,
          to: recipient.email,
          subject: personalizedSubject,
          html: htmlContent
        });

        // Registrar en logs
        await supabaseAdmin.from('email_send_logs').insert({
          tenant_id,
          template_id: template_id || null,
          template_name,
          subject: personalizedSubject,
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          status: sendError ? 'failed' : 'sent',
          error_message: sendError ? JSON.stringify(sendError) : null,
          sent_by
        });

        if (sendError) {
          results.failed++;
          results.errors.push(`${recipient.email}: ${JSON.stringify(sendError)}`);
        } else {
          results.sent++;
        }

      } catch (err) {
        results.failed++;
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
        results.errors.push(`${recipient.email}: ${errorMsg}`);

        // Registrar error en logs
        await supabaseAdmin.from('email_send_logs').insert({
          tenant_id,
          template_id: template_id || null,
          template_name,
          subject,
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          status: 'failed',
          error_message: errorMsg,
          sent_by
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: recipients.length,
      sent: results.sent,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors.slice(0, 5) : undefined
    });

  } catch (error) {
    console.error('Error sending emails:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

function replaceVariables(
  text: string, 
  recipient: Recipient, 
  tenant: { name: string; slug: string } | null
): string {
  const now = new Date();
  
  return text
    .replace(/{nombre_cliente}/g, recipient.name)
    .replace(/{email_cliente}/g, recipient.email)
    .replace(/{tenant_nombre}/g, tenant?.name || '')
    .replace(/{fecha}/g, now.toLocaleDateString('es-CO'))
    .replace(/{año}/g, now.getFullYear().toString());
}
