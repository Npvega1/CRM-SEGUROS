'use client';

// =====================================================
// COMPONENT: Comparativo en Tabla
// Muestra resultados como comparativo lado a lado (sin tasas)
// =====================================================

import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Trophy,
  Download,
  Info,
  Building,
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

export function ComparativoTabla({
  resultados,
  producto,
  datosCliente,
  valoresAsegurados,
}: ComparativoTablaProps) {
  const tablaRef = useRef<HTMLDivElement>(null);

  if (resultados.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay resultados</h3>
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

  // El mejor precio es el primero (viene ordenado)
  const mejorPrecio = resultados[0];

  // Calcular valor total asegurado
  const valorTotalAsegurado = Object.entries(valoresAsegurados)
    .filter(([key]) => key !== 'anoConstruccion')
    .reduce((sum, [, val]) => sum + (typeof val === 'number' ? val : 0), 0);

  // Generar PDF
  const handleDownloadPDF = async () => {
    if (!tablaRef.current) return;

    try {
      // Mostrar loading
      const originalBg = tablaRef.current.style.background;
      tablaRef.current.style.background = 'white';
      
      const canvas = await html2canvas(tablaRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      
      tablaRef.current.style.background = originalBg;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      // Agregar título
      pdf.setFontSize(16);
      pdf.text(`Comparativo de Cotización - ${producto}`, 14, 15);
      pdf.setFontSize(10);
      pdf.text(`Cliente: ${datosCliente.nombre}`, 14, 22);
      pdf.text(`Ciudad: ${datosCliente.ciudad} | Fecha: ${new Date().toLocaleDateString('es-CO')}`, 14, 27);
      pdf.text(`Valor Total Asegurado: ${formatCurrency(valorTotalAsegurado)}`, 14, 32);

      // Agregar imagen de la tabla
      const imgWidth = 270;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 14, 38, imgWidth, Math.min(imgHeight, 150));

      // Agregar pie de página
      pdf.setFontSize(8);
      pdf.text('* Las primas incluyen IVA del 19%. Sujeto a condiciones de aceptación.', 14, 200);

      pdf.save(`comparativo-${producto}-${datosCliente.nombre.replace(/\s+/g, '-')}.pdf`);
    } catch (error) {
      console.error('Error generando PDF:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500 rounded-full">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-700">Mejor precio</p>
                <p className="text-xl font-bold text-green-800">
                  {mejorPrecio.aseguradora.nombre_corto}
                </p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(mejorPrecio.primaTotal)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-100 rounded-full">
                <Building className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total Asegurado</p>
                <p className="text-lg font-semibold">{formatCurrency(valorTotalAsegurado)}</p>
                <p className="text-xs text-muted-foreground">
                  {resultados.length} aseguradoras comparadas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-100 rounded-full">
                <Info className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Factores aplicados</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {datosCliente.ciudad}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {valoresAsegurados.anoConstruccion}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botón descargar PDF */}
      <div className="flex justify-end">
        <Button onClick={handleDownloadPDF}>
          <Download className="h-4 w-4 mr-2" />
          Descargar PDF
        </Button>
      </div>

      {/* Tabla Comparativa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cuadro Comparativo de Primas</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto" ref={tablaRef}>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-bold text-foreground sticky left-0 bg-slate-50 z-10 min-w-[180px]">
                  Amparo
                </TableHead>
                {resultados.map((res, idx) => (
                  <TableHead 
                    key={res.aseguradora.id} 
                    className={`text-center min-w-[140px] ${idx === 0 ? 'bg-green-50' : ''}`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: res.aseguradora.color_primario }}
                      />
                      <span className="font-bold text-foreground">
                        {res.aseguradora.nombre_corto}
                      </span>
                      {idx === 0 && (
                        <Badge className="bg-green-500 text-white text-[10px] py-0">
                          Mejor
                        </Badge>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {amparosUnicos.map((amparo) => (
                <TableRow key={amparo}>
                  <TableCell className="font-medium sticky left-0 bg-white z-10">
                    {AMPARO_LABELS[amparo] || amparo}
                  </TableCell>
                  {resultados.map((res, idx) => {
                    const prima = res.primas.find(p => p.amparo === amparo);
                    return (
                      <TableCell 
                        key={res.aseguradora.id} 
                        className={`text-center font-mono ${idx === 0 ? 'bg-green-50/50' : ''}`}
                      >
                        {prima ? formatCurrency(prima.primaNeta) : '-'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              
              {/* Fila de Prima Neta Total */}
              <TableRow className="border-t-2 bg-slate-50">
                <TableCell className="font-bold sticky left-0 bg-slate-50 z-10">
                  Prima Neta
                </TableCell>
                {resultados.map((res, idx) => (
                  <TableCell 
                    key={res.aseguradora.id} 
                    className={`text-center font-mono font-bold ${idx === 0 ? 'bg-green-100' : ''}`}
                  >
                    {formatCurrency(res.primaTotalNeta)}
                  </TableCell>
                ))}
              </TableRow>

              {/* Fila de IVA */}
              <TableRow className="bg-slate-50">
                <TableCell className="text-muted-foreground sticky left-0 bg-slate-50 z-10">
                  IVA (19%)
                </TableCell>
                {resultados.map((res, idx) => (
                  <TableCell 
                    key={res.aseguradora.id} 
                    className={`text-center font-mono text-muted-foreground ${idx === 0 ? 'bg-green-100' : ''}`}
                  >
                    {formatCurrency(res.iva)}
                  </TableCell>
                ))}
              </TableRow>

              {/* Fila de Prima Total */}
              <TableRow className="bg-slate-100">
                <TableCell className="font-bold text-lg sticky left-0 bg-slate-100 z-10">
                  PRIMA TOTAL
                </TableCell>
                {resultados.map((res, idx) => (
                  <TableCell 
                    key={res.aseguradora.id} 
                    className={`text-center font-mono font-bold text-lg ${
                      idx === 0 ? 'bg-green-200 text-green-800' : ''
                    }`}
                  >
                    {formatCurrency(res.primaTotal)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Deducibles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deducibles por Aseguradora</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-bold text-foreground min-w-[180px]">
                  Amparo
                </TableHead>
                {resultados.slice(0, 4).map((res) => (
                  <TableHead 
                    key={res.aseguradora.id} 
                    className="text-center min-w-[200px]"
                  >
                    {res.aseguradora.nombre_corto}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {amparosUnicos.slice(0, 6).map((amparo) => (
                <TableRow key={amparo}>
                  <TableCell className="font-medium">
                    {AMPARO_LABELS[amparo] || amparo}
                  </TableCell>
                  {resultados.slice(0, 4).map((res) => {
                    const prima = res.primas.find(p => p.amparo === amparo);
                    return (
                      <TableCell 
                        key={res.aseguradora.id} 
                        className="text-center text-xs text-muted-foreground"
                      >
                        {prima?.deducible || '-'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Nota */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            * Las primas mostradas incluyen IVA del 19%. Los valores están sujetos a condiciones de aceptación 
            de cada aseguradora y pueden variar según el análisis de riesgo. Esta cotización tiene validez de 
            30 días a partir de la fecha de generación.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
