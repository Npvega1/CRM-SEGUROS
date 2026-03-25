'use client';

// =====================================================
// PÁGINA: Cotizador de Seguros
// /cotizador
// Cotizador determinista basado en tasas configuradas
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingScreen } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import {
  Calculator,
  Building,
  User,
  MapPin,
  Calendar,
  Shield,
  ChevronRight,
  ChevronLeft,
  FileText,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';

// Tipos
interface Aseguradora {
  id: string;
  nombre: string;
  nombre_corto: string;
  color_primario: string;
  activa_sistema: boolean;
}

interface Factor {
  id: string;
  tipo: string;
  clave: string;
  factor: number;
}

type Producto = 'PYME' | 'HOGAR' | 'COPROPIEDAD' | 'TRE';

interface DatosCliente {
  nombre: string;
  nit: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  actividadEconomica: string;
  historialSiniestros: string;
}

interface ValoresAsegurados {
  edificio: number;
  anoConstruccion: string;
  mejorasLocativas: number;
  mueblesEnseres: number;
  mercancias: number;
  dineroEfectivo: number;
  equipoElectronicoFijo: number;
  equipoMovil: number;
  maquinaria: number;
  transporteValores: number;
  limiteRC: number;
}

// Configuración de campos por producto
const CAMPOS_POR_PRODUCTO: Record<Producto, (keyof ValoresAsegurados)[]> = {
  PYME: ['edificio', 'anoConstruccion', 'mejorasLocativas', 'mueblesEnseres', 'mercancias', 
         'dineroEfectivo', 'equipoElectronicoFijo', 'equipoMovil', 'maquinaria', 'transporteValores', 'limiteRC'],
  HOGAR: ['edificio', 'anoConstruccion', 'mejorasLocativas', 'mueblesEnseres', 
          'dineroEfectivo', 'equipoElectronicoFijo', 'equipoMovil', 'limiteRC'],
  COPROPIEDAD: ['edificio', 'anoConstruccion', 'mejorasLocativas', 'mueblesEnseres', 
                'dineroEfectivo', 'equipoElectronicoFijo', 'maquinaria', 'limiteRC'],
  TRE: ['edificio', 'anoConstruccion', 'mejorasLocativas', 'mueblesEnseres', 'mercancias',
        'dineroEfectivo', 'equipoElectronicoFijo', 'equipoMovil', 'maquinaria', 'transporteValores', 'limiteRC'],
};

const LABELS_CAMPOS: Record<keyof ValoresAsegurados, string> = {
  edificio: 'Edificio / Inmueble',
  anoConstruccion: 'Año de construcción',
  mejorasLocativas: 'Mejoras Locativas',
  mueblesEnseres: 'Muebles y Enseres',
  mercancias: 'Mercancías',
  dineroEfectivo: 'Dinero en Efectivo',
  equipoElectronicoFijo: 'Equipo Electrónico Fijo',
  equipoMovil: 'Equipo Móvil y Portátil',
  maquinaria: 'Maquinaria',
  transporteValores: 'Transporte de Valores (presup. anual)',
  limiteRC: 'Límite Responsabilidad Civil',
};

export default function CotizadorPage() {
  const { tenantId, userId, isLoading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const supabase = getUntypedClient();

  // Estados
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);
  const [factores, setFactores] = useState<Factor[]>([]);
  
  // Datos del formulario
  const [producto, setProducto] = useState<Producto>('PYME');
  const [datosCliente, setDatosCliente] = useState<DatosCliente>({
    nombre: '',
    nit: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: 'Bogotá D.C.',
    actividadEconomica: '',
    historialSiniestros: 'Sin siniestros',
  });
  const [valoresAsegurados, setValoresAsegurados] = useState<ValoresAsegurados>({
    edificio: 0,
    anoConstruccion: '11 a 20 años',
    mejorasLocativas: 0,
    mueblesEnseres: 0,
    mercancias: 0,
    dineroEfectivo: 0,
    equipoElectronicoFijo: 0,
    equipoMovil: 0,
    maquinaria: 0,
    transporteValores: 0,
    limiteRC: 0,
  });

  // Cargar datos iniciales
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Cargar aseguradoras activas
      const { data: asegData, error: asegError } = await supabase
        .from('aseguradoras')
        .select('*')
        .eq('activa_sistema', true)
        .order('orden');
      
      if (asegError) throw asegError;
      setAseguradoras(asegData || []);

      // Cargar factores
      const { data: factoresData, error: factoresError } = await supabase
        .from('cotizador_factores')
        .select('*')
        .eq('activo', true);
      
      if (factoresError) throw factoresError;
      setFactores(factoresData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos del cotizador',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    if (!tenantLoading) {
      loadData();
    }
  }, [tenantLoading, loadData]);

  // Obtener factores por tipo
  const getFactoresPorTipo = (tipo: string) => {
    return factores.filter(f => f.tipo === tipo);
  };

  // Formatear moneda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Parsear valor de moneda
  const parseCurrency = (value: string): number => {
    const cleaned = value.replace(/[^0-9]/g, '');
    return parseInt(cleaned) || 0;
  };

  // Manejar cambio en valores asegurados
  const handleValorChange = (campo: keyof ValoresAsegurados, value: string) => {
    if (campo === 'anoConstruccion') {
      setValoresAsegurados(prev => ({ ...prev, [campo]: value }));
    } else {
      setValoresAsegurados(prev => ({ ...prev, [campo]: parseCurrency(value) }));
    }
  };

  // Validar paso actual
  const canProceed = () => {
    if (step === 1) {
      return datosCliente.nombre.trim() !== '' && datosCliente.ciudad !== '';
    }
    if (step === 2) {
      // Al menos edificio debe tener valor
      return valoresAsegurados.edificio > 0;
    }
    return true;
  };

  // Navegar entre pasos
  const nextStep = () => {
    if (canProceed() && step < 3) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  if (tenantLoading || isLoading) {
    return <LoadingScreen message="Cargando cotizador..." />;
  }

  return (
    <div className="p-6 space-y-6" data-testid="cotizador-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Cotizador de Seguros
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Genera cotizaciones comparativas para PYME, Hogar, Copropiedad y TRE
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 py-4">
        {[
          { num: 1, label: 'Datos del Cliente' },
          { num: 2, label: 'Valores Asegurados' },
          { num: 3, label: 'Resultados' },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  s.num < step
                    ? 'bg-green-100 text-green-600'
                    : s.num === step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {s.num < step ? <CheckCircle className="h-5 w-5" /> : s.num}
              </div>
              <span className="text-xs text-muted-foreground mt-1 hidden sm:block">
                {s.label}
              </span>
            </div>
            {idx < 2 && (
              <div
                className={`w-16 h-0.5 mx-2 ${
                  s.num < step ? 'bg-green-400' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Datos del Cliente */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Datos del Cliente y Producto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selector de Producto */}
            <div className="space-y-2">
              <Label>Tipo de Producto *</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['PYME', 'HOGAR', 'COPROPIEDAD', 'TRE'] as Producto[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProducto(p)}
                    className={`p-4 rounded-lg border-2 transition-all text-center ${
                      producto === p
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Building className={`h-6 w-6 mx-auto mb-2 ${producto === p ? 'text-primary' : 'text-slate-400'}`} />
                    <span className={`text-sm font-medium ${producto === p ? 'text-primary' : ''}`}>
                      {p}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Datos del Cliente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre / Razón Social *</Label>
                <Input
                  placeholder="Ej: Empresa ABC S.A.S."
                  value={datosCliente.nombre}
                  onChange={(e) => setDatosCliente(prev => ({ ...prev, nombre: e.target.value }))}
                  data-testid="cliente-nombre"
                />
              </div>
              <div className="space-y-2">
                <Label>NIT / Cédula</Label>
                <Input
                  placeholder="Ej: 900.123.456-7"
                  value={datosCliente.nit}
                  onChange={(e) => setDatosCliente(prev => ({ ...prev, nit: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@empresa.com"
                  value={datosCliente.email}
                  onChange={(e) => setDatosCliente(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  placeholder="300 123 4567"
                  value={datosCliente.telefono}
                  onChange={(e) => setDatosCliente(prev => ({ ...prev, telefono: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Dirección del Riesgo</Label>
                <Input
                  placeholder="Calle 123 # 45-67, Local 101"
                  value={datosCliente.direccion}
                  onChange={(e) => setDatosCliente(prev => ({ ...prev, direccion: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Ciudad *
                </Label>
                <Select
                  value={datosCliente.ciudad}
                  onValueChange={(v) => setDatosCliente(prev => ({ ...prev, ciudad: v }))}
                >
                  <SelectTrigger data-testid="cliente-ciudad">
                    <SelectValue placeholder="Seleccionar ciudad" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFactoresPorTipo('ZONA').map((f) => (
                      <SelectItem key={f.id} value={f.clave}>
                        {f.clave} ({f.factor.toFixed(2)}x)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Actividad Económica</Label>
                <Input
                  placeholder="Ej: Comercio al por menor"
                  value={datosCliente.actividadEconomica}
                  onChange={(e) => setDatosCliente(prev => ({ ...prev, actividadEconomica: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  Historial de Siniestros (últimos 3 años)
                </Label>
                <Select
                  value={datosCliente.historialSiniestros}
                  onValueChange={(v) => setDatosCliente(prev => ({ ...prev, historialSiniestros: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getFactoresPorTipo('SINIESTROS').map((f) => (
                      <SelectItem key={f.id} value={f.clave}>
                        {f.clave} ({f.factor > 1 ? '+' : ''}{((f.factor - 1) * 100).toFixed(0)}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Valores Asegurados */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Valores Asegurados - {producto}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CAMPOS_POR_PRODUCTO[producto].map((campo) => (
                <div key={campo} className="space-y-2">
                  <Label>{LABELS_CAMPOS[campo]}</Label>
                  {campo === 'anoConstruccion' ? (
                    <Select
                      value={valoresAsegurados.anoConstruccion}
                      onValueChange={(v) => handleValorChange('anoConstruccion', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getFactoresPorTipo('ANTIGUEDAD').map((f) => (
                          <SelectItem key={f.id} value={f.clave}>
                            {f.clave} ({f.factor > 1 ? '+' : ''}{((f.factor - 1) * 100).toFixed(0)}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="text"
                      placeholder="$ 0"
                      value={valoresAsegurados[campo] > 0 ? formatCurrency(valoresAsegurados[campo] as number) : ''}
                      onChange={(e) => handleValorChange(campo, e.target.value)}
                      data-testid={`valor-${campo}`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Resumen de valores */}
            <Card className="bg-slate-50">
              <CardContent className="py-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Valor Asegurado:</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(
                      Object.entries(valoresAsegurados)
                        .filter(([key]) => key !== 'anoConstruccion')
                        .reduce((sum, [, val]) => sum + (typeof val === 'number' ? val : 0), 0)
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Resultados (placeholder) */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Resultados de Cotización
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Calculator className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Calculando cotizaciones...</p>
              <p className="text-sm mt-2">
                El motor de cálculo está en desarrollo.
                Pronto verás aquí el cuadro comparativo de todas las aseguradoras.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {aseguradoras.map(a => (
                  <div 
                    key={a.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                    style={{ backgroundColor: `${a.color_primario}20`, color: a.color_primario }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color_primario }} />
                    {a.nombre_corto}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Anterior
        </Button>

        {step < 3 ? (
          <Button
            onClick={nextStep}
            disabled={!canProceed()}
            data-testid="cotizador-next"
          >
            Siguiente
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button disabled>
            <FileText className="h-4 w-4 mr-2" />
            Generar PDF (próximamente)
          </Button>
        )}
      </div>
    </div>
  );
}
