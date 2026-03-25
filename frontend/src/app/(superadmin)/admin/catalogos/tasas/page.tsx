'use client';

// =====================================================
// PAGE: Super Admin - Gestión de Tasas del Cotizador
// /admin/catalogos/tasas
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Filter,
  Percent,
  Building,
  Edit2,
  Check,
  X,
} from 'lucide-react';

interface Aseguradora {
  id: string;
  nombre: string;
  nombre_corto: string;
  color_primario: string;
  activa_sistema: boolean;
  orden: number;
}

interface Tasa {
  id: string;
  aseguradora_id: string;
  producto: string;
  amparo: string;
  tasa: number;
  base_calculo: string;
  deducible_texto: string;
  activo: boolean;
  aseguradora?: Aseguradora;
}

interface Factor {
  id: string;
  tipo: string;
  clave: string;
  factor: number;
  activo: boolean;
}

const PRODUCTOS = ['PYME', 'HOGAR', 'COPROPIEDAD', 'TRE'];

const AMPAROS: Record<string, string> = {
  incendio: 'Incendio',
  terremoto: 'Terremoto',
  hmacc: 'HMACC (Daños por agua)',
  hurtoCalif: 'Hurto Calificado',
  hurtoSimple: 'Hurto Simple',
  hurtoDinero: 'Hurto Dinero',
  eeeDanio: 'Equipo Electrónico (Daño)',
  eeeMovil: 'Equipo Electrónico Móvil',
  rotMaq: 'Rotura de Maquinaria',
  rotVidrios: 'Rotura de Vidrios',
  rce: 'Responsabilidad Civil',
  transValores: 'Transporte de Valores',
  mejorasLoc: 'Mejoras Locativas',
};

const BASES_CALCULO: Record<string, string> = {
  VA_TOTAL_DM: 'Valor Asegurado Total DM',
  CONTENIDOS: 'Contenidos',
  BIEN_ESPECIFICO: 'Bien Específico',
  LIMITE_RC: 'Límite RC',
  PRESUPUESTO_ANUAL: 'Presupuesto Anual',
};

export default function TasasPage() {
  const { toast } = useToast();
  const supabase = getUntypedClient();

  // Estados
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);
  const [tasas, setTasas] = useState<Tasa[]>([]);
  const [factores, setFactores] = useState<Factor[]>([]);
  
  // Filtros
  const [filterAseguradora, setFilterAseguradora] = useState<string>('all');
  const [filterProducto, setFilterProducto] = useState<string>('all');
  const [filterAmparo, setFilterAmparo] = useState<string>('all');
  
  // Edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  // Tab activa
  const [activeTab, setActiveTab] = useState<'tasas' | 'factores'>('tasas');

  // Cargar datos
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Cargar aseguradoras
      const { data: asegData, error: asegError } = await supabase
        .from('aseguradoras')
        .select('*')
        .order('orden');
      
      if (asegError) throw asegError;
      setAseguradoras(asegData || []);

      // Cargar tasas con aseguradora
      const { data: tasasData, error: tasasError } = await supabase
        .from('cotizador_tasas')
        .select(`
          *,
          aseguradora:aseguradoras(id, nombre, nombre_corto, color_primario)
        `)
        .order('aseguradora_id')
        .order('producto')
        .order('amparo');
      
      if (tasasError) throw tasasError;
      setTasas(tasasData || []);

      // Cargar factores
      const { data: factoresData, error: factoresError } = await supabase
        .from('cotizador_factores')
        .select('*')
        .order('tipo')
        .order('factor');
      
      if (factoresError) throw factoresError;
      setFactores(factoresData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrar tasas
  const filteredTasas = tasas.filter(t => {
    if (filterAseguradora !== 'all' && t.aseguradora_id !== filterAseguradora) return false;
    if (filterProducto !== 'all' && t.producto !== filterProducto) return false;
    if (filterAmparo !== 'all' && t.amparo !== filterAmparo) return false;
    return true;
  });

  // Guardar tasa editada
  const handleSaveTasa = async (tasaId: string) => {
    const newTasa = parseFloat(editValue);
    if (isNaN(newTasa) || newTasa < 0) {
      toast({
        title: 'Error',
        description: 'La tasa debe ser un número positivo',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('cotizador_tasas')
        .update({ tasa: newTasa, updated_at: new Date().toISOString() })
        .eq('id', tasaId);

      if (error) throw error;

      setTasas(prev => prev.map(t => 
        t.id === tasaId ? { ...t, tasa: newTasa } : t
      ));
      setEditingId(null);
      toast({
        title: 'Tasa actualizada',
        description: 'Los cambios se guardaron correctamente',
      });
    } catch (error) {
      console.error('Error saving tasa:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la tasa',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Guardar factor editado
  const handleSaveFactor = async (factorId: string, newFactor: number) => {
    if (isNaN(newFactor) || newFactor <= 0) {
      toast({
        title: 'Error',
        description: 'El factor debe ser un número positivo',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('cotizador_factores')
        .update({ factor: newFactor })
        .eq('id', factorId);

      if (error) throw error;

      setFactores(prev => prev.map(f => 
        f.id === factorId ? { ...f, factor: newFactor } : f
      ));
      setEditingId(null);
      toast({
        title: 'Factor actualizado',
      });
    } catch (error) {
      console.error('Error saving factor:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el factor',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Formatear tasa como porcentaje
  const formatTasa = (tasa: number) => {
    return (tasa * 100).toFixed(4) + '%';
  };

  if (isLoading) {
    return <LoadingScreen message="Cargando tasas..." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/catalogos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Tasas del Cotizador</h1>
            <p className="text-zinc-400 text-sm">
              Gestiona las tasas de cotización por aseguradora, producto y amparo
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        <Button
          variant={activeTab === 'tasas' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('tasas')}
        >
          <Percent className="h-4 w-4 mr-2" />
          Tasas ({tasas.length})
        </Button>
        <Button
          variant={activeTab === 'factores' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('factores')}
        >
          <Filter className="h-4 w-4 mr-2" />
          Factores ({factores.length})
        </Button>
      </div>

      {/* Tab: Tasas */}
      {activeTab === 'tasas' && (
        <>
          {/* Filtros */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Aseguradora</Label>
                  <Select value={filterAseguradora} onValueChange={setFilterAseguradora}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las aseguradoras</SelectItem>
                      {aseguradoras.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: a.color_primario }}
                            />
                            {a.nombre_corto}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Producto</Label>
                  <Select value={filterProducto} onValueChange={setFilterProducto}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los productos</SelectItem>
                      {PRODUCTOS.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Amparo</Label>
                  <Select value={filterAmparo} onValueChange={setFilterAmparo}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los amparos</SelectItem>
                      {Object.entries(AMPAROS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de tasas */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableHead className="text-zinc-400">Aseguradora</TableHead>
                      <TableHead className="text-zinc-400">Producto</TableHead>
                      <TableHead className="text-zinc-400">Amparo</TableHead>
                      <TableHead className="text-zinc-400 text-right">Tasa</TableHead>
                      <TableHead className="text-zinc-400">Base Cálculo</TableHead>
                      <TableHead className="text-zinc-400">Deducible</TableHead>
                      <TableHead className="text-zinc-400 w-20">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-zinc-500 py-8">
                          No hay tasas que coincidan con los filtros
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTasas.map(tasa => (
                        <TableRow 
                          key={tasa.id} 
                          className="border-zinc-800 hover:bg-zinc-800/50"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: tasa.aseguradora?.color_primario || '#666' }}
                              />
                              <span className="text-white font-medium">
                                {tasa.aseguradora?.nombre_corto || 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-zinc-300 border-zinc-700">
                              {tasa.producto}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-zinc-300">
                            {AMPAROS[tasa.amparo] || tasa.amparo}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingId === tasa.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  step="0.000001"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-28 h-8 text-right bg-zinc-800 border-zinc-700"
                                  autoFocus
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-500"
                                  onClick={() => handleSaveTasa(tasa.id)}
                                  disabled={isSaving}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500"
                                  onClick={() => setEditingId(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-amber-400 font-mono">
                                {formatTasa(tasa.tasa)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-zinc-400 text-sm">
                            {BASES_CALCULO[tasa.base_calculo] || tasa.base_calculo}
                          </TableCell>
                          <TableCell className="text-zinc-400 text-sm max-w-[200px] truncate">
                            {tasa.deducible_texto}
                          </TableCell>
                          <TableCell>
                            {editingId !== tasa.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingId(tasa.id);
                                  setEditValue(tasa.tasa.toString());
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="py-4">
              <p className="text-sm text-zinc-400">
                <strong className="text-amber-400">Nota:</strong> Las tasas se muestran como porcentaje. 
                Para editar, haz clic en el ícono de edición e ingresa el valor decimal 
                (ej: 0.000324 para 0.0324%). Los cambios se guardan automáticamente.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab: Factores */}
      {activeTab === 'factores' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {['ZONA', 'ANTIGUEDAD', 'SINIESTROS', 'PISOS'].map(tipo => {
            const factoresTipo = factores.filter(f => f.tipo === tipo);
            return (
              <Card key={tipo} className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base">
                    Factores por {tipo.charAt(0) + tipo.slice(1).toLowerCase()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-zinc-400">Valor</TableHead>
                        <TableHead className="text-zinc-400 text-right">Factor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {factoresTipo.map(factor => (
                        <TableRow key={factor.id} className="border-zinc-800">
                          <TableCell className="text-zinc-300">{factor.clave}</TableCell>
                          <TableCell className="text-right">
                            {editingId === factor.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-20 h-8 text-right bg-zinc-800 border-zinc-700"
                                  autoFocus
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-500"
                                  onClick={() => handleSaveFactor(factor.id, parseFloat(editValue))}
                                  disabled={isSaving}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500"
                                  onClick={() => setEditingId(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <span className={`font-mono ${
                                  factor.factor > 1 ? 'text-red-400' : 
                                  factor.factor < 1 ? 'text-green-400' : 'text-zinc-300'
                                }`}>
                                  {factor.factor.toFixed(2)}x
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setEditingId(factor.id);
                                    setEditValue(factor.factor.toString());
                                  }}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
