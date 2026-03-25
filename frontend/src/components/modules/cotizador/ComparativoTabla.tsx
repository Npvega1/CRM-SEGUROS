'use client';

// =====================================================
// COMPONENT: Cuadro Comparativo de Cotización
// Rediseño basado en HTML de referencia "CUADRO BASE"
// NOTA: Las TASAS son confidenciales - NO se muestran
// =====================================================

import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Building,
  Shield,
  FileText,
  DollarSign,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import {
  ResultadoAseguradora,
  formatCurrency,
  Producto,
  DatosCliente,
  ValoresAsegurados,
  AMPARO_LABELS,
} from '@/lib/services/cotizador-engine';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ComparativoTablaProps {
  resultados: ResultadoAseguradora[];
  producto: Producto;
  datosCliente: DatosCliente;
  valoresAsegurados: ValoresAsegurados;
}

// Colores de badge por aseguradora (fallbacks si no hay color_primario)
const ASEGURADORA_COLORS: Record<string, { bg: string; text: string }> = {
  'MAPFRE': { bg: '#dc2626', text: 'white' },
  'BOLIVAR': { bg: '#1e40af', text: 'white' },
  'SURA': { bg: '#0d9488', text: 'white' },
  'AXA': { bg: '#2563eb', text: 'white' },
  'MUNDIAL': { bg: '#7c3aed', text: 'white' },
  'ESTADO': { bg: '#059669', text: 'white' },
  'LIBERTY': { bg: '#eab308', text: 'black' },
  'HDI': { bg: '#f97316', text: 'white' },
  'SEGUROS GENERALES': { bg: '#64748b', text: 'white' },
  'ALLIANZ': { bg: '#0284c7', text: 'white' },
  'PREVISORA': { bg: '#16a34a', text: 'white' },
  'EQUIDAD': { bg: '#be185d', text: 'white' },
};

// Obtener color de aseguradora
function getAseguradoraColor(nombre: string, colorPrimario?: string) {
  if (colorPrimario) {
    return { bg: colorPrimario, text: 'white' };
  }
  const key = Object.keys(ASEGURADORA_COLORS).find(k => 
    nombre.toUpperCase().includes(k)
  );
  return key ? ASEGURADORA_COLORS[key] : { bg: '#6b7280', text: 'white' };
}

export function ComparativoTabla({
  resultados,
  producto,
  datosCliente,
  valoresAsegurados,
}: ComparativoTablaProps) {
  const tablaRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  if (resultados.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay resultados</h3>
          <p className="text-muted-foreground text-sm">
            No se encontraron aseguradoras con tasas disponibles para este producto
            o los valores asegurados son insuficientes.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Obtener todos los amparos únicos
  const amparosUnicos = Array.from(
    new Set(resultados.flatMap(r => r.primas.map(p => p.amparo)))
  );

  // Calcular valor total asegurado
  const valorTotalAsegurado = Object.entries(valoresAsegurados)
    .filter(([key]) => key !== 'anoConstruccion')
    .reduce((sum, [, val]) => sum + (typeof val === 'number' ? val : 0), 0);

  // Fecha actual formateada
  const fechaActual = new Date().toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Vigencia (1 año desde hoy)
  const fechaInicio = new Date();
  const fechaFin = new Date();
  fechaFin.setFullYear(fechaFin.getFullYear() + 1);
  const vigencia = `${fechaInicio.toLocaleDateString('es-CO')} – ${fechaFin.toLocaleDateString('es-CO')}`;

  // Generar PDF
  const handleDownloadPDF = async () => {
    if (!tablaRef.current) return;
    setIsGeneratingPDF(true);

    try {
      const canvas = await html2canvas(tablaRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
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

      // Calcular proporciones
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Si la imagen es muy alta, ajustar
      const maxImgHeight = pdfHeight - 30;
      const finalImgHeight = Math.min(imgHeight, maxImgHeight);
      const finalImgWidth = (finalImgHeight / imgHeight) * imgWidth;

      // Centrar horizontalmente
      const xOffset = (pdfWidth - finalImgWidth) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, 10, finalImgWidth, finalImgHeight);

      // Pie de página
      pdf.setFontSize(8);
      pdf.setTextColor(128);
      pdf.text(
        '* Las primas incluyen IVA del 19%. Sujeto a condiciones de aceptación de cada aseguradora.',
        10,
        pdfHeight - 10
      );

      const fileName = `Cotizacion-${producto}-${datosCliente.nombre.replace(/\s+/g, '_')}-${fechaActual.replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generando PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Botón descargar PDF */}
      <div className="flex justify-end">
        <Button 
          onClick={handleDownloadPDF} 
          disabled={isGeneratingPDF}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {isGeneratingPDF ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generando PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </>
          )}
        </Button>
      </div>

      {/* Contenedor para captura PDF */}
      <div ref={tablaRef} className="bg-white rounded-lg shadow-sm" data-testid="comparativo-tabla">
        {/* Header con datos del cliente */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-4 rounded-t-lg">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Cuadro Comparativo – {producto}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="opacity-70">Cliente: </span>
              <strong>{datosCliente.nombre || 'No especificado'}</strong>
            </div>
            <div>
              <span className="opacity-70">Dirección: </span>
              <strong>{datosCliente.direccion || datosCliente.ciudad}</strong>
            </div>
            <div>
              <span className="opacity-70">Valor Asegurado: </span>
              <strong>{formatCurrency(valorTotalAsegurado)}</strong>
            </div>
            <div>
              <span className="opacity-70">Vigencia: </span>
              <strong>{vigencia}</strong>
            </div>
          </div>
        </div>

        {/* Tabla principal */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* Header de aseguradoras */}
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-3 font-semibold text-slate-700 min-w-[180px] border-b border-slate-200">
                  Criterio
                </th>
                {resultados.map((res) => {
                  const colors = getAseguradoraColor(
                    res.aseguradora.nombre_corto,
                    res.aseguradora.color_primario
                  );
                  return (
                    <th 
                      key={res.aseguradora.id} 
                      className="text-center p-3 min-w-[160px] border-b border-slate-200"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          {res.aseguradora.nombre_corto}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {/* FILA 1: Valores Asegurados */}
              <tr className="border-b border-slate-200">
                <td className="p-3 font-medium text-slate-700 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-slate-500" />
                    <span>Valores Asegurados</span>
                  </div>
                </td>
                {resultados.map((res) => (
                  <td 
                    key={res.aseguradora.id} 
                    className="p-3"
                  >
                    <ul className="space-y-1 text-xs">
                      {valoresAsegurados.edificio > 0 && (
                        <li>Edificio: <strong>{formatCurrency(valoresAsegurados.edificio)}</strong></li>
                      )}
                      {valoresAsegurados.mueblesEnseres > 0 && (
                        <li>Muebles y Enseres: {formatCurrency(valoresAsegurados.mueblesEnseres)}</li>
                      )}
                      {valoresAsegurados.mercancias > 0 && (
                        <li>Mercancías: {formatCurrency(valoresAsegurados.mercancias)}</li>
                      )}
                      {valoresAsegurados.equipoElectronicoFijo > 0 && (
                        <li>Equipo Electrónico: {formatCurrency(valoresAsegurados.equipoElectronicoFijo)}</li>
                      )}
                      {valoresAsegurados.maquinaria > 0 && (
                        <li>Maquinaria: {formatCurrency(valoresAsegurados.maquinaria)}</li>
                      )}
                      {valoresAsegurados.limiteRC > 0 && (
                        <li>Resp. Civil: {formatCurrency(valoresAsegurados.limiteRC)}</li>
                      )}
                    </ul>
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        Total: {formatCurrency(valorTotalAsegurado)}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* FILA 2: Amparos / Coberturas (sin mostrar primas - confidencial) */}
              <tr className="border-b border-slate-200">
                <td className="p-3 font-medium text-slate-700 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-500" />
                    <span>Amparos</span>
                  </div>
                </td>
                {resultados.map((res) => (
                  <td 
                    key={res.aseguradora.id} 
                    className="p-3"
                  >
                    <ul className="space-y-1 text-xs">
                      {res.primas.map((prima) => (
                        <li key={prima.amparo} className="flex items-start gap-1">
                          <CheckCircle className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{AMPARO_LABELS[prima.amparo] || prima.amparo}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>

              {/* FILA 3: Deducibles */}
              <tr className="border-b border-slate-200">
                <td className="p-3 font-medium text-slate-700 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <span>Deducibles</span>
                  </div>
                </td>
                {resultados.map((res) => (
                  <td 
                    key={res.aseguradora.id} 
                    className="p-3"
                  >
                    <ul className="space-y-1 text-xs">
                      {res.primas.slice(0, 6).map((prima) => (
                        <li key={prima.amparo}>
                          {AMPARO_LABELS[prima.amparo] || prima.amparo}:{' '}
                          <span className={prima.deducible?.toLowerCase().includes('sin deducible') 
                            ? 'text-emerald-600 font-semibold' 
                            : 'text-slate-600'
                          }>
                            {prima.deducible || 'Según condiciones'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>

              {/* FILA 4: Valor a Pagar (Totales) */}
              <tr className="bg-slate-100">
                <td className="p-3 font-semibold text-slate-800">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-slate-600" />
                    <span>Valor a Pagar</span>
                  </div>
                </td>
                {resultados.map((res) => (
                  <td 
                    key={res.aseguradora.id} 
                    className="p-3 text-center"
                  >
                    <div className="space-y-1 text-xs">
                      <p>Prima Neta: {formatCurrency(res.primaTotalNeta)}</p>
                      <p>IVA 19%: {formatCurrency(res.iva)}</p>
                    </div>
                    <div className="mt-2 text-lg font-bold text-slate-800">
                      {formatCurrency(res.primaTotal)}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Pago anual
                    </p>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Disclaimer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 rounded-b-lg">
          <p className="text-[10px] text-slate-500 text-center">
            * Las primas mostradas incluyen IVA del 19%. Los valores están sujetos a condiciones de aceptación 
            de cada aseguradora y pueden variar según el análisis de riesgo. Cotización generada el {fechaActual}.
          </p>
        </div>
      </div>
    </div>
  );
}
