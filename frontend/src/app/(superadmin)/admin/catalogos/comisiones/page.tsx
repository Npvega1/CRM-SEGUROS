'use client';

// =====================================================
// PAGE: Super Admin - Comisiones por Compañía y Ramo
// Con acordeón colapsable y orden de grupos
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { LoadingScreen } from '@/components/ui/spinner';
import {
  Search,
  ArrowLeft,
  RefreshCw,
  Save,
  Building,
  FolderTree,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// Orden específico de grupos
const GROUP_ORDER = [
  'automoviles',
  'autos',
  'auto',
  'fianzas',
  'generales',
  'vida',
  'arl',
  'salud',
  'soat',
];

interface InsuranceCompany {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface InsuranceGroup {
  id: string;
  name: string;
  slug: string;
  line_id: string;
  line_name?: string;
  line_slug?: string;
}

interface CompanyLine {
  company_id: string;
  line_id: string;
}

interface CommissionEntry {
  company_id: string;
  group_id: string;
  commission_pct: number;
  company_name?: string;
  group_name?: string;
  line_name?: string;
  line_slug?: string;
  isModified?: boolean;
  isSaving?: boolean;
  isSaved?: boolean;
}

export default function ComisionesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [commissions, setCommissions] = useState<CommissionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [savingAll, setSavingAll] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());

  const supabase = getUntypedClient();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Cargar compañías activas
      const { data: companiesData } = await supabase
        .from('insurance_companies')
        .select('id, name, slug, is_active')
        .eq('is_active', true)
        .order('name');

      // Cargar relaciones company_lines (qué líneas tiene cada compañía)
      const { data: companyLinesData } = await supabase
        .from('company_lines')
        .select('company_id, line_id')
        .eq('is_active', true);

      // Cargar todos los ramos con su línea
      const { data: groupsData } = await supabase
        .from('insurance_groups')
        .select('id, name, slug, line_id')
        .eq('is_active', true)
        .order('name');

      // Cargar líneas para obtener nombres y slugs
      const { data: linesData } = await supabase
        .from('insurance_lines')
        .select('id, name, slug');

      // Cargar comisiones existentes
      const { data: commissionsData } = await supabase
        .from('company_group_commissions')
        .select('*');

      const companiesList = (companiesData || []) as InsuranceCompany[];
      const companyLinesList = (companyLinesData || []) as CompanyLine[];
      const groupsList = (groupsData || []).map((g: InsuranceGroup) => {
        const line = linesData?.find((l: { id: string; name: string; slug: string }) => l.id === g.line_id);
        return {
          ...g,
          line_name: line?.name || 'Sin grupo',
          line_slug: line?.slug || ''
        };
      }) as InsuranceGroup[];

      setCompanies(companiesList);

      // Crear mapa de líneas por compañía
      const companyLinesMap = new Map<string, Set<string>>();
      companyLinesList.forEach(cl => {
        if (!companyLinesMap.has(cl.company_id)) {
          companyLinesMap.set(cl.company_id, new Set());
        }
        companyLinesMap.get(cl.company_id)!.add(cl.line_id);
      });

      // Crear mapa de comisiones existentes
      const commissionsMap = new Map(
        (commissionsData || []).map((c: { company_id: string; group_id: string; commission_pct: number }) => 
          [`${c.company_id}-${c.group_id}`, c.commission_pct]
        )
      );

      // Crear matriz de comisiones SOLO para combinaciones válidas
      const allCommissions: CommissionEntry[] = [];
      
      companiesList.forEach(company => {
        // Obtener las líneas que tiene esta compañía
        const companyLineIds = companyLinesMap.get(company.id);
        
        if (companyLineIds && companyLineIds.size > 0) {
          // Solo agregar ramos que pertenecen a líneas de esta compañía
          groupsList.forEach(group => {
            if (companyLineIds.has(group.line_id)) {
              const key = `${company.id}-${group.id}`;
              allCommissions.push({
                company_id: company.id,
                group_id: group.id,
                commission_pct: commissionsMap.get(key) ?? 10,
                company_name: company.name,
                group_name: group.name,
                line_name: group.line_name,
                line_slug: group.line_slug,
                isModified: false,
                isSaving: false,
                isSaved: false,
              });
            }
          });
        }
      });

      setCommissions(allCommissions);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCompany = (companyId: string) => {
    setExpandedCompanies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allIds = new Set(Object.keys(groupedByCompany));
    setExpandedCompanies(allIds);
  };

  const collapseAll = () => {
    setExpandedCompanies(new Set());
  };

  const handleCommissionChange = (companyId: string, groupId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCommissions(prev => prev.map(c => 
      c.company_id === companyId && c.group_id === groupId
        ? { ...c, commission_pct: numValue, isModified: true, isSaved: false }
        : c
    ));
  };

  const saveCommission = async (companyId: string, groupId: string) => {
    const commission = commissions.find(c => c.company_id === companyId && c.group_id === groupId);
    if (!commission) return;

    setCommissions(prev => prev.map(c => 
      c.company_id === companyId && c.group_id === groupId
        ? { ...c, isSaving: true }
        : c
    ));

    try {
      const { error } = await supabase
        .from('company_group_commissions')
        .upsert({
          company_id: companyId,
          group_id: groupId,
          commission_pct: commission.commission_pct,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'company_id,group_id'
        });

      if (error) throw error;

      setCommissions(prev => prev.map(c => 
        c.company_id === companyId && c.group_id === groupId
          ? { ...c, isModified: false, isSaving: false, isSaved: true }
          : c
      ));

      setTimeout(() => {
        setCommissions(prev => prev.map(c => 
          c.company_id === companyId && c.group_id === groupId
            ? { ...c, isSaved: false }
            : c
        ));
      }, 2000);

    } catch (error) {
      console.error('Error saving commission:', error);
      setCommissions(prev => prev.map(c => 
        c.company_id === companyId && c.group_id === groupId
          ? { ...c, isSaving: false }
          : c
      ));
    }
  };

  const saveAllModified = async () => {
    const modified = commissions.filter(c => c.isModified);
    if (modified.length === 0) return;

    setSavingAll(true);
    
    for (const commission of modified) {
      await saveCommission(commission.company_id, commission.group_id);
    }

    setSavingAll(false);
  };

  // Función para ordenar por grupo
  const getGroupOrder = (lineSlug: string): number => {
    const slug = lineSlug.toLowerCase();
    for (let i = 0; i < GROUP_ORDER.length; i++) {
      if (slug.includes(GROUP_ORDER[i])) {
        return i;
      }
    }
    return GROUP_ORDER.length; // Si no coincide, va al final
  };

  // Filtrar comisiones
  const filteredCommissions = commissions.filter(c => {
    const matchesSearch = 
      c.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.group_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.line_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCompany = companyFilter === 'all' || c.company_id === companyFilter;
    
    return matchesSearch && matchesCompany;
  });

  // Agrupar por compañía y ordenar los ramos
  const groupedByCompany = filteredCommissions.reduce((acc, commission) => {
    const key = commission.company_id;
    if (!acc[key]) {
      acc[key] = {
        company_name: commission.company_name || 'Sin compañía',
        commissions: []
      };
    }
    acc[key].commissions.push(commission);
    return acc;
  }, {} as Record<string, { company_name: string; commissions: CommissionEntry[] }>);

  // Ordenar las comisiones dentro de cada compañía por grupo
  Object.values(groupedByCompany).forEach(group => {
    group.commissions.sort((a, b) => {
      const orderA = getGroupOrder(a.line_slug || '');
      const orderB = getGroupOrder(b.line_slug || '');
      if (orderA !== orderB) return orderA - orderB;
      return (a.group_name || '').localeCompare(b.group_name || '');
    });
  });

  const modifiedCount = commissions.filter(c => c.isModified).length;

  // Compañías que tienen al menos una comisión (para el filtro)
  const companiesWithCommissions = companies.filter(c => 
    commissions.some(comm => comm.company_id === c.id)
  );

  if (isLoading) {
    return <LoadingScreen message="Cargando comisiones..." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/catalogos')}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Comisiones por Compañía</h1>
          <p className="text-zinc-400 mt-1">Configura el % de comisión para cada combinación Compañía + Ramo</p>
        </div>
        {modifiedCount > 0 && (
          <Button
            onClick={saveAllModified}
            disabled={savingAll}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {savingAll ? 'Guardando...' : `Guardar ${modifiedCount} cambios`}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar compañía o ramo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[250px] bg-zinc-900 border-zinc-800 text-white">
            <SelectValue placeholder="Filtrar por compañía" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all" className="text-white">Todas las compañías</SelectItem>
            {companiesWithCommissions.map((company) => (
              <SelectItem key={company.id} value={company.id} className="text-white">
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
            className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            Expandir todo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAll}
            className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            Colapsar todo
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchData()}
          className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-blue-400 text-sm">
        <p>
          <strong>Instrucciones:</strong> Haz clic en una compañía para expandirla y ver sus ramos. 
          Modifica el porcentaje y presiona Enter o el botón guardar. Los cambios pendientes se muestran en amarillo.
        </p>
      </div>

      {/* Commissions by Company - Accordion */}
      {Object.entries(groupedByCompany).length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-8 text-center text-zinc-500">
            <p>No se encontraron combinaciones de Compañía + Ramo.</p>
            <p className="text-sm mt-2">Asegúrate de que las compañías tengan grupos/líneas asignados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {Object.entries(groupedByCompany).map(([companyId, { company_name, commissions: companyCommissions }]) => {
            const isExpanded = expandedCompanies.has(companyId);
            const modifiedInCompany = companyCommissions.filter(c => c.isModified).length;
            
            return (
              <Collapsible
                key={companyId}
                open={isExpanded}
                onOpenChange={() => toggleCompany(companyId)}
              >
                <Card className="bg-zinc-900 border-zinc-800">
                  <CollapsibleTrigger asChild>
                    <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Building className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{company_name}</h3>
                        <p className="text-xs text-zinc-500">{companyCommissions.length} ramos</p>
                      </div>
                      {modifiedInCompany > 0 && (
                        <Badge className="bg-yellow-500/20 text-yellow-400">
                          {modifiedInCompany} sin guardar
                        </Badge>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-zinc-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-zinc-400" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="p-0 border-t border-zinc-800">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-zinc-800 hover:bg-transparent">
                            <TableHead className="text-zinc-400">Grupo</TableHead>
                            <TableHead className="text-zinc-400">Ramo</TableHead>
                            <TableHead className="text-zinc-400 text-center w-[150px]">Comisión %</TableHead>
                            <TableHead className="text-zinc-400 text-right w-[100px]">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyCommissions.map((commission) => (
                            <TableRow 
                              key={`${commission.company_id}-${commission.group_id}`} 
                              className="border-zinc-800 hover:bg-zinc-800/50"
                            >
                              <TableCell className="text-zinc-400">
                                <Badge className="bg-purple-500/20 text-purple-400">
                                  {commission.line_name}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-white">
                                <div className="flex items-center gap-2">
                                  <FolderTree className="h-4 w-4 text-green-500" />
                                  {commission.group_name}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={commission.commission_pct}
                                    onChange={(e) => handleCommissionChange(
                                      commission.company_id, 
                                      commission.group_id, 
                                      e.target.value
                                    )}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        saveCommission(commission.company_id, commission.group_id);
                                      }
                                    }}
                                    className={`w-20 text-center bg-zinc-800 border-zinc-700 text-white ${
                                      commission.isModified ? 'border-yellow-500 bg-yellow-500/10' : ''
                                    }`}
                                  />
                                  <span className="text-zinc-400">%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {commission.isSaved ? (
                                  <Badge className="bg-green-500/20 text-green-400">
                                    <Check className="h-3 w-3 mr-1" />
                                    OK
                                  </Badge>
                                ) : commission.isModified ? (
                                  <Button
                                    size="sm"
                                    onClick={() => saveCommission(commission.company_id, commission.group_id)}
                                    disabled={commission.isSaving}
                                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                                  >
                                    {commission.isSaving ? '...' : <Save className="h-3 w-3" />}
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
