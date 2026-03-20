'use client';

// =====================================================
// COMPONENTE: AutomationBuilder
// Constructor visual CUANDO / SI / ENTONCES
// =====================================================

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Trash2,
  GripVertical,
  Zap,
  Filter,
  Play,
  Mail,
  Bell,
  CheckSquare,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import {
  type AutomationWithStats,
  type AutomationCondition,
  type AutomationActionInput,
  type TriggerEvent,
  type ActionType,
  type EmailTemplate,
  TriggerEventEnum,
  ActionTypeEnum,
  ConditionOperatorEnum,
  TRIGGER_EVENT_LABELS,
  TRIGGER_EVENT_DESCRIPTIONS,
  ACTION_TYPE_LABELS,
  OPERATOR_LABELS,
  TRIGGER_FIELDS
} from '@/lib/validations/automations';

interface AutomationBuilderProps {
  automation: AutomationWithStats | null;
  templates: EmailTemplate[];
  onSave: () => void;
  onCancel: () => void;
}

const ACTION_ICONS: Record<ActionType, React.ReactNode> = {
  'send_email': <Mail className="h-4 w-4" />,
  'create_task': <CheckSquare className="h-4 w-4" />,
  'in_app_notification': <Bell className="h-4 w-4" />,
  'move_pipeline_stage': <ArrowRight className="h-4 w-4" />
};

export function AutomationBuilder({
  automation,
  templates,
  onSave,
  onCancel
}: AutomationBuilderProps) {
  const { tenantId, userId } = useTenant();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState(automation?.name || '');
  const [description, setDescription] = useState(automation?.description || '');
  const [isActive, setIsActive] = useState(automation?.is_active ?? true);
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerEvent | ''>(automation?.trigger_event || '');
  const [conditions, setConditions] = useState<AutomationCondition[]>(automation?.conditions || []);
  const [actions, setActions] = useState<AutomationActionInput[]>([]);
  const [pipelineStages, setPipelineStages] = useState<{ id: string; name: string }[]>([]);

  const supabase = getBrowserClient();

  // Cargar datos existentes si estamos editando
  useEffect(() => {
    if (automation) {
      loadExistingActions();
    }
  }, [automation]);

  // Cargar etapas de pipeline
  useEffect(() => {
    const loadStages = async () => {
      if (!tenantId) return;
      const { data } = await supabase
        .from('pipeline_stages')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('order_index');
      if (data) setPipelineStages(data);
    };
    loadStages();
  }, [tenantId, supabase]);

  const loadExistingActions = async () => {
    if (!automation) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('automation_actions')
      .select('*')
      .eq('automation_id', automation.id)
      .order('order_index');
    
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setActions(data.map((a: Record<string, unknown>) => ({
        action_type: a.action_type as ActionType,
        action_config: (a.action_config || {}) as Record<string, unknown>,
        order_index: a.order_index as number
      })));
    }
  };

  // Agregar condición
  const addCondition = () => {
    const fields = selectedTrigger ? TRIGGER_FIELDS[selectedTrigger] : [];
    const defaultField = fields[0]?.name || '';
    setConditions([...conditions, { field: defaultField, operator: 'equals', value: '' }]);
  };

  // Eliminar condición
  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  // Actualizar condición
  const updateCondition = (index: number, field: keyof AutomationCondition, value: string | number | boolean | null) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConditions(updated);
  };

  // Agregar acción
  const addAction = (type: ActionType) => {
    const newAction: AutomationActionInput = {
      action_type: type,
      action_config: getDefaultActionConfig(type),
      order_index: actions.length
    };
    setActions([...actions, newAction]);
  };

  // Eliminar acción
  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index).map((a, i) => ({ ...a, order_index: i })));
  };

  // Actualizar configuración de acción
  const updateActionConfig = (index: number, key: string, value: unknown) => {
    const updated = [...actions];
    updated[index] = {
      ...updated[index],
      action_config: { ...updated[index].action_config, [key]: value }
    };
    setActions(updated);
  };

  // Configuración por defecto según tipo de acción
  const getDefaultActionConfig = (type: ActionType): Record<string, unknown> => {
    switch (type) {
      case 'send_email':
        return { template_id: '', to_field: 'client.email' };
      case 'create_task':
        return { subject: '', description: '', assign_to: 'agent', due_days: 1 };
      case 'in_app_notification':
        return { title: '', body: '', notify_to: 'agent' };
      case 'move_pipeline_stage':
        return { target_stage_id: '' };
      default:
        return {};
    }
  };

  // Guardar automatización
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tenantId || !selectedTrigger) return;
    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (actions.length === 0) {
      setError('Debes agregar al menos una acción');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      let automationId = automation?.id;

      if (automation) {
        // Actualizar automatización existente
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('automations')
          .update({
            name,
            description: description || null,
            is_active: isActive,
            trigger_event: selectedTrigger,
            conditions: conditions
          })
          .eq('id', automation.id);

        if (updateError) throw updateError;

        // Eliminar acciones existentes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('automation_actions')
          .delete()
          .eq('automation_id', automation.id);
      } else {
        // Crear nueva automatización
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newAutomation, error: insertError } = await (supabase as any)
          .from('automations')
          .insert({
            tenant_id: tenantId,
            name,
            description: description || null,
            is_active: isActive,
            trigger_event: selectedTrigger,
            conditions: conditions,
            created_by: userId
          })
          .select()
          .single();

        if (insertError) throw insertError;
        automationId = newAutomation.id;
      }

      // Insertar acciones
      const actionsToInsert = actions.map((action, index) => ({
        automation_id: automationId,
        action_type: action.action_type,
        action_config: action.action_config,
        order_index: index
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: actionsError } = await (supabase as any)
        .from('automation_actions')
        .insert(actionsToInsert);

      if (actionsError) throw actionsError;

      onSave();
    } catch (err) {
      console.error('Error saving automation:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generar descripción en lenguaje natural
  const getNaturalLanguageDescription = () => {
    if (!selectedTrigger) return '';

    const parts = [];
    parts.push(`CUANDO: ${TRIGGER_EVENT_LABELS[selectedTrigger]}`);

    if (conditions.length > 0) {
      const conditionTexts = conditions.map(c => {
        const fieldDef = TRIGGER_FIELDS[selectedTrigger]?.find(f => f.name === c.field);
        return `${fieldDef?.label || c.field} ${OPERATOR_LABELS[c.operator]} ${c.value || ''}`;
      });
      parts.push(`SI: ${conditionTexts.join(' Y ')}`);
    }

    if (actions.length > 0) {
      const actionTexts = actions.map(a => ACTION_TYPE_LABELS[a.action_type]);
      parts.push(`ENTONCES: ${actionTexts.join(', ')}`);
    }

    return parts.join('\n');
  };

  const triggerFields = selectedTrigger ? TRIGGER_FIELDS[selectedTrigger] : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Información básica */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="name">Nombre de la automatización</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Notificar pólizas por vencer"
            data-testid="automation-name-input"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="description">Descripción (opcional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe qué hace esta automatización..."
            rows={2}
          />
        </div>
      </div>

      {/* Sección CUANDO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            CUANDO (Evento Trigger)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select 
            value={selectedTrigger} 
            onValueChange={(value: TriggerEvent) => {
              setSelectedTrigger(value);
              setConditions([]); // Limpiar condiciones al cambiar trigger
            }}
          >
            <SelectTrigger data-testid="trigger-select">
              <SelectValue placeholder="Selecciona un evento..." />
            </SelectTrigger>
            <SelectContent>
              {TriggerEventEnum.options.map((event) => (
                <SelectItem key={event} value={event}>
                  <div>
                    <div className="font-medium">{TRIGGER_EVENT_LABELS[event]}</div>
                    <div className="text-xs text-muted-foreground">
                      {TRIGGER_EVENT_DESCRIPTIONS[event]}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Sección SI (Condiciones) */}
      {selectedTrigger && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-500" />
                SI (Condiciones opcionales)
              </CardTitle>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={addCondition}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar condición
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {conditions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin condiciones: se ejecutará siempre que ocurra el evento
              </p>
            ) : (
              <div className="space-y-3">
                {conditions.map((condition, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Select
                      value={condition.field}
                      onValueChange={(value) => updateCondition(index, 'field', value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Campo" />
                      </SelectTrigger>
                      <SelectContent>
                        {triggerFields.map((field) => (
                          <SelectItem key={field.name} value={field.name}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={condition.operator}
                      onValueChange={(value) => updateCondition(index, 'operator', value)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Operador" />
                      </SelectTrigger>
                      <SelectContent>
                        {ConditionOperatorEnum.options.map((op) => (
                          <SelectItem key={op} value={op}>
                            {OPERATOR_LABELS[op]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {condition.operator !== 'is_empty' && condition.operator !== 'is_not_empty' && (
                      <Input
                        value={String(condition.value || '')}
                        onChange={(e) => updateCondition(index, 'value', e.target.value)}
                        placeholder="Valor"
                        className="flex-1"
                      />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sección ENTONCES (Acciones) */}
      {selectedTrigger && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Play className="h-4 w-4 text-green-500" />
                ENTONCES (Acciones)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {/* Botones para agregar acciones */}
            <div className="flex flex-wrap gap-2 mb-4">
              {ActionTypeEnum.options.map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addAction(type)}
                  data-testid={`add-action-${type}`}
                >
                  {ACTION_ICONS[type]}
                  <span className="ml-1">{ACTION_TYPE_LABELS[type]}</span>
                </Button>
              ))}
            </div>

            {/* Lista de acciones */}
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Agrega al menos una acción para esta automatización
              </p>
            ) : (
              <div className="space-y-3">
                {actions.map((action, index) => (
                  <div 
                    key={index} 
                    className="p-4 border rounded-lg bg-muted/30"
                    data-testid={`action-item-${index}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                        <Badge variant="secondary" className="gap-1">
                          {ACTION_ICONS[action.action_type]}
                          {ACTION_TYPE_LABELS[action.action_type]}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAction(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    {/* Configuración específica según tipo */}
                    {action.action_type === 'send_email' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Plantilla de email</Label>
                          <Select
                            value={action.action_config.template_id as string || ''}
                            onValueChange={(value) => updateActionConfig(index, 'template_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar plantilla..." />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.filter(t => t.is_active).map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Enviar a</Label>
                          <Select
                            value={action.action_config.to_field as string || 'client.email'}
                            onValueChange={(value) => updateActionConfig(index, 'to_field', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="client.email">Email del cliente</SelectItem>
                              <SelectItem value="agent.email">Email del agente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {action.action_type === 'create_task' && (
                      <div className="grid gap-3">
                        <div>
                          <Label>Asunto de la tarea</Label>
                          <Input
                            value={action.action_config.subject as string || ''}
                            onChange={(e) => updateActionConfig(index, 'subject', e.target.value)}
                            placeholder="Ej: Llamar a cliente por renovación"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label>Asignar a</Label>
                            <Select
                              value={action.action_config.assign_to as string || 'agent'}
                              onValueChange={(value) => updateActionConfig(index, 'assign_to', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="agent">Agente del cliente</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Vence en (días)</Label>
                            <Input
                              type="number"
                              min={1}
                              max={365}
                              value={action.action_config.due_days as number || 1}
                              onChange={(e) => updateActionConfig(index, 'due_days', parseInt(e.target.value) || 1)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {action.action_type === 'in_app_notification' && (
                      <div className="grid gap-3">
                        <div>
                          <Label>Título</Label>
                          <Input
                            value={action.action_config.title as string || ''}
                            onChange={(e) => updateActionConfig(index, 'title', e.target.value)}
                            placeholder="Ej: Nueva póliza activada"
                          />
                        </div>
                        <div>
                          <Label>Mensaje (opcional)</Label>
                          <Textarea
                            value={action.action_config.body as string || ''}
                            onChange={(e) => updateActionConfig(index, 'body', e.target.value)}
                            placeholder="Detalle de la notificación..."
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label>Notificar a</Label>
                          <Select
                            value={action.action_config.notify_to as string || 'agent'}
                            onValueChange={(value) => updateActionConfig(index, 'notify_to', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="agent">Agente del cliente</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="all_admins">Todos los administradores</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {action.action_type === 'move_pipeline_stage' && (
                      <div>
                        <Label>Mover a etapa</Label>
                        <Select
                          value={action.action_config.target_stage_id as string || ''}
                          onValueChange={(value) => updateActionConfig(index, 'target_stage_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar etapa..." />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelineStages.map((stage) => (
                              <SelectItem key={stage.id} value={stage.id}>
                                {stage.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview en lenguaje natural */}
      {selectedTrigger && actions.length > 0 && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Vista previa</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap text-muted-foreground">
              {getNaturalLanguageDescription()}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Botones de acción */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || !selectedTrigger || actions.length === 0}
          data-testid="save-automation-btn"
        >
          {isSubmitting ? 'Guardando...' : (automation ? 'Guardar cambios' : 'Crear automatización')}
        </Button>
      </div>
    </form>
  );
}
