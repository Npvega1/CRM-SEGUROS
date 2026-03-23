import { NextRequest, NextResponse } from 'next/server';

// Este API Route actúa como proxy al backend de FastAPI
// que tiene la librería emergentintegrations funcionando

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
    // URL del backend (en producción esto debería ser configurable)
    const backendUrl = process.env.FASTAPI_BACKEND_URL || 'https://quote-ai-2.preview.emergentagent.com';
    
    const response = await fetch(`${backendUrl}/api/ai/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    
    console.log('Backend response status:', response.status);
    console.log('Backend result success:', result.success);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión con el servidor'
    });
  }
}
