'use client';

// =====================================================
// PAGE: Super Admin - Grupos de Seguro
// Gestión del catálogo de grupos/productos por ramo
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
import { LoadingScreen } from '@/components/ui/spinner';
import {
  FolderTree,
  Search,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Layers,
} from 'lucide-react';

interface InsuranceGroup {
  id: string;
  name: string;
  slug: string;
  line_id: string;
  is_active: boolean;
  display_order: number;
  line_name?: string;
  line_unit?: string;
}

interface InsuranceLine {
  id: string;
  name: string;
  slug: string;
  unit: 'generales' | 'vida';
}

export default function GruposPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<InsuranceGroup[]>([]);
  const [lines, setLines] = useState<InsuranceLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<InsuranceGroup | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '', line_id: '' });
  
  const supabase = getUntypedClient();

  const fetchLines = useCallback(async () => {
    const { data } = await supabase
      .from('insurance_lines')
      .select('id, name, slug, unit')
      .eq('is_active', true)
      .order('display_order');
    setLines((data as InsuranceLine[]) || []);
  }, [supabase]);

  const fetchGroups = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('insurance_groups')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Enriquecer con nombre del ramo
      const groupsWithLine = await Promise.all(
        (data || []).map(async (group: InsuranceGroup) => {
          const { data: lineData } = await supabase
            .from('insurance_lines')
            .select('name, unit')
            .eq('id', group.line_id)
            .single();
          return {
            ...group,
            line_name: lineData?.name || 'Sin ramo',
            line_unit: lineData?.unit || 'generales',
          };
        })
      );

      setGroups(groupsWithLine);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchLines();
    fetchGroups();
  }, [fetchLines, fetchGroups]);

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

  const openModal = (group?: InsuranceGroup) => {
    if (group) {
      setEditingGroup(group);
      setFormData({ name: group.name, slug: group.slug, line_id: group.line_id });
    } else {
      setEditingGroup(null);
      setFormData({ name: '', slug: '', line_id: lines[0]?.id || '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.line_id) return;

    setIsSubmitting(true);
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('insurance_groups')
          .update({ name: formData.name, slug: formData.slug, line_id: formData.line_id })
          .eq('id', editingGroup.id);
        if (error) throw error;
      } else {
        // Obtener el siguiente display_order para este ramo
        const { count } = await supabase
          .from('insurance_groups')
          .select('*', { count: 'exact', head: true })
          .eq('line_id', formData.line_id);

        const { error } = await supabase
          .from('insurance_groups')
          .insert({
            name: formData.name,
            slug: formData.slug,
            line_id: formData.line_id,
            display_order: (count || 0) + 1,
          });
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchGroups();
    } catch (error) {
      console.error('Error saving group:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (group: InsuranceGroup) => {
    try {
      const { error } = await supabase
        .from('insurance_groups')
        .update({ is_active: !group.is_active })
        .eq('id', group.id);
      if (error) throw error;
      fetchGroups();
    } catch (error) {
      console.error('Error toggling group:', error);
    }
  };

  const deleteGroup = async (group: InsuranceGroup) => {
    if (!confirm(`¿Eliminar "${group.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('insurance_groups')
        .delete()
        .eq('id', group.id);
      if (error) throw error;
      fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const filteredGroups = groups.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLine = lineFilter === 'all' || g.line_id === lineFilter;
    return matchesSearch && matchesLine;
  });

  // Agrupar por ramo para mejor visualización
  const groupedByLine = filteredGroups.reduce((acc, group) => {
    const key = group.line_id;
    if (!acc[key]) {
      acc[key] = {
        line_name: group.line_name || 'Sin ramo',
        line_unit: group.line_unit || 'generales',
        groups: [],
      };
    }
    acc[key].groups.push(group);
    return acc;
  }, {} as Record<string, { line_name: string; line_unit: string; groups: InsuranceGroup[] }>);

  if (isLoading) {
    return <LoadingScreen message="Cargando grupos..." />;
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
          <p className="text-zinc-400 mt-1">Productos específicos dentro de cada ramo</p>
        </div>
        <Button
          onClick={() => openModal()}
          className="bg-red-500 hover:bg-red-600 text-white"
          data-testid="add-group-btn"
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
        <Select value={lineFilter} onValueChange={setLineFilter}>
          <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-800 text-white">
            <SelectValue placeholder="Filtrar por ramo" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all" className="text-white">Todos los ramos</SelectItem>
            {lines.map((line) => (
              <SelectItem key={line.id} value={line.id} className="text-white">
                {line.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => fetchGroups()}
          className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Groups by Line */}
      {Object.entries(groupedByLine).length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-8 text-center text-zinc-500">
            No se encontraron grupos
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedByLine).map(([lineId, { line_name, line_unit, groups: lineGroups }]) => (
          <Card key={lineId} className="bg-zinc-900 border-zinc-800">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Layers className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium">{line_name}</h3>
                <p className="text-xs text-zinc-500">{lineGroups.length} grupos</p>
              </div>
              <Badge
                className={line_unit === 'generales' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-pink-500/20 text-pink-400'
                }
              >
                {line_unit === 'generales' ? 'Generales' : 'Vida'}
              </Badge>
            </div>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Grupo</TableHead>
                    <TableHead className="text-zinc-400">Slug</TableHead>
                    <TableHead className="text-zinc-400">Estado</TableHead>
                    <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineGroups.map((group) => (
                    <TableRow key={group.id} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-3">
                          <FolderTree className="h-4 w-4 text-green-500" />
                          {group.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-400 font-mono text-sm">{group.slug}</TableCell>
                      <TableCell>
                        <Badge
                          className={group.is_active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'}
                        >
                          {group.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openModal(group)}
                            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(group)}
                            className={group.is_active 
                              ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              : "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            }
                          >
                            {group.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteGroup(group)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-green-500" />
              {editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-zinc-300">Ramo</Label>
              <Select
                value={formData.line_id}
                onValueChange={(v) => setFormData({ ...formData, line_id: v })}
              >
                <SelectTrigger className="mt-1.5 bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Selecciona un ramo" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {lines.map((line) => (
                    <SelectItem key={line.id} value={line.id} className="text-white">
                      {line.name} ({line.unit === 'generales' ? 'Generales' : 'Vida'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-300">Nombre</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Auto individual"
                className="mt-1.5 bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Slug</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="auto-individual"
                className="mt-1.5 bg-zinc-800 border-zinc-700 text-white font-mono"
              />
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
              disabled={isSubmitting || !formData.name.trim() || !formData.line_id}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
