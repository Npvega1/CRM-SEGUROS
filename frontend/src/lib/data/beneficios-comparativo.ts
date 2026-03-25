// =====================================================
// BENEFICIOS_COMPARATIVO.ts
// Fuente: páginas web oficiales de cada aseguradora — marzo 2026
// Usar en el CRM-SEGUROS para mostrar beneficios en el comparativo de cotización
// Estructura: BENEFICIOS[nombre_corto][producto] = array de strings
// =====================================================

export type ProductoBeneficio = 'PYME' | 'HOGAR' | 'COPROPIEDAD' | 'TRE';

export const BENEFICIOS: Record<string, Partial<Record<ProductoBeneficio, string[]>>> = {

  AXA: {
    PYME: [
      "Índice variable automático: cubre hasta el 10% del valor del edificio sin declaración adicional",
      "Anticipo de indemnización del 50% una vez demostrada la ocurrencia del siniestro",
      "Renuncia a depreciación: equipos y maquinaria a valor de reposición a nuevo",
      "Asistencia 24/7: cerrajería, plomería, electricidad y celaduría hasta 30 SMDLV",
      "Amparo automático para bienes nuevos hasta el 10% del VA",
      "RC ampliada: predios, labores, operaciones y RC de productos defectuosos",
    ],
    HOGAR: [
      "Gastos de alojamiento temporal hasta 6 meses si el inmueble queda inhabitable",
      "Cobertura de suelos, cimientos y muros de contención ante eventos sísmicos",
      "Asistencia domiciliaria 24/7: cerrajería, plomería, electricidad y vidrios",
      "Pérdida de arrendamiento: cubre el canon mensual dejado de percibir",
      "RC familiar: daños que el asegurado, familia o mascotas causen a terceros",
      "Programa de beneficios: descuentos en hoteles, ópticas y servicios de salud",
    ],
    COPROPIEDAD: [
      "Índice variable: cubre hasta el 10% del valor del edificio sin declaración adicional",
      "Cobertura a valor de reconstrucción sin descuento por depreciación",
      "RC Propiedad Horizontal amplia: daños a propietarios, visitantes y empleados",
      "Anticipo de indemnización del 50% para recuperación inmediata",
      "Asistencia a zonas comunes 24/7: cerrajería, plomería y electricidad",
      "Amparo automático de nuevas inversiones hasta el 10% del VA",
    ],
    TRE: [
      "Índice variable automático: cubre hasta el 10% del valor del edificio",
      "Anticipo de indemnización del 50% una vez demostrada la ocurrencia",
      "Renuncia a depreciación: equipos a valor de reposición a nuevo",
      "Asistencia 24/7: cerrajería, plomería, electricidad y celaduría",
      "RC ampliada: predios, labores, operaciones y productos defectuosos",
      "Atención de siniestros 24/7 los 365 días del año",
    ]
  },

  SURA: {
    PYME: [
      "Ecosistema Empresas SURA: asesoría jurídica, contable y financiera gratuita",
      "Cobertura todo riesgo: todo lo que no esté excluido está cubierto",
      "Maquinaria sin demérito por uso: indemnización a valor de reposición a nuevo",
      "Lucro cesante opcional: pérdidas por interrupción de operaciones",
      "Plataforma digital de gestión de siniestros 100% en línea",
      "RC extracontractual amplia: PLO, productos, patronal y contratistas",
    ],
    HOGAR: [
      "Asistencias domiciliarias ilimitadas: cerrajería, plomería y electricidad 24/7",
      "Cobertura de gastos médicos de urgencia ocurridos dentro del inmueble",
      "Contenidos a valor de reposición a nuevo sin descuento por desgaste",
      "Rotura accidental de vidrios y mamposterías sin deducible",
      "RC familiar: daños que el asegurado, familia o mascotas causen a terceros",
      "Descuentos disponibles para asegurados con otros productos SURA",
    ],
    COPROPIEDAD: [
      "Asesoría jurídica para administradores de PH incluida sin costo",
      "Cobertura todo riesgo en zonas comunes: todo lo no excluido está cubierto",
      "Rotura de maquinaria en equipos comunes a valor de reposición a nuevo",
      "Amparo automático para nuevas inversiones hasta el 10% del VA",
      "RC Propiedad Horizontal: daños a copropietarios, visitantes y empleados",
      "Capacitaciones en gestión de copropiedades y prevención de riesgos",
    ],
    TRE: [
      "Ecosistema Empresas SURA: asesoría integral sin costo",
      "Cobertura todo riesgo: todo lo no excluido está cubierto",
      "Maquinaria a valor de reposición sin demérito por uso",
      "Plataforma digital para gestión de siniestros",
      "RC extracontractual amplia incluida",
      "Centro de Empresas SURA: capacitaciones y talleres",
    ]
  },

  EQUIDAD: {
    PYME: [
      "Gastos adicionales al 15%: remoción, extinción, preservación y flete",
      "Primera opción de compra sobre salvamentos a precio preferencial",
      "Infidelidad de empleados incluida hasta $60 millones",
      "Orientación jurídica, contable y tributaria ilimitada",
      "Amparo automático en ferias y exposiciones hasta 150 SMMLV",
      "RC amplia: PLO, productos, parqueaderos y gastos médicos",
    ],
    HOGAR: [
      "Gastos de alojamiento temporal si el hogar queda inhabitable",
      "Rotura accidental de vidrios y unidades sanitarias sin deducible",
      "Orientación jurídica telefónica ilimitada durante la vigencia",
      "Asistencias 24/7: cerrajería, plomería y electricidad",
      "Contenidos a valor de reposición a nuevo sin deducción por uso",
      "RC locativa y familiar incluida",
    ],
    COPROPIEDAD: [
      "Gastos adicionales al 15% para zonas comunes incluidos",
      "RC Propiedad Horizontal completa: daños a propietarios y visitantes",
      "Orientación jurídica y contable ilimitada para la administración",
      "Asistencias 24/7 en zonas comunes sin costo adicional",
      "Infidelidad del administrador cubierta",
      "Indemnización a valor de reconstrucción sin descuento por antigüedad",
    ],
    TRE: [
      "Gastos adicionales al 15%: remoción, extinción y preservación",
      "Primera opción de compra sobre salvamentos",
      "Infidelidad de empleados incluida hasta $60 millones",
      "Orientación jurídica, contable y tributaria ilimitada",
      "RC amplia: PLO, productos y parqueaderos",
      "Bienes bajo custodia cubiertos",
    ]
  },

  ESTADO: {
    PYME: [
      "Producto modular: elige cada cobertura individualmente",
      "Coberturas flexibles: riesgos nombrados o todo riesgo",
      "Asistencias 24h: plomería, electricidad, cerrajería y celaduría",
      "RC Extracontractual: PLO, patronal, productos y defensa jurídica",
      "Respaldo de reaseguradores multinacionales de primera línea",
      "Línea nacional gratuita #388 disponible 24 horas",
    ],
    HOGAR: [
      "Asistencias completas: plomero, electricista, cerrajero, jardinería y mudanza",
      "Cobertura para propietarios y grupo familiar básico",
      "Gastos de alojamiento temporal por siniestro cubierto",
      "Cobertura de vidrios y unidades frágiles sin deducible",
      "RC locativa y familiar incluida",
      "Adaptable a casas, apartamentos y viviendas de campo",
    ],
    COPROPIEDAD: [
      "Cobertura integral para zonas comunes: portería, salones, parqueaderos",
      "Cobertura de sustracción con o sin violencia en zonas comunes",
      "Vidrios y unidades frágiles sin deducible en planes integrales",
      "Daño interno de equipos eléctricos y electrónicos por voltaje",
      "Rotura de maquinaria para ascensores, bombas y equipos comunes",
      "RC frente a terceros en zonas comunes incluida",
    ],
    TRE: [
      "Producto modular: coberturas a la medida",
      "Asistencias 24h: plomería, electricidad y cerrajería",
      "RC Extracontractual amplia incluida",
      "Respaldo de reaseguradores multinacionales",
      "Línea nacional gratuita #388 disponible 24h",
      "Cobertura para cualquier actividad empresarial",
    ]
  },

  HDI: {
    PYME: [
      "Cobertura fuera de predios: equipos móviles hasta 1 mes fuera de Colombia",
      "Bienes refrigerados: mercancías dañadas por falla en refrigeración",
      "Fraude de empleados por descubrimiento cubierto",
      "Gastos por paralización del negocio incluidos",
      "Respaldo Grupo Talanx: una de las 10 aseguradoras más grandes del mundo",
      "Transporte automático de mercancías en tránsito nacional",
    ],
    HOGAR: [
      "Solución 100% ajustable: inmueble, contenidos o ambos",
      "Cobertura para propietarios que habitan, arriendan o arrendatarios",
      "Asistencia básica incluida: plomería, electricidad, cerrajería y vidriería 24h",
      "Asistencia especializada adicional: jornada de aseo y profesional en casa",
      "RC familiar: daños accidentales dentro y fuera del inmueble",
      "Respaldo Grupo Talanx internacional garantizando solvencia",
    ],
    COPROPIEDAD: [
      "Cobertura modular: el administrador elige exactamente qué contratar",
      "Experiencia en hoteles, conjuntos residenciales y oficinas",
      "RC Propiedad Horizontal: daños a copropietarios, visitantes y empleados",
      "Cobertura de equipos comunitarios a valor de reposición",
      "Asistencias 24/7: cerrajería, plomería y electricidad",
      "Fraude del administrador cubierto",
    ],
    TRE: [
      "Cobertura fuera de predios hasta 1 mes fuera de Colombia",
      "Bienes refrigerados cubiertos por falla en refrigeración",
      "Fraude de empleados cubierto",
      "Respaldo Grupo Talanx internacional",
      "RC amplia incluida",
      "Cobertura modular a la medida",
    ]
  },

  BOLIVAR: {
    PYME: [
      "Proceso de siniestros para minimizar interrupción del negocio",
      "Asesoría de ingenieros en prevención de riesgos sin costo",
      "RC Extracontractual: PLO, patronal, parqueaderos y gastos médicos",
      "Daño mecánico y electrónico de equipos sin deducible especial",
      "App Bolívar Conmigo: gestión digital de pólizas y siniestros",
      "Asistencia 24h al #322 y WhatsApp para siniestros",
    ],
    HOGAR: [
      "Asistencias 24/7: cerrajería, plomería, gas, electricidad y vidrios",
      "Cobertura de sismos incluida automáticamente",
      "RC familiar y locativa incluida",
      "Orientación financiera y jurídica telefónica gratuita",
      "Contenidos a valor de reposición a nuevo",
      "App Bolívar Conmigo: gestión digital de la póliza",
    ],
    COPROPIEDAD: [
      "Seguro de Cuotas al Día: garantiza ingreso aunque residentes no paguen",
      "Asistencia en zonas comunes: plomería, cerrajería, gas y vidrios 24/7",
      "Orientación jurídica en propiedad horizontal",
      "Daños a equipos electrónicos en zonas comunes cubiertos",
      "Asesoría de ingenieros en prevención de riesgos sin costo",
      "App Bolívar Conmigo para gestión digital del conjunto",
    ],
    TRE: [
      "Proceso de siniestros optimizado para empresas",
      "Asesoría de ingenieros en prevención sin costo",
      "RC Extracontractual amplia incluida",
      "App Bolívar Conmigo para gestión digital",
      "Asistencia 24h al #322 y WhatsApp",
      "Daño mecánico y electrónico cubierto",
    ]
  },

  MAPFRE: {
    PYME: [
      "Tres productos: PYME Comercio, PYME Integral y PYME Restaurantes",
      "Servicio Si-24: atención 24/7 los 365 días desde cualquier país",
      "Asistencia PYME: plomería, electricidad, cerrajería, vidrios y jardinería",
      "Cobertura de interrupción del negocio incluida",
      "RC amplia: productos, gastos médicos y RC de contratistas",
      "Más de 450 actividades económicas cubiertas",
    ],
    HOGAR: [
      "Dos planes: Hogar Trébol (básica) y Hogar Plus (ampliada)",
      "Asistencia domiciliaria en Hogar Plus: plomería, electricidad y cerrajería 24/7",
      "RC familiar en Hogar Plus incluida",
      "Servicio Si-24 MAPFRE: atención 24h desde cualquier lugar",
      "Rotura de vidrios y cristales al 100% sin deducible",
      "Protección ante desastres naturales: granizo, deslizamiento, vientos y terremoto",
    ],
    COPROPIEDAD: [
      "Cuotas de administración cubiertas hasta 6 meses por siniestro",
      "Cobertura del 100% de vidrios en zonas comunes sin deducible",
      "RC para Directores y Administradores incluida",
      "Asistencia a la copropiedad y residentes 24/7",
      "Servicio Si-24 MAPFRE: atención 24h los 7 días",
      "Respaldo MAPFRE global con capacidad de pago garantizada",
    ],
    TRE: [
      "Productos especializados por sector empresarial",
      "Servicio Si-24: atención 24/7 los 365 días",
      "Asistencia empresarial incluida",
      "Cobertura de interrupción del negocio",
      "RC amplia: productos y contratistas",
      "Respaldo MAPFRE global en más de 100 países",
    ]
  },

  SOLIDARIA: {
    PYME: [
      "Asistente virtual CAMI 24/7 en WhatsApp para cotizar y reportar",
      "Coberturas flexibles: riesgos nombrados o todo riesgo",
      "Asistencias: cerrajería, plomería y electricidad 24h",
      "Tasas competitivas orientadas a microempresas y pymes",
      "RC Extracontractual: PLO, productos y gastos médicos",
      "Compañía 100% colombiana con más de 35 años",
    ],
    HOGAR: [
      "Asistente CAMI en WhatsApp 24/7 para siniestros y asistencias",
      "Asistencias domiciliarias: cerrajería, plomería, electricidad y vidriería",
      "Compañía 100% colombiana: precios accesibles para todos los estratos",
      "RC locativa y familiar incluida",
      "Daño interno de equipos eléctricos por variaciones de voltaje",
      "Terremoto incluido en todos los planes",
    ],
    COPROPIEDAD: [
      "Asistente CAMI en WhatsApp 24/7 para la administración",
      "Coberturas flexibles adaptadas al tipo de copropiedad",
      "RC Propiedad Horizontal: daños a propietarios, visitantes y empleados",
      "Asistencias en zonas comunes 24/7 sin costo adicional",
      "Compañía 100% colombiana con precios competitivos",
      "Daño interno de equipos electrónicos en zonas comunes",
    ],
    TRE: [
      "Asistente virtual CAMI 24/7 en WhatsApp",
      "Coberturas flexibles a la medida",
      "Asistencias: cerrajería, plomería y electricidad 24h",
      "Tasas competitivas del mercado",
      "RC Extracontractual incluida",
      "Compañía 100% colombiana",
    ]
  },

  BBVA: {
    PYME: [
      "RC Extracontractual incluida al 20% del valor asegurado",
      "Débito automático mensual: sin pago único anual anticipado",
      "Propiedad personal de empleados cubierta hasta $6M por vigencia",
      "Celador sustituto: si es hospitalizado +3 días, BBVA envía reemplazo",
      "Asistencias de emergencia: plomería, electricidad y cerrajería 24/7",
      "Pago fraccionado mensual sin recargo",
    ],
    HOGAR: [
      "Débito automático de cuenta BBVA sin recargo por fraccionamiento",
      "Producto 100% modular: vivienda, contenidos o ambos",
      "Asistencias sin costo: cerrajería, electricidad y desinundación",
      "Traslado médico de emergencia incluido",
      "Orientación jurídica telefónica gratuita",
      "Todo riesgo de contenidos al 30% hasta $50 millones sin deducible",
    ],
    COPROPIEDAD: [
      "RC Propiedad Horizontal incluida al 20% del VA sin costo adicional",
      "Débito automático mensual desde cuenta BBVA",
      "Asistencias en zonas comunes: plomería, electricidad y cerrajería 24/7",
      "Daño interno de equipos electrónicos por voltaje cubierto",
      "Gastos adicionales al 15% incluidos",
      "Pago fraccionado mensual sin recargo",
    ],
    TRE: [
      "RC Extracontractual incluida al 20% del VA",
      "Débito automático mensual sin pago anual anticipado",
      "Propiedad personal de empleados cubierta",
      "Asistencias 24/7: plomería, electricidad y cerrajería",
      "Pago fraccionado sin recargo",
      "Gastos adicionales al 15% incluidos",
    ]
  },

  ZURICH: {
    PYME: [
      "Ciberseguridad disponible: protección ante ataques informáticos y ransomware",
      "Soluciones 100% flexibles adaptadas al sector y tamaño",
      "Respaldo Zurich global: más de 140 años en más de 170 países",
      "Avería de maquinaria: daños durante operación y mantenimiento",
      "Cobertura de transporte: bienes protegidos por tierra, mar o aire",
      "Gestión digital de pólizas y siniestros vía web o app",
    ],
    HOGAR: [
      "Artículos móviles cubiertos: bicicletas, tablets y portátiles",
      "Protección de documentos personales y bolso ante hurto",
      "Protección de llaves: cubre cambio de cerradura y llaves nuevas",
      "Asistencia domiciliaria 24/7: cerrajería, plomería, electricidad y vidrios",
      "Cotización y compra 100% digital sin papeleos",
      "RC familiar: daños que el asegurado, familia o mascotas causen a terceros",
    ],
    COPROPIEDAD: [
      "Ciberseguridad disponible para la administración digital del conjunto",
      "Respaldo Zurich global: más de 140 años de experiencia",
      "RC Propiedad Horizontal amplia: daños a propietarios y contratistas",
      "Rotura de maquinaria a valor de reposición a nuevo",
      "Gestión digital de la póliza y siniestros sin desplazamientos",
      "Asistencias en zonas comunes 24/7 sin costo adicional",
    ],
    TRE: [
      "Ciberseguridad disponible como módulo adicional",
      "Soluciones flexibles adaptadas al sector",
      "Respaldo Zurich global: más de 140 años",
      "Avería de maquinaria cubierta",
      "RC Extracontractual amplia",
      "Gestión digital de pólizas y siniestros",
    ]
  },

  ALLIANZ: {
    PYME: [
      "Cobertura Todo Riesgo: cualquier causa no excluida está cubierta",
      "Gastos adicionales automáticos: remoción, extinción y preservación",
      "Asistencia PYME: plomería, electricidad, cerrajería y celaduría 24/7",
      "Terremoto al 100% del valor asegurado sin sublímite",
      "Daño interno EEE hasta el 100% sin deducción por uso",
      "Primera aseguradora de Colombia: más de 80 años de trayectoria",
    ],
    HOGAR: [
      "Eventos eléctricos hasta el 40% del VA: una de las más amplias del mercado",
      "Asistencia de mascotas: consultas veterinarias, vacunación y cremación",
      "Instalación de pequeños accesorios incluida como asistencia",
      "RC familiar amplia: daños del asegurado, familiares y mascotas",
      "Rotura de vidrios y unidades sanitarias sin deducible",
      "Asistencias domiciliarias 24/7: plomería, cerrajería, vidrios y gas",
    ],
    COPROPIEDAD: [
      "Cobertura Todo Riesgo para zonas comunes",
      "Terremoto al 100% del valor asegurado sin sublímite",
      "Daño interno de equipos electrónicos al 100%",
      "Gastos adicionales automáticos: remoción, extinción y preservación",
      "RC Propiedad Horizontal amplia incluida",
      "Primera aseguradora de Colombia: más de 80 años de respaldo",
    ],
    TRE: [
      "Cobertura Todo Riesgo: cualquier causa no excluida",
      "Gastos adicionales automáticos incluidos",
      "Asistencia empresarial 24/7",
      "Terremoto al 100% sin sublímite",
      "Daño interno EEE al 100%",
      "Primera aseguradora de Colombia: 80+ años",
    ]
  },

  MUNDIAL: {
    HOGAR: [
      "Precio muy competitivo: una de las primas más bajas del mercado",
      "Producto 100% digital: cotización y compra en línea",
      "Cobertura de equipos electrónicos contra daño accidental y hurto",
      "Seguro de mascota disponible para gastos veterinarios",
      "Asistencia al hogar incluida para propietarios y arrendatarios",
      "RC familiar: protege por daños causados accidentalmente a terceros",
    ],
    PYME: [
      "Precio competitivo del mercado",
      "Producto digital: cotización y compra en línea",
      "Cobertura de equipos electrónicos incluida",
      "Asistencia empresarial incluida",
      "RC incluida",
      "Red de asesores especializados a nivel nacional",
    ],
    COPROPIEDAD: [
      "Precio muy competitivo para copropiedades",
      "Producto digital: gestión en línea",
      "Cobertura de equipos en zonas comunes",
      "Asistencia incluida",
      "RC Propiedad Horizontal incluida",
      "Red de asesores a nivel nacional",
    ],
    TRE: [
      "Precio competitivo",
      "Producto digital",
      "Cobertura de equipos electrónicos",
      "Asistencia empresarial",
      "RC incluida",
      "Red de asesores especializados",
    ]
  }

};

// Función helper para obtener beneficios por compañía y producto
export function getBeneficios(nombreCorto: string, producto: ProductoBeneficio): string[] {
  const comp = BENEFICIOS[nombreCorto];
  if (!comp) return [];
  return comp[producto] || [];
}

// Mapeo de nombre_corto de Supabase al key del objeto BENEFICIOS
export const NOMBRE_CORTO_MAP: Record<string, string> = {
  'AXA': 'AXA',
  'SURA': 'SURA',
  'EQUIDAD': 'EQUIDAD',
  'ESTADO': 'ESTADO',
  'HDI': 'HDI',
  'BOLIVAR': 'BOLIVAR',
  'MAPFRE': 'MAPFRE',
  'SOLIDARIA': 'SOLIDARIA',
  'BBVA': 'BBVA',
  'ZURICH': 'ZURICH',
  'ALLIANZ': 'ALLIANZ',
  'MUNDIAL': 'MUNDIAL',
};
