'use client';

// =====================================================
// COMPONENTE: EmailTemplateEditor (Con Plantillas Prediseñadas)
// =====================================================

import { useState, useEffect, useRef } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  Eye,
  Code,
  Copy,
  Check,
  Send,
  Users,
  Loader2,
  Image as ImageIcon,
  X,
  CheckCircle,
  LayoutTemplate,
  Megaphone,
  Bell,
  PartyPopper,
  FileText,
  Palette
} from 'lucide-react';
import {
  type EmailTemplate,
  EMAIL_TEMPLATE_VARIABLES,
  replaceTemplateVariables,
  getExampleContext
} from '@/lib/validations/automations';

// =====================================================
// PLANTILLAS PREDISEÑADAS
// =====================================================

interface PredesignedTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  subject: string;
  html: string;
}

const PREDESIGNED_TEMPLATES: PredesignedTemplate[] = [
  {
    id: 'comunicado',
    name: 'Comunicado General',
    description: 'Header con color, mensaje y footer',
    icon: <Megaphone className="h-5 w-5" />,
    subject: 'Comunicado importante de {tenant_nombre}',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">{tenant_nombre}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">Hola, {nombre_cliente}</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Queremos informarte sobre las últimas novedades de nuestra agencia.
              </p>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                [Escribe aquí tu mensaje principal]
              </p>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0;">
                Si tienes alguna pregunta, no dudes en contactarnos.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                <strong>{tenant_nombre}</strong>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Este correo fue enviado a {email_cliente}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'renovacion',
    name: 'Recordatorio de Renovación',
    description: 'Aviso de vencimiento con botón de acción',
    icon: <Bell className="h-5 w-5" />,
    subject: '{nombre_cliente}, tu póliza está próxima a vencer',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">⏰</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Recordatorio de Renovación</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">Hola, {nombre_cliente}</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Te recordamos que tu póliza <strong>{poliza}</strong> está próxima a vencer.
              </p>
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="color: #92400e; font-size: 16px; margin: 0;">
                  <strong>Fecha de vencimiento:</strong> {fecha_vencimiento}
                </p>
              </div>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Para renovar tu póliza y mantener tu protección activa, contáctanos lo antes posible.
              </p>
              <div style="text-align: center;">
                <a href="#" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Renovar Ahora
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                <strong>{tenant_nombre}</strong>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                ¿Preguntas? Responde a este correo o llámanos.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'bienvenida',
    name: 'Bienvenida',
    description: 'Para nuevos clientes o aliados',
    icon: <PartyPopper className="h-5 w-5" />,
    subject: '¡Bienvenido/a a {tenant_nombre}!',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 50px 40px; text-align: center;">
              <div style="font-size: 56px; margin-bottom: 15px;">🎉</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">¡Bienvenido/a!</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">Hola, {nombre_cliente}</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Nos complace darte la bienvenida a <strong>{tenant_nombre}</strong>. Estamos muy contentos de que formes parte de nuestra familia.
              </p>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                A partir de ahora, contarás con nuestro respaldo y asesoría profesional en todos tus seguros.
              </p>
              <div style="background-color: #ecfdf5; padding: 25px; border-radius: 8px; margin: 25px 0;">
                <h3 style="color: #065f46; margin: 0 0 15px 0; font-size: 18px;">¿Qué puedes hacer ahora?</h3>
                <ul style="color: #047857; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Consultar tus pólizas activas</li>
                  <li>Reportar un siniestro</li>
                  <li>Contactar a tu asesor</li>
                </ul>
              </div>
              <div style="text-align: center; margin-top: 30px;">
                <a href="#" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Acceder a Mi Portal
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                <strong>{tenant_nombre}</strong>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Tu tranquilidad es nuestra prioridad.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'siniestro',
    name: 'Notificación de Siniestro',
    description: 'Actualización de estado de reclamación',
    icon: <FileText className="h-5 w-5" />,
    subject: 'Actualización de tu siniestro - {tenant_nombre}',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Actualización de Siniestro</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">Hola, {nombre_cliente}</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Queremos informarte sobre el estado de tu siniestro.
              </p>
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 25px; border-radius: 8px; margin: 25px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #6b7280; font-size: 14px;">Póliza:</span>
                      <span style="color: #1f2937; font-size: 14px; font-weight: 600; float: right;">{poliza}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px;">Estado:</span>
                      <span style="color: #1d4ed8; font-size: 14px; font-weight: 600; float: right;">En revisión</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px;">Fecha de reporte:</span>
                      <span style="color: #1f2937; font-size: 14px; font-weight: 600; float: right;">{fecha}</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                [Escribe aquí los detalles de la actualización]
              </p>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0;">
                Si tienes alguna pregunta sobre tu caso, no dudes en contactarnos.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                <strong>{tenant_nombre}</strong>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Estamos aquí para ayudarte.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }
];

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

interface EmailTemplateEditorProps {
  template: EmailTemplate | null;
  onSave: () => void;
  onCancel: () => void;
}

interface Recipient {
  id: string;
  email: string;
  name: string;
  type: 'client' | 'ally';
}

export function EmailTemplateEditor({
  template,
  onSave,
  onCancel
}: EmailTemplateEditorProps) {
  const { tenantId, userId } = useTenant();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'send'>('edit');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [htmlBody, setHtmlBody] = useState(template?.html_body || '');
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templateAny = template as any;
  const [recipientType, setRecipientType] = useState<'clients' | 'allies' | 'both'>(
    templateAny?.recipient_type || 'clients'
  );

  // Send state
  const [sendToAll, setSendToAll] = useState(true);
  const [availableRecipients, setAvailableRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const supabase = getBrowserClient();

  // Cargar destinatarios
  useEffect(() => {
    const loadRecipients = async () => {
      if (!tenantId) return;
      
      setLoadingRecipients(true);
      const recipients: Recipient[] = [];

      try {
        if (recipientType === 'clients' || recipientType === 'both') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: clients } = await (supabase as any)
            .from('clients')
            .select('id, email, full_name')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .not('email', 'is', null)
            .order('full_name');

          if (clients) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            clients.forEach((c: any) => {
              if (c.email) {
                recipients.push({
                  id: c.id,
                  email: c.email,
                  name: c.full_name || 'Sin nombre',
                  type: 'client'
                });
              }
            });
          }
        }

        if (recipientType === 'allies' || recipientType === 'both') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: allies } = await (supabase as any)
            .from('allied_agents')
            .select('id, email, full_name')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .not('email', 'is', null)
            .order('full_name');

          if (allies) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            allies.forEach((a: any) => {
              if (a.email) {
                recipients.push({
                  id: a.id,
                  email: a.email,
                  name: a.full_name || 'Sin nombre',
                  type: 'ally'
                });
              }
            });
          }
        }

        setAvailableRecipients(recipients);
      } catch (err) {
        console.error('Error loading recipients:', err);
      } finally {
        setLoadingRecipients(false);
      }
    };

    loadRecipients();
  }, [tenantId, recipientType, supabase]);

  // Seleccionar plantilla prediseñada
  const handleSelectPredesignedTemplate = (predesigned: PredesignedTemplate) => {
    setSubject(predesigned.subject);
    setHtmlBody(predesigned.html);
    if (!name) {
      setName(predesigned.name);
    }
    setShowTemplateSelector(false);
    setActiveTab('preview');
  };

  // Subir imagen
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen no puede superar 2MB');
      return;
    }

    setIsUploadingImage(true);
    setError(null);

    try {
      const fileName = `${tenantId}/${Date.now()}_${file.name}`;
      
      const { data, error: uploadError } = await supabase
        .storage
        .from('email-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase
        .storage
        .from('email-images')
        .getPublicUrl(data.path);

      const imgTag = `\n\n<div style="text-align: center; margin: 20px 0;">\n  <img src="${urlData.publicUrl}" alt="Imagen" style="max-width: 100%; height: auto; border-radius: 8px;" />\n</div>\n\n`;
      setHtmlBody(prev => prev + imgTag);

      setSuccess('Imagen subida correctamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Error al subir la imagen');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCopyVariable = (variableName: string) => {
    const variableText = `{${variableName}}`;
    navigator.clipboard.writeText(variableText);
    setCopiedVariable(variableName);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  const insertVariable = (variableName: string) => {
    const variableText = `{${variableName}}`;
    setHtmlBody(prev => prev + variableText);
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev => 
      prev.includes(id) 
        ? prev.filter(r => r !== id)
        : [...prev, id]
    );
  };

  const toggleAllRecipients = () => {
    if (selectedRecipients.length === availableRecipients.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(availableRecipients.map(r => r.id));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!tenantId) return;
    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (!subject.trim()) {
      setError('El asunto es requerido');
      return;
    }
    if (!htmlBody.trim()) {
      setError('El contenido es requerido');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (template) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('email_templates')
          .update({
            name,
            subject,
            html_body: htmlBody,
            is_active: isActive,
            recipient_type: recipientType
          })
          .eq('id', template.id);

        if (updateError) throw updateError;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from('email_templates')
          .insert({
            tenant_id: tenantId,
            name,
            subject,
            html_body: htmlBody,
            is_active: isActive,
            recipient_type: recipientType,
            created_by: userId
          });

        if (insertError) throw insertError;
      }

      onSave();
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmails = async () => {
    if (!tenantId || !userId) return;

    if (!sendToAll && selectedRecipients.length === 0) {
      setError('Selecciona al menos un destinatario');
      return;
    }

    if (!subject.trim() || !htmlBody.trim()) {
      setError('El asunto y contenido son requeridos');
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          template_id: template?.id || null,
          template_name: name || 'Envío manual',
          subject,
          html_body: htmlBody,
          recipient_type: recipientType,
          recipient_ids: sendToAll ? null : selectedRecipients,
          send_to_all: sendToAll,
          sent_by: userId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar');
      }

      setSuccess(`Enviados: ${result.sent} de ${result.total} emails`);
      
      if (result.failed > 0) {
        setError(`Fallaron: ${result.failed} emails`);
      }

    } catch (err) {
      console.error('Error sending emails:', err);
      setError(err instanceof Error ? err.message : 'Error al enviar emails');
    } finally {
      setIsSending(false);
    }
  };

  const exampleContext = getExampleContext();
  const previewSubject = replaceTemplateVariables(subject, exampleContext);
  const previewBody = replaceTemplateVariables(htmlBody, exampleContext);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Selector de plantillas prediseñadas */}
      {!template && (
        <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayoutTemplate className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">¿Comenzar con una plantilla?</p>
                <p className="text-xs text-muted-foreground">Selecciona un diseño profesional como base</p>
              </div>
            </div>
            <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Palette className="h-4 w-4 mr-2" />
                  Ver Plantillas
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Plantillas Prediseñadas</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  {PREDESIGNED_TEMPLATES.map((pt) => (
                    <div
                      key={pt.id}
                      className="border rounded-lg p-4 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
                      onClick={() => handleSelectPredesignedTemplate(pt)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          {pt.icon}
                        </div>
                        <div>
                          <h4 className="font-medium">{pt.name}</h4>
                          <p className="text-xs text-muted-foreground">{pt.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label htmlFor="name">Nombre de la plantilla</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Recordatorio de renovación"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Label htmlFor="is_active" className="text-sm">Activa</Label>
            <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="subject">Asunto del email</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ej: {nombre_cliente}, tu póliza vence pronto"
            />
          </div>
          <div>
            <Label htmlFor="recipient_type">Tipo de destinatarios</Label>
            <Select value={recipientType} onValueChange={(v) => setRecipientType(v as typeof recipientType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clients">Solo Clientes</SelectItem>
                <SelectItem value="allies">Solo Aliados</SelectItem>
                <SelectItem value="both">Clientes y Aliados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-muted/30">
        <Label className="text-sm font-medium mb-3 block">Variables disponibles (click para insertar)</Label>
        <div className="flex flex-wrap gap-2">
          {EMAIL_TEMPLATE_VARIABLES.map((variable) => (
            <Badge
              key={variable.name}
              variant="outline"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors group"
              onClick={() => insertVariable(variable.name)}
              title={`Ejemplo: ${variable.example}`}
            >
              <span className="mr-1">{`{${variable.name}}`}</span>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleCopyVariable(variable.name); }}
              >
                {copiedVariable === variable.name ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="edit" className="gap-2"><Code className="h-4 w-4" />Editar</TabsTrigger>
          <TabsTrigger value="preview" className="gap-2"><Eye className="h-4 w-4" />Vista previa</TabsTrigger>
          <TabsTrigger value="send" className="gap-2"><Send className="h-4 w-4" />Enviar</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4">
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage}>
              {isUploadingImage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
              Subir imagen
            </Button>
            <span className="text-xs text-muted-foreground">Máx. 2MB</span>
          </div>
          <div>
            <Label htmlFor="html_body">Contenido del email (HTML)</Label>
            <Textarea
              id="html_body"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              placeholder={`Escribe el contenido de tu email aquí...`}
              rows={16}
              className="font-mono text-sm"
            />
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-3 border-b flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Vista previa con datos de ejemplo</p>
            </div>
            <div className="bg-gray-100 p-4">
              <div className="mb-3 bg-white rounded-lg p-3 border">
                <p className="text-sm text-muted-foreground">Asunto:</p>
                <p className="font-medium">{previewSubject || '(Sin asunto)'}</p>
              </div>
              <div 
                className="bg-white rounded-lg overflow-hidden"
                dangerouslySetInnerHTML={{ 
                  __html: previewBody.includes('<') ? previewBody : `<div style="padding: 20px; white-space: pre-wrap;">${previewBody}</div>` 
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="send" className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Destinatarios</span>
                <Badge variant="secondary">
                  {recipientType === 'clients' ? 'Clientes' : recipientType === 'allies' ? 'Aliados' : 'Todos'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="send_to_all" checked={sendToAll} onCheckedChange={setSendToAll} />
                <Label htmlFor="send_to_all" className="text-sm">Enviar a todos ({availableRecipients.length})</Label>
              </div>
            </div>

            {!sendToAll && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Seleccionados: {selectedRecipients.length}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={toggleAllRecipients}>
                    {selectedRecipients.length === availableRecipients.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </Button>
                </div>
                <div className="h-[200px] overflow-y-auto border rounded-md p-2">
                  {loadingRecipients ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : availableRecipients.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No hay destinatarios disponibles</p>
                  ) : (
                    <div className="space-y-1">
                      {availableRecipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => toggleRecipient(recipient.id)}
                        >
                          <Checkbox checked={selectedRecipients.includes(recipient.id)} onCheckedChange={() => toggleRecipient(recipient.id)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{recipient.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{recipient.type === 'client' ? 'Cliente' : 'Aliado'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <Button
                type="button"
                onClick={handleSendEmails}
                disabled={isSending || (!sendToAll && selectedRecipients.length === 0)}
                className="w-full"
              >
                {isSending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Enviar ahora ({sendToAll ? availableRecipients.length : selectedRecipients.length} emails)</>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => handleSubmit()} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (template ? 'Guardar cambios' : 'Crear plantilla')}
        </Button>
      </div>
    </div>
  );
}
