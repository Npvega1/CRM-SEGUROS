import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/clientes/[id]/polizas - Obtener pólizas de un cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: clientId } = await params;

    // Verificar que el cliente existe y pertenece al tenant
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Obtener pólizas del cliente
    const { data: policies, error: policiesError } = await supabase
      .from('policies')
      .select('*')
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (policiesError) {
      console.error('Error fetching policies:', policiesError);
      return NextResponse.json({ error: 'Error al obtener pólizas' }, { status: 500 });
    }

    return NextResponse.json(policies || []);
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
