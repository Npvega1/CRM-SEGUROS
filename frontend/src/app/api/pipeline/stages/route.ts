import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreateStageInputSchema } from '@/lib/validations/pipeline';

// GET /api/pipeline/stages - Listar etapas del pipeline
export async function GET() {
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

    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching stages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stages: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GET /api/pipeline/stages:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/pipeline/stages - Crear etapa
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
    
    if (!['admin', 'senior_agent'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = CreateStageInputSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    const { data, error } = await supabase
      .from('pipeline_stages')
      .insert({
        tenant_id: tenantId,
        name: validatedData.name,
        order_index: validatedData.order_index,
        color: validatedData.color,
        is_default: false
      } as never)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una etapa con este nombre u orden' },
          { status: 409 }
        );
      }
      console.error('Error creating stage:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in POST /api/pipeline/stages:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
