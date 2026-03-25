'use client';

// =====================================================
// COMPONENTE: ComparisonViewer
// Visualizador de cuadro comparativo - TABLA LADO A LADO
// =====================================================

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ComparisonWithRelations } from '@/lib/validations/comparisons';
import { POLICY_LINE_LABELS, type PolicyLine } from '@/lib/validations/policies';
import { 
  Download, 
  Building2,
  User,
  Calendar,
  Loader2,
  FileText,
  FileDown
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateQuotationPDF, generateComparisonDOCX, generateFianzaPDF } from '@/lib/services/document-generator';
import { createClient } from '@/lib/supabase/client';
import { CotizacionFianza } from './CotizacionFianza';
import { ComparativoPolizas } from './ComparativoPolizas';

// Tipos para la estructura
interface InsurerData {
  name: string;
  valores_asegurados?: Array<{ concepto: string; valor: string }>;
  amparos?: Array<{ amparo: string; limite?: string }>;
  deducibles?: Array<{ concepto: string; valor: string }>;
  beneficios?: string[];
  prima?: {
    prima_neta?: string;
    iva?: string;
    total_anual?: string;
    forma_pago?: string;
  };
}

// Tipo para aseguradoras (PYME/Hogar/Copropiedades)
interface AseguradoraData {
  nombre: string;
  producto?: string;
  recomendada?: boolean;
  valoresAsegurados?: Record<string, number>;
  amparos?: Array<{ nombre: string; valorAsegurado?: number | string; deducible?: string; nota_comparativa?: string }>;
  beneficiosAdicionales?: Record<string, unknown>;
  prima?: { netaAnteIva?: number; asistencia?: number; iva?: number; total?: number };
}

interface ComparisonTable {
  line?: string;
  type?: 'comparison' | 'quotation';
  insurers?: InsurerData[];
  aseguradoras?: AseguradoraData[];
  resumen_recomendacion?: string;
  quotation?: {
    tipo_documento?: string;
    datos_extraidos?: Record<string, string>;
    cotizacion_sugerida?: Record<string, unknown>;
  };
}

interface ComparisonViewerProps {
  comparison: ComparisonWithRelations;
  onUpdateCell: (insurerKey: string, criteriaKey: string, newValue: string) => Promise<void>;
  onCreatePolicy?: (insurerName: string) => void;
  branding?: {
    logoUrl?: string;
    agencyName?: string;
    primaryColor?: string;
  };
}

export function ComparisonViewer({
  comparison,
  branding
}: ComparisonViewerProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [tenantSettings, setTenantSettings] = useState<{
    logo_url?: string | null;
    primary_color?: string;
    tenant_name?: string;
  }>({});

  const table = comparison.comparison_table as ComparisonTable | null;
  const prospectName = (comparison as unknown as { prospect_name?: string }).prospect_name;
  const clientName = comparison.client?.full_name || prospectName || 'No especificado';

  // Cargar configuración del tenant (logo, colores)
  useEffect(() => {
    async function loadTenantSettings() {
      if (!comparison.tenant_id) return;
      const supabase = createClient();
      const { data } = await (supabase.from('tenant_settings') as unknown as { 
        select: (cols: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: { logo_url?: string; primary_color?: string } | null }> } } 
      })
        .select('logo_url, primary_color')
        .eq('tenant_id', comparison.tenant_id)
        .single();
      if (data) {
        setTenantSettings(data);
      }
    }
    loadTenantSettings();
  }, [comparison.tenant_id]);

  // Verificar si es cotización o comparativo
  const isQuotation = table?.type === 'quotation';

  // Función para descargar PDF de cotización
  const handleDownloadPDF = async () => {
    setIsExportingPDF(true);
    try {
      // Obtener datos adicionales del cliente si existen
      const clientData = comparison.client ? {
        name: comparison.client.full_name,
        document_number: (comparison.client as { document_number?: string }).document_number || undefined,
        email: comparison.client.email || undefined,
        phone: (comparison.client as { phone?: string }).phone || undefined,
      } : undefined;

      await generateQuotationPDF(
        {
          id: comparison.id,
          line: comparison.line,
          created_at: comparison.created_at,
          comparison_table: {
            type: table?.type || 'quotation',
            quotation: table?.quotation as {
              tipo_documento?: string;
              datos_extraidos?: {
                contratante?: string;
                beneficiario?: string;
                objeto?: string;
                valor_contrato?: string;
                plazo?: string;
                ubicacion?: string;
              };
              cotizacion_sugerida?: {
                tipo_fianza?: string;
                valor_asegurado?: string;
                vigencia?: string;
                tasa_estimada?: string;
                prima_estimada?: string;
                requisitos?: string[];
                observaciones?: string;
              };
            }
          },
          client: clientData,
        },
        {
          logo_url: tenantSettings.logo_url || branding?.logoUrl,
          primary_color: tenantSettings.primary_color || branding?.primaryColor || '#3b82f6',
          tenant_name: branding?.agencyName,
        }
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Función para descargar DOCX de comparativo
  const handleDownloadDOCX = async () => {
    setIsExporting(true);
    try {
      const clientData = comparison.client ? {
        name: comparison.client.full_name,
        document_number: (comparison.client as { document_number?: string }).document_number || undefined,
      } : undefined;

      // Mapear insurers para asegurar tipos correctos
      const mappedInsurers = table?.insurers?.map(ins => ({
        name: ins.name,
        valores_asegurados: ins.valores_asegurados,
        amparos: ins.amparos?.map(a => ({ amparo: a.amparo, limite: a.limite || '' })),
        deducibles: ins.deducibles,
        beneficios: ins.beneficios,
        prima: ins.prima,
      }));

      await generateComparisonDOCX(
        {
          id: comparison.id,
          line: comparison.line,
          created_at: comparison.created_at,
          comparison_table: {
            type: table?.type || 'comparison',
            insurers: mappedInsurers
          },
          client: clientData,
        },
        {
          logo_url: tenantSettings.logo_url || branding?.logoUrl,
          primary_color: tenantSettings.primary_color || branding?.primaryColor || '#3b82f6',
          tenant_name: branding?.agencyName,
        }
      );
    } catch (error) {
      console.error('Error generating DOCX:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Función helper para renderizar valores de forma recursiva
  const renderValue = (value: unknown, depth: number = 0): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">-</span>;
    }
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return <span className="font-medium">{String(value)}</span>;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-muted-foreground italic">-</span>;
      
      // Si es un array de objetos complejos (como polizas o amparos)
      if (typeof value[0] === 'object' && value[0] !== null) {
        return (
          <div className="space-y-3 mt-2">
            {value.map((item, idx) => (
              <div key={idx} className={`${depth > 0 ? 'ml-4 pl-4 border-l-2 border-blue-200' : ''} bg-slate-50 rounded-lg p-3`}>
                {typeof item === 'object' && item !== null ? (
                  Object.entries(item).map(([k, v]) => (
                    <div key={k} className="flex flex-wrap gap-x-2 py-1">
                      <span className="text-muted-foreground capitalize min-w-[120px]">{formatKey(k)}:</span>
                      {renderValue(v, depth + 1)}
                    </div>
                  ))
                ) : (
                  <span>{String(item)}</span>
                )}
              </div>
            ))}
          </div>
        );
      }
      
      // Array simple de strings/numbers
      return <span className="font-medium">{value.join(', ')}</span>;
    }
    
    if (typeof value === 'object') {
      return (
        <div className={`${depth > 0 ? 'ml-4 pl-4 border-l-2 border-gray-200' : ''} space-y-1`}>
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="py-1">
              <span className="text-muted-foreground capitalize">{formatKey(k)}:</span>
              <div className="ml-2">{renderValue(v, depth + 1)}</div>
            </div>
          ))}
        </div>
      );
    }
    
    return String(value);
  };

  // Formatear keys para mostrar
  const formatKey = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  };

  // Detectar si es una cotización de Fianzas (cumplimiento, anticipo, calidad, etc.)
  const isFianzaQuotation = isQuotation && (
    comparison.line.toLowerCase().includes('cumplimiento') ||
    comparison.line.toLowerCase().includes('fianza') ||
    comparison.line.toLowerCase().includes('anticipo') ||
    comparison.line.toLowerCase().includes('calidad') ||
    comparison.line.toLowerCase().includes('garantia') ||
    comparison.line.toLowerCase().includes('particular')
  );

  // Función para descargar PDF de Fianza
  const handleDownloadFianzaPDF = async () => {
    setIsExportingPDF(true);
    try {
      await generateFianzaPDF(
        {
          quotation: table?.quotation as Record<string, unknown>,
          clientName,
          ramoName: POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line,
          createdAt: comparison.created_at,
        },
        {
          logo_url: tenantSettings.logo_url || branding?.logoUrl,
          primary_color: tenantSettings.primary_color || branding?.primaryColor || '#3b82f6',
          tenant_name: branding?.agencyName || 'Agencia de Seguros',
        }
      );
    } catch (error) {
      console.error('Error generating Fianza PDF:', error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Si es cotización de FIANZAS, usar el componente especializado
  if (isFianzaQuotation && table?.quotation) {
    return (
      <CotizacionFianza
        quotation={table.quotation as {
          notas?: string;
          polizas?: Array<{
            tipo?: string;
            objeto?: string;
            amparos?: Array<{
              nombre?: string;
              porcentaje?: number;
              valorAsegurado?: number;
              vigenciaDesde?: string;
              vigenciaFinal?: string;
              dias?: number;
              prima?: number;
            }>;
            iva?: number;
            gastos?: number;
            totalPrima?: number;
          }>;
          tomador?: { nombre?: string; identificacion?: string };
          beneficiario?: { nombre?: string; identificacion?: string };
          noContrato?: string;
          valorContrato?: number;
          vigenciaDesde?: string;
          vigenciaHasta?: string;
          vigenciaMasLarga?: string;
        }}
        clientName={clientName}
        ramoName={POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line}
        tenantName={branding?.agencyName || 'Agencia de Seguros'}
        primaryColor={tenantSettings.primary_color || branding?.primaryColor || '#3b82f6'}
        logoUrl={tenantSettings.logo_url || branding?.logoUrl}
        onDownloadPDF={handleDownloadFianzaPDF}
        isExporting={isExportingPDF}
      />
    );
  }

  // Detectar si es un comparativo de PYME, Hogar o Copropiedades (NO cotización, sino comparativo)
  const isPolizaComparison = !isQuotation && (
    comparison.line.toLowerCase().includes('pyme') ||
    comparison.line.toLowerCase().includes('hogar') ||
    comparison.line.toLowerCase().includes('copropiedad') ||
    comparison.line.toLowerCase().includes('copropiedades') ||
    comparison.line.toLowerCase().includes('multiriesgo') ||
    comparison.line.toLowerCase().includes('empresarial')
  );

  // Si es un comparativo de PYME/Hogar/Copropiedades con estructura de aseguradoras
  if (isPolizaComparison && table?.aseguradoras) {
    return (
      <ComparativoPolizas
        comparativo={{
          cliente: {
            nombre: clientName,
            vigenciaDesde: comparison.created_at ? format(new Date(comparison.created_at), 'dd/MM/yyyy', { locale: es }) : undefined,
            vigenciaHasta: undefined,
          },
          aseguradoras: table.aseguradoras as Array<{
            nombre: string;
            producto?: string;
            recomendada?: boolean;
            valoresAsegurados?: Record<string, number>;
            amparos?: Array<{ nombre: string; valorAsegurado?: number | string; deducible?: string; nota_comparativa?: string }>;
            beneficiosAdicionales?: Record<string, unknown>;
            prima?: { netaAnteIva?: number; asistencia?: number; iva?: number; total?: number };
          }>,
          resumen_recomendacion: (table as { resumen_recomendacion?: string }).resumen_recomendacion,
        }}
        tenantName={branding?.agencyName || 'Agencia de Seguros'}
        primaryColor={tenantSettings.primary_color || branding?.primaryColor || '#3b82f6'}
        logoUrl={tenantSettings.logo_url || branding?.logoUrl}
        onDownloadWord={handleDownloadDOCX}
        isExporting={isExporting}
      />
    );
  }

  // Si es cotización genérica (no Fianzas), mostrar vista genérica
  if (isQuotation && table?.quotation) {
    const quotation = table.quotation as Record<string, unknown>;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cotización Generada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info básica */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Cliente:</span>
              <p className="font-medium">{clientName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Ramo:</span>
              <p className="font-medium">{POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line}</p>
            </div>
          </div>

          {/* Renderizar todo el contenido de la cotización dinámicamente */}
          <div className="space-y-4">
            {Object.entries(quotation).map(([key, value]) => {
              // Saltar campos vacíos
              if (value === null || value === undefined) return null;
              if (Array.isArray(value) && value.length === 0) return null;
              
              return (
                <div key={key} className="space-y-2">
                  <h4 className="font-semibold text-sm text-blue-700 border-b pb-1">
                    {formatKey(key)}
                  </h4>
                  <div className="text-sm">
                    {renderValue(value)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botón de descarga PDF */}
          <div className="pt-4 border-t">
            <Button 
              onClick={handleDownloadPDF} 
              disabled={isExportingPDF}
              className="w-full sm:w-auto"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Descargar Cotización (PDF)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Vista de comparativo (múltiples aseguradoras)
  if (!table || !table.insurers || table.insurers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No hay datos de comparación disponibles.</p>
        </CardContent>
      </Card>
    );
  }

  const insurers = table.insurers;

  // Función para exportar a Word con diseño profesional
  const exportToWord = async () => {
    setIsExporting(true);
    
    try {
      // Import dinámico con manejo de errores mejorado
      const [docxModule, fileSaverModule] = await Promise.all([
        import('docx'),
        import('file-saver')
      ]);
      
      const { 
        Document, 
        Packer, 
        Paragraph, 
        Table, 
        TableCell, 
        TableRow, 
        TextRun, 
        WidthType, 
        AlignmentType,
        BorderStyle,
        ShadingType,
        VerticalAlign
      } = docxModule;
      
      const saveAs = fileSaverModule.saveAs || fileSaverModule.default?.saveAs;
      
      if (!saveAs) {
        throw new Error('No se pudo cargar la función de guardado');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: any[] = [];
      
      // Colores (sin # para docx)
      const HEADER_BG = '2563EB'; // Azul
      const HEADER_TEXT = 'FFFFFF'; // Blanco
      const ROW_ODD = 'F8FAFC'; // Gris muy claro
      const ROW_EVEN = 'FFFFFF'; // Blanco
      const HIGHLIGHT_BG = 'FEF9C3'; // Amarillo suave para destacar
      const BORDER_COLOR = 'CBD5E1'; // Gris para bordes
      
      // Configuración de bordes
      const cellBorder = { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR };
      const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
      
      // ========== ANCHOS DE COLUMNAS UNIFORMES ==========
      // Primera columna (criterio) = 25%, resto dividido equitativamente entre aseguradoras
      const numInsurers = insurers.length;
      const CRITERIA_WIDTH = 25; // 25% para la columna de criterios
      const INSURER_WIDTH = Math.floor((100 - CRITERIA_WIDTH) / numInsurers); // % para cada aseguradora
      
      // Helper para celda de encabezado (fondo azul, texto blanco)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headerCell = (text: string, widthPercent: number) => new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text, bold: true, color: HEADER_TEXT, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 }
        })],
        borders,
        shading: { fill: HEADER_BG, type: ShadingType.CLEAR, color: HEADER_BG },
        verticalAlign: VerticalAlign.CENTER,
        width: { size: widthPercent, type: WidthType.PERCENTAGE },
        margins: { top: 60, bottom: 60, left: 80, right: 80 }
      });
      
      // Helper para celda de datos normal con ancho uniforme
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataCell = (text: string, isOdd: boolean, isBold = false, align: any = AlignmentType.LEFT, isHighlight = false, widthPercent?: number) => new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text, bold: isBold, size: 18 })],
          alignment: align,
          spacing: { before: 40, after: 40 }
        })],
        borders,
        shading: { 
          fill: isHighlight ? HIGHLIGHT_BG : (isOdd ? ROW_ODD : ROW_EVEN), 
          type: ShadingType.CLEAR, 
          color: isHighlight ? HIGHLIGHT_BG : (isOdd ? ROW_ODD : ROW_EVEN)
        },
        verticalAlign: VerticalAlign.CENTER,
        width: widthPercent ? { size: widthPercent, type: WidthType.PERCENTAGE } : undefined,
        margins: { top: 40, bottom: 40, left: 80, right: 80 }
      });

      // ========== ENCABEZADO ==========
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Cuadro Comparativo de Cotizaciones', bold: true, size: 36 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: branding?.agencyName || 'LA PRIMA JUSTA', bold: true, size: 28, color: '2563EB' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      );
      
      // Info del cliente
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Cliente: ', bold: true, size: 22 }),
            new TextRun({ text: clientName, size: 22, bold: true }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Ramo: ', bold: true, size: 20 }),
            new TextRun({ text: POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line, size: 20 }),
            new TextRun({ text: '     |     Fecha: ', bold: true, size: 20 }),
            new TextRun({ text: comparison.created_at ? format(new Date(comparison.created_at), 'dd/MM/yyyy') : 'N/A', size: 20 }),
          ],
          spacing: { after: 300 },
        })
      );

      // ========== TABLA PRINCIPAL COMPARATIVA ==========
      // Encabezado con nombres de aseguradoras
      const mainHeaderRow = new TableRow({
        children: [
          headerCell('Criterio', CRITERIA_WIDTH),
          ...insurers.map(ins => headerCell(ins.name || 'Aseguradora', INSURER_WIDTH)),
        ],
      });

      // ========== VALORES ASEGURADOS ==========
      const valoresHeaderRow = new TableRow({
        children: [
          dataCell('📊 VALORES ASEGURADOS', true, true, AlignmentType.LEFT, false, CRITERIA_WIDTH),
          ...insurers.map(() => dataCell('', true, false, AlignmentType.LEFT, false, INSURER_WIDTH)),
        ],
      });

      const valoresRows = Array.from(allValores).map((concepto, idx) => new TableRow({
        children: [
          dataCell(concepto, idx % 2 === 0, concepto.toUpperCase() === 'TOTAL ASEGURADO', AlignmentType.LEFT, false, CRITERIA_WIDTH),
          ...insurers.map(ins => {
            const valor = ins.valores_asegurados?.find(v => v.concepto === concepto)?.valor || '-';
            return dataCell(valor, idx % 2 === 0, concepto.toUpperCase() === 'TOTAL ASEGURADO', AlignmentType.RIGHT, false, INSURER_WIDTH);
          }),
        ],
      }));

      // ========== AMPAROS ==========
      const amparosHeaderRow = new TableRow({
        children: [
          dataCell('🛡️ COBERTURAS', true, true, AlignmentType.LEFT, false, CRITERIA_WIDTH),
          ...insurers.map(() => dataCell('', true, false, AlignmentType.LEFT, false, INSURER_WIDTH)),
        ],
      });

      const amparosRows = Array.from(allAmparos).map((amparo, idx) => new TableRow({
        children: [
          dataCell(amparo, idx % 2 === 0, false, AlignmentType.LEFT, false, CRITERIA_WIDTH),
          ...insurers.map(ins => {
            const amp = ins.amparos?.find(a => a.amparo === amparo);
            const text = amp ? (amp.limite || '✓ Incluido') : '✗ No incluido';
            return dataCell(text, idx % 2 === 0, false, AlignmentType.LEFT, false, INSURER_WIDTH);
          }),
        ],
      }));

      // ========== DEDUCIBLES ==========
      const deduciblesHeaderRow = new TableRow({
        children: [
          dataCell('📋 DEDUCIBLES', true, true, AlignmentType.LEFT, false, CRITERIA_WIDTH),
          ...insurers.map(() => dataCell('', true, false, AlignmentType.LEFT, false, INSURER_WIDTH)),
        ],
      });

      const deduciblesRows = Array.from(allDeducibles).map((ded, idx) => new TableRow({
        children: [
          dataCell(ded, idx % 2 === 0, false, AlignmentType.LEFT, false, CRITERIA_WIDTH),
          ...insurers.map(ins => {
            const deducible = ins.deducibles?.find(d => d.concepto === ded);
            return dataCell(deducible?.valor || '-', idx % 2 === 0, false, AlignmentType.LEFT, false, INSURER_WIDTH);
          }),
        ],
      }));

      // ========== BENEFICIOS ==========
      const beneficiosHeaderRow = new TableRow({
        children: [
          dataCell('🎁 BENEFICIOS', true, true, AlignmentType.LEFT, false, CRITERIA_WIDTH),
          ...insurers.map(() => dataCell('', true, false, AlignmentType.LEFT, false, INSURER_WIDTH)),
        ],
      });

      const beneficiosRow = new TableRow({
        children: [
          dataCell('Asistencias incluidas', false, false, AlignmentType.LEFT, false, CRITERIA_WIDTH),
          ...insurers.map(ins => {
            const bens = ins.beneficios?.join('\n• ') || 'No especificados';
            return dataCell(ins.beneficios && ins.beneficios.length > 0 ? '• ' + bens : 'No especificados', false, false, AlignmentType.LEFT, false, INSURER_WIDTH);
          }),
        ],
      });

      // ========== PRIMA (DESTACADA) ==========
      const primaHeaderRow = new TableRow({
        children: [
          dataCell('💰 VALOR A PAGAR', true, true, AlignmentType.LEFT, true, CRITERIA_WIDTH),
          ...insurers.map(() => dataCell('', true, false, AlignmentType.LEFT, true, INSURER_WIDTH)),
        ],
      });

      const primaTotalRow = new TableRow({
        children: [
          dataCell('Prima Total Anual', false, true, AlignmentType.LEFT, true, CRITERIA_WIDTH),
          ...insurers.map(ins => dataCell(ins.prima?.total_anual || 'No especificado', false, true, AlignmentType.RIGHT, true, INSURER_WIDTH)),
        ],
      });

      const primaFormaRow = new TableRow({
        children: [
          dataCell('Forma de Pago', false, false, AlignmentType.LEFT, false, CRITERIA_WIDTH),
          ...insurers.map(ins => dataCell(ins.prima?.forma_pago || 'No especificado', false, false, AlignmentType.LEFT, false, INSURER_WIDTH)),
        ],
      });

      // Construir tabla completa con anchos de columna fijos
      const columnWidths = [CRITERIA_WIDTH, ...insurers.map(() => INSURER_WIDTH)];
      
      const mainTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: columnWidths.map(w => w * 100), // Convertir a twips aproximados
        rows: [
          mainHeaderRow,
          valoresHeaderRow,
          ...valoresRows,
          amparosHeaderRow,
          ...amparosRows,
          deduciblesHeaderRow,
          ...deduciblesRows,
          beneficiosHeaderRow,
          beneficiosRow,
          primaHeaderRow,
          primaTotalRow,
          primaFormaRow,
        ],
      });

      children.push(mainTable);

      // ========== PIE DE PÁGINA ==========
      children.push(
        new Paragraph({ children: [], spacing: { before: 300 } }),
        new Paragraph({
          children: [new TextRun({ 
            text: `Documento generado el ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}`,
            size: 16, 
            italics: true,
            color: '64748B'
          })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ 
            text: 'Este cuadro comparativo es informativo. Las condiciones definitivas están sujetas a las pólizas de cada aseguradora.',
            size: 14, 
            italics: true,
            color: '94A3B8'
          })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 50 }
        })
      );

      // Crear documento
      const doc = new Document({
        sections: [{ 
          properties: {
            page: {
              margin: { top: 720, bottom: 720, left: 720, right: 720 },
            }
          }, 
          children 
        }],
      });

      const blob = await Packer.toBlob(doc);
      const fileName = `Comparativo_${clientName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.docx`;
      saveAs(blob, fileName);
      
    } catch (error) {
      console.error('Error exporting to Word:', error);
      alert('Error al exportar: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsExporting(false);
    }
  };

  // Obtener todos los conceptos únicos
  const allValores = new Set<string>();
  const allAmparos = new Set<string>();
  const allDeducibles = new Set<string>();
  
  insurers.forEach(ins => {
    ins.valores_asegurados?.forEach(v => allValores.add(v.concepto));
    ins.amparos?.forEach(a => allAmparos.add(a.amparo));
    ins.deducibles?.forEach(d => allDeducibles.add(d.concepto));
  });

  return (
    <div className="space-y-6" data-testid="comparison-viewer">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Cuadro Comparativo de Cotizaciones</CardTitle>
                <p className="text-sm text-muted-foreground">{branding?.agencyName || 'Agencia de Seguros'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line}</Badge>
              <Button variant="default" size="sm" onClick={handleDownloadDOCX} disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                Descargar Word
              </Button>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Cliente</p>
                <p className="font-medium">{clientName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Fecha</p>
                <p className="font-medium">
                  {comparison.created_at ? format(new Date(comparison.created_at), 'dd MMM yyyy', { locale: es }) : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Agente</p>
                <p className="font-medium">{comparison.agent?.full_name || 'No especificado'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Cotizaciones</p>
                <p className="font-medium">{insurers.length} aseguradoras</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PRIMAS EN COLUMNAS */}
      <Card>
        <CardHeader className="py-3 bg-amber-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">💰 Resumen de Primas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="text-left p-3 font-semibold min-w-[150px]">Concepto</th>
                  {insurers.map((ins, i) => (
                    <th key={i} className="text-right p-3 font-semibold min-w-[140px]">{ins.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium">Prima Neta</td>
                  {insurers.map((ins, i) => (
                    <td key={i} className="p-3 text-right">
                      {ins.prima?.prima_neta || ins.prima?.total_anual || 'No especificado'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium">IVA</td>
                  {insurers.map((ins, i) => (
                    <td key={i} className="p-3 text-right">
                      {ins.prima?.iva || '-'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b hover:bg-amber-50 bg-amber-50">
                  <td className="p-3 font-bold">PRIMA TOTAL</td>
                  {insurers.map((ins, i) => (
                    <td key={i} className="p-3 text-right font-bold text-primary text-lg">
                      {ins.prima?.total_anual || 'No especificado'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium">Forma de Pago</td>
                  {insurers.map((ins, i) => (
                    <td key={i} className="p-3 text-right text-muted-foreground">
                      {ins.prima?.forma_pago || 'No especificado'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* VALORES ASEGURADOS */}
      {allValores.size > 0 && (
        <Card>
          <CardHeader className="py-3 bg-green-50 border-b">
            <CardTitle className="text-base flex items-center gap-2">📊 Valores Asegurados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b">
                    <th className="text-left p-3 font-semibold min-w-[180px]">Concepto</th>
                    {insurers.map((ins, i) => (
                      <th key={i} className="text-right p-3 font-semibold min-w-[140px]">{ins.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(allValores).map((concepto, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-medium">{concepto}</td>
                      {insurers.map((ins, j) => {
                        const valor = ins.valores_asegurados?.find(v => v.concepto === concepto)?.valor;
                        return (
                          <td key={j} className="p-3 text-right">
                            {valor || <span className="text-slate-400">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AMPAROS */}
      {allAmparos.size > 0 && (
        <Card>
          <CardHeader className="py-3 bg-blue-50 border-b">
            <CardTitle className="text-base flex items-center gap-2">🛡️ Amparos / Coberturas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b">
                    <th className="text-left p-3 font-semibold min-w-[180px]">Amparo</th>
                    {insurers.map((ins, i) => (
                      <th key={i} className="text-left p-3 font-semibold min-w-[140px]">{ins.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(allAmparos).map((amparo, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-medium">{amparo}</td>
                      {insurers.map((ins, j) => {
                        const amp = ins.amparos?.find(a => a.amparo === amparo);
                        return (
                          <td key={j} className="p-3">
                            {amp ? (
                              <span className="text-green-600">{amp.limite || '✓ Incluido'}</span>
                            ) : (
                              <span className="text-red-400">✗ No incluido</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DEDUCIBLES */}
      {allDeducibles.size > 0 && (
        <Card>
          <CardHeader className="py-3 bg-orange-50 border-b">
            <CardTitle className="text-base flex items-center gap-2">⚠️ Deducibles</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b">
                    <th className="text-left p-3 font-semibold min-w-[180px]">Deducible</th>
                    {insurers.map((ins, i) => (
                      <th key={i} className="text-left p-3 font-semibold min-w-[140px]">{ins.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(allDeducibles).map((ded, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-medium">{ded}</td>
                      {insurers.map((ins, j) => {
                        const deducible = ins.deducibles?.find(d => d.concepto === ded);
                        return (
                          <td key={j} className="p-3">
                            {deducible?.valor || <span className="text-slate-400">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BENEFICIOS */}
      <Card>
        <CardHeader className="py-3 bg-purple-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">🎁 Beneficios Adicionales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b">
                  {insurers.map((ins, i) => (
                    <th key={i} className="text-left p-3 font-semibold">{ins.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {insurers.map((ins, i) => (
                    <td key={i} className="p-3 align-top border-r last:border-r-0">
                      {ins.beneficios && ins.beneficios.length > 0 ? (
                        <ul className="list-none space-y-1">
                          {ins.beneficios.map((ben, j) => (
                            <li key={j} className="flex items-start gap-1">
                              <span className="text-green-500">✓</span>
                              <span>{ben}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400">No especificados</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
