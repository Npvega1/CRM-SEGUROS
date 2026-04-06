"""
Vercel Serverless Function: Extract Client Data
Extrae datos de clientes (persona natural o juridica) desde documentos SARLAFT usando IA
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import base64
import asyncio

from emergentintegrations.llm.chat import LlmChat, UserMessage
import fitz  # PyMuPDF


def extract_text_from_pdf(binary_data: bytes) -> str:
    """Extrae texto de un PDF usando PyMuPDF"""
    try:
        doc = fitz.open(stream=binary_data, filetype="pdf")
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts)
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""


async def process_extraction(body: dict) -> dict:
    """Procesa la extraccion de datos del cliente"""

    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        return {"success": False, "error": "EMERGENT_LLM_KEY no configurada"}

    client_type = body.get('client_type', 'persona_natural')
    files = body.get('files', [])

    print(f"[Extract Client] Processing {client_type}, files: {len(files)}")

    # Extraer texto de todos los archivos
    all_text = ""
    for file_data in files:
        try:
            base64_content = file_data.get('base64_content', '')
            if ',' in base64_content:
                base64_content = base64_content.split(',')[1]

            binary_data = base64.b64decode(base64_content)
            file_type = file_data.get('file_type', 'pdf')
            file_name = file_data.get('name', 'documento')

            if file_type == 'pdf':
                text = extract_text_from_pdf(binary_data)
            else:
                continue

            if text.strip():
                all_text += f"\n\n=== DOCUMENTO: {file_name} ===\n{text[:8000]}\n"
                print(f"[Extract Client] Extracted {len(text)} chars from {file_name}")
        except Exception as e:
            print(f"[Extract Client] Error processing file: {e}")
            continue

    if not all_text.strip():
        return {
            "success": False,
            "error": "No se pudo extraer texto de los documentos. Verifique que no sean imagenes escaneadas."
        }

    # Limitar texto total
    all_text = all_text[:25000]

    # Prompt segun tipo de cliente
    if client_type == 'persona_natural':
        extraction_prompt = f"""Eres un experto en seguros colombiano. Analiza estos documentos SARLAFT y extrae TODOS los datos de la PERSONA NATURAL.

DOCUMENTOS:
{all_text}

EXTRAE la siguiente informacion. Si un campo no esta disponible, dejalo como null.
Si un campo tiene informacion ambigua, marcalo en "campos_verificar".

RESPONDE SOLO CON JSON VALIDO:
{{
    "informacion_personal": {{
        "primer_apellido": "string o null",
        "segundo_apellido": "string o null",
        "primer_nombre": "string o null",
        "otros_nombres": "string o null",
        "tipo_identificacion": "CC|CE|PA|TE|RC o null",
        "numero_identificacion": "string o null",
        "lugar_expedicion": "string o null",
        "fecha_expedicion": "YYYY-MM-DD o null",
        "fecha_nacimiento": "YYYY-MM-DD o null",
        "lugar_nacimiento": "string o null",
        "nacionalidad": "string o null",
        "sexo": "M|F o null",
        "estado_civil": "soltero|casado|union_libre|separado|divorciado|viudo o null",
        "tipo_solicitud": "vinculacion|renovacion|actualizacion o null"
    }},
    "ubicacion_contacto": {{
        "direccion_residencia": "string o null",
        "municipio_residencia": "string o null",
        "departamento_residencia": "string o null",
        "pais_residencia": "string o null",
        "direccion_laboral": "string o null",
        "municipio_laboral": "string o null",
        "departamento_laboral": "string o null",
        "telefono_fijo": "string o null",
        "celular": "string o null",
        "correo_electronico": "string o null"
    }},
    "informacion_laboral": {{
        "ocupacion": "string o null",
        "nombre_empresa": "string o null",
        "cargo": "string o null",
        "actividad_economica_ciiu": "string o null",
        "tipo_empleo": "empleado|independiente|pensionado o null"
    }},
    "informacion_financiera": {{
        "ingresos_mensuales": "number o null",
        "egresos_mensuales": "number o null",
        "total_activos": "number o null",
        "total_pasivos": "number o null",
        "otros_ingresos": "number o null",
        "concepto_otros_ingresos": "string o null"
    }},
    "campos_verificar": ["lista de campos que requieren verificacion manual"],
    "confianza_extraccion": "alta|media|baja",
    "notas_extraccion": "string con observaciones sobre la extraccion"
}}"""
    else:
        extraction_prompt = f"""Eres un experto en seguros colombiano. Analiza estos documentos SARLAFT y extrae TODOS los datos de la PERSONA JURIDICA.

DOCUMENTOS:
{all_text}

EXTRAE la siguiente informacion. Si un campo no esta disponible, dejalo como null.
Si un campo tiene informacion ambigua, marcalo en "campos_verificar".

RESPONDE SOLO CON JSON VALIDO:
{{
    "informacion_general": {{
        "razon_social": "string o null",
        "nit": "string o null",
        "digito_verificacion": "string o null",
        "tipo_empresa": "publica|privada|mixta|sin_animo_lucro o null",
        "actividad_economica_ciiu_principal": "string o null",
        "actividad_economica_ciiu_secundaria": "string o null",
        "numero_empleados": "number o null",
        "tipo_solicitud": "vinculacion|renovacion|actualizacion o null"
    }},
    "ubicacion_contacto": {{
        "direccion_principal": "string o null",
        "municipio": "string o null",
        "departamento": "string o null",
        "pais": "string o null",
        "direccion_sucursal": "string o null",
        "telefono": "string o null",
        "celular": "string o null",
        "correo_electronico": "string o null"
    }},
    "representante_legal": {{
        "primer_apellido": "string o null",
        "segundo_apellido": "string o null",
        "nombres": "string o null",
        "tipo_identificacion": "CC|CE|PA|TE|RC o null",
        "numero_identificacion": "string o null",
        "lugar_expedicion": "string o null",
        "fecha_expedicion": "YYYY-MM-DD o null",
        "fecha_nacimiento": "YYYY-MM-DD o null",
        "lugar_nacimiento": "string o null",
        "sexo": "M|F o null",
        "estado_civil": "soltero|casado|union_libre|separado|divorciado|viudo o null",
        "nacionalidad": "string o null"
    }},
    "informacion_financiera": {{
        "total_activos": "number o null",
        "total_pasivos": "number o null",
        "total_patrimonio": "number o null",
        "ingresos_mensuales": "number o null",
        "egresos_mensuales": "number o null",
        "otros_ingresos": "number o null"
    }},
    "campos_verificar": ["lista de campos que requieren verificacion manual"],
    "confianza_extraccion": "alta|media|baja",
    "notas_extraccion": "string con observaciones sobre la extraccion"
}}"""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"extract-client-{body.get('tenantId', 'unknown')}",
            system_message="""Eres un experto en seguros colombiano especializado en analisis de documentos SARLAFT.
Tu tarea es extraer informacion estructurada de documentos de clientes (cedulas, RUT, formularios SARLAFT, certificados de camara de comercio, etc.).
Siempre responde SOLO con JSON valido, sin texto adicional ni markdown.
Si no encuentras un dato, usa null. No inventes informacion."""
        ).with_model("gemini", "gemini-2.5-flash")

        print("[Extract Client] Calling Gemini API...")
        response_text = await chat.send_message(UserMessage(text=extraction_prompt))
        print(f"[Extract Client] Response length: {len(response_text)}")

        # Parsear respuesta JSON
        clean_response = response_text.strip()
        if '```json' in clean_response:
            start = clean_response.find('```json') + 7
            end = clean_response.rfind('```')
            if end > start:
                clean_response = clean_response[start:end].strip()
        elif '```' in clean_response:
            parts = clean_response.split('```')
            for part in parts:
                part = part.strip()
                if part.startswith('json'):
                    part = part[4:].strip()
                if part.startswith('{'):
                    clean_response = part
                    break

        if not clean_response.startswith('{'):
            for i, char in enumerate(clean_response):
                if char == '{':
                    clean_response = clean_response[i:]
                    break

        extraction_data = json.loads(clean_response)

        campos_verificar = extraction_data.get('campos_verificar', [])
        confianza = extraction_data.get('confianza_extraccion', 'media')
        needs_verification = len(campos_verificar) > 0 or confianza in ['baja', 'media']

        return {
            "success": True,
            "data": extraction_data,
            "needs_verification": needs_verification,
            "verification_fields": campos_verificar if campos_verificar else None
        }

    except json.JSONDecodeError as e:
        print(f"[Extract Client] JSON parse error: {e}")
        return {"success": False, "error": f"Error al parsear respuesta de IA: {str(e)[:100]}"}
    except Exception as e:
        print(f"[Extract Client] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)[:200]}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode('utf-8'))

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(process_extraction(body))
            loop.close()

            self.send_response(200 if result.get('success') else 500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))

        except Exception as e:
            print(f"[Extract Client] Handler error: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "error": str(e)
            }).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
