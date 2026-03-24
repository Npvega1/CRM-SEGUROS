'use client';

// =====================================================
// PAGE: Super Admin - Compañías de Seguros
// Gestión del catálogo de aseguradoras
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
import { Label } from '@/components/ui/label';
import { LoadingScreen } from '@/components/ui/spinner';
import {
  Building,
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

interface InsuranceCompany {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  lines_count?: number;
}

export default function CompaniasPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<InsuranceCompany | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '' });
  
  const supabase = getUntypedClient();

  const fetchCompanies = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('insurance_companies')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Obtener conteo de ramos por compañía
      const companiesWithCount = await Promise.all(
        (data || []).map(async (company: InsuranceCompany) => {
          const { count } = await supabase
            .from('company_lines')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id);
          return { ...company, lines_count: count || 0 };
        })
      );

      setCompanies(companiesWithCount);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

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
      name,
      slug: generateSlug(name),
    });
  };

  const openModal = (company?: InsuranceCompany) => {
    if (company) {
      setEditingCompany(company);
      setFormData({ name: company.name, slug: company.slug });
    } else {
      setEditingCompany(null);
      setFormData({ name: '', slug: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingCompany) {
        const { error } = await supabase
          .from('insurance_companies')
          .update({ name: formData.name, slug: formData.slug })
          .eq('id', editingCompany.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('insurance_companies')
          .insert({
            name: formData.name,
            slug: formData.slug,
            display_order: companies.length + 1,
          });
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (company: InsuranceCompany) => {
    try {
      const { error } = await supabase
        .from('insurance_companies')
        .update({ is_active: !company.is_active })
        .eq('id', company.id);
      if (error) throw error;
      fetchCompanies();
    } catch (error) {
      console.error('Error toggling company:', error);
    }
  };

  const deleteCompany = async (company: InsuranceCompany) => {
    if (!confirm(`¿Eliminar "${company.name}"? Esta acción no se puede deshacer.`)) return;

    try {
      const { error } = await supabase
        .from('insurance_companies')
        .delete()
        .eq('id', company.id);
      if (error) throw error;
      fetchCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <LoadingScreen message="Cargando compañías..." />;
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
          <h1 className="text-2xl font-bold text-white">Compañías de Seguros</h1>
          <p className="text-zinc-400 mt-1">Gestiona las aseguradoras disponibles</p>
        </div>
        <Button
          onClick={() => openModal()}
          className="bg-red-500 hover:bg-red-600 text-white"
          data-testid="add-company-btn"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nueva Compañía
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar compañía..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => fetchCompanies()}
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
                <TableHead className="text-zinc-400">Nombre</TableHead>
                <TableHead className="text-zinc-400">Slug</TableHead>
                <TableHead className="text-zinc-400 text-center">Ramos</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                    No se encontraron compañías
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="font-medium text-white">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Building className="h-4 w-4 text-blue-500" />
                        </div>
                        {company.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-400 font-mono text-sm">{company.slug}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Layers className="h-3 w-3 text-zinc-500" />
                        <span className="text-zinc-300">{company.lines_count}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={company.is_active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'}
                      >
                        {company.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openModal(company)}
                          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(company)}
                          className={company.is_active 
                            ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                            : "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          }
                        >
                          {company.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCompany(company)}
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

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-500" />
              {editingCompany ? 'Editar Compañía' : 'Nueva Compañía'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-zinc-300">Nombre</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Seguros Sura"
                className="mt-1.5 bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Slug</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="seguros-sura"
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
              disabled={isSubmitting || !formData.name.trim()}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
