'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, Loader2, Landmark } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useTenant } from '@/lib/context/TenantContext';
import {
  getCostCenters,
  createCostCenter,
  updateCostCenter,
  deleteCostCenter,
} from '@/lib/services/cost-centers.service';
import type { CostCenter, CreateCostCenterInput } from '@/types/cost-centers';

const emptyForm = {
  name: '',
  code: '',
  address: '',
  city: '',
};

export default function CostCentersPage() {
  const { tenantId } = useTenant();
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<CostCenter | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCenters();
  }, []);

  const loadCenters = async () => {
    try {
      const data = await getCostCenters();
      setCenters(data);
    } catch (error) {
      toast.error('Error al cargar centros de costos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelected(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const handleEdit = (center: CostCenter) => {
    setSelected(center);
    setFormData({
      name: center.name || '',
      code: center.code || '',
      address: center.address || '',
      city: center.city || '',
    });
    setFormOpen(true);
  };

  const handleDelete = (center: CostCenter) => {
    setSelected(center);
    setDeleteOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setSaving(true);
    try {
      if (selected?.id) {
        await updateCostCenter(selected.id, formData);
        toast.success('Centro de costos actualizado exitosamente');
      } else {
        const input: CreateCostCenterInput = {
          ...formData,
          is_active: true,
        };
        await createCostCenter(input, tenantId);
        toast.success('Centro de costos creado exitosamente');
      }
      setFormOpen(false);
      loadCenters();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al guardar';
      toast.error(msg);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!selected?.id) return;
    setDeleting(true);
    try {
      await deleteCostCenter(selected.id);
      toast.success('Centro de costos desactivado exitosamente');
      setDeleteOpen(false);
      loadCenters();
    } catch (error) {
      toast.error('Error al desactivar centro de costos');
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = centers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centro de Costos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los centros de costos de tu operación
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Centro de Costos
        </Button>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Landmark className="h-12 w-12 mb-4 opacity-50" />
              <p>No hay centros de costos registrados</p>
              <Button variant="link" onClick={handleCreate}>
                Crear el primer centro de costos
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="py-2">Nombre</TableHead>
                  <TableHead className="py-2">Código</TableHead>
                  <TableHead className="py-2">Ciudad</TableHead>
                  <TableHead className="py-2">Estado</TableHead>
                  <TableHead className="py-2 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((center) => (
                  <TableRow key={center.id} className="text-sm">
                    <TableCell className="py-2 font-medium">{center.name}</TableCell>
                    <TableCell className="py-2">{center.code}</TableCell>
                    <TableCell className="py-2">{center.city || '-'}</TableCell>
                    <TableCell className="py-2">
                      {center.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-800 text-xs">Activo</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(center)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(center)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto top-[55%]">
          <DialogHeader>
            <DialogTitle>{selected ? 'Editar Centro de Costos' : 'Nuevo Centro de Costos'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="name">Nombre del Centro de Costos *</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
              </div>

              <div className="space-y-1">
                <Label htmlFor="code">Código *</Label>
                <Input id="code" name="code" value={formData.code} onChange={handleChange} required />
              </div>

              <div className="space-y-1">
                <Label htmlFor="city">Ciudad</Label>
                <Input id="city" name="city" value={formData.city} onChange={handleChange} />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" name="address" value={formData.address} onChange={handleChange} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{selected ? 'Guardando...' : 'Creando...'}</>
                ) : (
                  selected ? 'Guardar' : 'Crear Centro de Costos'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Desactivación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas desactivar el centro de costos{' '}
              <strong>{selected?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
