'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, Eye, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

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
  getBusinessGroups,
  createBusinessGroup,
  updateBusinessGroup,
  deleteBusinessGroup,
} from '@/lib/services/business-groups.service';
import type { BusinessGroup, CreateBusinessGroupInput } from '@/types/business-groups';

const emptyForm = {
  name: '',
  main_nit: '',
  primary_contact_name: '',
  primary_contact_phone: '',
  secondary_contact_name: '',
  secondary_contact_phone: '',
  address: '',
  city: '',
};

export default function BusinessGroupsPage() {
  const { tenantId } = useTenant();
  const [groups, setGroups] = useState<BusinessGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<BusinessGroup | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await getBusinessGroups();
      setGroups(data);
    } catch (error) {
      toast.error('Error al cargar grupos empresariales');
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

  const handleEdit = (group: BusinessGroup) => {
    setSelected(group);
    setFormData({
      name: group.name || '',
      main_nit: group.main_nit || '',
      primary_contact_name: group.primary_contact_name || '',
      primary_contact_phone: group.primary_contact_phone || '',
      secondary_contact_name: group.secondary_contact_name || '',
      secondary_contact_phone: group.secondary_contact_phone || '',
      address: group.address || '',
      city: group.city || '',
    });
    setFormOpen(true);
  };

  const handleDelete = (group: BusinessGroup) => {
    setSelected(group);
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
        await updateBusinessGroup(selected.id, formData);
        toast.success('Grupo actualizado exitosamente');
      } else {
        const input: CreateBusinessGroupInput = {
          ...formData,
          is_active: true,
        };
        await createBusinessGroup(input, tenantId);
        toast.success('Grupo creado exitosamente');
      }
      setFormOpen(false);
      loadGroups();
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
      await deleteBusinessGroup(selected.id);
      toast.success('Grupo desactivado exitosamente');
      setDeleteOpen(false);
      loadGroups();
    } catch (error) {
      toast.error('Error al desactivar grupo');
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.main_nit.includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grupos Empresariales</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los grupos empresariales y sus clientes asociados
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Grupo
        </Button>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o NIT..."
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
              <Building2 className="h-12 w-12 mb-4 opacity-50" />
              <p>No hay grupos empresariales registrados</p>
              <Button variant="link" onClick={handleCreate}>
                Crear el primer grupo
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="py-2">Nombre</TableHead>
                  <TableHead className="py-2">NIT</TableHead>
                  <TableHead className="py-2">Contacto Principal</TableHead>
                  <TableHead className="py-2">Ciudad</TableHead>
                  <TableHead className="py-2">Estado</TableHead>
                  <TableHead className="py-2 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((group) => (
                  <TableRow key={group.id} className="text-sm">
                    <TableCell className="py-2 font-medium">{group.name}</TableCell>
                    <TableCell className="py-2">{group.main_nit}</TableCell>
                    <TableCell className="py-2">
                      {group.primary_contact_name ? (
                        <div>
                          <p className="text-sm">{group.primary_contact_name}</p>
                          {group.primary_contact_phone && (
                            <p className="text-xs text-muted-foreground">{group.primary_contact_phone}</p>
                          )}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="py-2">{group.city || '-'}</TableCell>
                    <TableCell className="py-2">
                      {group.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-800 text-xs">Activo</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/grupos/${group.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(group)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(group)}>
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
            <DialogTitle>{selected ? 'Editar Grupo' : 'Nuevo Grupo Empresarial'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="name">Nombre del Grupo *</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
              </div>

              <div className="space-y-1">
                <Label htmlFor="main_nit">NIT Principal *</Label>
                <Input id="main_nit" name="main_nit" value={formData.main_nit} onChange={handleChange} required />
              </div>

              <div className="space-y-1">
                <Label htmlFor="city">Ciudad</Label>
                <Input id="city" name="city" value={formData.city} onChange={handleChange} />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="address">Dirección Principal</Label>
                <Input id="address" name="address" value={formData.address} onChange={handleChange} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="primary_contact_name">Contacto Principal</Label>
                <Input id="primary_contact_name" name="primary_contact_name" value={formData.primary_contact_name} onChange={handleChange} placeholder="Nombre" />
              </div>

              <div className="space-y-1">
                <Label htmlFor="primary_contact_phone">Teléfono Principal</Label>
                <Input id="primary_contact_phone" name="primary_contact_phone" value={formData.primary_contact_phone} onChange={handleChange} placeholder="Teléfono" />
              </div>

              <div className="space-y-1">
                <Label htmlFor="secondary_contact_name">Contacto Secundario</Label>
                <Input id="secondary_contact_name" name="secondary_contact_name" value={formData.secondary_contact_name} onChange={handleChange} placeholder="Nombre" />
              </div>

              <div className="space-y-1">
                <Label htmlFor="secondary_contact_phone">Teléfono Secundario</Label>
                <Input id="secondary_contact_phone" name="secondary_contact_phone" value={formData.secondary_contact_phone} onChange={handleChange} placeholder="Teléfono" />
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
                  selected ? 'Guardar' : 'Crear Grupo'
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
              ¿Estás seguro de que deseas desactivar el grupo{' '}
              <strong>{selected?.name}</strong>? Los clientes asociados no se verán afectados.
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
