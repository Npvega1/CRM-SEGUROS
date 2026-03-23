# Módulo 06 - Automatizaciones y Workflows

## Descripción
Motor de automatizaciones para el CRM de seguros que permite crear workflows automáticos basados en eventos del sistema.

## Tablas de Base de Datos

### automations
Automatizaciones configuradas por tenant.
- Trigger events: `policy.expiring`, `policy.activated`, `invoice.overdue`, `claim.created`, `claim.status_changed`, `opportunity.stage_changed`, `client.created`
- Condiciones JSONB con operadores flexibles

### automation_actions
Acciones a ejecutar por cada automatización.
- Tipos: `send_email`, `create_task`, `in_app_notification`, `move_pipeline_stage`
- Ordenables por `order_index`

### automation_queue_v2
Cola de eventos pendientes de procesar.
- Estados: `pending`, `processing`, `done`, `error`

### automation_logs_v2
Historial de ejecuciones con detalles de éxito/error.

### email_templates
Plantillas de email con variables Handlebars.
- Variables disponibles: `{nombre_cliente}`, `{poliza}`, `{fecha_vencimiento}`, `{agente}`, `{monto}`, `{aseguradora}`, `{ramo}`, etc.

### notifications
Notificaciones in-app para usuarios con soporte de Supabase Realtime.

## Instalación

### 1. Ejecutar Migración SQL
```bash
# En Supabase Dashboard > SQL Editor
# Ejecutar el contenido de: supabase/migrations/00006_automations.sql
```

### 2. Habilitar Supabase Realtime (para notificaciones)
1. Ve a **Supabase Dashboard > Database > Replication**
2. En la sección "Source", habilita la tabla `notifications`
3. O ejecuta este SQL:
```sql
-- Habilitar replicación para notificaciones en tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

### 3. Configurar Edge Function (Opcional)
La Edge Function `automation-engine` procesa la cola de automatizaciones.

```bash
# Desplegar la función
supabase functions deploy automation-engine

# Configurar cron job (opcional, cada 5 minutos)
# En Supabase Dashboard > Database > Extensions > pg_cron
SELECT cron.schedule(
  'process-automations',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://[PROJECT_REF].supabase.co/functions/v1/automation-engine',
      headers := '{"Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb
    );
  $$
);
```

## Integración de Email (Pendiente)

El envío de emails está preparado como **MOCK**. Para integrar un servicio real:

### Resend (Recomendado)
```typescript
// En supabase/functions/automation-engine/index.ts
import { Resend } from 'resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

// En la sección send_email:
await resend.emails.send({
  from: 'tu-email@tudominio.com',
  to: recipientEmail,
  subject,
  html: body
});
```

### SendGrid
```typescript
// Usar @sendgrid/mail
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(Deno.env.get('SENDGRID_API_KEY'));

await sgMail.send({
  from: 'tu-email@tudominio.com',
  to: recipientEmail,
  subject,
  html: body
});
```

## Componentes UI

### AutomationsPage (`/automations`)
- Lista de automatizaciones con toggle on/off
- Lista de plantillas de email
- Badges de estado y última ejecución

### AutomationBuilder
- Constructor visual CUANDO / SI / ENTONCES
- Campos dinámicos según evento seleccionado
- Preview en lenguaje natural

### EmailTemplateEditor
- Editor de texto con panel de variables
- Vista previa con datos de ejemplo

### AutomationLogs
- Historial paginado de ejecuciones
- Expandible para ver detalles y errores

### NotificationBell
- Campana en header con badge de no leídas
- Dropdown con lista de notificaciones
- Suscripción a Supabase Realtime

## Triggers Automáticos

Los siguientes triggers insertan eventos en `automation_queue_v2`:

| Trigger | Evento |
|---------|--------|
| `trigger_auto_policy_activated` | Cuando póliza cambia a estado 'activa' |
| `trigger_auto_claim_created` | Cuando se crea un siniestro |
| `trigger_auto_claim_status` | Cuando cambia estado de siniestro |
| `trigger_auto_opportunity_stage` | Cuando oportunidad cambia de etapa |
| `trigger_auto_client_created` | Cuando se crea un cliente |

## Permisos RLS

| Tabla | Admin | Senior Agent | Agent | Readonly |
|-------|-------|--------------|-------|----------|
| automations | CRUD | CRUD | Read | Read |
| automation_actions | CRUD | CRUD | Read | Read |
| email_templates | CRUD | CRUD | Read | Read |
| notifications | Read own | Read own | Read own | Read own |

## Notas de Desarrollo

- TypeScript estricto: Se usan `as any` en llamadas a Supabase para tablas nuevas (hasta regenerar tipos)
- Validaciones Zod en `lib/validations/automations.ts`
- No usar Server Actions ni API Routes (regla del proyecto)
- Usar `getBrowserClient()` siempre
