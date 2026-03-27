'use client';

// =====================================================
// COMPONENTE: EmailTemplateEditor (Mejorado)
// Editor de plantillas con envío manual, destinatarios y preview
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Upload,
  X,
  CheckCircle
} from 'lucide-react';
import {
  type EmailTemplate,
  EMAIL_TEMPLATE_VARIABLES,
  replaceTemplateVariables,
  getExampleContext
} from '@/lib/validations/automations';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [htmlBody, setHtmlBody] = useState(template?.html_body || '');
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [recipientType, setRecipientType] = useState<'clients' | 'allies' | 'both'>(
    (template?.recipient_type as 'clients' | 'allies' | 'both') || 'clients'
  );

  // Send state
  const [sendToAll, setSendToAll] = useState(true);
  const [availableRecipients, setAvailableRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const supabase = getBrowserClient();

  // Cargar destinatarios cuando cambia el tipo
  useEffect(() => {
    const loadRecipients = async () => {
      if (!tenantId) return;
      
      setLoadingRecipients(true);
      const recipients: Recipient[] = [];

      try {
        if (recipientType === 'clients' || recipientType === 'both') {
          const { data: clients } = await supabase
            .from('clients')
            .select('id, email, full_name')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .not('email', 'is', null)
            .order('full_name');

          if (clients) {
            clients.forEach(c => {
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
          const { data: allies } = await supabase
            .from('allied_agents')
            .select('id, email, full_name')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .not('email', 'is', null)
            .order('full_name');

          if (allies) {
            allies.forEach(a => {
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

      // Obtener URL pública
      const { data: urlData } = supabase
        .storage
        .from('email-images')
        .getPublicUrl(data.path);

      // Insertar tag de imagen en el cuerpo
      const imgTag = `\n<img src="${urlData.publicUrl}" alt="Imagen" style="max-width: 100%; height: auto;" />\n`;
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

  // Copiar variable
  const handleCopyVariable = (variableName: string) => {
    const variableText = `{${variableName}}`;
    navigator.clipboard.writeText(variableText);
    setCopiedVariable(variableName);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  // Insertar variable
  const insertVariable = (variableName: string) => {
    const variableText = `{${variableName}}`;
    setHtmlBody(prev => prev + variableText);
  };

  // Toggle selección de destinatario
  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev => 
      prev.includes(id) 
        ? prev.filter(r => r !== id)
        : [...prev, id]
    );
  };

  // Seleccionar/deseleccionar todos
  const toggleAllRecipients = () => {
    if (selectedRecipients.length === availableRecipients.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(availableRecipients.map(r => r.id));
    }
  };

  // Guardar plantilla
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        const { error: updateError } = await supabase
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
        const { error: insertError } = await supabase
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

  // Enviar emails
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

  // Preview con datos de ejemplo
  const exampleContext = getExampleContext();
  const previewSubject = replaceTemplateVariables(subject, exampleContext);
  const previewBody = replaceTemplateVariables(htmlBody, exampleContext);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Información básica */}
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
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clients">Solo Clientes</SelectItem>
                <SelectItem value="allies">Solo Aliados</SelectItem>
                <SelectItem value="both">Clientes y Aliados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Variables disponibles */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <Label className="text-sm font-medium mb-3 block">
          Variables disponibles (click para insertar)
        </Label>
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyVariable(variable.name);
                }}
              >
                {copiedVariable === variable.name ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Tabs: Editar / Preview / Enviar */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="edit" className="gap-2">
            <Code className="h-4 w-4" />
            Editar
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            Vista previa
          </TabsTrigger>
          <TabsTrigger value="send" className="gap-2">
            <Send className="h-4 w-4" />
            Enviar
          </TabsTrigger>
        </TabsList>

        {/* Tab: Editar */}
        <TabsContent value="edit" className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4 mr-2" />
              )}
              Subir imagen
            </Button>
            <span className="text-xs text-muted-foreground">
              Máx. 2MB (JPG, PNG, GIF)
            </span>
          </div>

          <div>
            <Label htmlFor="html_body">Contenido del email</Label>
            <Textarea
              id="html_body"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              placeholder={`Estimado/a {nombre_cliente},

Le recordamos que su póliza {poliza} vence el {fecha_vencimiento}.

Atentamente,
{tenant_nombre}`}
              rows={14}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Puedes usar HTML y variables entre llaves {`{variable}`}
            </p>
          </div>
        </TabsContent>

        {/* Tab: Preview */}
        <TabsContent value="preview">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-3 border-b">
              <p className="text-sm text-muted-foreground">Vista previa con datos de ejemplo</p>
            </div>
            <div className="p-4 bg-white min-h-[300px]">
              <div className="mb-4 pb-4 border-b">
                <p className="text-sm text-muted-foreground">Asunto:</p>
                <p className="font-medium">{previewSubject || '(Sin asunto)'}</p>
              </div>
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: previewBody.includes('<') 
                    ? previewBody 
                    : `<div style="white-space: pre-wrap;">${previewBody}</div>` 
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab: Enviar */}
        <TabsContent value="send" className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Destinatarios</span>
                <Badge variant="secondary">
                  {recipientType === 'clients' ? 'Clientes' : 
                   recipientType === 'allies' ? 'Aliados' : 'Todos'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="send_to_all"
                  checked={sendToAll}
                  onCheckedChange={setSendToAll}
                />
                <Label htmlFor="send_to_all" className="text-sm">
                  Enviar a todos ({availableRecipients.length})
                </Label>
              </div>
            </div>

            {!sendToAll && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Seleccionados: {selectedRecipients.length}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllRecipients}
                  >
                    {selectedRecipients.length === availableRecipients.length 
                      ? 'Deseleccionar todos' 
                      : 'Seleccionar todos'}
                  </Button>
                </div>

                <ScrollArea className="h-[200px] border rounded-md p-2">
                  {loadingRecipients ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : availableRecipients.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay destinatarios disponibles
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {availableRecipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => toggleRecipient(recipient.id)}
                        >
                          <Checkbox
                            checked={selectedRecipients.includes(recipient.id)}
                            onCheckedChange={() => toggleRecipient(recipient.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{recipient.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {recipient.type === 'client' ? 'Cliente' : 'Aliado'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
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
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar ahora ({sendToAll ? availableRecipients.length : selectedRecipients.length} emails)
                  </>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Botones de acción */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : (template ? 'Guardar cambios' : 'Crear plantilla')}
        </Button>
      </div>
    </div>
  );
}
