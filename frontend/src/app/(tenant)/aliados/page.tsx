'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

import { AlliedAgentForm } from '@/components/modules/allied-agents/AlliedAgentForm';
import { AlliedAgentDocuments } from '@/components/modules/allied-agents/AlliedAgentDocuments';
import {
  getAlliedAgents,
  deleteAlliedAgent,
} from '@/lib/services/allied-agents.service';
import type { AlliedAgent } from '@/types/allied-agents';

export default function AlliedAgentsPage() {
  const [agents, setAgents] = useState<AlliedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AlliedAgent | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const data = await getAlliedAgents();
      setAgents(data);
    } catch (error) {
      toast.error('Error al cargar aliados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedAgent(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (agent: AlliedAgent) => {
    setSelectedAgent(agent);
    setFormDialogOpen(true);
  };

  const handleDelete = (agent: AlliedAgent) => {
    setSelectedAgent(agent);
    setDeleteDialogOpen(true);
  };

  const handleDocuments = (agent: AlliedAgent) => {
    setSelectedAgent(agent);
    setDocumentsDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedAgent?.id) return;
    
    setDeleting(true);
    try {
      await deleteAlliedAgent(selectedAgent.id);
      toast.success('Aliado desactivado exitosamente');
      setDeleteDialogOpen(false);
      loadAgents();
    } catch (error) {
      toast.error('Error al desactivar aliado');
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const handleFormSuccess = () => {
    setFormDialogOpen(false);
    loadAgents();
  };

  const filteredAgents = agents.filter(agent =>
    agent.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.identification.includes(searchTerm)
  );

  const countDocuments = (agent: AlliedAgent): number => {
    let count = 0;
    if (agent.document_cedula) count++;
    if (agent.document_bank_certificate) count++;
    if (agent.document_rut) count++;
    if (agent.document_other) count++;
    return count;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agentes Aliados</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona los agentes aliados de tu agencia
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Aliado
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, correo o identificación..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <p>No hay aliados registrados</p>
              <Button variant="link" onClick={handleCreate}>
                Crear el primer aliado
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Identificación</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.full_name}</TableCell>
                    <TableCell>{agent.identification}</TableCell>
                    <TableCell>{agent.email}</TableCell>
                    <TableCell>{agent.phone}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {agent.commission_percentage}% / {100 - agent.commission_percentage}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDocuments(agent)}>
                        <FileText className="h-4 w-4 mr-1" />
                        {countDocuments(agent)}/4
                      </Button>
                    </TableCell>
                    <TableCell>
                      {agent.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(agent)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(agent)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
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
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAgent ? 'Editar Aliado' : 'Nuevo Aliado'}</DialogTitle>
            <DialogDescription>
              {selectedAgent ? 'Actualiza los datos del aliado' : 'Completa los datos para registrar un nuevo aliado'}
            </DialogDescription>
          </DialogHeader>
          <AlliedAgentForm
            agent={selectedAgent}
            onSuccess={handleFormSuccess}
            onCancel={() => setFormDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Desactivación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas desactivar al aliado{' '}
              <strong>{selectedAgent?.full_name}</strong>?
              El aliado no podrá acceder al portal pero se mantendrá su historial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documents Dialog */}
      <Dialog open={documentsDialogOpen} onOpenChange={setDocumentsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Documentos de {selectedAgent?.full_name}</DialogTitle>
            <DialogDescription>Gestiona los documentos del aliado (máximo 4)</DialogDescription>
          </DialogHeader>
          {selectedAgent && (
            <AlliedAgentDocuments agent={selectedAgent} onUpdate={loadAgents} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
