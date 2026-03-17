// =====================================================
// EDGE FUNCTION: policy-expiry-alerts
// Alertas de vencimiento de pólizas
// Se ejecuta via cron diario
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExpiringPolicy {
  id: string
  policy_number: string
  client_id: string
  client_name: string
  insurer: string
  line: string
  premium: number
  end_date: string
  days_until_expiry: number
  tenant_id: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get all tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id')
      .eq('is_active', true)

    if (tenantsError) {
      throw new Error(`Error fetching tenants: ${tenantsError.message}`)
    }

    const results: Array<{
      tenant_id: string
      policies_processed: number
      automations_created: number
    }> = []

    // Process each tenant
    for (const tenant of tenants || []) {
      // Get expiring policies for this tenant
      const { data: expiringPolicies, error: policiesError } = await supabase
        .rpc('get_expiring_policies', {
          p_tenant_id: tenant.id,
          p_days_ahead: [5, 15, 30]
        })

      if (policiesError) {
        console.error(`Error fetching policies for tenant ${tenant.id}:`, policiesError)
        continue
      }

      let automationsCreated = 0

      // Create automation queue entries for each expiring policy
      for (const policy of (expiringPolicies as ExpiringPolicy[]) || []) {
        // Determine alert type based on days until expiry
        let triggerType = 'policy_expiring_30d'
        if (policy.days_until_expiry === 15) {
          triggerType = 'policy_expiring_15d'
        } else if (policy.days_until_expiry === 5) {
          triggerType = 'policy_expiring_5d'
        }

        // Check if automation already exists for this policy and trigger type today
        const today = new Date().toISOString().split('T')[0]
        const { data: existingAutomation } = await supabase
          .from('automation_queue')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('entity_id', policy.id)
          .eq('trigger_type', triggerType)
          .gte('created_at', `${today}T00:00:00`)
          .single()

        if (existingAutomation) {
          console.log(`Automation already exists for policy ${policy.id} trigger ${triggerType}`)
          continue
        }

        // Insert into automation_queue (M06 stub)
        const { error: queueError } = await supabase
          .from('automation_queue')
          .insert({
            tenant_id: tenant.id,
            trigger_type: triggerType,
            entity_type: 'policy',
            entity_id: policy.id,
            payload: {
              policy_number: policy.policy_number,
              client_id: policy.client_id,
              client_name: policy.client_name,
              insurer: policy.insurer,
              line: policy.line,
              premium: policy.premium,
              end_date: policy.end_date,
              days_until_expiry: policy.days_until_expiry
            },
            status: 'pending'
          })

        if (queueError) {
          console.error(`Error creating automation for policy ${policy.id}:`, queueError)
          continue
        }

        automationsCreated++
      }

      // Log result
      const { error: logError } = await supabase
        .from('automation_logs')
        .insert({
          tenant_id: tenant.id,
          automation_type: 'policy_expiry_check',
          result: 'success',
          details: {
            policies_checked: (expiringPolicies || []).length,
            automations_created: automationsCreated,
            execution_date: new Date().toISOString()
          }
        })

      if (logError) {
        console.error(`Error logging automation result for tenant ${tenant.id}:`, logError)
      }

      results.push({
        tenant_id: tenant.id,
        policies_processed: (expiringPolicies || []).length,
        automations_created: automationsCreated
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Policy expiry alerts processed',
        results,
        executed_at: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in policy-expiry-alerts:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})

/* 
=====================================================
CRON CONFIGURATION (en Supabase Dashboard):
=====================================================

Para configurar el cron diario:

1. Ve a Supabase Dashboard > Edge Functions
2. Selecciona la función 'policy-expiry-alerts'
3. Ve a la pestaña 'Schedule'
4. Agrega un schedule con la expresión cron: 0 8 * * *
   (Esto ejecutará la función todos los días a las 8:00 AM UTC)

Alternativa manual via SQL:
---------------------
select cron.schedule(
  'policy-expiry-check',
  '0 8 * * *',
  $$
  select
    net.http_post(
      url:='https://<project-ref>.functions.supabase.co/policy-expiry-alerts',
      headers:='{"Authorization": "Bearer <service_role_key>"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

=====================================================
*/
