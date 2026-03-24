'use client';

// =====================================================
// PAGE: Super Admin - Grupos de Seguro
// Gestión del catálogo de grupos (antes llamado ramos)
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingScreen } from '@/components/ui/spinner';
import {
  Layers,
  Search,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Building,
  Brain,
  Settings,
} from 'lucide-react';

interface InsuranceLine {
  id: string;
  name: string;
  slug: string;
  unit: 'generales' | 'vida';
  is_active: boolean;
  has_ai_prompt: boolean;
  display_order: number;
  groups_count?: number;
  companies_count?: number;
}

interface InsuranceCompany {
  id: string;
  name: string;
  slug: string;
}

export default function RamosPage() {
  const router = useRouter();
  const [lines, setLines] = useState<InsuranceLine[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompaniesModalOpen, setIsCompaniesModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<InsuranceLine | null>(null);
  const [selectedLineForCompanies, setSelectedLineForCompanies] = useState<InsuranceLine | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '', unit: 'generales' as 'generales' | 'vida' });
  
  const supabase = getUntypedClient();

  const fetchLines = useCallback(async () => {
    try {
      const { data: linesData, error } = await supabase
        .from('insurance_lines')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Obtener conteos
      const linesWithCounts = await Promise.all(
        (linesData || []).map(async (line: InsuranceLine) => {
          const [groupsRes, companiesRes] = await Promise.all([
            supabase.from('insurance_groups').select('*', { count: 'exact', head: true }).eq('line_id', line.id),
            supabase.from('company_lines').select('*', { count: 'exact', head: true }).eq('line_id', line.id),
          ]);
          return {
            ...line,
            groups_count: groupsRes.count || 0,
            companies_count: companiesRes.count || 0,
          };
        })
      );

      setLines(linesWithCounts);
    } catch (error) {
      console.error('Error fetching lines:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase
      .from('insurance_companies')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name');
    setCompanies((data as InsuranceCompany[]) || []);
  }, [supabase]);

  useEffect(() => {
    fetchLines();
    fetchCompanies();
  }, [fetchLines, fetchCompanies]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: generateSlug(name),
    });
  };

  const openModal = (line?: InsuranceLine) => {
    if (line) {
      setEditingLine(line);
      setFormData({ name: line.name, slug: line.slug, unit: line.unit });
    } else {
      setEditingLine(null);
      setFormData({ name: '', slug: '', unit: 'generales' });
    }
    setIsModalOpen(true);
  };

  const openCompaniesModal = async (line: InsuranceLine) => {
    setSelectedLineForCompanies(line);
    
    // Cargar compañías asignadas
    const { data } = await supabase
      .from('company_lines')
      .select('company_id')
      .eq('line_id', line.id);
    
    setSelectedCompanyIds((data || []).map((cl: { company_id: string }) => cl.company_id));
    setIsCompaniesModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingLine) {
        const { error } = await supabase
          .from('insurance_lines')
          .update({ name: formData.name, slug: formData.slug, unit: formData.unit })
          .eq('id', editingLine.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('insurance_lines')
          .insert({
            name: formData.name,
            slug: formData.slug,
            unit: formData.unit,
            display_order: lines.length + 1,
          });
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchLines();
    } catch (error) {
      console.error('Error saving line:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCompanies = async () => {
    if (!selectedLineForCompanies) return;

    setIsSubmitting(true);
    try {
      // Eliminar asignaciones actuales
      await supabase
        .from('company_lines')
        .delete()
        .eq('line_id', selectedLineForCompanies.id);

      // Insertar nuevas asignaciones
      if (selectedCompanyIds.length > 0) {
        const inserts = selectedCompanyIds.map((companyId) => ({
          company_id: companyId,
          line_id: selectedLineForCompanies.id,
        }));
        const { error } = await supabase.from('company_lines').insert(inserts);
        if (error) throw error;
      }

      setIsCompaniesModalOpen(false);
      fetchLines();
    } catch (error) {
      console.error('Error saving companies:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (line: InsuranceLine) => {
    try {
      const { error } = await supabase
        .from('insurance_lines')
        .update({ is_active: !line.is_active })
        .eq('id', line.id);
      if (error) throw error;
      fetchLines();
    } catch (error) {
      console.error('Error toggling line:', error);
    }
  };

  const toggleAiPrompt = async (line: InsuranceLine) => {
    try {
      const { error } = await supabase
        .from('insurance_lines')
        .update({ has_ai_prompt: !line.has_ai_prompt })
        .eq('id', line.id);
      if (error) throw error;
      fetchLines();
    } catch (error) {
      console.error('Error toggling AI prompt:', error);
    }
  };

  const deleteLine = async (line: InsuranceLine) => {
    if (!confirm(`¿Eliminar "${line.name}"? Se eliminarán también sus grupos asociados.`)) return;

    try {
      const { error } = await supabase
        .from('insurance_lines')
        .delete()
        .eq('id', line.id);
      if (error) throw error;
      fetchLines();
    } catch (error) {
      console.error('Error deleting line:', error);
    }
  };

  const filteredLines = lines.filter((l) => {
    const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUnit = unitFilter === 'all' || l.unit === unitFilter;
    return matchesSearch && matchesUnit;
  });

  if (isLoading) {
    return <LoadingScreen message="Cargando ramos..." />;
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
          <h1 className="text-2xl font-bold text-white">Grupos de Seguro</h1>
          <p className="text-zinc-400 mt-1">Configura los grupos y asigna compañías</p>
        </div>
        <Button
          onClick={() => openModal()}
          className="bg-red-500 hover:bg-red-600 text-white"
          data-testid="add-line-btn"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Grupo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar grupo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
          />
        </div>
        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger className="w-[150px] bg-zinc-900 border-zinc-800 text-white">
            <SelectValue placeholder="Unidad" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all" className="text-white">Todas</SelectItem>
            <SelectItem value="generales" className="text-white">Generales</SelectItem>
            <SelectItem value="vida" className="text-white">Vida</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => fetchLines()}
          className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Grupo</TableHead>
                <TableHead className="text-zinc-400">Unidad</TableHead>
                <TableHead className="text-zinc-400 text-center">Ramos</TableHead>
                <TableHead className="text-zinc-400 text-center">Compañías</TableHead>
                <TableHead className="text-zinc-400 text-center">IA</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                    No se encontraron grupos
                  </TableCell>
                </TableRow>
              ) : (
                filteredLines.map((line) => (
                  <TableRow key={line.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="font-medium text-white">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Layers className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p>{line.name}</p>
                          <p className="text-xs text-zinc-500 font-mono">{line.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={line.unit === 'generales' 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-pink-500/20 text-pink-400'
                        }
                      >
                        {line.unit === 'generales' ? 'Generales' : 'Vida'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-zinc-300">{line.groups_count}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openCompaniesModal(line)}
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                      >
                        <Building className="h-3 w-3 mr-1" />
                        {line.companies_count}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAiPrompt(line)}
                        className={line.has_ai_prompt 
                          ? "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          : "text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800"
                        }
                        title={line.has_ai_prompt ? 'Tiene prompt IA activo' : 'Sin prompt IA'}
                      >
                        <Brain className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={line.is_active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'}
                      >
                        {line.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openModal(line)}
                          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(line)}
                          className={line.is_active 
                            ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                            : "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          }
                        >
                          {line.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLine(line)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal: Editar/Crear Ramo */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-500" />
              {editingLine ? 'Editar Grupo' : 'Nuevo Grupo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-zinc-300">Nombre</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Automóviles"
                className="mt-1.5 bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Slug</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="automoviles"
                className="mt-1.5 bg-zinc-800 border-zinc-700 text-white font-mono"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Unidad</Label>
              <Select
                value={formData.unit}
                onValueChange={(v) => setFormData({ ...formData, unit: v as 'generales' | 'vida' })}
              >
                <SelectTrigger className="mt-1.5 bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="generales" className="text-white">Generales</SelectItem>
                  <SelectItem value="vida" className="text-white">Vida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name.trim()}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Asignar Compañías */}
      <Dialog open={isCompaniesModalOpen} onOpenChange={setIsCompaniesModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-500" />
              Compañías para "{selectedLineForCompanies?.name}"
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 max-h-[400px] overflow-y-auto space-y-2">
            {companies.map((company) => (
              <div
                key={company.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800 cursor-pointer"
                onClick={() => {
                  if (selectedCompanyIds.includes(company.id)) {
                    setSelectedCompanyIds(selectedCompanyIds.filter((id) => id !== company.id));
                  } else {
                    setSelectedCompanyIds([...selectedCompanyIds, company.id]);
                  }
                }}
              >
                <Checkbox
                  checked={selectedCompanyIds.includes(company.id)}
                  className="border-zinc-600 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                />
                <span className="text-white">{company.name}</span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCompaniesModalOpen(false)}
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCompanies}
              disabled={isSubmitting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Guardar (${selectedCompanyIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
