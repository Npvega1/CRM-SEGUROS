'use client';

// =====================================================
// COMPONENTE: EmailTemplateEditor (Editor Visual)
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
import { Slider } from '@/components/ui/slider';
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
  Palette,
  Settings,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import {
  type EmailTemplate,
  EMAIL_TEMPLATE_VARIABLES,
  replaceTemplateVariables,
  getExampleContext
} from '@/lib/validations/automations';

// =====================================================
// TIPOS Y CONFIGURACIÓN
// =====================================================

interface TemplateSettings {
  headerColor: string;
  buttonColor: string;
  fontFamily: string;
  fontSize: string;
  textAlign: 'left' | 'center' | 'right';
  headerText: string;
  greeting: string;
  mainContent: string;
  ctaText: string;
  ctaUrl: string;
  footerText: string;
  showButton: boolean;
}

const DEFAULT_SETTINGS: TemplateSettings = {
  headerColor: '#667eea',
  buttonColor: '#667eea',
  fontFamily: 'Arial, sans-serif',
  fontSize: '16px',
  textAlign: 'left',
  headerText: '{tenant_nombre}',
  greeting: 'Hola, {nombre_cliente}',
  mainContent: 'Escribe aquí el contenido de tu mensaje...',
  ctaText: 'Ver más',
  ctaUrl: '#',
  footerText: '{tenant_nombre} - Tu tranquilidad es nuestra prioridad',
  showButton: true
};

const FONT_OPTIONS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
];

const FONT_SIZE_OPTIONS = [
  { value: '14px', label: 'Pequeño' },
  { value: '16px', label: 'Normal' },
  { value: '18px', label: 'Grande' },
  { value: '20px', label: 'Muy grande' },
];

const PRESET_COLORS = [
  '#667eea', '#764ba2', '#f59e0b', '#10b981', 
  '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899',
  '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

interface PredesignedTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  subject: string;
  settings: Partial<TemplateSettings>;
}

const PREDESIGNED_TEMPLATES: PredesignedTemplate[] = [
  {
    id: 'comunicado',
    name: 'Comunicado General',
    description: 'Header con color, mensaje y footer',
    icon: <Megaphone className="h-5 w-5" />,
    subject: 'Comunicado importante de {tenant_nombre}',
    settings: {
      headerColor: '#667eea',
      buttonColor: '#667eea',
      headerText: '{tenant_nombre}',
      greeting: 'Hola, {nombre_cliente}',
      mainContent: 'Queremos informarte sobre las últimas novedades de nuestra agencia.\n\nEscribe aquí tu mensaje principal.\n\nSi tienes alguna pregunta, no dudes en contactarnos.',
      showButton: false,
      footerText: '{tenant_nombre}'
    }
  },
  {
    id: 'renovacion',
    name: 'Recordatorio de Renovación',
    description: 'Aviso de vencimiento con botón',
    icon: <Bell className="h-5 w-5" />,
    subject: '{nombre_cliente}, tu póliza está próxima a vencer',
    settings: {
      headerColor: '#f59e0b',
      buttonColor: '#f59e0b',
      headerText: '⏰ Recordatorio de Renovación',
      greeting: 'Hola, {nombre_cliente}',
      mainContent: 'Te recordamos que tu póliza está próxima a vencer.\n\n📋 Póliza: {poliza}\n📅 Fecha de vencimiento: {fecha_vencimiento}\n\nPara renovar tu póliza y mantener tu protección activa, contáctanos lo antes posible.',
      ctaText: 'Renovar Ahora',
      showButton: true,
      footerText: '{tenant_nombre} - ¿Preguntas? Responde a este correo.'
    }
  },
  {
    id: 'bienvenida',
    name: 'Bienvenida',
    description: 'Para nuevos clientes o aliados',
    icon: <PartyPopper className="h-5 w-5" />,
    subject: '¡Bienvenido/a a {tenant_nombre}!',
    settings: {
      headerColor: '#10b981',
      buttonColor: '#10b981',
      headerText: '🎉 ¡Bienvenido/a!',
      greeting: 'Hola, {nombre_cliente}',
      mainContent: 'Nos complace darte la bienvenida a {tenant_nombre}. Estamos muy contentos de que formes parte de nuestra familia.\n\nA partir de ahora, contarás con nuestro respaldo y asesoría profesional en todos tus seguros.\n\n¿Qué puedes hacer ahora?\n• Consultar tus pólizas activas\n• Reportar un siniestro\n• Contactar a tu asesor',
      ctaText: 'Acceder a Mi Portal',
      showButton: true,
      footerText: '{tenant_nombre} - Tu tranquilidad es nuestra prioridad.'
    }
  },
  {
    id: 'siniestro',
    name: 'Notificación de Siniestro',
    description: 'Actualización de estado',
    icon: <FileText className="h-5 w-5" />,
    subject: 'Actualización de tu siniestro - {tenant_nombre}',
    settings: {
      headerColor: '#3b82f6',
      buttonColor: '#3b82f6',
      headerText: '📋 Actualización de Siniestro',
      greeting: 'Hola, {nombre_cliente}',
      mainContent: 'Queremos informarte sobre el estado de tu siniestro.\n\n📄 Póliza: {poliza}\n📊 Estado: En revisión\n📅 Fecha de reporte: {fecha}\n\nEscribe aquí los detalles de la actualización.\n\nSi tienes alguna pregunta sobre tu caso, no dudes en contactarnos.',
      showButton: false,
      footerText: '{tenant_nombre} - Estamos aquí para ayudarte.'
    }
  }
];

// =====================================================
// GENERADOR DE HTML
// =====================================================

function generateEmailHTML(settings: TemplateSettings): string {
  const contentLines = settings.mainContent.split('\n').map(line => {
    if (line.trim() === '') return '<br>';
    if (line.startsWith('•')) {
      return `<li style="color: #4b5563; margin: 5px 0;">${line.substring(1).trim()}</li>`;
    }
    return `<p style="color: #4b5563; font-size: ${settings.fontSize}; line-height: 1.6; margin: 0 0 15px 0; text-align: ${settings.textAlign};">${line}</p>`;
  }).join('\n');

  const hasListItems = settings.mainContent.includes('•');
  const contentHTML = hasListItems 
    ? contentLines.replace(/<li/g, '<ul style="padding-left: 20px; margin: 15px 0;"><li').replace(/<\/li>(?![\s\S]*<li)/g, '</li></ul>')
    : contentLines;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ${settings.fontFamily}; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${settings.headerColor} 0%, ${adjustColor(settings.headerColor, -20)} 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; font-family: ${settings.fontFamily};">${settings.headerText}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px; font-family: ${settings.fontFamily};">
              <h2 style="color: #1f2937; margin: 0 0 25px 0; font-size: 22px; text-align: ${settings.textAlign};">${settings.greeting}</h2>
              ${contentHTML}
              ${settings.showButton ? `
              <div style="text-align: center; margin-top: 30px;">
                <a href="${settings.ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, ${settings.buttonColor} 0%, ${adjustColor(settings.buttonColor, -20)} 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: ${settings.fontFamily};">
                  ${settings.ctaText}
                </a>
              </div>
              ` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0; font-family: ${settings.fontFamily};">
                ${settings.footerText}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

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
  const [activeTab, setActiveTab] = useState<'design' | 'preview' | 'code' | 'send'>('design');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templateAny = template as any;
  const [recipientType, setRecipientType] = useState<'clients' | 'allies' | 'both'>(
    templateAny?.recipient_type || 'clients'
  );

  // Visual editor settings
  const [settings, setSettings] = useState<TemplateSettings>(DEFAULT_SETTINGS);
  const [useVisualEditor, setUseVisualEditor] = useState(true);
  const [rawHtml, setRawHtml] = useState('');

  // Send state
  const [sendToAll, setSendToAll] = useState(true);
  const [availableRecipients, setAvailableRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const supabase = getBrowserClient();

  // Generate HTML from settings
  const generatedHtml = useVisualEditor ? generateEmailHTML(settings) : rawHtml;

  // Load existing template
  useEffect(() => {
    if (template?.html_body) {
      setRawHtml(template.html_body);
      setUseVisualEditor(false);
    }
  }, [template]);

  // Load recipients
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
                recipients.push({ id: c.id, email: c.email, name: c.full_name || 'Sin nombre', type: 'client' });
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
                recipients.push({ id: a.id, email: a.email, name: a.full_name || 'Sin nombre', type: 'ally' });
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

  const updateSettings = (key: keyof TemplateSettings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectPredesignedTemplate = (predesigned: PredesignedTemplate) => {
    setSubject(predesigned.subject);
    setSettings({ ...DEFAULT_SETTINGS, ...predesigned.settings });
    setUseVisualEditor(true);
    if (!name) setName(predesigned.name);
    setShowTemplateSelector(false);
    setActiveTab('design');
  };

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
      const { data, error: uploadError } = await supabase.storage.from('email-images').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('email-images').getPublicUrl(data.path);
      const imgTag = `\n\n<img src="${urlData.publicUrl}" alt="Imagen" style="max-width: 100%; height: auto; border-radius: 8px; margin: 20px 0;" />\n\n`;
      
      updateSettings('mainContent', settings.mainContent + imgTag);
      setSuccess('Imagen subida correctamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Error al subir la imagen');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const toggleAllRecipients = () => {
    if (selectedRecipients.length === availableRecipients.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(availableRecipients.map(r => r.id));
    }
  };

  const handleSubmit = async () => {
    if (!tenantId) return;
    if (!name.trim()) { setError('El nombre es requerido'); return; }
    if (!subject.trim()) { setError('El asunto es requerido'); return; }

    setIsSubmitting(true);
    setError(null);

    try {
      const htmlToSave = useVisualEditor ? generateEmailHTML(settings) : rawHtml;

      if (template) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('email_templates')
          .update({ name, subject, html_body: htmlToSave, is_active: isActive, recipient_type: recipientType })
          .eq('id', template.id);
        if (updateError) throw updateError;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from('email_templates')
          .insert({ tenant_id: tenantId, name, subject, html_body: htmlToSave, is_active: isActive, recipient_type: recipientType, created_by: userId });
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
    if (!sendToAll && selectedRecipients.length === 0) { setError('Selecciona al menos un destinatario'); return; }
    if (!subject.trim()) { setError('El asunto es requerido'); return; }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const htmlToSend = useVisualEditor ? generateEmailHTML(settings) : rawHtml;
      
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          template_id: template?.id || null,
          template_name: name || 'Envío manual',
          subject,
          html_body: htmlToSend,
          recipient_type: recipientType,
          recipient_ids: sendToAll ? null : selectedRecipients,
          send_to_all: sendToAll,
          sent_by: userId
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al enviar');

      setSuccess(`Enviados: ${result.sent} de ${result.total} emails`);
      if (result.failed > 0) setError(`Fallaron: ${result.failed} emails`);
    } catch (err) {
      console.error('Error sending emails:', err);
      setError(err instanceof Error ? err.message : 'Error al enviar emails');
    } finally {
      setIsSending(false);
    }
  };

  const exampleContext = getExampleContext();
  const previewHtml = replaceTemplateVariables(generatedHtml, exampleContext);
  const previewSubject = replaceTemplateVariables(subject, exampleContext);

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

      {/* Template Selector for new templates */}
      {!template && useVisualEditor && (
        <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayoutTemplate className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Comienza con una plantilla</p>
                <p className="text-xs text-muted-foreground">Selecciona un diseño y personalízalo</p>
              </div>
            </div>
            <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Palette className="h-4 w-4 mr-2" />Ver Plantillas</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Plantillas Prediseñadas</DialogTitle></DialogHeader>
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  {PREDESIGNED_TEMPLATES.map((pt) => (
                    <div key={pt.id} className="border rounded-lg p-4 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all" onClick={() => handleSelectPredesignedTemplate(pt)}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">{pt.icon}</div>
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

      {/* Basic Info */}
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label htmlFor="name">Nombre de la plantilla</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Recordatorio de renovación" />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Label htmlFor="is_active" className="text-sm">Activa</Label>
            <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="subject">Asunto del email</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej: {nombre_cliente}, información importante" />
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="design" className="gap-2"><Settings className="h-4 w-4" />Diseño</TabsTrigger>
          <TabsTrigger value="preview" className="gap-2"><Eye className="h-4 w-4" />Vista previa</TabsTrigger>
          <TabsTrigger value="code" className="gap-2"><Code className="h-4 w-4" />Código</TabsTrigger>
          <TabsTrigger value="send" className="gap-2"><Send className="h-4 w-4" />Enviar</TabsTrigger>
        </TabsList>

        {/* Design Tab */}
        <TabsContent value="design" className="space-y-6">
          {/* Colors */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-2 block">Color del Header</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${settings.headerColor === color ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => updateSettings('headerColor', color)}
                  />
                ))}
                <input
                  type="color"
                  value={settings.headerColor}
                  onChange={(e) => updateSettings('headerColor', e.target.value)}
                  className="w-8 h-8 rounded-full cursor-pointer border-0"
                  title="Color personalizado"
                />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Color del Botón</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${settings.buttonColor === color ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => updateSettings('buttonColor', color)}
                  />
                ))}
                <input
                  type="color"
                  value={settings.buttonColor}
                  onChange={(e) => updateSettings('buttonColor', e.target.value)}
                  className="w-8 h-8 rounded-full cursor-pointer border-0"
                  title="Color personalizado"
                />
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Tipo de letra</Label>
              <Select value={settings.fontFamily} onValueChange={(v) => updateSettings('fontFamily', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tamaño de letra</Label>
              <Select value={settings.fontSize} onValueChange={(v) => updateSettings('fontSize', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_SIZE_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Alineación</Label>
              <div className="flex gap-1 mt-1">
                {(['left', 'center', 'right'] as const).map(align => (
                  <Button
                    key={align}
                    type="button"
                    variant={settings.textAlign === align ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateSettings('textAlign', align)}
                  >
                    {align === 'left' && <AlignLeft className="h-4 w-4" />}
                    {align === 'center' && <AlignCenter className="h-4 w-4" />}
                    {align === 'right' && <AlignRight className="h-4 w-4" />}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-4">
            <div>
              <Label>Texto del Header</Label>
              <Input value={settings.headerText} onChange={(e) => updateSettings('headerText', e.target.value)} placeholder="{tenant_nombre}" />
            </div>
            <div>
              <Label>Saludo</Label>
              <Input value={settings.greeting} onChange={(e) => updateSettings('greeting', e.target.value)} placeholder="Hola, {nombre_cliente}" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Contenido principal</Label>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage}>
                    {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Textarea
                value={settings.mainContent}
                onChange={(e) => updateSettings('mainContent', e.target.value)}
                rows={8}
                placeholder="Escribe el contenido de tu email..."
              />
              <p className="text-xs text-muted-foreground mt-1">Usa • al inicio de línea para crear listas</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={settings.showButton} onCheckedChange={(v) => updateSettings('showButton', v)} />
                <Label>Mostrar botón</Label>
              </div>
            </div>
            {settings.showButton && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Texto del botón</Label>
                  <Input value={settings.ctaText} onChange={(e) => updateSettings('ctaText', e.target.value)} placeholder="Ver más" />
                </div>
                <div>
                  <Label>URL del botón</Label>
                  <Input value={settings.ctaUrl} onChange={(e) => updateSettings('ctaUrl', e.target.value)} placeholder="https://..." />
                </div>
              </div>
            )}
            <div>
              <Label>Texto del Footer</Label>
              <Input value={settings.footerText} onChange={(e) => updateSettings('footerText', e.target.value)} placeholder="{tenant_nombre}" />
            </div>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-3 border-b">
              <p className="text-sm"><strong>Asunto:</strong> {previewSubject}</p>
            </div>
            <div className="bg-gray-200 p-4">
              <div className="max-w-[600px] mx-auto" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </TabsContent>

        {/* Code Tab */}
        <TabsContent value="code">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Código HTML</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setRawHtml(generatedHtml); setUseVisualEditor(false); }}>
                Copiar del editor visual
              </Button>
            </div>
            <Textarea
              value={useVisualEditor ? generatedHtml : rawHtml}
              onChange={(e) => { setRawHtml(e.target.value); setUseVisualEditor(false); }}
              rows={16}
              className="font-mono text-xs"
            />
            {!useVisualEditor && (
              <Button type="button" variant="outline" size="sm" onClick={() => setUseVisualEditor(true)}>
                Volver al editor visual
              </Button>
            )}
          </div>
        </TabsContent>

        {/* Send Tab */}
        <TabsContent value="send">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Destinatarios</span>
                <Badge variant="secondary">{recipientType === 'clients' ? 'Clientes' : recipientType === 'allies' ? 'Aliados' : 'Todos'}</Badge>
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
                    {selectedRecipients.length === availableRecipients.length ? 'Deseleccionar' : 'Seleccionar todos'}
                  </Button>
                </div>
                <div className="h-[200px] overflow-y-auto border rounded-md p-2">
                  {loadingRecipients ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : availableRecipients.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No hay destinatarios</p>
                  ) : (
                    <div className="space-y-1">
                      {availableRecipients.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer" onClick={() => toggleRecipient(r.id)}>
                          <Checkbox checked={selectedRecipients.includes(r.id)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{r.type === 'client' ? 'Cliente' : 'Aliado'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <Button type="button" onClick={handleSendEmails} disabled={isSending || (!sendToAll && selectedRecipients.length === 0)} className="w-full">
                {isSending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : <><Send className="h-4 w-4 mr-2" />Enviar ahora ({sendToAll ? availableRecipients.length : selectedRecipients.length})</>}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (template ? 'Guardar cambios' : 'Crear plantilla')}
        </Button>
      </div>
    </div>
  );
}
