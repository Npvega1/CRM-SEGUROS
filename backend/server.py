from fastapi import FastAPI, APIRouter, HTTPException
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
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType


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

class CompareResponse(BaseModel):
    success: bool
    comparison_table: Optional[Dict] = None
    ai_recommendation: Optional[str] = None
    error: Optional[str] = None

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
# AI COMPARISON ENDPOINT
# =====================================================

@api_router.post("/ai/compare", response_model=CompareResponse)
async def compare_quotations(request: CompareRequest):
    """
    Process insurance quotation files and generate a comparison table using AI.
    Uses Gemini for file analysis via emergentintegrations library.
    """
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Initialize Gemini chat (required for file attachments)
        chat = LlmChat(
            api_key=api_key,
            session_id=f"comparison-{request.comparisonId}",
            system_message="""Eres un experto analista de seguros. Tu tarea es analizar cotizaciones de seguros y extraer información estructurada.
            
Debes extraer los datos de cada cotización y organizarlos en un formato JSON estructurado.
Siempre responde SOLO con JSON válido, sin texto adicional ni markdown."""
        ).with_model("gemini", "gemini-2.5-flash")
        
        # Prepare file contents
        temp_files = []
        file_contents = []
        
        for file_data in request.files:
            try:
                # Decode base64 and save to temp file
                base64_content = file_data.get('base64_content', '')
                if ',' in base64_content:
                    base64_content = base64_content.split(',')[1]
                
                binary_data = base64.b64decode(base64_content)
                
                # Determine mime type
                file_type = file_data.get('file_type', 'pdf')
                mime_type = 'application/pdf' if file_type == 'pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                
                # Create temp file
                suffix = f".{file_type}"
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
                temp_file.write(binary_data)
                temp_file.close()
                temp_files.append(temp_file.name)
                
                # Create FileContentWithMimeType
                file_content = FileContentWithMimeType(
                    file_path=temp_file.name,
                    mime_type=mime_type
                )
                file_contents.append(file_content)
                
            except Exception as e:
                logger.error(f"Error processing file {file_data.get('name', 'unknown')}: {e}")
                continue
        
        if not file_contents:
            raise HTTPException(status_code=400, detail="No se pudieron procesar los archivos")
        
        # Build the analysis prompt
        criteria_list = "\n".join([f"- {c}" for c in request.criteria])
        
        analysis_prompt = f"""Analiza estas {len(file_contents)} cotizaciones de seguro de ramo "{request.line}".

Para cada cotización, extrae la siguiente información:
{criteria_list}

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{{
  "insurers": [
    {{
      "name": "Nombre de la aseguradora",
      "fields": {{
        "NombreCriterio1": {{"value": "valor extraído", "notes": "observaciones opcionales"}},
        "NombreCriterio2": {{"value": "valor extraído", "notes": "observaciones opcionales"}}
      }}
    }}
  ]
}}

Importante:
- Extrae el nombre de la aseguradora de cada documento
- Si un valor no está disponible, usa "No especificado"
- Los valores numéricos deben incluir la moneda cuando aplique
- NO incluyas texto fuera del JSON"""

        # Send message with file attachments
        user_message = UserMessage(
            text=analysis_prompt,
            file_contents=file_contents
        )
        
        # Get AI response
        response_text = await chat.send_message(user_message)
        
        # Clean up temp files
        for temp_path in temp_files:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
        
        # Parse JSON response
        try:
            # Remove markdown code blocks if present
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
        
        # Build comparison table
        comparison_table = {
            "criteria": request.criteria,
            "insurers": comparison_data.get("insurers", [])
        }
        
        # Generate recommendation
        recommendation_chat = LlmChat(
            api_key=api_key,
            session_id=f"recommendation-{request.comparisonId}",
            system_message="Eres un asesor de seguros experto. Debes dar recomendaciones claras y objetivas basadas en los datos."
        ).with_model("gemini", "gemini-2.5-flash")
        
        recommendation_prompt = f"""Basándote en este análisis comparativo de cotizaciones de seguro:

{json.dumps(comparison_table, indent=2, ensure_ascii=False)}

Genera una recomendación concisa (máximo 3 párrafos) para el cliente que incluya:
1. Cuál cotización ofrece mejor relación costo-beneficio
2. Puntos fuertes y débiles de cada opción
3. Recomendación final

Sé objetivo y profesional. No uses markdown, solo texto plano."""

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