import { NextRequest, NextResponse } from 'next/server';

// Este API Route actúa como proxy al backend de FastAPI
// que tiene la librería emergentintegrations funcionando

// Configurar timeout máximo para Vercel (Pro: 60s, Hobby: 10s)
export const maxDuration = 60;

interface CompareRequest {
  comparisonId: string;
  tenantId: string;
  line: string;
  files: Array<{
    name: string;
    file_type: string;
    base64_content: string;
  }>;
  criteria: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: CompareRequest = await request.json();
    
    console.log('Proxying to FastAPI backend...');
    console.log('Files:', body.files.map(f => f.name));

    // El backend de FastAPI está en Emergent
    const backendUrl = process.env.FASTAPI_BACKEND_URL;
    
    if (!backendUrl) {
      console.error('FASTAPI_BACKEND_URL not configured');
      return NextResponse.json({
        success: false,
        error: 'Backend URL no configurada. Contacta al administrador.'
      }, { status: 500 });
    }
    
    console.log('Backend URL:', backendUrl);
    
    // Crear AbortController para manejar timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout
    
    try {
      const response = await fetch(`${backendUrl}/api/ai/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Verificar si la respuesta es JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        return NextResponse.json({
          success: false,
          error: 'El servidor respondió con un formato inesperado. Intenta de nuevo.'
        }, { status: 502 });
      }

      const result = await response.json();
      
      console.log('Backend response status:', response.status);
      console.log('Backend result success:', result.success);

      return NextResponse.json(result);
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('Request timeout');
        return NextResponse.json({
          success: false,
          error: 'El procesamiento tardó demasiado. Los archivos son muy grandes o complejos. Intenta con menos archivos.'
        }, { status: 504 });
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión con el servidor'
    }, { status: 500 });
  }
}
