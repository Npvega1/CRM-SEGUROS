'use client';

// =====================================================
// COMPONENTE: ComparisonViewer
// Visualizador de cuadro comparativo - TABLA LADO A LADO
// =====================================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ComparisonWithRelations } from '@/lib/validations/comparisons';
import { POLICY_LINE_LABELS, type PolicyLine } from '@/lib/validations/policies';
import { 
  Download, 
  Edit2, 
  Check, 
  X,
  Sparkles,
  Building2,
  User,
  Calendar,
  Loader2,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

interface ComparisonTable {
  line?: string;
  insurers: InsurerData[];
}

interface ComparisonViewerProps {
  comparison: ComparisonWithRelations;
  onUpdateCell: (insurerKey: string, criteriaKey: string, newValue: string) => Promise<void>;
  onUpdateRecommendation: (recommendation: string) => Promise<void>;
  onCreatePolicy?: (insurerName: string) => void;
  branding?: {
    logoUrl?: string;
    agencyName?: string;
    primaryColor?: string;
  };
}

export function ComparisonViewer({
  comparison,
  onUpdateRecommendation,
  branding
}: ComparisonViewerProps) {
  const [isEditingRecommendation, setIsEditingRecommendation] = useState(false);
  const [recommendationValue, setRecommendationValue] = useState(comparison.ai_recommendation || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const table = comparison.comparison_table as ComparisonTable | null;
  const prospectName = (comparison as unknown as { prospect_name?: string }).prospect_name;
  const clientName = comparison.client?.full_name || prospectName || 'No especificado';

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

  const handleSaveRecommendation = async () => {
    setIsSaving(true);
    try {
      await onUpdateRecommendation(recommendationValue);
      setIsEditingRecommendation(false);
    } catch (error) {
      console.error('Error saving recommendation:', error);
    }
    setIsSaving(false);
  };

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
      
      // Helper para celda de encabezado (fondo azul, texto blanco)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headerCell = (text: string) => new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text, bold: true, color: HEADER_TEXT, size: 20 })],
          alignment: AlignmentType.CENTER
        })],
        borders,
        shading: { fill: HEADER_BG, type: ShadingType.CLEAR, color: HEADER_BG },
        verticalAlign: VerticalAlign.CENTER,
      });
      
      // Helper para celda de datos normal
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataCell = (text: string, isOdd: boolean, isBold = false, align: any = AlignmentType.LEFT, isHighlight = false) => new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text, bold: isBold, size: 18 })],
          alignment: align
        })],
        borders,
        shading: { 
          fill: isHighlight ? HIGHLIGHT_BG : (isOdd ? ROW_ODD : ROW_EVEN), 
          type: ShadingType.CLEAR, 
          color: isHighlight ? HIGHLIGHT_BG : (isOdd ? ROW_ODD : ROW_EVEN)
        },
        verticalAlign: VerticalAlign.CENTER,
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
          headerCell('Criterio'),
          ...insurers.map(ins => headerCell(ins.name || 'Aseguradora')),
        ],
      });

      // Fila de iconos/logos (simulado con emoji o texto)
      const logoRow = new TableRow({
        children: [
          dataCell('🏢', false, false, AlignmentType.CENTER),
          ...insurers.map((ins, i) => dataCell(ins.name?.split(' ')[0] || 'ASG', false, true, AlignmentType.CENTER)),
        ],
      });

      // ========== VALORES ASEGURADOS ==========
      const valoresHeaderRow = new TableRow({
        children: [
          dataCell('📊 VALORES ASEGURADOS', true, true, AlignmentType.LEFT),
          ...insurers.map(() => dataCell('', true)),
        ],
      });

      const valoresRows = Array.from(allValores).map((concepto, idx) => new TableRow({
        children: [
          dataCell(concepto, idx % 2 === 0, concepto.toUpperCase() === 'TOTAL ASEGURADO'),
          ...insurers.map(ins => {
            const valor = ins.valores_asegurados?.find(v => v.concepto === concepto)?.valor || '-';
            return dataCell(valor, idx % 2 === 0, concepto.toUpperCase() === 'TOTAL ASEGURADO', AlignmentType.RIGHT);
          }),
        ],
      }));

      // ========== AMPAROS ==========
      const amparosHeaderRow = new TableRow({
        children: [
          dataCell('🛡️ COBERTURAS', true, true, AlignmentType.LEFT),
          ...insurers.map(() => dataCell('', true)),
        ],
      });

      const amparosRows = Array.from(allAmparos).map((amparo, idx) => new TableRow({
        children: [
          dataCell(amparo, idx % 2 === 0),
          ...insurers.map(ins => {
            const amp = ins.amparos?.find(a => a.amparo === amparo);
            const text = amp ? (amp.limite || '✓ Incluido') : '✗ No incluido';
            return dataCell(text, idx % 2 === 0);
          }),
        ],
      }));

      // ========== DEDUCIBLES ==========
      const deduciblesHeaderRow = new TableRow({
        children: [
          dataCell('📋 DEDUCIBLES', true, true, AlignmentType.LEFT),
          ...insurers.map(() => dataCell('', true)),
        ],
      });

      const deduciblesRows = Array.from(allDeducibles).map((ded, idx) => new TableRow({
        children: [
          dataCell(ded, idx % 2 === 0),
          ...insurers.map(ins => {
            const deducible = ins.deducibles?.find(d => d.concepto === ded);
            return dataCell(deducible?.valor || '-', idx % 2 === 0);
          }),
        ],
      }));

      // ========== BENEFICIOS ==========
      const beneficiosHeaderRow = new TableRow({
        children: [
          dataCell('🎁 BENEFICIOS', true, true, AlignmentType.LEFT),
          ...insurers.map(() => dataCell('', true)),
        ],
      });

      const beneficiosRow = new TableRow({
        children: [
          dataCell('Asistencias incluidas', false),
          ...insurers.map(ins => {
            const bens = ins.beneficios?.join('\n• ') || 'No especificados';
            return dataCell(ins.beneficios && ins.beneficios.length > 0 ? '• ' + bens : 'No especificados', false);
          }),
        ],
      });

      // ========== PRIMA (DESTACADA) ==========
      const primaHeaderRow = new TableRow({
        children: [
          dataCell('💰 VALOR A PAGAR', true, true, AlignmentType.LEFT, true),
          ...insurers.map(() => dataCell('', true, false, AlignmentType.LEFT, true)),
        ],
      });

      const primaTotalRow = new TableRow({
        children: [
          dataCell('Prima Total Anual', false, true, AlignmentType.LEFT, true),
          ...insurers.map(ins => dataCell(ins.prima?.total_anual || 'No especificado', false, true, AlignmentType.RIGHT, true)),
        ],
      });

      const primaFormaRow = new TableRow({
        children: [
          dataCell('Forma de Pago', false, false, AlignmentType.LEFT),
          ...insurers.map(ins => dataCell(ins.prima?.forma_pago || 'No especificado', false)),
        ],
      });

      // Construir tabla completa
      const mainTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
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

      // ========== RECOMENDACIÓN ==========
      if (comparison.ai_recommendation) {
        children.push(
          new Paragraph({ children: [], spacing: { before: 300 } }),
          new Paragraph({ 
            children: [new TextRun({ text: '🏆 Recomendación del Asesor', bold: true, size: 24 })],
            spacing: { after: 150 } 
          })
        );
        
        // Caja de recomendación
        const recoTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: comparison.ai_recommendation.split('\n').map(line => 
                    new Paragraph({ 
                      children: [new TextRun({ text: line, size: 20 })],
                      spacing: { after: 80 }
                    })
                  ),
                  borders: { 
                    top: { style: BorderStyle.SINGLE, size: 12, color: '2563EB' },
                    bottom: { style: BorderStyle.SINGLE, size: 12, color: '2563EB' },
                    left: { style: BorderStyle.SINGLE, size: 12, color: '2563EB' },
                    right: { style: BorderStyle.SINGLE, size: 12, color: '2563EB' },
                  },
                  shading: { fill: 'EFF6FF', type: ShadingType.CLEAR, color: 'EFF6FF' },
                }),
              ],
            }),
          ],
        });
        children.push(recoTable);
      }

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
              <Button variant="default" size="sm" onClick={exportToWord} disabled={isExporting}>
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

      {/* RECOMENDACIÓN */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Recomendación del Asesor
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setIsEditingRecommendation(!isEditingRecommendation)}>
              <Edit2 className="h-4 w-4 mr-1" />
              Editar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isEditingRecommendation ? (
            <div className="space-y-3">
              <Textarea
                value={recommendationValue}
                onChange={(e) => setRecommendationValue(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRecommendationValue(comparison.ai_recommendation || '');
                    setIsEditingRecommendation(false);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveRecommendation} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 text-sm whitespace-pre-wrap border border-blue-100">
              {comparison.ai_recommendation || 'No hay recomendación disponible.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
