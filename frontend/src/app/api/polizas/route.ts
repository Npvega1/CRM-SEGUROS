import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreatePolicyInputSchema } from '@/lib/validations/policies';

// GET /api/polizas - Listar pólizas
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
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const line = searchParams.get('line');
    const clientId = searchParams.get('client_id');

    const offset = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('policies')
      .select(`
        *,
        client:clients(id, full_name, doc_number)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (search) {
      query = query.or(`policy_number.ilike.%${search}%,insurer.ilike.%${search}%`);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (line) {
      query = query.eq('line', line);
    }
    
    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching policies:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type PolicyRow = {
      id: string;
      client: { id: string; full_name: string; doc_number: string } | null;
      [key: string]: unknown;
    };

    // Formatear para incluir client_name
    const policies = ((data || []) as PolicyRow[]).map(policy => {
      const client = policy.client;
      return {
        ...policy,
        client_name: client?.full_name || 'N/A',
        client: undefined
      };
    });

    return NextResponse.json({ 
      policies, 
      total: count || 0,
      page,
      pageSize 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GET /api/polizas:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/polizas - Crear póliza
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
    const validationResult = CreatePolicyInputSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Verificar que el cliente pertenece al tenant
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', validatedData.client_id)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('policies')
      .insert({
        tenant_id: tenantId,
        client_id: validatedData.client_id,
        policy_number: validatedData.policy_number,
        insurer: validatedData.insurer,
        line: validatedData.line,
        status: validatedData.status,
        premium: validatedData.premium,
        currency: validatedData.currency,
        start_date: validatedData.start_date,
        end_date: validatedData.end_date,
        commission_pct: validatedData.commission_pct,
        metadata: validatedData.metadata
      } as never)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una póliza con este número' },
          { status: 409 }
        );
      }
      console.error('Error creating policy:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in POST /api/polizas:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
