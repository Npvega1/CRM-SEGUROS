from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
import asyncio
import json
import base64
import tempfile
import fitz  # PyMuPDF para extraer texto de PDFs
from docx import Document  # python-docx para extraer texto de DOCX
from emergentintegrations.llm.chat import LlmChat, UserMessage
import httpx  # Para llamar a Supabase


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# =====================================================
# AI COMPARISON MODELS
# =====================================================

class CompareRequest(BaseModel):
    comparisonId: str
    tenantId: str
    line: str
    files: List[Dict]  # [{name, file_url, file_type, base64_content}]
    criteria: List[str]
    # Supabase credentials para actualizar directamente
    supabaseUrl: Optional[str] = None
    supabaseKey: Optional[str] = None

class CompareResponse(BaseModel):
    success: bool
    comparison_table: Optional[Dict] = None
    ai_recommendation: Optional[str] = None
    error: Optional[str] = None
    
class AsyncCompareResponse(BaseModel):
    accepted: bool
    message: str
    comparisonId: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# =====================================================
# AI COMPARISON ENDPOINT - OPTIMIZADO
# Extrae texto de PDFs para procesamiento más rápido
# =====================================================

def extract_text_from_pdf(binary_data: bytes) -> str:
    """Extrae texto de un PDF usando PyMuPDF (muy rápido)"""
    try:
        doc = fitz.open(stream=binary_data, filetype="pdf")
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts)
    except Exception as e:
        logger.error(f"Error extracting PDF text: {e}")
        return ""

def extract_text_from_docx(binary_data: bytes) -> str:
    """Extrae texto de un DOCX"""
    try:
        # Guardar temporalmente para leer con python-docx
        with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as tmp:
            tmp.write(binary_data)
            tmp_path = tmp.name
        
        doc = Document(tmp_path)
        text_parts = [para.text for para in doc.paragraphs]
        os.unlink(tmp_path)
        return "\n".join(text_parts)
    except Exception as e:
        logger.error(f"Error extracting DOCX text: {e}")
        return ""

@api_router.post("/ai/compare", response_model=CompareResponse)
async def compare_quotations(request: CompareRequest, background_tasks: BackgroundTasks):
    """
    Procesa cotizaciones de seguros y genera tabla comparativa con IA.
    Si se proporcionan credenciales de Supabase, procesa en background y actualiza directamente.
    """
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Si hay credenciales de Supabase, procesar en background
        if request.supabaseUrl and request.supabaseKey:
            # Iniciar procesamiento en background
            background_tasks.add_task(
                process_comparison_background,
                request,
                api_key
            )
            # Retornar inmediatamente
            return CompareResponse(
                success=True,
                comparison_table={"status": "processing"},
                ai_recommendation="Procesando...",
                error=None
            )
        
        # Si no hay credenciales, procesar síncronamente (comportamiento anterior)
        return await process_comparison_sync(request, api_key)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in compare_quotations: {e}")
        return CompareResponse(success=False, error=str(e))


async def update_supabase(supabase_url: str, supabase_key: str, comparison_id: str, data: dict):
    """Actualiza el registro en Supabase directamente"""
    try:
        url = f"{supabase_url}/rest/v1/comparisons?id=eq.{comparison_id}"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        
        logger.info(f"Updating Supabase: {url}")
        logger.info(f"Data keys: {list(data.keys())}")
        
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                url,
                headers=headers,
                json=data,
                timeout=30.0
            )
            
            logger.info(f"Supabase update response: {response.status_code}")
            
            if response.status_code != 204:
                logger.error(f"Supabase error response: {response.text}")
                
            return response.status_code == 204
    except Exception as e:
        logger.error(f"Error updating Supabase: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


async def process_comparison_background(request: CompareRequest, api_key: str):
    """Procesa la comparación en background y actualiza Supabase cuando termina"""
    try:
        logger.info(f"Starting background processing for {request.comparisonId}")
        
        # Procesar
        result = await process_comparison_sync(request, api_key)
        
        # Actualizar Supabase con el resultado
        if request.supabaseUrl and request.supabaseKey:
            if result.success:
                await update_supabase(
                    request.supabaseUrl,
                    request.supabaseKey,
                    request.comparisonId,
                    {
                        "comparison_table": result.comparison_table,
                        "ai_recommendation": result.ai_recommendation,
                        "status": "completed"
                    }
                )
                logger.info(f"Background processing completed for {request.comparisonId}")
            else:
                await update_supabase(
                    request.supabaseUrl,
                    request.supabaseKey,
                    request.comparisonId,
                    {
                        "status": "error",
                        "ai_recommendation": f"Error: {result.error}"
                    }
                )
                logger.error(f"Background processing failed for {request.comparisonId}: {result.error}")
    except Exception as e:
        logger.error(f"Background processing error: {e}")
        if request.supabaseUrl and request.supabaseKey:
            await update_supabase(
                request.supabaseUrl,
                request.supabaseKey,
                request.comparisonId,
                {
                    "status": "error",
                    "ai_recommendation": f"Error de procesamiento: {str(e)}"
                }
            )


async def process_comparison_sync(request: CompareRequest, api_key: str) -> CompareResponse:
    """Procesa la comparación de forma síncrona"""
    try:
        # Extraer texto de cada archivo
        extracted_texts = []
        
        for file_data in request.files:
            try:
                file_name = file_data.get('name', 'archivo')
                base64_content = file_data.get('base64_content', '')
                if ',' in base64_content:
                    base64_content = base64_content.split(',')[1]
                
                binary_data = base64.b64decode(base64_content)
                file_type = file_data.get('file_type', 'pdf')
                
                # Extraer texto según el tipo de archivo
                if file_type == 'pdf':
                    text = extract_text_from_pdf(binary_data)
                elif file_type == 'docx':
                    text = extract_text_from_docx(binary_data)
                else:
                    text = ""
                
                if text.strip():
                    extracted_texts.append({
                        "name": file_name,
                        "content": text[:8000]  # 8000 chars por archivo para mantenerse dentro del timeout
                    })
                    logger.info(f"Extracted {len(text)} chars from {file_name}")
                else:
                    logger.warning(f"No text extracted from {file_name}")
                    
            except Exception as e:
                logger.error(f"Error processing file {file_data.get('name', 'unknown')}: {e}")
                continue
        
        if not extracted_texts:
            raise HTTPException(status_code=400, detail="No se pudo extraer texto de los archivos. Verifica que los PDFs no sean imágenes escaneadas.")
        
        # Construir el prompt con el texto extraído - ESTRUCTURA COMPLETA PARA COMPARATIVO
        files_content = ""
        for i, doc in enumerate(extracted_texts, 1):
            files_content += f"\n\n{'='*60}\nCOTIZACIÓN {i}: {doc['name']}\n{'='*60}\n{doc['content']}\n"
        
        analysis_prompt = f"""Eres un experto analista de seguros colombiano. Analiza estas {len(extracted_texts)} cotizaciones del ramo "{request.line}" y crea UN cuadro comparativo CONSOLIDADO.

{files_content}

REGLAS CRÍTICAS DE NORMALIZACIÓN:

1. **VALORES ASEGURADOS** - Usa SOLO estos nombres exactos (si aplican):
   - "Edificio"
   - "Contenidos" (agrupa: muebles, enseres, equipos electrónicos fijos/móviles)
   - "Maquinaria y Equipo" (solo PYME)
   - "TOTAL ASEGURADO"
   
   ⚠️ Si una aseguradora NO tiene un concepto, NO lo incluyas (no pongas $0)

2. **AMPAROS** - NORMALIZA los nombres. Usa EXACTAMENTE estos:
   - "Incendio y Rayo" (agrupa: incendio, rayo, explosión, riesgos aliados)
   - "Terremoto" (agrupa: temblor, erupción volcánica, maremoto)
   - "Eventos Naturales" (agrupa: inundación, vientos, granizo, avalancha)
   - "HMACC/AMIT" (agrupa: huelga, motín, terrorismo, actos maliciosos)
   - "Daños por Agua" (agrupa: anegación, rotura tuberías)
   - "Hurto Calificado"
   - "Hurto Simple" (solo si es diferente al calificado)
   - "Responsabilidad Civil"
   - "Daños Equipos Eléctricos"
   - "Rotura de Vidrios"
   - "Remoción de Escombros"
   - "Gastos de Arrendamiento" (agrupa: renta temporal, arrendamiento)
   
   ⚠️ NO dupliques amparos con nombres similares. CONSOLIDA todo bajo el nombre estándar.
   ⚠️ Si una aseguradora NO tiene un amparo, pon "No incluido"

3. **DEDUCIBLES** - Usa estos nombres:
   - "Incendio/Básico"
   - "Terremoto"
   - "HMACC/AMIT"
   - "Hurto"
   - "Equipos Eléctricos"
   - "Rotura Vidrios"
   
   ⚠️ Solo incluye deducibles que SÍ tengan información. No pongas "No especificado" para todos.

4. **BENEFICIOS** - Lista solo los servicios de ASISTENCIA gratuitos (no sublímites de cobertura)

5. **PRIMA** - Extrae prima neta, IVA y total. Si no hay desglose, pon el total.

RESPONDE SOLO CON JSON VÁLIDO:
{{
  "insurers": [
    {{
      "name": "NOMBRE ASEGURADORA",
      "valores_asegurados": [
        {{"concepto": "Edificio", "valor": "$600,000,000"}},
        {{"concepto": "Contenidos", "valor": "$50,000,000"}},
        {{"concepto": "TOTAL ASEGURADO", "valor": "$650,000,000"}}
      ],
      "amparos": [
        {{"amparo": "Incendio y Rayo", "limite": "100%"}},
        {{"amparo": "Terremoto", "limite": "100%"}},
        {{"amparo": "Hurto Calificado", "limite": "$30,000,000"}},
        {{"amparo": "Responsabilidad Civil", "limite": "$50,000,000"}}
      ],
      "deducibles": [
        {{"concepto": "Incendio/Básico", "valor": "0.5% del valor de la pérdida"}},
        {{"concepto": "Terremoto", "valor": "3% valor asegurado, mín 1 SMMLV"}}
      ],
      "beneficios": ["Asistencia domiciliaria 24/7", "Hospedaje temporal"],
      "prima": {{
        "prima_neta": "$1,000,000",
        "iva": "$190,000",
        "total_anual": "$1,190,000",
        "forma_pago": "Anual o cuotas"
      }}
    }}
  ]
}}"""

        # Inicializar chat con Gemini
        chat = LlmChat(
            api_key=api_key,
            session_id=f"comparison-{request.comparisonId}",
            system_message="""Eres un experto analista de seguros colombiano. Tu tarea es analizar cotizaciones de seguros y extraer información estructurada.
Debes extraer los datos de cada cotización y organizarlos en un formato JSON estructurado.
Siempre responde SOLO con JSON válido, sin texto adicional ni markdown."""
        ).with_model("gemini", "gemini-2.5-pro")
        
        # Obtener respuesta de IA
        logger.info(f"Sending {len(analysis_prompt)} chars to Gemini...")
        response_text = await chat.send_message(UserMessage(text=analysis_prompt))
        logger.info(f"Received response: {len(response_text)} chars")
        
        # Parsear respuesta JSON
        try:
            clean_response = response_text.strip()
            if clean_response.startswith('```'):
                clean_response = clean_response.split('```')[1]
                if clean_response.startswith('json'):
                    clean_response = clean_response[4:]
            if clean_response.endswith('```'):
                clean_response = clean_response[:-3]
            
            comparison_data = json.loads(clean_response.strip())
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {response_text[:500]}")
            raise HTTPException(status_code=500, detail=f"Error al parsear respuesta de IA: {str(e)}")
        
        # Construir tabla comparativa con nueva estructura
        comparison_table = {
            "line": request.line,
            "insurers": comparison_data.get("insurers", [])
        }
        
        # Generar recomendación profesional
        recommendation_chat = LlmChat(
            api_key=api_key,
            session_id=f"recommendation-{request.comparisonId}",
            system_message="Eres un asesor de seguros experto colombiano. Das recomendaciones profesionales, claras y objetivas."
        ).with_model("gemini", "gemini-2.5-pro")
        
        # Preparar resumen para la recomendación
        resumen_aseguradoras = []
        for ins in comparison_table.get("insurers", []):
            prima_total = ins.get("prima", {}).get("total_anual", "No especificado")
            num_amparos = len(ins.get("amparos", []))
            num_beneficios = len(ins.get("beneficios", []))
            resumen_aseguradoras.append(f"- {ins.get('name', 'Aseguradora')}: Prima {prima_total}, {num_amparos} amparos, {num_beneficios} beneficios")
        
        recommendation_prompt = f"""Analiza estas cotizaciones de seguro de {request.line} para un cliente:

{chr(10).join(resumen_aseguradoras)}

Datos completos del comparativo:
{json.dumps(comparison_table, indent=2, ensure_ascii=False)[:3000]}

Genera una recomendación profesional (3-4 párrafos) que incluya:
1. ¿Cuál cotización ofrece mejor relación costo-beneficio y por qué?
2. Puntos fuertes de cada opción
3. Consideraciones importantes sobre deducibles y coberturas
4. Tu recomendación final clara

Sé objetivo y profesional. Responde en español. No uses markdown."""

        recommendation = await recommendation_chat.send_message(UserMessage(text=recommendation_prompt))
        
        return CompareResponse(
            success=True,
            comparison_table=comparison_table,
            ai_recommendation=recommendation
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in AI comparison: {str(e)}", exc_info=True)
        return CompareResponse(
            success=False,
            error=str(e)
        )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()