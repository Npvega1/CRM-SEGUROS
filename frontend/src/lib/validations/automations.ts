// =====================================================
// VALIDACIONES ZOD - Automatizaciones y Workflows
// Módulo 06: Automations
// TypeScript estricto - NO usar 'any'
// =====================================================

import { z } from 'zod';

// =====================================================
// ENUMS
// =====================================================

/**
 * Eventos que disparan automatizaciones
 */
export const TriggerEventEnum = z.enum([
  'policy.expiring',
  'policy.activated',
  'invoice.overdue',
  'claim.created',
  'claim.status_changed',
  'opportunity.stage_changed',
  'client.created'
]);
export type TriggerEvent = z.infer<typeof TriggerEventEnum>;

/**
 * Tipos de acciones
 */
export const ActionTypeEnum = z.enum([
  'send_email',
  'create_task',
  'in_app_notification',
  'move_pipeline_stage'
]);
export type ActionType = z.infer<typeof ActionTypeEnum>;

/**
 * Estado de la cola de automatizaciones
 */
export const QueueStatusEnum = z.enum([
  'pending',
  'processing',
  'done',
  'error'
]);
export type QueueStatus = z.infer<typeof QueueStatusEnum>;

/**
 * Estado de ejecución en logs
 */
export const LogStatusEnum = z.enum([
  'success',
  'error'
]);
export type LogStatus = z.infer<typeof LogStatusEnum>;

/**
 * Operadores para condiciones
 */
export const ConditionOperatorEnum = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'greater_or_equal',
  'less_or_equal',
  'is_empty',
  'is_not_empty'
]);
export type ConditionOperator = z.infer<typeof ConditionOperatorEnum>;

// =====================================================
// SCHEMAS ZOD - Condiciones
// =====================================================

/**
 * Schema para una condición
 */
export const AutomationConditionSchema = z.object({
  field: z.string().min(1, 'El campo es requerido'),
  operator: ConditionOperatorEnum,
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional()
});

export type AutomationCondition = z.infer<typeof AutomationConditionSchema>;

// =====================================================
// SCHEMAS ZOD - Configuración de Acciones
// =====================================================

/**
 * Configuración para send_email
 */
export const SendEmailConfigSchema = z.object({
  template_id: z.string().uuid('ID de plantilla inválido'),
  to_field: z.string().min(1, 'Campo destinatario requerido').default('client.email'),
  cc: z.string().optional(),
  bcc: z.string().optional()
});

/**
 * Configuración para create_task
 */
export const CreateTaskConfigSchema = z.object({
  subject: z.string().min(1, 'Asunto requerido').max(200),
  description: z.string().optional(),
  assign_to: z.enum(['agent', 'admin', 'specific_user']).default('agent'),
  specific_user_id: z.string().uuid().optional(),
  due_days: z.number().int().min(0).max(365).default(1)
});

/**
 * Configuración para in_app_notification
 */
export const InAppNotificationConfigSchema = z.object({
  title: z.string().min(1, 'Título requerido').max(200),
  body: z.string().optional(),
  notify_to: z.enum(['agent', 'admin', 'all_admins', 'specific_user']).default('agent'),
  specific_user_id: z.string().uuid().optional()
});

/**
 * Configuración para move_pipeline_stage
 */
export const MovePipelineStageConfigSchema = z.object({
  target_stage_id: z.string().uuid('ID de etapa inválido')
});

/**
 * Configuración de acción (unión de todos los tipos)
 */
export const ActionConfigSchema = z.union([
  SendEmailConfigSchema,
  CreateTaskConfigSchema,
  InAppNotificationConfigSchema,
  MovePipelineStageConfigSchema
]);

export type ActionConfig = z.infer<typeof ActionConfigSchema>;

// =====================================================
// SCHEMAS ZOD - Automation
// =====================================================

/**
 * Schema completo de Automation
 */
export const AutomationSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  is_active: z.boolean(),
  trigger_event: TriggerEventEnum,
  conditions: z.array(AutomationConditionSchema),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type Automation = z.infer<typeof AutomationSchema>;

/**
 * Schema para crear automatización
 */
export const AutomationCreateSchema = z.object({
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(200, 'Máximo 200 caracteres'),
  description: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().default(true),
  trigger_event: TriggerEventEnum,
  conditions: z.array(AutomationConditionSchema).default([])
});

export type AutomationCreate = z.infer<typeof AutomationCreateSchema>;

/**
 * Schema para actualizar automatización
 */
export const AutomationUpdateSchema = AutomationCreateSchema.partial();
export type AutomationUpdate = z.infer<typeof AutomationUpdateSchema>;

// =====================================================
// SCHEMAS ZOD - Automation Action
// =====================================================

/**
 * Schema completo de AutomationAction
 */
export const AutomationActionSchema = z.object({
  id: z.string().uuid(),
  automation_id: z.string().uuid(),
  action_type: ActionTypeEnum,
  action_config: z.record(z.string(), z.unknown()),
  order_index: z.number().int().min(0),
  created_at: z.string().datetime()
});

export type AutomationAction = z.infer<typeof AutomationActionSchema>;

/**
 * Schema para crear/actualizar acción
 */
export const AutomationActionInputSchema = z.object({
  action_type: ActionTypeEnum,
  action_config: z.record(z.string(), z.unknown()),
  order_index: z.number().int().min(0).default(0)
});

export type AutomationActionInput = z.infer<typeof AutomationActionInputSchema>;

// =====================================================
// SCHEMAS ZOD - Automation con Acciones
// =====================================================

/**
 * Automatización con sus acciones (para UI)
 */
export interface AutomationWithActions extends Automation {
  actions: AutomationAction[];
}

/**
 * Automatización con estadísticas
 */
export interface AutomationWithStats extends Automation {
  actions_count: number;
  last_execution_at: string | null;
  last_execution_status: LogStatus | null;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
}

// =====================================================
// SCHEMAS ZOD - Email Templates
// =====================================================

/**
 * Schema completo de EmailTemplate
 */
export const EmailTemplateSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  html_body: z.string().min(1),
  is_active: z.boolean(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;

/**
 * Schema para crear/actualizar plantilla de email
 */
export const EmailTemplateInputSchema = z.object({
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(200, 'Máximo 200 caracteres'),
  subject: z.string()
    .min(1, 'El asunto es requerido')
    .max(300, 'Máximo 300 caracteres'),
  html_body: z.string()
    .min(1, 'El contenido es requerido'),
  is_active: z.boolean().default(true)
});

export type EmailTemplateInput = z.infer<typeof EmailTemplateInputSchema>;

// =====================================================
// SCHEMAS ZOD - Notifications
// =====================================================

/**
 * Schema completo de Notification
 */
export const NotificationSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().nullable().optional(),
  is_read: z.boolean(),
  entity_type: z.string().max(50).nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime()
});

export type Notification = z.infer<typeof NotificationSchema>;

// =====================================================
// SCHEMAS ZOD - Automation Queue
// =====================================================

/**
 * Schema de AutomationQueue
 */
export const AutomationQueueSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  automation_id: z.string().uuid().nullable().optional(),
  trigger_event: TriggerEventEnum,
  entity_id: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
  status: QueueStatusEnum,
  error_msg: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  processed_at: z.string().datetime().nullable().optional()
});

export type AutomationQueue = z.infer<typeof AutomationQueueSchema>;

// =====================================================
// SCHEMAS ZOD - Automation Logs
// =====================================================

/**
 * Schema de AutomationLog
 */
export const AutomationLogSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  automation_id: z.string().uuid().nullable().optional(),
  queue_id: z.string().uuid().nullable().optional(),
  action_id: z.string().uuid().nullable().optional(),
  status: LogStatusEnum,
  response: z.record(z.string(), z.unknown()).nullable().optional(),
  error_msg: z.string().nullable().optional(),
  executed_at: z.string().datetime()
});

export type AutomationLog = z.infer<typeof AutomationLogSchema>;

/**
 * Log con información adicional para UI
 */
export interface AutomationLogWithDetails extends AutomationLog {
  automation_name?: string;
  trigger_event?: TriggerEvent;
  action_type?: ActionType;
}

// =====================================================
// HELPERS - UI Labels
// =====================================================

/**
 * Labels para eventos trigger
 */
export const TRIGGER_EVENT_LABELS: Record<TriggerEvent, string> = {
  'policy.expiring': 'Póliza por vencer',
  'policy.activated': 'Póliza activada',
  'invoice.overdue': 'Cuota vencida',
  'claim.created': 'Siniestro creado',
  'claim.status_changed': 'Cambio de estado de siniestro',
  'opportunity.stage_changed': 'Cambio de etapa en pipeline',
  'client.created': 'Cliente creado'
};

/**
 * Descripciones para eventos trigger
 */
export const TRIGGER_EVENT_DESCRIPTIONS: Record<TriggerEvent, string> = {
  'policy.expiring': 'Se ejecuta cuando una póliza está próxima a vencer',
  'policy.activated': 'Se ejecuta cuando una póliza cambia a estado activa',
  'invoice.overdue': 'Se ejecuta cuando una cuota pasa a estado vencida',
  'claim.created': 'Se ejecuta cuando se crea un nuevo siniestro',
  'claim.status_changed': 'Se ejecuta cuando cambia el estado de un siniestro',
  'opportunity.stage_changed': 'Se ejecuta cuando una oportunidad cambia de etapa',
  'client.created': 'Se ejecuta cuando se crea un nuevo cliente'
};

/**
 * Labels para tipos de acción
 */
export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  'send_email': 'Enviar email',
  'create_task': 'Crear tarea',
  'in_app_notification': 'Notificación en app',
  'move_pipeline_stage': 'Mover en pipeline'
};

/**
 * Iconos para tipos de acción (nombres de Lucide)
 */
export const ACTION_TYPE_ICONS: Record<ActionType, string> = {
  'send_email': 'Mail',
  'create_task': 'CheckSquare',
  'in_app_notification': 'Bell',
  'move_pipeline_stage': 'ArrowRight'
};

/**
 * Labels para operadores de condición
 */
export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  'equals': 'Es igual a',
  'not_equals': 'No es igual a',
  'contains': 'Contiene',
  'not_contains': 'No contiene',
  'greater_than': 'Mayor que',
  'less_than': 'Menor que',
  'greater_or_equal': 'Mayor o igual que',
  'less_or_equal': 'Menor o igual que',
  'is_empty': 'Está vacío',
  'is_not_empty': 'No está vacío'
};

/**
 * Labels para estados de cola
 */
export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  'pending': 'Pendiente',
  'processing': 'Procesando',
  'done': 'Completado',
  'error': 'Error'
};

/**
 * Colores para estados de cola (Tailwind classes)
 */
export const QUEUE_STATUS_COLORS: Record<QueueStatus, string> = {
  'pending': 'bg-yellow-100 text-yellow-800',
  'processing': 'bg-blue-100 text-blue-800',
  'done': 'bg-green-100 text-green-800',
  'error': 'bg-red-100 text-red-800'
};

/**
 * Labels para estados de log
 */
export const LOG_STATUS_LABELS: Record<LogStatus, string> = {
  'success': 'Éxito',
  'error': 'Error'
};

/**
 * Colores para estados de log (Tailwind classes)
 */
export const LOG_STATUS_COLORS: Record<LogStatus, string> = {
  'success': 'bg-green-100 text-green-800',
  'error': 'bg-red-100 text-red-800'
};

// =====================================================
// CAMPOS DISPONIBLES POR EVENTO
// =====================================================

interface FieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'enum';
  enumValues?: string[];
}

/**
 * Campos disponibles para condiciones según evento
 */
export const TRIGGER_FIELDS: Record<TriggerEvent, FieldDefinition[]> = {
  'policy.expiring': [
    { name: 'days_until_expiry', label: 'Días hasta vencimiento', type: 'number' },
    { name: 'line', label: 'Ramo', type: 'enum', enumValues: ['vida', 'auto', 'salud', 'hogar', 'soat', 'otro'] },
    { name: 'insurer', label: 'Aseguradora', type: 'string' },
    { name: 'premium', label: 'Prima', type: 'number' }
  ],
  'policy.activated': [
    { name: 'line', label: 'Ramo', type: 'enum', enumValues: ['vida', 'auto', 'salud', 'hogar', 'soat', 'otro'] },
    { name: 'insurer', label: 'Aseguradora', type: 'string' },
    { name: 'premium', label: 'Prima', type: 'number' }
  ],
  'invoice.overdue': [
    { name: 'days_overdue', label: 'Días de mora', type: 'number' },
    { name: 'amount', label: 'Monto', type: 'number' },
    { name: 'installment_number', label: 'Número de cuota', type: 'number' }
  ],
  'claim.created': [
    { name: 'claimed_amount', label: 'Monto reclamado', type: 'number' },
    { name: 'line', label: 'Ramo', type: 'enum', enumValues: ['vida', 'auto', 'salud', 'hogar', 'soat', 'otro'] }
  ],
  'claim.status_changed': [
    { name: 'old_status', label: 'Estado anterior', type: 'enum', enumValues: ['reported', 'investigating', 'docs_complete', 'processing', 'resolved', 'closed'] },
    { name: 'new_status', label: 'Nuevo estado', type: 'enum', enumValues: ['reported', 'investigating', 'docs_complete', 'processing', 'resolved', 'closed'] }
  ],
  'opportunity.stage_changed': [
    { name: 'old_stage_id', label: 'Etapa anterior', type: 'string' },
    { name: 'new_stage_id', label: 'Nueva etapa', type: 'string' },
    { name: 'estimated_premium', label: 'Prima estimada', type: 'number' },
    { name: 'line', label: 'Ramo', type: 'enum', enumValues: ['vida', 'auto', 'salud', 'hogar', 'soat', 'otro'] }
  ],
  'client.created': [
    { name: 'segment', label: 'Segmento', type: 'enum', enumValues: ['individual', 'empresa', 'vip'] },
    { name: 'email', label: 'Email', type: 'string' },
    { name: 'phone', label: 'Teléfono', type: 'string' }
  ]
};

// =====================================================
// VARIABLES DISPONIBLES PARA PLANTILLAS DE EMAIL
// =====================================================

export interface TemplateVariable {
  name: string;
  label: string;
  example: string;
}

/**
 * Variables disponibles para plantillas de email
 */
export const EMAIL_TEMPLATE_VARIABLES: TemplateVariable[] = [
  { name: 'nombre_cliente', label: 'Nombre del cliente', example: 'Juan Pérez' },
  { name: 'email_cliente', label: 'Email del cliente', example: 'juan@email.com' },
  { name: 'telefono_cliente', label: 'Teléfono del cliente', example: '+57 300 123 4567' },
  { name: 'poliza', label: 'Número de póliza', example: 'POL-2024-001' },
  { name: 'aseguradora', label: 'Aseguradora', example: 'Seguros ABC' },
  { name: 'ramo', label: 'Ramo/Línea', example: 'Auto' },
  { name: 'prima', label: 'Prima', example: '$1,500,000' },
  { name: 'fecha_inicio', label: 'Fecha inicio', example: '01/01/2024' },
  { name: 'fecha_vencimiento', label: 'Fecha vencimiento', example: '31/12/2024' },
  { name: 'agente', label: 'Nombre del agente', example: 'María García' },
  { name: 'monto', label: 'Monto (genérico)', example: '$500,000' },
  { name: 'fecha', label: 'Fecha (genérico)', example: '15/03/2024' },
  { name: 'tenant_nombre', label: 'Nombre de la agencia', example: 'Mi Agencia de Seguros' }
];

// =====================================================
// HELPERS - Formateo
// =====================================================

/**
 * Formatea fecha para mostrar
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Formatea fecha y hora para mostrar
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Reemplaza variables en una plantilla
 */
export function replaceTemplateVariables(
  template: string, 
  context: Record<string, string | number | null | undefined>
): string {
  let result = template;
  for (const [key, value] of Object.entries(context)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, String(value ?? ''));
  }
  return result;
}

/**
 * Obtiene el contexto de ejemplo para preview de plantilla
 */
export function getExampleContext(): Record<string, string> {
  return EMAIL_TEMPLATE_VARIABLES.reduce((acc, v) => {
    acc[v.name] = v.example;
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Evalúa una condición contra un payload
 */
export function evaluateCondition(
  condition: AutomationCondition,
  payload: Record<string, unknown>
): boolean {
  const fieldValue = payload[condition.field];
  const conditionValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === conditionValue;
    case 'not_equals':
      return fieldValue !== conditionValue;
    case 'contains':
      return typeof fieldValue === 'string' && 
             typeof conditionValue === 'string' && 
             fieldValue.includes(conditionValue);
    case 'not_contains':
      return typeof fieldValue === 'string' && 
             typeof conditionValue === 'string' && 
             !fieldValue.includes(conditionValue);
    case 'greater_than':
      return typeof fieldValue === 'number' && 
             typeof conditionValue === 'number' && 
             fieldValue > conditionValue;
    case 'less_than':
      return typeof fieldValue === 'number' && 
             typeof conditionValue === 'number' && 
             fieldValue < conditionValue;
    case 'greater_or_equal':
      return typeof fieldValue === 'number' && 
             typeof conditionValue === 'number' && 
             fieldValue >= conditionValue;
    case 'less_or_equal':
      return typeof fieldValue === 'number' && 
             typeof conditionValue === 'number' && 
             fieldValue <= conditionValue;
    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    default:
      return false;
  }
}

/**
 * Evalúa todas las condiciones de una automatización
 */
export function evaluateAllConditions(
  conditions: AutomationCondition[],
  payload: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every(condition => evaluateCondition(condition, payload));
}
