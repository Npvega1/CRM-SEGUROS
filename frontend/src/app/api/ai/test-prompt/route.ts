// =====================================================
// API ROUTE: Test AI Prompt with Claude
// Prueba prompts de IA con texto de ejemplo
// =====================================================

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { system_prompt, recommendation_prompt, model_id, test_input } = body;

    // Validación básica
    if (!system_prompt || !recommendation_prompt || !test_input) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // En producción, aquí se llamaría a Claude API usando emergentintegrations
    // Por ahora retornamos un mock response para demostración
    
    // Mock: Simular llamada a Claude
    const mockResponse = `[MOCK RESPONSE - Modelo: ${model_id}]

=== ANÁLISIS COMPARATIVO ===

Basado en el texto proporcionado y siguiendo las instrucciones del prompt de sistema, he analizado la información.

**Prompt de Sistema aplicado:**
${system_prompt.substring(0, 100)}...

**Prompt de Recomendación aplicado:**
${recommendation_prompt.substring(0, 100)}...

**Entrada analizada:**
${test_input.substring(0, 200)}...

=== RECOMENDACIÓN ===

Este es un resultado de prueba (MOCK). En producción, Claude generaría:
1. Un análisis detallado de las cotizaciones
2. Una comparación punto por punto
3. Una recomendación personalizada para el cliente

El prompt parece estar configurado correctamente y listo para producción.

=== MÉTRICAS ===
- Tokens estimados: ~${Math.floor(Math.random() * 1000 + 500)}
- Tiempo de respuesta simulado: ${Math.floor(Math.random() * 2000 + 500)}ms`;

    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({
      result: mockResponse,
      model: model_id,
      tokens_used: Math.floor(Math.random() * 1000 + 500),
      mock: true,
    });
  } catch (error) {
    console.error('Error testing prompt:', error);
    return NextResponse.json(
      { error: 'Error al probar el prompt' },
      { status: 500 }
    );
  }
}
