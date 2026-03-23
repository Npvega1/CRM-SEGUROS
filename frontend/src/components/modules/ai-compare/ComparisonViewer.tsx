'use client';

// =====================================================
// COMPONENTE: ComparisonViewer
// Visualizador de cuadro comparativo - NUEVA ESTRUCTURA
// Con exportación a Word
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
  MapPin,
  DollarSign,
  Shield,
  AlertTriangle,
  Gift,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Tipos para la nueva estructura
interface InsurerData {
  name: string;
  informacion_riesgo?: {
    cliente?: string;
    direccion?: string;
    ciudad?: string;
    descripcion_riesgo?: string;
  };
  valores_asegurados?: Array<{ concepto: string; valor: string }>;
  amparos?: Array<{ amparo: string; limite?: string }>;
  deducibles?: Array<{ concepto: string; valor: string }>;
  beneficios?: string[];
  prima?: {
    total_anual?: string;
    forma_pago?: string;
  };
  // Estructura antigua para compatibilidad
  fields?: Record<string, { value: string; notes?: string }>;
}

interface ComparisonTable {
  line?: string;
  criteria?: string[];
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

  // Verificar si usa la nueva estructura
  const isNewStructure = table.insurers[0]?.informacion_riesgo !== undefined;

  // Función para exportar a Word (con import dinámico para evitar SSR issues)
  const exportToWord = async () => {
    setIsExporting(true);
    
    try {
      // Import dinámico de docx para evitar problemas de SSR
      const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, HeadingLevel, ShadingType } = await import('docx');
      const { saveAs } = await import('file-saver');
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: any[] = [];
      
      // Título
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: branding?.agencyName || 'Agencia de Seguros',
              bold: true,
              size: 32,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'CUADRO COMPARATIVO DE COTIZACIONES',
              bold: true,
              size: 28,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      // Info general
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Cliente: ', bold: true }),
            new TextRun({ text: clientName }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Ramo: ', bold: true }),
            new TextRun({ text: POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Fecha: ', bold: true }),
            new TextRun({ text: comparison.created_at 
              ? format(new Date(comparison.created_at), 'dd MMMM yyyy', { locale: es })
              : 'No disponible' }),
          ],
          spacing: { after: 300 },
        })
      );

      // Para cada aseguradora
      for (const insurer of table.insurers) {
        // Nombre de aseguradora
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `═══ ${insurer.name} ═══`,
                bold: true,
                size: 26,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
          })
        );

        if (isNewStructure) {
          // INFORMACIÓN DEL RIESGO
          if (insurer.informacion_riesgo) {
            children.push(
              new Paragraph({
                text: 'INFORMACIÓN DEL RIESGO',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              })
            );
            
            const infoRows = [
              ['Cliente', insurer.informacion_riesgo.cliente || 'No especificado'],
              ['Dirección', insurer.informacion_riesgo.direccion || 'No especificado'],
              ['Ciudad', insurer.informacion_riesgo.ciudad || 'No especificado'],
              ['Descripción', insurer.informacion_riesgo.descripcion_riesgo || 'No especificado'],
            ];
            
            for (const [label, value] of infoRows) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: `${label}: `, bold: true }),
                    new TextRun({ text: value }),
                  ],
                  spacing: { after: 50 },
                })
              );
            }
          }

          // VALORES ASEGURADOS
          if (insurer.valores_asegurados && insurer.valores_asegurados.length > 0) {
            children.push(
              new Paragraph({
                text: 'VALORES ASEGURADOS',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              })
            );
            
            // Crear tabla de valores asegurados
            const valoresTable = new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: 'Concepto', bold: true })] })],
                      shading: { fill: 'E0E0E0', type: ShadingType.SOLID },
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: 'Valor', bold: true })] })],
                      shading: { fill: 'E0E0E0', type: ShadingType.SOLID },
                    }),
                  ],
                }),
                ...insurer.valores_asegurados.map(
                  (v) =>
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph(v.concepto)] }),
                        new TableCell({ children: [new Paragraph(v.valor)] }),
                      ],
                    })
                ),
              ],
            });

            children.push(valoresTable);
            children.push(new Paragraph({ children: [] })); // Spacer
          }

          // AMPAROS
          if (insurer.amparos && insurer.amparos.length > 0) {
            children.push(
              new Paragraph({
                text: 'AMPAROS / COBERTURAS',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              })
            );
            
            for (const amparo of insurer.amparos) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: '• ' }),
                    new TextRun({ text: amparo.amparo, bold: true }),
                    amparo.limite ? new TextRun({ text: ` - ${amparo.limite}` }) : new TextRun({ text: '' }),
                  ],
                  spacing: { after: 50 },
                })
              );
            }
          }

          // DEDUCIBLES
          if (insurer.deducibles && insurer.deducibles.length > 0) {
            children.push(
              new Paragraph({
                text: 'DEDUCIBLES',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              })
            );
            
            for (const ded of insurer.deducibles) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: '• ' }),
                    new TextRun({ text: ded.concepto, bold: true }),
                    new TextRun({ text: `: ${ded.valor}` }),
                  ],
                  spacing: { after: 50 },
                })
              );
            }
          }

          // BENEFICIOS
          if (insurer.beneficios && insurer.beneficios.length > 0) {
            children.push(
              new Paragraph({
                text: 'BENEFICIOS ADICIONALES',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              })
            );
            
            for (const ben of insurer.beneficios) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: '• ' }),
                    new TextRun({ text: ben }),
                  ],
                  spacing: { after: 50 },
                })
              );
            }
          }

          // PRIMA
          if (insurer.prima) {
            children.push(
              new Paragraph({
                text: 'PRIMA',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Prima Total Anual: ', bold: true }),
                  new TextRun({ text: insurer.prima.total_anual || 'No especificado', bold: true, size: 28 }),
                ],
                spacing: { after: 50 },
              })
            );
            
            if (insurer.prima.forma_pago) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Forma de Pago: ', bold: true }),
                    new TextRun({ text: insurer.prima.forma_pago }),
                  ],
                  spacing: { after: 100 },
                })
              );
            }
          }
        }
      }

      // Recomendación
      if (comparison.ai_recommendation) {
        children.push(
          new Paragraph({
            text: 'RECOMENDACIÓN',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: comparison.ai_recommendation,
            spacing: { after: 200 },
          })
        );
      }

      // Crear documento
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: children,
          },
        ],
      });

      // Generar y descargar
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Comparativo_${clientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.docx`);
      
    } catch (error) {
      console.error('Error exporting to Word:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="comparison-viewer">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {branding?.logoUrl ? (
                <img 
                  src={branding.logoUrl} 
                  alt="Logo" 
                  className="h-12 w-auto object-contain"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">
                  Cuadro Comparativo de Cotizaciones
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {branding?.agencyName || 'Agencia de Seguros'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line}
              </Badge>
              <Button
                variant="default"
                size="sm"
                onClick={exportToWord}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
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
                  {comparison.created_at 
                    ? format(new Date(comparison.created_at), 'dd MMM yyyy', { locale: es })
                    : 'No disponible'}
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
                <p className="font-medium">{table.insurers.length} aseguradoras</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparativo por aseguradora */}
      <div className="grid gap-6">
        {table.insurers.map((insurer, index) => (
          <Card key={index} className="overflow-hidden">
            <CardHeader className="bg-slate-50 py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {insurer.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              
              {/* Información del Riesgo */}
              {isNewStructure && insurer.informacion_riesgo && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    INFORMACIÓN DEL RIESGO
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 p-3 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">Cliente:</span>
                      <p className="font-medium">{insurer.informacion_riesgo.cliente || 'No especificado'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ciudad:</span>
                      <p className="font-medium">{insurer.informacion_riesgo.ciudad || 'No especificado'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Dirección:</span>
                      <p className="font-medium">{insurer.informacion_riesgo.direccion || 'No especificado'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Valores Asegurados */}
              {isNewStructure && insurer.valores_asegurados && insurer.valores_asegurados.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    VALORES ASEGURADOS
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="text-left p-2 font-medium">Concepto</th>
                          <th className="text-right p-2 font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insurer.valores_asegurados.map((item, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{item.concepto}</td>
                            <td className="p-2 text-right font-medium">{item.valor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Amparos */}
              {isNewStructure && insurer.amparos && insurer.amparos.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    AMPAROS / COBERTURAS
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="text-left p-2 font-medium">Amparo</th>
                          <th className="text-left p-2 font-medium">Límite</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insurer.amparos.map((item, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{item.amparo}</td>
                            <td className="p-2">{item.limite || '100%'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Deducibles */}
              {isNewStructure && insurer.deducibles && insurer.deducibles.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    DEDUCIBLES
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="text-left p-2 font-medium">Concepto</th>
                          <th className="text-left p-2 font-medium">Deducible</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insurer.deducibles.map((item, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{item.concepto}</td>
                            <td className="p-2">{item.valor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Beneficios */}
              {isNewStructure && insurer.beneficios && insurer.beneficios.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 mb-3 flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    BENEFICIOS ADICIONALES
                  </h4>
                  <ul className="list-disc list-inside text-sm space-y-1 bg-green-50 p-3 rounded-lg">
                    {insurer.beneficios.map((ben, i) => (
                      <li key={i}>{ben}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Prima */}
              {isNewStructure && insurer.prima && (
                <div className="bg-primary/5 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm text-slate-600 mb-2">PRIMA</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-primary">
                      {insurer.prima.total_anual || 'No especificado'}
                    </span>
                    <span className="text-sm text-muted-foreground">anual</span>
                  </div>
                  {insurer.prima.forma_pago && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {insurer.prima.forma_pago}
                    </p>
                  )}
                </div>
              )}

              {/* Estructura antigua (compatibilidad) */}
              {!isNewStructure && insurer.fields && (
                <div className="space-y-2">
                  {Object.entries(insurer.fields).map(([key, field]) => (
                    <div key={key} className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-medium">{field.value}</span>
                    </div>
                  ))}
                </div>
              )}
              
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Recommendation */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Recomendación de la IA
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingRecommendation(!isEditingRecommendation)}
            >
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
                <Button
                  size="sm"
                  onClick={handleSaveRecommendation}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-4 text-sm whitespace-pre-wrap">
              {comparison.ai_recommendation || 'No hay recomendación disponible.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
