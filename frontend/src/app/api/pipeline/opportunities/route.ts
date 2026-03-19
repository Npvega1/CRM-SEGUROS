import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreateOpportunityInputSchema } from '@/lib/validations/pipeline';

// GET /api/pipeline/opportunities - Listar oportunidades
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'active';
    const agentId = searchParams.get('agent_id');
    const stageId = searchParams.get('stage_id');

    let query = supabase
      .from('opportunities')
      .select(`
        *,
        client:clients(id, full_name, email, phone, segment),
        agent:users(id, full_name, avatar_url),
        stage:pipeline_stages(id, name, color, order_index)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (agentId) {
      query = query.eq('agent_id', agentId);
    }
    
    if (stageId) {
      query = query.eq('stage_id', stageId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching opportunities:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ opportunities: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GET /api/pipeline/opportunities:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/pipeline/opportunities - Crear oportunidad
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const tenantId = user.app_metadata?.tenant_id;
    const userRole = user.app_metadata?.role;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 });
    }
    
    if (!['admin', 'senior_agent', 'agent'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = CreateOpportunityInputSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Verificar que la etapa pertenece al tenant
    const { data: stageData, error: stageError } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('id', validatedData.stage_id)
      .eq('tenant_id', tenantId)
      .single();

    if (stageError || !stageData) {
      return NextResponse.json(
        { error: 'Etapa no válida para este tenant' },
        { status: 400 }
      );
    }

    // Verificar que el cliente pertenece al tenant
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', validatedData.client_id)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json(
        { error: 'Cliente no válido para este tenant' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        tenant_id: tenantId,
        client_id: validatedData.client_id,
        stage_id: validatedData.stage_id,
        agent_id: validatedData.agent_id || user.id,
        line: validatedData.line,
        estimated_premium: validatedData.estimated_premium,
        close_probability: validatedData.close_probability,
        expected_close_date: validatedData.expected_close_date,
        notes: validatedData.notes,
        status: 'active'
      } as never)
      .select(`
        *,
        client:clients(id, full_name, email, phone, segment),
        agent:users(id, full_name, avatar_url),
        stage:pipeline_stages(id, name, color, order_index)
      `)
      .single();

    if (error) {
      console.error('Error creating opportunity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in POST /api/pipeline/opportunities:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
