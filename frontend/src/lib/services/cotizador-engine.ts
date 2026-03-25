// =====================================================
// SERVICE: Motor de Cálculo del Cotizador
// /lib/services/cotizador-engine.ts
// =====================================================

import { SupabaseClient } from '@supabase/supabase-js';

// Tipos
export interface Aseguradora {
  id: string;
  nombre: string;
  nombre_corto: string;
  color_primario: string;
}

export interface Tasa {
  id: string;
  aseguradora_id: string;
  producto: string;
  amparo: string;
  tasa: number;
  base_calculo: string;
  deducible_texto: string;
}

export interface Factor {
  tipo: string;
  clave: string;
  factor: number;
}

export type Producto = 'PYME' | 'HOGAR' | 'COPROPIEDAD' | 'TRE';

export interface ValoresAsegurados {
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

export interface DatosCliente {
  nombre: string;
  nit: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  actividadEconomica: string;
  historialSiniestros: string;
}

export interface PrimaAmparo {
  amparo: string;
  amparoLabel: string;
  valorAsegurado: number;
  tasa: number;
  primaNeta: number;
  deducible: string;
}

export interface ResultadoAseguradora {
  aseguradora: Aseguradora;
  primas: PrimaAmparo[];
  primaTotalNeta: number;
  iva: number;
  primaTotal: number;
  factorZona: number;
  factorAntiguedad: number;
  factorSiniestros: number;
  factorTotal: number;
}

// Labels para amparos
export const AMPARO_LABELS: Record<string, string> = {
  incendio: 'Incendio y Aliados',
  terremoto: 'Terremoto',
  hmacc: 'HMACC (Daños por agua)',
  hurtoCalif: 'Hurto Calificado',
  hurtoSimple: 'Hurto Simple',
  hurtoDinero: 'Hurto de Dinero',
  eeeDanio: 'Equipo Electrónico (Daño)',
  eeeMovil: 'Equipo Electrónico Móvil',
  rotMaq: 'Rotura de Maquinaria',
  rotVidrios: 'Rotura de Vidrios',
  rce: 'Responsabilidad Civil',
  transValores: 'Transporte de Valores',
  mejorasLoc: 'Mejoras Locativas',
};

// Mapeo de amparo a campo de valor asegurado
const AMPARO_TO_VALOR: Record<string, keyof ValoresAsegurados | 'VA_TOTAL_DM'> = {
  incendio: 'VA_TOTAL_DM',
  terremoto: 'VA_TOTAL_DM',
  hmacc: 'VA_TOTAL_DM',
  hurtoCalif: 'mueblesEnseres', // CONTENIDOS = muebles + mercancías
  hurtoSimple: 'mueblesEnseres',
  hurtoDinero: 'dineroEfectivo',
  eeeDanio: 'equipoElectronicoFijo',
  eeeMovil: 'equipoMovil',
  rotMaq: 'maquinaria',
  rotVidrios: 'edificio', // Se usa un % del edificio
  rce: 'limiteRC',
  transValores: 'transporteValores',
  mejorasLoc: 'mejorasLocativas',
};

/**
 * Calcula el valor total de daños materiales (VA_TOTAL_DM)
 */
function calcularVATotalDM(valores: ValoresAsegurados): number {
  return (
    valores.edificio +
    valores.mejorasLocativas +
    valores.mueblesEnseres +
    valores.mercancias
  );
}

/**
 * Calcula el valor de contenidos (muebles + mercancías + equipo)
 */
function calcularContenidos(valores: ValoresAsegurados): number {
  return (
    valores.mueblesEnseres +
    valores.mercancias +
    valores.equipoElectronicoFijo +
    valores.equipoMovil
  );
}

/**
 * Obtiene el valor asegurado para un amparo específico
 */
function getValorParaAmparo(
  amparo: string,
  baseCalculo: string,
  valores: ValoresAsegurados
): number {
  switch (baseCalculo) {
    case 'VA_TOTAL_DM':
      return calcularVATotalDM(valores);
    case 'CONTENIDOS':
      return calcularContenidos(valores);
    case 'BIEN_ESPECIFICO':
      const campo = AMPARO_TO_VALOR[amparo];
      if (campo && campo !== 'VA_TOTAL_DM') {
        const valor = valores[campo];
        return typeof valor === 'number' ? valor : 0;
      }
      return 0;
    case 'LIMITE_RC':
      return valores.limiteRC || 0;
    case 'PRESUPUESTO_ANUAL':
      return valores.transporteValores || 0;
    default:
      return 0;
  }
}

/**
 * Obtiene el factor por tipo y clave
 */
function getFactor(factores: Factor[], tipo: string, clave: string): number {
  const factor = factores.find(f => f.tipo === tipo && f.clave === clave);
  return factor?.factor || 1.0;
}

/**
 * Motor principal de cálculo de cotizaciones
 */
export async function calcularCotizacion(
  supabase: SupabaseClient,
  producto: Producto,
  valores: ValoresAsegurados,
  datosCliente: DatosCliente
): Promise<ResultadoAseguradora[]> {
  // 1. Obtener aseguradoras activas
  const { data: aseguradoras, error: asegError } = await supabase
    .from('aseguradoras')
    .select('id, nombre, nombre_corto, color_primario')
    .eq('activa_sistema', true)
    .order('orden');

  if (asegError || !aseguradoras) {
    console.error('Error obteniendo aseguradoras:', asegError);
    return [];
  }

  // 2. Obtener tasas para el producto
  const { data: tasas, error: tasasError } = await supabase
    .from('cotizador_tasas')
    .select('*')
    .eq('producto', producto)
    .eq('activo', true);

  if (tasasError || !tasas) {
    console.error('Error obteniendo tasas:', tasasError);
    return [];
  }

  // 3. Obtener factores
  const { data: factores, error: factoresError } = await supabase
    .from('cotizador_factores')
    .select('tipo, clave, factor')
    .eq('activo', true);

  if (factoresError || !factores) {
    console.error('Error obteniendo factores:', factoresError);
    return [];
  }

  // 4. Calcular factores de ajuste
  const factorZona = getFactor(factores, 'ZONA', datosCliente.ciudad);
  const factorAntiguedad = getFactor(factores, 'ANTIGUEDAD', valores.anoConstruccion);
  const factorSiniestros = getFactor(factores, 'SINIESTROS', datosCliente.historialSiniestros);
  const factorTotal = factorZona * factorAntiguedad * factorSiniestros;

  // 5. Calcular resultados por aseguradora
  const resultados: ResultadoAseguradora[] = [];

  for (const aseguradora of aseguradoras) {
    const tasasAseguradora = tasas.filter(t => t.aseguradora_id === aseguradora.id);
    
    if (tasasAseguradora.length === 0) {
      // Esta aseguradora no tiene tasas para este producto
      continue;
    }

    const primas: PrimaAmparo[] = [];
    let primaTotalNeta = 0;

    for (const tasa of tasasAseguradora) {
      const valorAsegurado = getValorParaAmparo(tasa.amparo, tasa.base_calculo, valores);
      
      // Solo calcular si hay valor asegurado
      if (valorAsegurado > 0) {
        // Prima = Valor Asegurado × Tasa × Factor Total
        const primaNeta = valorAsegurado * tasa.tasa * factorTotal;
        
        primas.push({
          amparo: tasa.amparo,
          amparoLabel: AMPARO_LABELS[tasa.amparo] || tasa.amparo,
          valorAsegurado,
          tasa: tasa.tasa,
          primaNeta,
          deducible: tasa.deducible_texto || 'Según condiciones',
        });

        primaTotalNeta += primaNeta;
      }
    }

    // Solo incluir aseguradoras que tengan al menos una prima calculada
    if (primas.length > 0 && primaTotalNeta > 0) {
      const iva = primaTotalNeta * 0.19; // IVA del 19%
      
      resultados.push({
        aseguradora,
        primas,
        primaTotalNeta,
        iva,
        primaTotal: primaTotalNeta + iva,
        factorZona,
        factorAntiguedad,
        factorSiniestros,
        factorTotal,
      });
    }
  }

  // 6. Ordenar por prima total (menor a mayor)
  resultados.sort((a, b) => a.primaTotal - b.primaTotal);

  return resultados;
}

/**
 * Formatea un valor como moneda colombiana
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formatea una tasa como porcentaje
 */
export function formatTasa(tasa: number): string {
  return (tasa * 100).toFixed(4) + '%';
}
