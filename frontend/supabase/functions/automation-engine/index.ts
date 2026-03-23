// =====================================================
// SUPABASE EDGE FUNCTION: automation-engine
// Motor de procesamiento de automatizaciones
// 
// NOTA: Email está MOCK por ahora. Para integrar servicio 
// real de email (Resend, SendGrid), agregar las credenciales
// y descomentar el código correspondiente.
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Tipos
interface AutomationCondition {
  field: string
  operator: string
  value: string | number | boolean | null
}

interface AutomationAction {
  id: string
  automation_id: string
  action_type: 'send_email' | 'create_task' | 'in_app_notification' | 'move_pipeline_stage'
  action_config: Record<string, unknown>
  order_index: number
}

interface QueueItem {
  id: string
  tenant_id: string
  automation_id: string | null
  trigger_event: string
  entity_id: string
  payload: Record<string, unknown>
  status: string
}

interface Automation {
  id: string
  tenant_id: string
  name: string
  is_active: boolean
  trigger_event: string
  conditions: AutomationCondition[]
}

// Evaluar una condición
function evaluateCondition(
  condition: AutomationCondition,
  payload: Record<string, unknown>
): boolean {
  const fieldValue = payload[condition.field]
  const conditionValue = condition.value

  switch (condition.operator) {
    case 'equals':
      return fieldValue === conditionValue
    case 'not_equals':
      return fieldValue !== conditionValue
    case 'contains':
      return typeof fieldValue === 'string' &&
        typeof conditionValue === 'string' &&
        fieldValue.includes(conditionValue)
    case 'not_contains':
      return typeof fieldValue === 'string' &&
        typeof conditionValue === 'string' &&
        !fieldValue.includes(conditionValue)
    case 'greater_than':
      return typeof fieldValue === 'number' &&
        typeof conditionValue === 'number' &&
        fieldValue > conditionValue
    case 'less_than':
      return typeof fieldValue === 'number' &&
        typeof conditionValue === 'number' &&
        fieldValue < conditionValue
    case 'greater_or_equal':
      return typeof fieldValue === 'number' &&
        typeof conditionValue === 'number' &&
        fieldValue >= conditionValue
    case 'less_or_equal':
      return typeof fieldValue === 'number' &&
        typeof conditionValue === 'number' &&
        fieldValue <= conditionValue
    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === ''
    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
    default:
      return false
  }
}

// Evaluar todas las condiciones
function evaluateAllConditions(
  conditions: AutomationCondition[],
  payload: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every(condition => evaluateCondition(condition, payload))
}

// Reemplazar variables en plantilla
function replaceTemplateVariables(
  template: string,
  context: Record<string, unknown>
): string {
  let result = template
  for (const [key, value] of Object.entries(context)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g')
    result = result.replace(regex, String(value ?? ''))
  }
  return result
}

Deno.serve(async (req) => {
  try {
    // Crear cliente de Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obtener items pendientes de la cola
    const { data: pendingItems, error: queueError } = await supabase
      .from('automation_queue_v2')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (queueError) {
      throw new Error(`Error fetching queue: ${queueError.message}`)
    }

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending items', processed: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    let processedCount = 0
    let successCount = 0
    let errorCount = 0

    for (const queueItem of pendingItems as QueueItem[]) {
      try {
        // Marcar como procesando
        await supabase
          .from('automation_queue_v2')
          .update({ status: 'processing' })
          .eq('id', queueItem.id)

        // Buscar automatizaciones activas para este evento y tenant
        const { data: automations, error: autoError } = await supabase
          .from('automations')
          .select('*')
          .eq('tenant_id', queueItem.tenant_id)
          .eq('trigger_event', queueItem.trigger_event)
          .eq('is_active', true)

        if (autoError) {
          throw new Error(`Error fetching automations: ${autoError.message}`)
        }

        if (!automations || automations.length === 0) {
          // No hay automatizaciones, marcar como done
          await supabase
            .from('automation_queue_v2')
            .update({ status: 'done', processed_at: new Date().toISOString() })
            .eq('id', queueItem.id)
          processedCount++
          continue
        }

        // Procesar cada automatización
        for (const automation of automations as Automation[]) {
          // Evaluar condiciones
          if (!evaluateAllConditions(automation.conditions, queueItem.payload)) {
            // Condiciones no cumplidas, saltar
            continue
          }

          // Obtener acciones de la automatización
          const { data: actions, error: actionsError } = await supabase
            .from('automation_actions')
            .select('*')
            .eq('automation_id', automation.id)
            .order('order_index', { ascending: true })

          if (actionsError) {
            throw new Error(`Error fetching actions: ${actionsError.message}`)
          }

          // Ejecutar cada acción
          for (const action of (actions || []) as AutomationAction[]) {
            try {
              await executeAction(supabase, queueItem, automation, action)
              
              // Log de éxito
              await supabase.from('automation_logs_v2').insert({
                tenant_id: queueItem.tenant_id,
                automation_id: automation.id,
                queue_id: queueItem.id,
                action_id: action.id,
                status: 'success',
                response: { action_type: action.action_type, message: 'Action executed successfully' }
              })
              
              successCount++
            } catch (actionError) {
              // Log de error pero continuar con siguientes acciones
              await supabase.from('automation_logs_v2').insert({
                tenant_id: queueItem.tenant_id,
                automation_id: automation.id,
                queue_id: queueItem.id,
                action_id: action.id,
                status: 'error',
                error_msg: actionError instanceof Error ? actionError.message : 'Unknown error'
              })
              
              errorCount++
            }
          }
        }

        // Marcar item de cola como completado
        await supabase
          .from('automation_queue_v2')
          .update({ status: 'done', processed_at: new Date().toISOString() })
          .eq('id', queueItem.id)

        processedCount++
      } catch (itemError) {
        // Error procesando el item de cola
        await supabase
          .from('automation_queue_v2')
          .update({
            status: 'error',
            error_msg: itemError instanceof Error ? itemError.message : 'Unknown error',
            processed_at: new Date().toISOString()
          })
          .eq('id', queueItem.id)

        errorCount++
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Processing complete',
        processed: processedCount,
        success: successCount,
        errors: errorCount
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// Ejecutar una acción específica
async function executeAction(
  supabase: ReturnType<typeof createClient>,
  queueItem: QueueItem,
  automation: Automation,
  action: AutomationAction
): Promise<void> {
  const config = action.action_config

  switch (action.action_type) {
    case 'send_email': {
      // MOCK: Email no se envía realmente
      // Para integrar con Resend/SendGrid, agregar aquí la llamada al API
      
      const templateId = config.template_id as string
      if (!templateId) {
        throw new Error('Template ID not configured')
      }

      // Obtener plantilla
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (templateError || !template) {
        throw new Error('Email template not found')
      }

      // Preparar contexto para variables
      const context = {
        ...queueItem.payload,
        tenant_nombre: automation.name // Placeholder
      }

      const subject = replaceTemplateVariables(template.subject, context)
      const body = replaceTemplateVariables(template.html_body, context)

      // MOCK: Solo logueamos que se enviaría
      console.log('[MOCK EMAIL]', {
        to: config.to_field,
        subject,
        bodyPreview: body.substring(0, 100) + '...'
      })

      // TODO: Integrar con servicio real de email
      // const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
      // await resend.emails.send({ from, to, subject, html: body })
      
      break
    }

    case 'create_task': {
      const subject = config.subject as string
      const description = config.description as string || ''
      const dueDays = (config.due_days as number) || 1

      // Calcular fecha de vencimiento
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + dueDays)

      // Determinar a quién asignar
      let agentId: string | null = null
      const assignTo = config.assign_to as string

      if (assignTo === 'agent') {
        // Obtener agente del cliente desde el payload
        const clientId = queueItem.payload.client_id as string
        if (clientId) {
          const { data: client } = await supabase
            .from('clients')
            .select('agent_id')
            .eq('id', clientId)
            .single()
          agentId = client?.agent_id || null
        }
      } else if (assignTo === 'admin') {
        // Obtener un admin del tenant
        const { data: admin } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', queueItem.tenant_id)
          .eq('role', 'admin')
          .limit(1)
          .single()
        agentId = admin?.id || null
      }

      // Crear tarea como actividad
      await supabase.from('activities').insert({
        tenant_id: queueItem.tenant_id,
        client_id: queueItem.payload.client_id as string || null,
        agent_id: agentId,
        type: 'task',
        subject,
        description,
        scheduled_at: dueDate.toISOString()
      })

      break
    }

    case 'in_app_notification': {
      const title = config.title as string
      const body = config.body as string || ''
      const notifyTo = config.notify_to as string

      // Determinar destinatarios
      let userIds: string[] = []

      if (notifyTo === 'agent') {
        const clientId = queueItem.payload.client_id as string
        if (clientId) {
          const { data: client } = await supabase
            .from('clients')
            .select('agent_id')
            .eq('id', clientId)
            .single()
          if (client?.agent_id) {
            userIds = [client.agent_id]
          }
        }
      } else if (notifyTo === 'admin') {
        const { data: admin } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', queueItem.tenant_id)
          .eq('role', 'admin')
          .limit(1)
          .single()
        if (admin?.id) {
          userIds = [admin.id]
        }
      } else if (notifyTo === 'all_admins') {
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', queueItem.tenant_id)
          .in('role', ['admin', 'senior_agent'])
        if (admins) {
          userIds = admins.map(a => a.id)
        }
      } else if (notifyTo === 'specific_user') {
        const specificUserId = config.specific_user_id as string
        if (specificUserId) {
          userIds = [specificUserId]
        }
      }

      // Crear notificaciones
      for (const userId of userIds) {
        await supabase.from('notifications').insert({
          tenant_id: queueItem.tenant_id,
          user_id: userId,
          title,
          body,
          entity_type: queueItem.trigger_event.split('.')[0], // 'policy', 'claim', etc.
          entity_id: queueItem.entity_id
        })
      }

      break
    }

    case 'move_pipeline_stage': {
      const targetStageId = config.target_stage_id as string
      if (!targetStageId) {
        throw new Error('Target stage ID not configured')
      }

      // Solo aplica si el evento es de oportunidad
      const opportunityId = queueItem.payload.opportunity_id as string
      if (!opportunityId) {
        throw new Error('Opportunity ID not found in payload')
      }

      await supabase
        .from('opportunities')
        .update({ stage_id: targetStageId })
        .eq('id', opportunityId)

      break
    }

    default:
      throw new Error(`Unknown action type: ${action.action_type}`)
  }
}
