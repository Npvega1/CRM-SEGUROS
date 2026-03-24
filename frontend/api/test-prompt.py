# =====================================================
# Vercel Serverless Function - Test Prompt con Claude
# Archivo: /api/test-prompt.py
# =====================================================

from http.server import BaseHTTPRequestHandler
import json
import os
import asyncio

# Importar emergentintegrations para Claude
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    HAS_EMERGENT = True
except ImportError:
    HAS_EMERGENT = False


def run_async(coro):
    """Helper para ejecutar código async en Vercel"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def test_prompt_async(data: dict) -> dict:
    """Prueba un prompt con Claude"""
    
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        return {"success": False, "error": "EMERGENT_LLM_KEY no configurada"}
    
    system_prompt = data.get('system_prompt', '')
    recommendation_prompt = data.get('recommendation_prompt', '')
    model_id = data.get('model_id', 'claude-3-5-sonnet')
    test_input = data.get('test_input', '')
    examples = data.get('examples', [])
    
    # Construir prompt completo
    full_system_prompt = system_prompt
    
    # Agregar ejemplos si existen
    if examples:
        examples_text = "\n\n=== EJEMPLOS DE ESTRUCTURA ===\n"
        for i, example in enumerate(examples, 1):
            examples_text += f"\n--- Ejemplo {i}: {example.get('name', 'Sin nombre')} ---\n"
            examples_text += example.get('content', '')[:3000]
            examples_text += "\n"
        full_system_prompt += examples_text
    
    # Agregar prompt de recomendación
    full_system_prompt += f"\n\n=== INSTRUCCIONES DE RECOMENDACIÓN ===\n{recommendation_prompt}"
    
    # Mapeo de modelos
    model_mapping = {
        'claude-3-5-sonnet': ('anthropic', 'claude-sonnet-4-5-20250929'),
        'claude-3-opus': ('anthropic', 'claude-opus-4-5-20251101'),
        'claude-3-haiku': ('anthropic', 'claude-haiku-4-5-20251001'),
        'gpt-4-turbo': ('openai', 'gpt-5.2'),
        'gemini-pro': ('gemini', 'gemini-2.5-pro'),
    }
    
    provider, model = model_mapping.get(model_id, ('anthropic', 'claude-sonnet-4-5-20250929'))
    
    # Inicializar chat
    import uuid
    chat = LlmChat(
        api_key=api_key,
        session_id=f"test-prompt-{uuid.uuid4()}",
        system_message=full_system_prompt
    ).with_model(provider, model)
    
    # Enviar mensaje
    response_text = await chat.send_message(UserMessage(text=test_input))
    
    return {
        "success": True,
        "result": response_text,
        "model": f"{provider}/{model}",
        "tokens_used": len(response_text) // 4
    }


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Leer body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode())
            return
        
        # Validar campos requeridos
        if not data.get('system_prompt') or not data.get('test_input'):
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Faltan campos requeridos"}).encode())
            return
        
        # Verificar que emergentintegrations está disponible
        if not HAS_EMERGENT:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "error": "emergentintegrations no instalado"
            }).encode())
            return
        
        # Ejecutar test
        try:
            result = run_async(test_prompt_async(data))
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "error": str(e)
            }).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
