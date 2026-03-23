'use client';

// =====================================================
// COMPONENTE: EmailTemplateEditor
// Editor de plantillas de email con preview
// =====================================================

import { useState } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  Eye,
  Code,
  Copy,
  Check
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

export function EmailTemplateEditor({
  template,
  onSave,
  onCancel
}: EmailTemplateEditorProps) {
  const { tenantId, userId } = useTenant();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');

  // Form state
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [htmlBody, setHtmlBody] = useState(template?.html_body || '');
  const [isActive, setIsActive] = useState(template?.is_active ?? true);

  const supabase = getBrowserClient();

  // Copiar variable al portapapeles
  const handleCopyVariable = (variableName: string) => {
    const variableText = `{${variableName}}`;
    navigator.clipboard.writeText(variableText);
    setCopiedVariable(variableName);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  // Insertar variable en el cuerpo del email
  const insertVariable = (variableName: string) => {
    const variableText = `{${variableName}}`;
    setHtmlBody(htmlBody + variableText);
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
        // Actualizar plantilla existente
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('email_templates')
          .update({
            name,
            subject,
            html_body: htmlBody,
            is_active: isActive
          })
          .eq('id', template.id);

        if (updateError) throw updateError;
      } else {
        // Crear nueva plantilla
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from('email_templates')
          .insert({
            tenant_id: tenantId,
            name,
            subject,
            html_body: htmlBody,
            is_active: isActive,
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

  // Generar preview con datos de ejemplo
  const exampleContext = getExampleContext();
  const previewSubject = replaceTemplateVariables(subject, exampleContext);
  const previewBody = replaceTemplateVariables(htmlBody, exampleContext);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Información básica */}
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-4">
            <Label htmlFor="name">Nombre de la plantilla</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Recordatorio de renovación"
              data-testid="template-name-input"
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

        <div>
          <Label htmlFor="subject">Asunto del email</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ej: {nombre_cliente}, tu póliza vence pronto"
            data-testid="template-subject-input"
          />
        </div>
      </div>

      {/* Panel de variables */}
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
        <p className="text-xs text-muted-foreground mt-2">
          Las variables serán reemplazadas con datos reales al enviar el email
        </p>
      </div>

      {/* Editor / Preview */}
      <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as 'edit' | 'preview')}>
        <TabsList className="mb-4">
          <TabsTrigger value="edit" className="gap-2">
            <Code className="h-4 w-4" />
            Editar
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            Vista previa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <div>
            <Label htmlFor="html_body">Contenido del email</Label>
            <Textarea
              id="html_body"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              placeholder={`Estimado/a {nombre_cliente},

Le recordamos que su póliza {poliza} con {aseguradora} vence el {fecha_vencimiento}.

Para renovar su póliza, por favor comuníquese con nosotros.

Atentamente,
{agente}
{tenant_nombre}`}
              rows={12}
              className="font-mono text-sm"
              data-testid="template-body-input"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Puedes usar las variables entre llaves {`{variable}`} que serán reemplazadas al enviar
            </p>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-3 border-b">
              <p className="text-sm text-muted-foreground">Vista previa con datos de ejemplo</p>
            </div>
            <div className="p-4 bg-white">
              <div className="mb-4 pb-4 border-b">
                <p className="text-sm text-muted-foreground">Asunto:</p>
                <p className="font-medium">{previewSubject || '(Sin asunto)'}</p>
              </div>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm bg-transparent p-0 m-0">
                  {previewBody || '(Sin contenido)'}
                </pre>
              </div>
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
          type="submit" 
          disabled={isSubmitting}
          data-testid="save-template-btn"
        >
          {isSubmitting ? 'Guardando...' : (template ? 'Guardar cambios' : 'Crear plantilla')}
        </Button>
      </div>
    </form>
  );
}
