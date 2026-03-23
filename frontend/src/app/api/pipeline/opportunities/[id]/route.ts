import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  UpdateOpportunityInputSchema,
  MoveStageInputSchema,
  WinOpportunityInputSchema,
  LoseOpportunityInputSchema
} from '@/lib/validations/pipeline';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/pipeline/opportunities/[id] - Obtener oportunidad por ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('opportunities')
      .select(`
        *,
        client:clients(id, full_name, email, phone, segment, doc_type, doc_number),
        agent:users(id, full_name, avatar_url, email),
        stage:pipeline_stages(id, name, color, order_index),
        converted_policy:policies(id, policy_number, status, premium)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 });
      }
      console.error('Error fetching opportunity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Obtener actividades de la oportunidad
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('opportunity_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ 
      opportunity: data,
      activities: activities || []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GET /api/pipeline/opportunities/[id]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/pipeline/opportunities/[id] - Actualizar oportunidad
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const validationResult = UpdateOpportunityInputSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Verificar que la oportunidad existe y pertenece al tenant
    const { data: existingOpp } = await supabase
      .from('opportunities')
      .select('id, status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!existingOpp) {
      return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 });
    }

    const oppData = existingOpp as { id: string; status: string };
    if (oppData.status !== 'active') {
      return NextResponse.json(
        { error: 'No se puede editar una oportunidad cerrada' },
        { status: 400 }
      );
    }

    // Si se está cambiando la etapa, verificar que pertenece al tenant
    if (validatedData.stage_id) {
      const { data: stageData } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('id', validatedData.stage_id)
        .eq('tenant_id', tenantId)
        .single();

      if (!stageData) {
        return NextResponse.json(
          { error: 'Etapa no válida para este tenant' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('opportunities')
      .update(validatedData as never)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(`
        *,
        client:clients(id, full_name, email, phone, segment),
        agent:users(id, full_name, avatar_url),
        stage:pipeline_stages(id, name, color, order_index)
      `)
      .single();

    if (error) {
      console.error('Error updating opportunity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in PATCH /api/pipeline/opportunities/[id]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/pipeline/opportunities/[id] - Eliminar oportunidad
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    
    if (!['admin', 'senior_agent'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { error } = await supabase
      .from('opportunities')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error deleting opportunity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in DELETE /api/pipeline/opportunities/[id]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/pipeline/opportunities/[id]/move - Mover a otra etapa
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const action = body.action;

    // Manejar diferentes acciones
    if (action === 'move') {
      const validationResult = MoveStageInputSchema.safeParse({
        opportunity_id: id,
        new_stage_id: body.new_stage_id
      });
      
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Validation error', details: validationResult.error.issues },
          { status: 400 }
        );
      }

      // Verificar que la etapa destino pertenece al tenant
      const { data: stageData } = await supabase
        .from('pipeline_stages')
        .select('id, name')
        .eq('id', body.new_stage_id)
        .eq('tenant_id', tenantId)
        .single();

      if (!stageData) {
        return NextResponse.json(
          { error: 'Etapa destino no válida' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('opportunities')
        .update({ stage_id: body.new_stage_id } as never)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .select(`
          *,
          client:clients(id, full_name, email, phone, segment),
          agent:users(id, full_name, avatar_url),
          stage:pipeline_stages(id, name, color, order_index)
        `)
        .single();

      if (error) {
        console.error('Error moving opportunity:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    if (action === 'win') {
      const validationResult = WinOpportunityInputSchema.safeParse({
        opportunity_id: id,
        ...body
      });
      
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Validation error', details: validationResult.error.issues },
          { status: 400 }
        );
      }

      // Llamar a la función de PostgreSQL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('win_opportunity', {
        p_opportunity_id: id,
        p_agent_id: user.id,
        p_policy_number: body.policy_number || null,
        p_start_date: body.start_date || new Date().toISOString().split('T')[0],
        p_end_date: body.end_date || null,
        p_commission_pct: body.commission_pct || 10
      });

      if (error) {
        console.error('Error winning opportunity:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        policy: data,
        message: 'Oportunidad ganada y póliza creada exitosamente'
      });
    }

    if (action === 'lose') {
      const validationResult = LoseOpportunityInputSchema.safeParse({
        opportunity_id: id,
        lost_reason: body.lost_reason
      });
      
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Validation error', details: validationResult.error.issues },
          { status: 400 }
        );
      }

      // Llamar a la función de PostgreSQL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('lose_opportunity', {
        p_opportunity_id: id,
        p_lost_reason: body.lost_reason,
        p_agent_id: user.id
      });

      if (error) {
        console.error('Error losing opportunity:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        opportunity: data,
        message: 'Oportunidad marcada como perdida'
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in POST /api/pipeline/opportunities/[id]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
