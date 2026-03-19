'use client';

// =====================================================
// COMPONENTE: CreateOpportunityForm
// Formulario para crear nueva oportunidad
// =====================================================

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus } from 'lucide-react';
import type { PipelineStage, CreateOpportunityInput } from '@/lib/validations/pipeline';
import type { Client } from '@/lib/validations/clients';
import { POLICY_LINE_LABELS, PolicyLine } from '@/lib/validations/policies';

interface CreateOpportunityFormProps {
  open: boolean;
  stages: PipelineStage[];
  onClose: () => void;
  onSubmit: (data: CreateOpportunityInput) => Promise<void>;
}

export function CreateOpportunityForm({
  open,
  stages,
  onClose,
  onSubmit
}: CreateOpportunityFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Búsqueda de clientes
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Form data
  const [formData, setFormData] = useState<{
    stage_id: string;
    line: PolicyLine;
    estimated_premium: string;
    close_probability: string;
    expected_close_date: string;
    notes: string;
  }>({
    stage_id: '',
    line: 'otro',
    estimated_premium: '',
    close_probability: '50',
    expected_close_date: '',
    notes: ''
  });

  // Establecer etapa inicial
  useEffect(() => {
    if (stages.length > 0 && !formData.stage_id) {
      const firstStage = stages.find(s => 
        !s.name.toLowerCase().includes('ganado') && 
        !s.name.toLowerCase().includes('perdido')
      );
      if (firstStage) {
        setFormData(prev => ({ ...prev, stage_id: firstStage.id }));
      }
    }
  }, [stages, formData.stage_id]);

  // Buscar clientes
  useEffect(() => {
    const searchClients = async () => {
      if (clientSearch.length < 2) {
        setClients([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(`/api/clientes?search=${encodeURIComponent(clientSearch)}&pageSize=10`);
        if (response.ok) {
          const data = await response.json();
          setClients(data.clients || []);
        }
      } catch (e) {
        console.error('Error searching clients:', e);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchClients, 300);
    return () => clearTimeout(timeoutId);
  }, [clientSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClient) {
      setError('Debe seleccionar un cliente');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        client_id: selectedClient.id,
        stage_id: formData.stage_id,
        line: formData.line,
        estimated_premium: parseFloat(formData.estimated_premium) || 0,
        close_probability: parseInt(formData.close_probability) || 50,
        expected_close_date: formData.expected_close_date || null,
        notes: formData.notes || null
      });
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      stage_id: stages[0]?.id || '',
      line: 'otro',
      estimated_premium: '',
      close_probability: '50',
      expected_close_date: '',
      notes: ''
    });
    setSelectedClient(null);
    setClientSearch('');
    setClients([]);
    setError(null);
    onClose();
  };

  const selectableStages = stages.filter(s => 
    !s.name.toLowerCase().includes('ganado') && 
    !s.name.toLowerCase().includes('perdido')
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="create-opportunity-modal">
        <DialogHeader>
          <DialogTitle>Nueva Oportunidad</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Búsqueda de cliente */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            {selectedClient ? (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{selectedClient.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedClient.doc_number} · {selectedClient.segment}
                  </p>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedClient(null)}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente por nombre o documento..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-10"
                  data-testid="client-search-input"
                />
                {(clients.length > 0 || isSearching) && (
                  <div className="absolute z-10 w-full mt-1 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {isSearching ? (
                      <div className="p-3 text-sm text-muted-foreground">Buscando...</div>
                    ) : (
                      clients.map(client => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full text-left p-3 hover:bg-muted/50 border-b last:border-b-0"
                          onClick={() => {
                            setSelectedClient(client);
                            setClientSearch('');
                            setClients([]);
                          }}
                        >
                          <p className="font-medium">{client.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {client.doc_number}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Etapa */}
            <div className="space-y-2">
              <Label htmlFor="opp-stage">Etapa *</Label>
              <Select
                value={formData.stage_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, stage_id: value }))}
              >
                <SelectTrigger id="opp-stage">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {selectableStages.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ramo */}
            <div className="space-y-2">
              <Label htmlFor="opp-line">Ramo</Label>
              <Select
                value={formData.line}
                onValueChange={(value) => setFormData(prev => ({ ...prev, line: value as PolicyLine }))}
              >
                <SelectTrigger id="opp-line">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(POLICY_LINE_LABELS) as PolicyLine[]).map(line => (
                    <SelectItem key={line} value={line}>
                      {POLICY_LINE_LABELS[line]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prima estimada */}
            <div className="space-y-2">
              <Label htmlFor="opp-premium">Prima Estimada *</Label>
              <Input
                id="opp-premium"
                type="number"
                placeholder="0"
                value={formData.estimated_premium}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_premium: e.target.value }))}
                data-testid="estimated-premium-input"
              />
            </div>

            {/* Probabilidad */}
            <div className="space-y-2">
              <Label htmlFor="opp-probability">Probabilidad (%)</Label>
              <Input
                id="opp-probability"
                type="number"
                min="0"
                max="100"
                value={formData.close_probability}
                onChange={(e) => setFormData(prev => ({ ...prev, close_probability: e.target.value }))}
              />
            </div>

            {/* Fecha esperada */}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="opp-date">Fecha Esperada de Cierre</Label>
              <Input
                id="opp-date"
                type="date"
                value={formData.expected_close_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expected_close_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="opp-notes">Notas</Label>
            <Textarea
              id="opp-notes"
              placeholder="Información adicional sobre la oportunidad..."
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !selectedClient || !formData.stage_id}
              data-testid="submit-opportunity-btn"
            >
              <Plus className="h-4 w-4 mr-1" />
              {isSubmitting ? 'Creando...' : 'Crear Oportunidad'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
