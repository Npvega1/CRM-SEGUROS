'use client';

// =====================================================
// COMPONENT: Resultados Comparativos del Cotizador
// =====================================================

import { useState } from 'react';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  ResultadoAseguradora,
  formatCurrency,
  formatTasa,
  Producto,
  DatosCliente,
  ValoresAsegurados,
} from '@/lib/services/cotizador-engine';

interface ResultadosComparativosProps {
  resultados: ResultadoAseguradora[];
  producto: Producto;
  datosCliente: DatosCliente;
  valoresAsegurados: ValoresAsegurados;
  onGenerarPDF?: (aseguradoraId: string) => void;
  onNuevaCotizacion?: () => void;
}

export function ResultadosComparativos({
  resultados,
  producto,
  datosCliente,
  valoresAsegurados,
  onGenerarPDF,
  onNuevaCotizacion,
}: ResultadosComparativosProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    resultados.length > 0 ? resultados[0].aseguradora.id : null
  );

  if (resultados.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay resultados</h3>
          <p className="text-muted-foreground text-sm mb-4">
            No se encontraron aseguradoras con tasas disponibles para este producto
            o los valores asegurados son insuficientes.
          </p>
          {onNuevaCotizacion && (
            <Button onClick={onNuevaCotizacion}>Modificar valores</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // El mejor precio es el primero (ya viene ordenado)
  const mejorPrecio = resultados[0];
  const peorPrecio = resultados[resultados.length - 1];
  const diferencia = peorPrecio.primaTotal - mejorPrecio.primaTotal;
  const porcentajeDiferencia = ((diferencia / mejorPrecio.primaTotal) * 100).toFixed(1);

  // Calcular valor total asegurado
  const valorTotalAsegurado = Object.entries(valoresAsegurados)
    .filter(([key]) => key !== 'anoConstruccion')
    .reduce((sum, [, val]) => sum + (typeof val === 'number' ? val : 0), 0);

  return (
    <div className="space-y-6">
      {/* Header de resumen */}
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
                <TrendingUp className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rango de precios</p>
                <p className="text-sm">
                  {formatCurrency(mejorPrecio.primaTotal)} - {formatCurrency(peorPrecio.primaTotal)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Diferencia: {formatCurrency(diferencia)} ({porcentajeDiferencia}%)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-100 rounded-full">
                <FileText className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total Asegurado</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(valorTotalAsegurado)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {resultados.length} aseguradoras comparadas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Factores aplicados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Factores de Ajuste Aplicados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Zona:</span>
              <Badge variant={mejorPrecio.factorZona > 1 ? 'destructive' : mejorPrecio.factorZona < 1 ? 'default' : 'secondary'}>
                {datosCliente.ciudad} ({mejorPrecio.factorZona.toFixed(2)}x)
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Antigüedad:</span>
              <Badge variant={mejorPrecio.factorAntiguedad > 1 ? 'destructive' : mejorPrecio.factorAntiguedad < 1 ? 'default' : 'secondary'}>
                {valoresAsegurados.anoConstruccion} ({mejorPrecio.factorAntiguedad.toFixed(2)}x)
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Siniestros:</span>
              <Badge variant={mejorPrecio.factorSiniestros > 1 ? 'destructive' : 'secondary'}>
                {datosCliente.historialSiniestros} ({mejorPrecio.factorSiniestros.toFixed(2)}x)
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Factor Total:</span>
              <Badge variant="outline" className="font-mono">
                {mejorPrecio.factorTotal.toFixed(3)}x
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla comparativa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo de Primas por Aseguradora</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {resultados.map((resultado, index) => {
              const isExpanded = expandedId === resultado.aseguradora.id;
              const isBest = index === 0;
              const diffFromBest = resultado.primaTotal - mejorPrecio.primaTotal;
              const diffPercent = ((diffFromBest / mejorPrecio.primaTotal) * 100).toFixed(1);

              return (
                <Collapsible
                  key={resultado.aseguradora.id}
                  open={isExpanded}
                  onOpenChange={() => setExpandedId(isExpanded ? null : resultado.aseguradora.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div
                      className={`flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                        isBest ? 'bg-green-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: resultado.aseguradora.color_primario }}
                          />
                          <span className="font-medium">{resultado.aseguradora.nombre_corto}</span>
                          {isBest && (
                            <Badge className="bg-green-500 text-white">
                              <Trophy className="h-3 w-3 mr-1" />
                              Mejor precio
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Prima Total</p>
                          <p className={`text-lg font-bold ${isBest ? 'text-green-600' : ''}`}>
                            {formatCurrency(resultado.primaTotal)}
                          </p>
                        </div>

                        {!isBest && (
                          <div className="text-right w-24">
                            <p className="text-xs text-muted-foreground">vs mejor</p>
                            <p className="text-sm text-red-500 flex items-center justify-end gap-1">
                              <TrendingUp className="h-3 w-3" />
                              +{diffPercent}%
                            </p>
                          </div>
                        )}

                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-2 bg-slate-50/50">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Amparo</TableHead>
                            <TableHead className="text-right">Valor Asegurado</TableHead>
                            <TableHead className="text-right">Tasa</TableHead>
                            <TableHead className="text-right">Prima Neta</TableHead>
                            <TableHead>Deducible</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {resultado.primas.map((prima) => (
                            <TableRow key={prima.amparo}>
                              <TableCell className="font-medium">{prima.amparoLabel}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(prima.valorAsegurado)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {formatTasa(prima.tasa)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(prima.primaNeta)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                {prima.deducible}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-t-2">
                            <TableCell colSpan={3} className="font-medium">
                              Prima Neta Total
                            </TableCell>
                            <TableCell className="text-right font-bold font-mono">
                              {formatCurrency(resultado.primaTotalNeta)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={3} className="text-muted-foreground">
                              IVA (19%)
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {formatCurrency(resultado.iva)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                          <TableRow className="bg-slate-100">
                            <TableCell colSpan={3} className="font-bold text-lg">
                              PRIMA TOTAL ANUAL
                            </TableCell>
                            <TableCell className="text-right font-bold text-lg font-mono">
                              {formatCurrency(resultado.primaTotal)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        </TableBody>
                      </Table>

                      {onGenerarPDF && (
                        <div className="mt-4 flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => onGenerarPDF(resultado.aseguradora.id)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Generar PDF
                          </Button>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex justify-between">
        {onNuevaCotizacion && (
          <Button variant="outline" onClick={onNuevaCotizacion}>
            Nueva Cotización
          </Button>
        )}
      </div>
    </div>
  );
}
