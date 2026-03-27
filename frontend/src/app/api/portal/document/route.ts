import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente con Service Role Key para bypass de RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { document_url, client_id } = body;

    if (!document_url || !client_id) {
      return NextResponse.json(
        { error: 'document_url y client_id son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el cliente existe y está activo
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .eq('is_active', true)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json(
        { error: 'Cliente no autorizado' },
        { status: 403 }
      );
    }

    // Verificar que la póliza pertenece al cliente
    const { data: policyData, error: policyError } = await supabaseAdmin
      .from('policies')
      .select('id')
      .eq('document_url', document_url)
      .eq('client_id', client_id)
      .single();

    if (policyError || !policyData) {
      return NextResponse.json(
        { error: 'Documento no encontrado o no autorizado' },
        { status: 403 }
      );
    }

    // Generar URL firmada
    const { data, error } = await supabaseAdmin
      .storage
      .from('policy-documents')
      .createSignedUrl(document_url, 300); // 5 minutos

    if (error) {
      console.error('Error creating signed URL:', error);
      return NextResponse.json(
        { error: 'Error al generar URL del documento' },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: data.signedUrl });

  } catch (error) {
    console.error('Error in document API:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
