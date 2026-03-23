import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UpdatePolicyInputSchema } from '@/lib/validations/policies';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/polizas/[id] - Obtener póliza por ID
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
      .from('policies')
      .select(`
        *,
        client:clients(id, full_name, doc_type, doc_number, email, phone, segment)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Póliza no encontrada' }, { status: 404 });
      }
      console.error('Error fetching policy:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GET /api/polizas/[id]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/polizas/[id] - Actualizar póliza
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
    const validationResult = UpdatePolicyInputSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('policies')
      .update(validationResult.data as never)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating policy:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in PATCH /api/polizas/[id]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/polizas/[id] - Eliminar póliza
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
      .from('policies')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error deleting policy:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in DELETE /api/polizas/[id]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
