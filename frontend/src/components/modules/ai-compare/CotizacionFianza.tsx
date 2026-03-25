'use client';

// =====================================================
// COMPONENTE: CotizacionFianza
// Visualizador especializado para cotizaciones de Fianzas
// con formato profesional tipo tabla
// =====================================================

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';

interface AmparoData {
  nombre?: string;
  porcentaje?: number;
  valorAsegurado?: number;
  vigenciaDesde?: string;
  vigenciaFinal?: string;
  dias?: number;
  prima?: number;
}

interface PolizaData {
  tipo?: string;
  objeto?: string;
  amparos?: AmparoData[];
  iva?: number;
  gastos?: number;
  totalPrima?: number;
}

interface TomadorData {
  nombre?: string;
  identificacion?: string;
}

interface BeneficiarioData {
  nombre?: string;
  identificacion?: string;
}

interface QuotationData {
  notas?: string;
  polizas?: PolizaData[];
  tomador?: TomadorData;
  beneficiario?: BeneficiarioData;
  noContrato?: string;
  valorContrato?: number;
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  vigenciaMasLarga?: string;
}

interface CotizacionFianzaProps {
  quotation: QuotationData;
  clientName: string;
  ramoName: string;
  tenantName?: string;
  primaryColor?: string;
  logoUrl?: string | null;
  onDownloadPDF?: () => void;
  isExporting?: boolean;
}

export function CotizacionFianza({
  quotation,
  clientName,
  ramoName,
  tenantName = 'Agencia de Seguros',
  primaryColor = '#3b82f6',
  logoUrl,
  onDownloadPDF,
  isExporting = false,
}: CotizacionFianzaProps) {
  
  // Obtener la primera póliza (asumiendo que es la principal)
  const poliza = quotation.polizas?.[0];
  const amparos = poliza?.amparos || [];
  
  // Calcular totales
  const totalValorAsegurado = amparos.reduce((sum, a) => sum + (a.valorAsegurado || 0), 0);
  const totalPrima = amparos.reduce((sum, a) => sum + (a.prima || 0), 0);
  const gastos = poliza?.gastos || 0;
  const iva = poliza?.iva || Math.round(totalPrima * 0.19);
  const totalFinal = poliza?.totalPrima || (totalPrima + gastos + iva);

  // Formatear moneda
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Formatear fecha
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    // Si ya viene en formato dd/mm/yyyy, devolverlo tal cual
    if (dateStr.includes('/')) return dateStr;
    // Si viene en ISO, formatear
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-CO');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header con logo y título */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
            )}
            <div>
              <h2 className="text-xl font-bold" style={{ color: primaryColor }}>
                {tenantName.toUpperCase()}
              </h2>
              <p className="text-sm text-muted-foreground">COTIZACIÓN DE PÓLIZA DE GARANTÍA</p>
            </div>
          </div>
        </div>

        {/* Tipo de garantía - Banner */}
        <div 
          className="py-3 px-4 text-white text-center font-bold"
          style={{ backgroundColor: primaryColor }}
        >
          {poliza?.tipo || 'GARANTÍA DE CUMPLIMIENTO'}
        </div>

        {/* Información del tomador y beneficiario */}
        <div className="border-b">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-4 font-semibold bg-gray-50 w-1/6">TOMADOR</td>
                <td className="py-2 px-4 w-2/6">{quotation.tomador?.nombre || clientName}</td>
                <td className="py-2 px-4 font-semibold bg-gray-50 w-1/6">IDENTIFICACIÓN</td>
                <td className="py-2 px-4 w-2/6">{quotation.tomador?.identificacion || '-'}</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-semibold bg-gray-50">BENEFICIARIO / CONTRATANTE</td>
                <td className="py-2 px-4">{quotation.beneficiario?.nombre || '-'}</td>
                <td className="py-2 px-4 font-semibold bg-gray-50">IDENTIFICACIÓN</td>
                <td className="py-2 px-4">{quotation.beneficiario?.identificacion || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Objeto del contrato */}
        <div className="p-4 border-b">
          <p className="text-sm">
            <span className="font-semibold">OBJETO: </span>
            {poliza?.objeto || '-'}
          </p>
        </div>

        {/* Vigencia y valor del contrato */}
        <div className="border-b">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-4 w-1/2">
                  <span className="font-semibold">VIGENCIA DESDE </span>
                  {formatDate(quotation.vigenciaDesde || amparos[0]?.vigenciaDesde)}
                  <span className="font-semibold ml-4"> HASTA </span>
                  {formatDate(quotation.vigenciaHasta || amparos[0]?.vigenciaFinal)}
                </td>
                <td className="py-2 px-4 w-1/2">
                  <span className="font-semibold">VIGENCIA MÁS LARGA </span>
                  {formatDate(quotation.vigenciaMasLarga || amparos[0]?.vigenciaFinal)}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4">
                  <span className="font-semibold">VALOR CONTRATO </span>
                  {formatCurrency(quotation.valorContrato)}
                </td>
                <td className="py-2 px-4">
                  <span className="font-semibold"># CONTRATO </span>
                  {quotation.noContrato || '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabla de amparos */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: primaryColor }} className="text-white">
                <th className="py-2 px-3 text-left font-semibold">AMPAROS</th>
                <th className="py-2 px-3 text-center font-semibold">%</th>
                <th className="py-2 px-3 text-right font-semibold">VL ASEGURADO</th>
                <th className="py-2 px-3 text-center font-semibold">VIG. DESDE</th>
                <th className="py-2 px-3 text-center font-semibold">VIG. FINAL</th>
                <th className="py-2 px-3 text-center font-semibold">DÍAS</th>
                <th className="py-2 px-3 text-right font-semibold">PRIMA</th>
              </tr>
            </thead>
            <tbody>
              {amparos.map((amparo, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium">{amparo.nombre || '-'}</td>
                  <td className="py-2 px-3 text-center">{amparo.porcentaje ? `${amparo.porcentaje}%` : '-'}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(amparo.valorAsegurado)}</td>
                  <td className="py-2 px-3 text-center">{formatDate(amparo.vigenciaDesde)}</td>
                  <td className="py-2 px-3 text-center">{formatDate(amparo.vigenciaFinal)}</td>
                  <td className="py-2 px-3 text-center">{amparo.dias || '-'}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(amparo.prima)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="border-t">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b bg-gray-50">
                <td className="py-2 px-4 font-semibold" colSpan={2}>VALOR ASEGURADO TOTAL</td>
                <td className="py-2 px-4 text-right font-semibold">{formatCurrency(totalValorAsegurado)}</td>
                <td className="py-2 px-4 font-semibold text-right">GASTOS</td>
                <td className="py-2 px-4 text-right">{formatCurrency(gastos)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4" colSpan={3}></td>
                <td className="py-2 px-4 font-semibold text-right">IVA 19%</td>
                <td className="py-2 px-4 text-right">{formatCurrency(iva)}</td>
              </tr>
              <tr style={{ backgroundColor: primaryColor }} className="text-white">
                <td className="py-3 px-4" colSpan={3}></td>
                <td className="py-3 px-4 font-bold text-right">TOTAL PRIMA</td>
                <td className="py-3 px-4 text-right font-bold text-lg">{formatCurrency(totalFinal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notas */}
        {quotation.notas && (
          <div className="p-4 border-t bg-gray-50">
            <p className="text-xs text-muted-foreground italic">
              * {quotation.notas}
            </p>
          </div>
        )}

        {/* Botón de descarga */}
        <div className="p-4 border-t flex justify-end">
          <Button 
            onClick={onDownloadPDF} 
            disabled={isExporting}
            className="gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando PDF...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Descargar Cotización (PDF)
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
