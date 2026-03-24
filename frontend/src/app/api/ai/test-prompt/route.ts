// =====================================================
// API Route: Test Prompt con Claude
// Usa el SDK oficial de Anthropic
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

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

    // Obtener API key
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.EMERGENT_LLM_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key no configurada. Agrega ANTHROPIC_API_KEY en las variables de entorno de Vercel.' },
        { status: 500 }
      );
    }

    // Construir prompt completo
    let fullSystemPrompt = system_prompt;

    // Agregar ejemplos si existen
    if (examples && examples.length > 0) {
      fullSystemPrompt += "\n\n=== EJEMPLOS DE ESTRUCTURA ===\n";
      examples.forEach((example: { name: string; content: string }, i: number) => {
        fullSystemPrompt += `\n--- Ejemplo ${i + 1}: ${example.name || 'Sin nombre'} ---\n`;
        fullSystemPrompt += (example.content || '').substring(0, 3000);
        fullSystemPrompt += "\n";
      });
    }

    // Agregar prompt de recomendación
    if (recommendation_prompt) {
      fullSystemPrompt += `\n\n=== INSTRUCCIONES DE RECOMENDACIÓN ===\n${recommendation_prompt}`;
    }

    // Mapeo de modelos
    const modelMapping: Record<string, string> = {
      'claude-3-5-sonnet': 'claude-sonnet-4-5-20250929',
      'claude-3-opus': 'claude-opus-4-5-20251101',
      'claude-3-haiku': 'claude-haiku-4-5-20251001',
    };

    const model = modelMapping[model_id] || 'claude-sonnet-4-5-20250929';

    // Inicializar cliente de Anthropic
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    // Enviar mensaje
    const message = await anthropic.messages.create({
      model: model,
      max_tokens: 4096,
      system: fullSystemPrompt,
      messages: [
        {
          role: 'user',
          content: test_input
        }
      ]
    });

    // Extraer texto de la respuesta
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return NextResponse.json({
      success: true,
      result: responseText,
      model: model,
      tokens_used: message.usage?.output_tokens || 0
    });

  } catch (error) {
    console.error('Error testing prompt:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
