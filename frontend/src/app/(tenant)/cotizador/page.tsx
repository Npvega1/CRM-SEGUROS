'use client';

// =====================================================
// PÁGINA: Cotizador de Seguros
// /cotizador
// Cotizador determinista basado en tasas configuradas
// Rediseño: Selección de producto -> Formulario -> Resultados
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Calculator,
  Building,
  Home,
  Building2,
  Briefcase,
  User,
  MapPin,
  Shield,
  ChevronRight,
  ChevronLeft,
  FileText,
  CheckCircle,
  RefreshCw,
  Loader2,
  ArrowLeft,
  History,
  Calendar,
  Download,
} from 'lucide-react';
import {
  calcularCotizacion,
  formatCurrency,
  Producto,
  DatosCliente,
  ValoresAsegurados,
  ResultadoAseguradora,
} from '@/lib/services/cotizador-engine';
import { ComparativoTabla } from '@/components/modules/cotizador/ComparativoTabla';

// Tipos
interface Factor {
  id: string;
  tipo: string;
  clave: string;
  factor: number;
}

interface TenantAseguradora {
  aseguradora_id: string;
  is_active: boolean;
}

interface CotizacionHistorial {
  id: string;
  producto: Producto;
  nombre_cliente: string;
  ciudad: string;
  mejor_prima_total: number;
  created_at: string;
  status: string;
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

const PRODUCTOS_CONFIG: Record<Producto, { icon: React.ElementType; description: string; color: string }> = {
  PYME: { 
    icon: Briefcase, 
    description: 'Pequeñas y medianas empresas, locales comerciales',
    color: 'text-blue-600 bg-blue-100'
  },
  HOGAR: { 
    icon: Home, 
    description: 'Viviendas, apartamentos, casas',
    color: 'text-green-600 bg-green-100'
  },
  COPROPIEDAD: { 
    icon: Building2, 
    description: 'Edificios residenciales, conjuntos cerrados',
    color: 'text-purple-600 bg-purple-100'
  },
  TRE: { 
    icon: Building, 
    description: 'Todo Riesgo Empresarial, grandes empresas',
    color: 'text-orange-600 bg-orange-100'
  },
};

export default function CotizadorPage() {
  const { tenantId, userId, isLoading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const supabase = getUntypedClient();

  // Estados principales
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [factores, setFactores] = useState<Factor[]>([]);
  const [tenantAseguradoras, setTenantAseguradoras] = useState<TenantAseguradora[]>([]);
  const [historial, setHistorial] = useState<CotizacionHistorial[]>([]);
  const [resultados, setResultados] = useState<ResultadoAseguradora[]>([]);
  
  // Estado de la vista: 'selection' | 'form' | 'results'
  const [vista, setVista] = useState<'selection' | 'form' | 'results'>('selection');
  const [step, setStep] = useState(1); // Dentro del formulario: 1=cliente, 2=valores
  
  // Datos del formulario
  const [producto, setProducto] = useState<Producto | null>(null);
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
    if (!tenantId) return;
    setIsLoading(true);
    try {
      // Cargar factores
      const { data: factoresData } = await supabase
        .from('cotizador_factores')
        .select('*')
        .eq('activo', true);
      setFactores(factoresData || []);

      // Cargar aseguradoras activas del tenant
      const { data: tenantAsegData } = await supabase
        .from('tenant_aseguradoras')
        .select('aseguradora_id, is_active')
        .eq('tenant_id', tenantId);
      setTenantAseguradoras(tenantAsegData || []);

      // Cargar historial de cotizaciones deterministas del tenant
      const { data: historialData } = await supabase
        .from('cotizaciones_deterministas')
        .select('id, producto, nombre_cliente, ciudad, mejor_prima_total, created_at, status')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);
      setHistorial(historialData || []);

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
  }, [supabase, tenantId, toast]);

  useEffect(() => {
    if (!tenantLoading && tenantId) {
      loadData();
    }
  }, [tenantLoading, tenantId, loadData]);

  // Obtener factores por tipo
  const getFactoresPorTipo = (tipo: string) => {
    return factores.filter(f => f.tipo === tipo);
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

  // Seleccionar producto y abrir formulario
  const handleSelectProducto = (prod: Producto) => {
    setProducto(prod);
    setVista('form');
    setStep(1);
  };

  // Validar paso actual del formulario
  const canProceed = () => {
    if (step === 1) {
      return datosCliente.nombre.trim() !== '' && datosCliente.ciudad !== '';
    }
    if (step === 2) {
      return valoresAsegurados.edificio > 0;
    }
    return true;
  };

  // Calcular cotización
  const handleCalcular = async () => {
    if (!producto || !tenantId) return;
    
    setIsCalculating(true);
    try {
      let results = await calcularCotizacion(
        supabase,
        producto,
        valoresAsegurados,
        datosCliente
      );
      
      // Filtrar por aseguradoras activas del tenant (si hay configuración)
      if (tenantAseguradoras.length > 0) {
        const activeIds = tenantAseguradoras
          .filter(ta => ta.is_active)
          .map(ta => ta.aseguradora_id);
        
        // Solo filtrar si hay al menos una aseguradora activa configurada
        if (activeIds.length > 0) {
          results = results.filter(r => activeIds.includes(r.aseguradora.id));
        }
      }
      
      // Guardar en historial si hay resultados
      if (results.length > 0) {
        const mejorResultado = results[0];
        
        // Preparar datos para guardar (sin las tasas por confidencialidad)
        const resultadosParaGuardar = results.map(r => ({
          aseguradora_id: r.aseguradora.id,
          aseguradora_nombre: r.aseguradora.nombre,
          aseguradora_nombre_corto: r.aseguradora.nombre_corto,
          prima_total_neta: r.primaTotalNeta,
          iva: r.iva,
          prima_total: r.primaTotal,
          amparos_count: r.primas.length,
        }));
        
        const { error: saveError } = await supabase
          .from('cotizaciones_deterministas')
          .insert({
            tenant_id: tenantId,
            user_id: userId,
            nombre_cliente: datosCliente.nombre,
            nit_cliente: datosCliente.nit,
            email_cliente: datosCliente.email,
            telefono_cliente: datosCliente.telefono,
            direccion_cliente: datosCliente.direccion,
            ciudad: datosCliente.ciudad,
            actividad_economica: datosCliente.actividadEconomica,
            producto,
            valores_asegurados: valoresAsegurados,
            resultados: resultadosParaGuardar,
            mejor_aseguradora_id: mejorResultado.aseguradora.id,
            mejor_prima_total: mejorResultado.primaTotal,
            factor_zona: mejorResultado.factorZona,
            factor_antiguedad: mejorResultado.factorAntiguedad,
            factor_siniestros: mejorResultado.factorSiniestros,
            status: 'completada',
          });
        
        if (saveError) {
          console.error('Error guardando cotización:', saveError);
          // No bloquear el flujo si falla el guardado
        } else {
          // Recargar historial
          loadData();
        }
      }
      
      setResultados(results);
      setVista('results');
    } catch (error) {
      console.error('Error calculando cotización:', error);
      toast({
        title: 'Error',
        description: 'No se pudo calcular la cotización',
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  // Navegar entre pasos del formulario
  const nextStep = () => {
    if (step === 2) {
      handleCalcular();
    } else if (canProceed() && step < 2) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      // Volver a selección de producto
      setVista('selection');
      setProducto(null);
    }
  };

  // Volver a selección desde resultados
  const handleNuevaCotizacion = () => {
    setVista('selection');
    setProducto(null);
    setResultados([]);
    setStep(1);
    setDatosCliente({
      nombre: '',
      nit: '',
      email: '',
      telefono: '',
      direccion: '',
      ciudad: 'Bogotá D.C.',
      actividadEconomica: '',
      historialSiniestros: 'Sin siniestros',
    });
    setValoresAsegurados({
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
  };

  if (tenantLoading || isLoading) {
    return <LoadingScreen message="Cargando cotizador..." />;
  }

  // ===== VISTA: SELECCIÓN DE PRODUCTO =====
  if (vista === 'selection') {
    return (
      <div className="p-6 space-y-6" data-testid="cotizador-page">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Cotizador de Seguros
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Selecciona el tipo de producto para generar un comparativo de primas
          </p>
        </div>

        {/* Selector de Productos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['PYME', 'HOGAR', 'COPROPIEDAD', 'TRE'] as Producto[]).map((prod) => {
            const config = PRODUCTOS_CONFIG[prod];
            const Icon = config.icon;
            return (
              <Card 
                key={prod}
                className="cursor-pointer hover:border-primary transition-colors group"
                onClick={() => handleSelectProducto(prod)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${config.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                        {prod}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {config.description}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Historial de Cotizaciones */}
        {historial.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Cotizaciones Recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {historial.map((cot) => (
                  <div key={cot.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{cot.producto}</Badge>
                      <div>
                        <p className="font-medium text-sm">{cot.nombre_cliente || 'Sin nombre'}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {cot.ciudad}
                          <span className="mx-1">•</span>
                          <Calendar className="h-3 w-3" />
                          {new Date(cot.created_at).toLocaleDateString('es-CO')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {cot.mejor_prima_total && (
                        <p className="font-semibold text-sm text-emerald-600">
                          {formatCurrency(cot.mejor_prima_total)}
                        </p>
                      )}
                      <Badge variant={cot.status === 'completada' ? 'default' : 'secondary'} className="mt-1">
                        {cot.status === 'completada' ? 'Completada' : cot.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ===== VISTA: FORMULARIO =====
  if (vista === 'form' && producto) {
    const config = PRODUCTOS_CONFIG[producto];
    const Icon = config.icon;

    return (
      <div className="p-6 space-y-6" data-testid="cotizador-form">
        {/* Header con producto seleccionado */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={prevStep}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {step === 1 ? 'Cambiar producto' : 'Anterior'}
          </Button>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${config.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold">Cotización {producto}</h1>
              <p className="text-xs text-muted-foreground">
                Paso {step} de 2
              </p>
            </div>
          </div>
        </div>

        {/* Step 1: Datos del Cliente */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Datos del Cliente
              </CardTitle>
              <CardDescription>
                Información básica del asegurado y ubicación del riesgo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar ciudad" />
                    </SelectTrigger>
                    <SelectContent>
                      {getFactoresPorTipo('ZONA').map((f) => (
                        <SelectItem key={f.id} value={f.clave}>
                          {f.clave}
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
                          {f.clave}
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
                Valores Asegurados
              </CardTitle>
              <CardDescription>
                Ingresa los valores en pesos colombianos. Solo se cotizarán los amparos con valores mayores a cero.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                              {f.clave}
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
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Resumen */}
              <Card className="bg-slate-50 border-slate-200">
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

        {/* Navigation */}
        <div className="flex justify-end">
          <Button
            onClick={nextStep}
            disabled={!canProceed() || isCalculating}
          >
            {isCalculating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calculando...
              </>
            ) : step === 2 ? (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Calcular Cotización
              </>
            ) : (
              <>
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ===== VISTA: RESULTADOS =====
  if (vista === 'results' && producto) {
    return (
      <div className="p-6 space-y-6" data-testid="cotizador-results">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Comparativo de Cotización
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {datosCliente.nombre} • {producto} • {datosCliente.ciudad}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleNuevaCotizacion}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Nueva Cotización
            </Button>
          </div>
        </div>

        {/* Comparativo en formato tabla */}
        <ComparativoTabla
          resultados={resultados}
          producto={producto}
          datosCliente={datosCliente}
          valoresAsegurados={valoresAsegurados}
        />
      </div>
    );
  }

  return null;
}
