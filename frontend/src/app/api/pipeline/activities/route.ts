import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreateActivityInputSchema, UpdateActivityInputSchema } from '@/lib/validations/pipeline';

// GET /api/pipeline/activities - Listar actividades
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
    const opportunityId = searchParams.get('opportunity_id');
    const clientId = searchParams.get('client_id');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('activities')
      .select(`
        *,
        agent:users(id, full_name, avatar_url)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (opportunityId) {
      query = query.eq('opportunity_id', opportunityId);
    }
    
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching activities:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ activities: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GET /api/pipeline/activities:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/pipeline/activities - Crear actividad
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
    const validationResult = CreateActivityInputSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Si hay opportunity_id, obtener también el client_id de la oportunidad
    let clientId = validatedData.client_id;
    if (validatedData.opportunity_id && !clientId) {
      const { data: oppData } = await supabase
        .from('opportunities')
        .select('client_id')
        .eq('id', validatedData.opportunity_id)
        .eq('tenant_id', tenantId)
        .single();
      
      if (oppData) {
        clientId = (oppData as { client_id: string }).client_id;
      }
    }

    const { data, error } = await supabase
      .from('activities')
      .insert({
        tenant_id: tenantId,
        opportunity_id: validatedData.opportunity_id,
        client_id: clientId,
        agent_id: user.id,
        type: validatedData.type,
        subject: validatedData.subject,
        description: validatedData.description,
        scheduled_at: validatedData.scheduled_at
      } as never)
      .select(`
        *,
        agent:users(id, full_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error('Error creating activity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in POST /api/pipeline/activities:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/pipeline/activities - Actualizar actividad (completar)
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const activityId = body.activity_id;
    
    if (!activityId) {
      return NextResponse.json({ error: 'activity_id is required' }, { status: 400 });
    }

    const validationResult = UpdateActivityInputSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    const { data, error } = await supabase
      .from('activities')
      .update(validatedData as never)
      .eq('id', activityId)
      .eq('tenant_id', tenantId)
      .select(`
        *,
        agent:users(id, full_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error('Error updating activity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in PATCH /api/pipeline/activities:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
