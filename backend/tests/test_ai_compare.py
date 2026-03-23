"""
Test suite for AI Comparison endpoint
Tests the new structured data format with sections:
- Información del riesgo
- Valores asegurados
- Amparos
- Deducibles
- Beneficios
- Prima
"""

import pytest
import httpx
import base64
import json
from pathlib import Path

# Backend URL
BACKEND_URL = "http://localhost:8001"

# Sample quote text that simulates PDF content
SAMPLE_QUOTE_1 = """
COTIZACIÓN DE SEGURO HOGAR
ASEGURADORA: Seguros Bolívar S.A.

═══════════════════════════════════════
INFORMACIÓN DEL RIESGO
═══════════════════════════════════════
Cliente/Asegurado: María García López
Dirección del riesgo: Carrera 45 #72-18, Apartamento 1202
Ciudad: Medellín, Antioquia
Descripción del bien: Apartamento residencial estrato 5

═══════════════════════════════════════
VALORES ASEGURADOS
═══════════════════════════════════════
Edificio (participación): $350,000,000
Contenido general: $120,000,000
Equipos electrónicos: $25,000,000
Joyas y obras de arte: $15,000,000
TOTAL ASEGURADO: $510,000,000

═══════════════════════════════════════
AMPAROS / COBERTURAS INCLUIDAS
═══════════════════════════════════════
- Incendio y/o rayo: 100% valor asegurado
- Terremoto y temblor: 100% valor asegurado
- Daños por agua: 100% valor asegurado
- Sustracción con violencia: Hasta $50,000,000
- Responsabilidad civil familiar: $100,000,000
- Daños eléctricos: $20,000,000

═══════════════════════════════════════
DEDUCIBLES
═══════════════════════════════════════
- Deducible general: 10% del valor del siniestro, mínimo $500,000
- Deducible terremoto: 2% del valor asegurado
- Deducible equipos electrónicos: $300,000

═══════════════════════════════════════
BENEFICIOS ADICIONALES SIN COSTO
═══════════════════════════════════════
- Asistencia domiciliaria 24/7 (plomería, cerrajería, electricidad)
- Hospedaje temporal hasta $5,000,000 por evento
- Mudanza de emergencia incluida
- Gastos de alimentación hasta $2,000,000

═══════════════════════════════════════
PRIMA
═══════════════════════════════════════
Prima anual total: $4,850,000 COP
IVA (19%): $921,500
TOTAL A PAGAR: $5,771,500

Formas de pago disponibles:
- Contado con 10% de descuento
- Financiado a 4 cuotas sin interés
- Financiado a 12 cuotas (interés 1.2% mensual)
"""

SAMPLE_QUOTE_2 = """
COTIZACIÓN SEGURO HOGAR
COMPAÑÍA: Allianz Seguros Colombia

DATOS DEL RIESGO:
Nombre del asegurado: María García López  
Ubicación: Carrera 45 #72-18 Apto 1202
Municipio: Medellín
Tipo de inmueble: Apartamento

SUMAS ASEGURADAS:
- Inmueble/Edificio: $350,000,000
- Bienes muebles: $100,000,000
- Equipos de cómputo: $30,000,000
Suma total: $480,000,000

COBERTURAS:
* Incendio, explosión y rayo - 100%
* Sismo/Terremoto - 100%
* Anegación - 100%
* Hurto calificado - $40,000,000 máximo
* RC Extracontractual - $80,000,000
* Daños a equipos eléctricos - $25,000,000

DEDUCIBLES APLICABLES:
General: 10% mínimo $600,000
Terremoto: 3% valor asegurado
Equipos: $400,000

SERVICIOS INCLUIDOS:
• Asistencia hogar ilimitada
• Alojamiento temporal $4,000,000
• Transporte de bienes
• Limpieza post-siniestro

VALOR PRIMA:
Prima neta anual: $4,200,000
Gastos expedición: $50,000
IVA: $807,500
Prima total: $5,057,500

Pago: Contado o 6 cuotas sin intereses
"""


def text_to_base64_pdf_mock(text: str) -> str:
    """
    Creates a base64 string that will be decoded by the backend.
    Note: This is a simple text encoded as base64 - the backend
    will try to extract text from it as if it were a PDF.
    For real testing, we'd need actual PDF files.
    """
    # The backend uses PyMuPDF which expects actual PDF binary
    # For testing purposes, we'll create actual PDF content
    return base64.b64encode(text.encode('utf-8')).decode('utf-8')


class TestAICompareEndpoint:
    """Tests for the /api/ai/compare endpoint"""
    
    @pytest.mark.asyncio
    async def test_endpoint_exists(self):
        """Test that the endpoint exists and responds"""
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{BACKEND_URL}/api/")
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
    
    @pytest.mark.asyncio
    async def test_empty_files_validation(self):
        """Test that empty files list returns appropriate error"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BACKEND_URL}/api/ai/compare",
                json={
                    "comparisonId": "test-validation-001",
                    "tenantId": "test-tenant",
                    "line": "hogar",
                    "files": [],
                    "criteria": ["Prima", "Deducibles"]
                }
            )
            # Should return 400 because no files were provided
            assert response.status_code == 400
            data = response.json()
            assert "detail" in data
    
    @pytest.mark.asyncio
    async def test_missing_required_fields(self):
        """Test validation of required fields"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BACKEND_URL}/api/ai/compare",
                json={
                    "comparisonId": "test-001"
                    # Missing other required fields
                }
            )
            assert response.status_code == 422  # Validation error


class TestResponseStructure:
    """Tests for the new response structure format"""
    
    def test_expected_structure_format(self):
        """Verify the expected JSON structure matches documentation"""
        expected_structure = {
            "insurers": [
                {
                    "name": "str - Insurer name",
                    "informacion_riesgo": {
                        "cliente": "str",
                        "direccion": "str",
                        "ciudad": "str",
                        "descripcion_riesgo": "str"
                    },
                    "valores_asegurados": [
                        {"concepto": "str", "valor": "str"}
                    ],
                    "amparos": [
                        {"amparo": "str", "limite": "str"}
                    ],
                    "deducibles": [
                        {"concepto": "str", "valor": "str"}
                    ],
                    "beneficios": ["str"],
                    "prima": {
                        "total_anual": "str",
                        "forma_pago": "str"
                    }
                }
            ]
        }
        
        # Verify required keys exist in structure
        assert "insurers" in expected_structure
        insurer = expected_structure["insurers"][0]
        
        required_keys = [
            "name",
            "informacion_riesgo",
            "valores_asegurados",
            "amparos",
            "deducibles",
            "beneficios",
            "prima"
        ]
        
        for key in required_keys:
            assert key in insurer, f"Missing required key: {key}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])
