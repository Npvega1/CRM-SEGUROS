'use client';

// =====================================================
// COMPONENTE: ComparativoPolizas
// Visualizador especializado para comparativos de:
// PYME, Hogar, Copropiedades
// Tabla lado a lado con múltiples aseguradoras
// =====================================================

import React, { useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, Award, TrendingDown } from 'lucide-react';

// Tipos
interface ClienteData {
  nombre?: string;
  nit?: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  ciiu?: string;
  actividad?: string;
}

interface AmparoData {
  nombre: string;
  valorAsegurado?: number | string;
  deducible?: string;
  nota_comparativa?: string;
}

interface AsistenciaData {
  nombre: string;
  limite?: string;
}

interface BeneficiosData {
  asistencias?: AsistenciaData[];
  amparoAutomaticoNuevosBienes?: string;
  gastosExtincionSiniestro?: string;
  gastosRemocionEscombros?: string;
  honorariosProfesionales?: string;
  anticipoIndemnizacion?: string;
  aviso_siniestro_dias?: string;
  designacionAjustadores?: string;
  restablecimientoAutomatico?: string;
  indiceVariable?: string;
  otrosBeneficios?: string[];
}

interface PrimaData {
  netaAnteIva?: number;
  asistencia?: number;
  iva?: number;
  total?: number;
}

interface ValoresAseguradosData {
  edificio?: number;
  indiceVariable?: number;
  mueblesEnseres?: number;
  eeeFijo?: number;
  eeeMovil?: number;
  maquinaria?: number;
  mercancias?: number;
  dineroEfectivo?: number;
  mejorasLocativas?: number;
  totalDanoMaterial?: number;
  lucroCesante?: number;
  contenidoGeneral?: number;
  joyas?: number;
  pilesYCueros?: number;
  objetosArte?: number;
  electrodomesticos?: number;
}

interface AseguradoraData {
  nombre: string;
  producto?: string;
  recomendada?: boolean;
  valoresAsegurados?: ValoresAseguradosData;
  amparos?: AmparoData[];
  beneficiosAdicionales?: BeneficiosData;
  prima?: PrimaData;
}

interface ComparativoData {
  cliente?: ClienteData;
  aseguradoras?: AseguradoraData[];
  resumen_recomendacion?: string;
}

interface ComparativoPolizasProps {
  comparativo: ComparativoData;
  tenantName?: string;
  primaryColor?: string;
  logoUrl?: string | null;
  onDownloadWord?: () => void;
  isExporting?: boolean;
}

export function ComparativoPolizas({
  comparativo,
  tenantName = 'Agencia de Seguros',
  primaryColor = '#3b82f6',
  logoUrl,
  onDownloadWord,
  isExporting = false,
}: ComparativoPolizasProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [descargando, setDescargando] = useState(false);

  // Colores basados en el color primario del tenant
  const C = {
    primary: primaryColor,
    primaryLight: `${primaryColor}15`,
    headerBg: primaryColor,
    headerText: '#FFFFFF',
    sectionBg: '#F8FAFC',
    sectionText: '#1E293B',
    cellBorder: '#E2E8F0',
    recommended: `${primaryColor}20`,
    recommendedBorder: primaryColor,
    notIncluded: '#FEF2F2',
    notIncludedTxt: '#991B1B',
    lowestPrice: '#DCFCE7',
    lowestPriceTxt: '#166534',
  };

  // Formatear moneda
  const fmt = (n: number | string | undefined) => {
    if (n === undefined || n === null || n === '') return '—';
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (isNaN(num)) return '—';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Verificar si es "no incluido"
  const isNotIncluded = (val: unknown): boolean => {
    if (val === null || val === undefined || val === 0 || val === '') return true;
    if (typeof val === 'string') {
      const lower = val.toLowerCase().trim();
      return lower === 'no incluido' || lower === 'no aplica' || lower === '—' || lower === '-' || lower === 'n/a';
    }
    return false;
  };

  // Encontrar la prima más baja
  const findLowestPrima = () => {
    if (!comparativo.aseguradoras) return -1;
    let lowest = Infinity;
    let lowestIndex = -1;
    comparativo.aseguradoras.forEach((a, i) => {
      if (a.prima?.total && a.prima.total < lowest) {
        lowest = a.prima.total;
        lowestIndex = i;
      }
    });
    return lowestIndex;
  };

  const lowestPrimaIndex = findLowestPrima();

  // Descargar PDF
  const handleDescargarPDF = async () => {
    if (!printRef.current) return;
    setDescargando(true);
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 5;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`comparativo_${comparativo.cliente?.nombre || 'polizas'}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el PDF. Por favor intente de nuevo.');
    } finally {
      setDescargando(false);
    }
  };

  if (!comparativo || !comparativo.aseguradoras || comparativo.aseguradoras.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No hay datos de comparativo disponibles
        </CardContent>
      </Card>
    );
  }

  const aseguradoras = comparativo.aseguradoras;
  const numCols = aseguradoras.length + 1;

  // Estilos
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  };

  const thStyle: React.CSSProperties = {
    padding: '12px 8px',
    textAlign: 'center',
    fontWeight: 600,
    borderBottom: `2px solid ${C.cellBorder}`,
  };

  const tdStyle: React.CSSProperties = {
    padding: '8px',
    borderBottom: `1px solid ${C.cellBorder}`,
    verticalAlign: 'top',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    backgroundColor: C.sectionBg,
    color: C.sectionText,
    fontWeight: 700,
    padding: '10px 8px',
    textAlign: 'left',
    borderBottom: `2px solid ${C.cellBorder}`,
  };

  // Componentes internos
  const SectionRow = ({ label }: { label: string }) => (
    <tr>
      <td colSpan={numCols} style={sectionHeaderStyle}>
        {label}
      </td>
    </tr>
  );

  const LabelCell = ({ children }: { children: React.ReactNode }) => (
    <td style={{ ...tdStyle, fontWeight: 500, backgroundColor: '#FAFAFA', width: '200px' }}>
      {children}
    </td>
  );

  const ValueCell = ({ value, isRecommended, align = 'left' }: { value: unknown; isRecommended?: boolean; align?: 'left' | 'right' | 'center' }) => {
    const notIncluded = isNotIncluded(value);
    return (
      <td
        style={{
          ...tdStyle,
          textAlign: align,
          backgroundColor: notIncluded ? C.notIncluded : isRecommended ? C.recommended : 'transparent',
          color: notIncluded ? C.notIncludedTxt : 'inherit',
          fontStyle: notIncluded ? 'italic' : 'normal',
        }}
      >
        {notIncluded ? 'No incluido' : String(value)}
      </td>
    );
  };

  const PriceCell = ({ value, isLowest, isRecommended }: { value: number | undefined; isLowest: boolean; isRecommended?: boolean }) => (
    <td
      style={{
        ...tdStyle,
        textAlign: 'right',
        fontWeight: isLowest ? 700 : 400,
        fontSize: isLowest ? '14px' : '12px',
        backgroundColor: isLowest ? C.lowestPrice : isRecommended ? C.recommended : 'transparent',
        color: isLowest ? C.lowestPriceTxt : 'inherit',
      }}
    >
      <div className="flex items-center justify-end gap-2">
        {fmt(value)}
        {isLowest && (
          <span className="inline-flex items-center gap-1 text-xs bg-green-600 text-white px-2 py-0.5 rounded">
            <TrendingDown className="h-3 w-3" />
            MÁS ECONÓMICA
          </span>
        )}
      </div>
    </td>
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div ref={printRef} style={{ backgroundColor: 'white', padding: '20px' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <div className="flex items-center gap-4">
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
              )}
              <div>
                <h2 className="text-xl font-bold" style={{ color: primaryColor }}>
                  {tenantName.toUpperCase()}
                </h2>
                <p className="text-sm text-muted-foreground">CUADRO COMPARATIVO DE PÓLIZAS</p>
              </div>
            </div>
            {comparativo.cliente && (
              <div className="text-right text-sm">
                <p><strong>Cliente:</strong> {comparativo.cliente.nombre}</p>
                {comparativo.cliente.nit && <p><strong>NIT:</strong> {comparativo.cliente.nit}</p>}
                <p><strong>Vigencia:</strong> {comparativo.cliente.vigenciaDesde} - {comparativo.cliente.vigenciaHasta}</p>
              </div>
            )}
          </div>

          {/* Resumen de recomendación */}
          {comparativo.resumen_recomendacion && (
            <div 
              className="mb-4 p-3 rounded-lg border-l-4"
              style={{ backgroundColor: C.primaryLight, borderLeftColor: primaryColor }}
            >
              <p className="text-sm">
                <strong>Recomendación:</strong> {comparativo.resumen_recomendacion}
              </p>
            </div>
          )}

          {/* Tabla comparativa */}
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ backgroundColor: C.headerBg, color: C.headerText }}>
                  <th style={{ ...thStyle, textAlign: 'left', width: '200px' }}>COBERTURA / CONCEPTO</th>
                  {aseguradoras.map((aseg, i) => (
                    <th
                      key={i}
                      style={{
                        ...thStyle,
                        backgroundColor: aseg.recomendada ? C.recommendedBorder : C.headerBg,
                        borderBottom: aseg.recomendada ? `3px solid ${C.recommendedBorder}` : `2px solid ${C.cellBorder}`,
                      }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold">{aseg.nombre}</span>
                        {aseg.producto && <span className="text-xs opacity-80">{aseg.producto}</span>}
                        {aseg.recomendada && (
                          <span className="inline-flex items-center gap-1 text-xs bg-white text-blue-600 px-2 py-0.5 rounded mt-1">
                            <Award className="h-3 w-3" />
                            RECOMENDADA
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* VALORES ASEGURADOS */}
                <SectionRow label="① VALORES ASEGURADOS" />
                
                {/* Renderizar valores asegurados dinámicamente */}
                {(() => {
                  const valoresLabels: { key: keyof ValoresAseguradosData; label: string }[] = [
                    { key: 'edificio', label: 'Edificio' },
                    { key: 'indiceVariable', label: 'Índice Variable' },
                    { key: 'mueblesEnseres', label: 'Muebles y Enseres' },
                    { key: 'eeeFijo', label: 'Equipo Eléctrico/Electrónico Fijo' },
                    { key: 'eeeMovil', label: 'Equipo Eléctrico/Electrónico Móvil' },
                    { key: 'maquinaria', label: 'Maquinaria' },
                    { key: 'mercancias', label: 'Mercancías' },
                    { key: 'dineroEfectivo', label: 'Dinero en Efectivo' },
                    { key: 'mejorasLocativas', label: 'Mejoras Locativas' },
                    { key: 'contenidoGeneral', label: 'Contenido General' },
                    { key: 'joyas', label: 'Joyas y Objetos de Valor' },
                    { key: 'electrodomesticos', label: 'Electrodomésticos' },
                    { key: 'lucroCesante', label: 'Lucro Cesante' },
                  ];

                  // Filtrar solo los que tienen algún valor
                  const activeValores = valoresLabels.filter(v => 
                    aseguradoras.some(a => a.valoresAsegurados?.[v.key])
                  );

                  return activeValores.map(({ key, label }) => (
                    <tr key={key}>
                      <LabelCell>{label}</LabelCell>
                      {aseguradoras.map((aseg, i) => (
                        <ValueCell 
                          key={i} 
                          value={fmt(aseg.valoresAsegurados?.[key])} 
                          isRecommended={aseg.recomendada}
                          align="right"
                        />
                      ))}
                    </tr>
                  ));
                })()}

                {/* Total Daño Material */}
                <tr style={{ backgroundColor: C.sectionBg, fontWeight: 600 }}>
                  <LabelCell>TOTAL DAÑO MATERIAL</LabelCell>
                  {aseguradoras.map((aseg, i) => (
                    <td
                      key={i}
                      style={{
                        ...tdStyle,
                        textAlign: 'right',
                        fontWeight: 700,
                        backgroundColor: aseg.recomendada ? C.recommended : C.sectionBg,
                      }}
                    >
                      {fmt(aseg.valoresAsegurados?.totalDanoMaterial)}
                    </td>
                  ))}
                </tr>

                {/* AMPAROS / COBERTURAS */}
                <SectionRow label="② AMPAROS / COBERTURAS" />
                
                {(() => {
                  // Obtener todos los amparos únicos
                  const allAmparos = new Set<string>();
                  aseguradoras.forEach(a => {
                    a.amparos?.forEach(amp => allAmparos.add(amp.nombre));
                  });

                  return Array.from(allAmparos).map(amparoNombre => (
                    <tr key={amparoNombre}>
                      <LabelCell>{amparoNombre}</LabelCell>
                      {aseguradoras.map((aseg, i) => {
                        const amparo = aseg.amparos?.find(a => a.nombre === amparoNombre);
                        const notIncluded = !amparo || isNotIncluded(amparo.valorAsegurado);
                        
                        return (
                          <td
                            key={i}
                            style={{
                              ...tdStyle,
                              backgroundColor: notIncluded ? C.notIncluded : aseg.recomendada ? C.recommended : 'transparent',
                              color: notIncluded ? C.notIncludedTxt : 'inherit',
                              fontStyle: notIncluded ? 'italic' : 'normal',
                            }}
                          >
                            {notIncluded ? (
                              'No incluido'
                            ) : (
                              <div className="text-xs space-y-1">
                                <div><strong>Valor:</strong> {fmt(amparo?.valorAsegurado)}</div>
                                {amparo?.deducible && <div><strong>Deducible:</strong> {amparo.deducible}</div>}
                                {amparo?.nota_comparativa && (
                                  <div className="text-muted-foreground italic">{amparo.nota_comparativa}</div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })()}

                {/* BENEFICIOS ADICIONALES */}
                <SectionRow label="③ BENEFICIOS ADICIONALES" />
                
                {/* Asistencias */}
                {(() => {
                  const hasAsistencias = aseguradoras.some(a => a.beneficiosAdicionales?.asistencias?.length);
                  if (!hasAsistencias) return null;
                  
                  return (
                    <tr>
                      <LabelCell>Asistencias</LabelCell>
                      {aseguradoras.map((aseg, i) => (
                        <td
                          key={i}
                          style={{
                            ...tdStyle,
                            backgroundColor: aseg.recomendada ? C.recommended : 'transparent',
                          }}
                        >
                          {aseg.beneficiosAdicionales?.asistencias?.length ? (
                            <ul className="text-xs list-disc list-inside">
                              {aseg.beneficiosAdicionales.asistencias.map((asist, j) => (
                                <li key={j}>
                                  {asist.nombre}
                                  {asist.limite && ` (${asist.limite})`}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })()}

                {/* Otros beneficios fijos */}
                {[
                  { key: 'amparoAutomaticoNuevosBienes', label: 'Amparo Automático Nuevos Bienes' },
                  { key: 'gastosExtincionSiniestro', label: 'Gastos Extinción Siniestro' },
                  { key: 'gastosRemocionEscombros', label: 'Gastos Remoción Escombros' },
                  { key: 'honorariosProfesionales', label: 'Honorarios Profesionales' },
                  { key: 'anticipoIndemnizacion', label: 'Anticipo de Indemnización' },
                  { key: 'restablecimientoAutomatico', label: 'Restablecimiento Automático' },
                ].map(({ key, label }) => {
                  const hasValue = aseguradoras.some(a => 
                    a.beneficiosAdicionales?.[key as keyof BeneficiosData]
                  );
                  if (!hasValue) return null;
                  
                  return (
                    <tr key={key}>
                      <LabelCell>{label}</LabelCell>
                      {aseguradoras.map((aseg, i) => (
                        <ValueCell
                          key={i}
                          value={aseg.beneficiosAdicionales?.[key as keyof BeneficiosData] as string}
                          isRecommended={aseg.recomendada}
                        />
                      ))}
                    </tr>
                  );
                })}

                {/* Otros beneficios diferenciales */}
                {(() => {
                  const hasOtros = aseguradoras.some(a => a.beneficiosAdicionales?.otrosBeneficios?.length);
                  if (!hasOtros) return null;
                  
                  return (
                    <tr>
                      <LabelCell>Coberturas Diferenciales</LabelCell>
                      {aseguradoras.map((aseg, i) => (
                        <td
                          key={i}
                          style={{
                            ...tdStyle,
                            backgroundColor: aseg.recomendada ? C.recommended : 'transparent',
                          }}
                        >
                          {aseg.beneficiosAdicionales?.otrosBeneficios?.length ? (
                            <ul className="text-xs list-disc list-inside">
                              {aseg.beneficiosAdicionales.otrosBeneficios.map((b, j) => (
                                <li key={j}>{b}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })()}

                {/* PRIMA */}
                <SectionRow label="④ PRIMA" />
                
                <tr>
                  <LabelCell>Prima Neta (antes de IVA)</LabelCell>
                  {aseguradoras.map((aseg, i) => (
                    <ValueCell 
                      key={i} 
                      value={fmt(aseg.prima?.netaAnteIva)} 
                      isRecommended={aseg.recomendada}
                      align="right"
                    />
                  ))}
                </tr>
                
                {aseguradoras.some(a => a.prima?.asistencia) && (
                  <tr>
                    <LabelCell>Asistencia</LabelCell>
                    {aseguradoras.map((aseg, i) => (
                      <ValueCell 
                        key={i} 
                        value={fmt(aseg.prima?.asistencia)} 
                        isRecommended={aseg.recomendada}
                        align="right"
                      />
                    ))}
                  </tr>
                )}
                
                <tr>
                  <LabelCell>IVA</LabelCell>
                  {aseguradoras.map((aseg, i) => (
                    <ValueCell 
                      key={i} 
                      value={fmt(aseg.prima?.iva)} 
                      isRecommended={aseg.recomendada}
                      align="right"
                    />
                  ))}
                </tr>
                
                <tr style={{ fontWeight: 700 }}>
                  <LabelCell>PRIMA TOTAL CON IVA</LabelCell>
                  {aseguradoras.map((aseg, i) => (
                    <PriceCell
                      key={i}
                      value={aseg.prima?.total}
                      isLowest={i === lowestPrimaIndex}
                      isRecommended={aseg.recomendada}
                    />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            <p className="italic">
              * Este documento es un cuadro comparativo de referencia. Las condiciones definitivas están 
              sujetas a la aprobación de cada compañía aseguradora y pueden variar según la evaluación del riesgo.
            </p>
            <p className="mt-2 text-right">
              Generado el {new Date().toLocaleDateString('es-CO')}
            </p>
          </div>
        </div>

        {/* Botones de descarga */}
        <div className="p-4 border-t flex justify-end gap-2">
          <Button 
            onClick={handleDescargarPDF} 
            disabled={descargando}
            variant="outline"
            className="gap-2"
          >
            {descargando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando PDF...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Descargar PDF
              </>
            )}
          </Button>
          
          {onDownloadWord && (
            <Button 
              onClick={onDownloadWord} 
              disabled={isExporting}
              className="gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando Word...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  Descargar Word
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
