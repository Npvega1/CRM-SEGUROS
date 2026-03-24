// =====================================================
// API Route: Test Prompt (Mock para pruebas)
// Simula respuesta de Claude para probar el flujo
// =====================================================

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { system_prompt, recommendation_prompt, model_id, test_input, examples } = body;

    // Validación básica
    if (!system_prompt || !test_input) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Simular delay de procesamiento
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generar respuesta mock basada en el input
    const examplesCount = examples?.length || 0;
    const inputPreview = test_input.substring(0, 200);
    
    const mockResponse = `**ANÁLISIS COMPARATIVO DE COTIZACIONES**

Basado en el texto proporcionado, he analizado la información siguiendo las instrucciones del prompt.

---

**📋 RESUMEN DEL ANÁLISIS**

• Texto analizado: ${test_input.length} caracteres
• Ejemplos de referencia utilizados: ${examplesCount}
• Modelo configurado: ${model_id}

---

**📊 DATOS EXTRAÍDOS**

Del texto de entrada:
"${inputPreview}${test_input.length > 200 ? '...' : ''}"

---

**💡 RECOMENDACIÓN**

${recommendation_prompt ? `Siguiendo las instrucciones de recomendación configuradas, el análisis sugiere revisar los siguientes puntos clave para tomar una decisión informada.` : 'No se configuró prompt de recomendación.'}

---

**✅ PROMPT CONFIGURADO CORRECTAMENTE**

El prompt está listo para usarse en producción. Cuando se integre con Claude real, generará análisis detallados basados en:
- Sistema: ${system_prompt.length} caracteres de instrucciones
- Recomendación: ${recommendation_prompt?.length || 0} caracteres
- Ejemplos: ${examplesCount} ejemplos de estructura`;

    return NextResponse.json({
      success: true,
      result: mockResponse,
      model: model_id,
      tokens_used: mockResponse.length,
      mock: true
    });

  } catch (error) {
    console.error('Error testing prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Error al probar el prompt' },
      { status: 500 }
    );
  }
}
