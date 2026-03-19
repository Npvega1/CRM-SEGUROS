'use client';

// =====================================================
// COMPONENTE: CommissionRatesConfig
// Configuración de tasas de comisión por aseguradora/ramo
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type CommissionRate,
  type PolicyLine,
  CommissionRateInputSchema,
  LINE_LABELS,
  formatDate
} from '@/lib/validations/billing';
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  AlertCircle
} from 'lucide-react';

export function CommissionRatesConfig() {
  const { tenantId, role } = useTenant();
  
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [insurers, setInsurers] = useState<string[]>([]);
  
  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form
  const [formInsurer, setFormInsurer] = useState('');
  const [formLine, setFormLine] = useState<PolicyLine>('auto');
  const [formRatePct, setFormRatePct] = useState('');
  const [formEffectiveFrom, setFormEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [formEffectiveTo, setFormEffectiveTo] = useState('');

  const canEdit = role === 'admin' || role === 'senior_agent';

  const loadRates = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const supabase = getBrowserClient();
      
      const { data, error: queryError } = await supabase
        .from('commission_rates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('insurer')
        .order('line');
      
      if (queryError) {
        console.error('Error loading rates:', queryError);
      } else {
        setRates((data || []) as CommissionRate[]);
        
        // Extraer aseguradoras únicas
        const insurerSet = new Set((data || []).map((r: CommissionRate) => r.insurer));
        const uniqueInsurers = Array.from(insurerSet);
        setInsurers(uniqueInsurers);
      }
    } catch (err) {
      console.error('Error:', err);
    }
    setIsLoading(false);
  }, [tenantId]);

  // Cargar aseguradoras desde pólizas existentes
  const loadInsurersFromPolicies = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const supabase = getBrowserClient();
      const { data } = await supabase
        .from('policies')
        .select('insurer')
        .eq('tenant_id', tenantId);
      
      if (data) {
        const insurerSet = new Set(data.map((p: { insurer: string }) => p.insurer));
        const uniqueInsurers = Array.from(insurerSet);
        setInsurers(prev => {
          const combined = new Set([...prev, ...uniqueInsurers]);
          return Array.from(combined);
        });
      }
    } catch (err) {
      console.error('Error loading insurers:', err);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      loadRates();
      loadInsurersFromPolicies();
    }
  }, [tenantId, loadRates, loadInsurersFromPolicies]);

  const openNewModal = () => {
    setEditingRate(null);
    setFormInsurer('');
    setFormLine('auto');
    setFormRatePct('');
    setFormEffectiveFrom(new Date().toISOString().split('T')[0]);
    setFormEffectiveTo('');
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (rate: CommissionRate) => {
    setEditingRate(rate);
    setFormInsurer(rate.insurer);
    setFormLine(rate.line as PolicyLine);
    setFormRatePct(rate.rate_pct.toString());
    setFormEffectiveFrom(rate.effective_from);
    setFormEffectiveTo(rate.effective_to || '');
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!tenantId) return;
    
    setError(null);
    
    // Validar datos
    const validation = CommissionRateInputSchema.safeParse({
      insurer: formInsurer,
      line: formLine,
      rate_pct: parseFloat(formRatePct) || 0,
      effective_from: formEffectiveFrom,
      effective_to: formEffectiveTo || null
    });
    
    if (!validation.success) {
      const zodError = validation.error as { errors?: Array<{ message?: string }> };
      setError(zodError.errors?.[0]?.message || 'Datos inválidos');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const supabase = getBrowserClient();
      
      if (editingRate) {
        // Actualizar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('commission_rates')
          .update({
            insurer: formInsurer,
            line: formLine,
            rate_pct: parseFloat(formRatePct),
            effective_from: formEffectiveFrom,
            effective_to: formEffectiveTo || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingRate.id)
          .eq('tenant_id', tenantId);
        
        if (updateError) {
          setError('Error al actualizar la tasa');
          setIsSubmitting(false);
          return;
        }
      } else {
        // Crear
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from('commission_rates')
          .insert({
            tenant_id: tenantId,
            insurer: formInsurer,
            line: formLine,
            rate_pct: parseFloat(formRatePct),
            effective_from: formEffectiveFrom,
            effective_to: formEffectiveTo || null
          });
        
        if (insertError) {
          setError('Error al crear la tasa');
          setIsSubmitting(false);
          return;
        }
      }
      
      setShowModal(false);
      loadRates();
    } catch (err) {
      console.error('Error:', err);
      setError('Error al guardar');
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (rate: CommissionRate) => {
    if (!tenantId || !confirm('¿Estás seguro de eliminar esta tasa de comisión?')) return;
    
    try {
      const supabase = getBrowserClient();
      
      const { error: deleteError } = await supabase
        .from('commission_rates')
        .delete()
        .eq('id', rate.id)
        .eq('tenant_id', tenantId);
      
      if (deleteError) {
        console.error('Error deleting rate:', deleteError);
      } else {
        loadRates();
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const isRateActive = (rate: CommissionRate): boolean => {
    const today = new Date();
    const from = new Date(rate.effective_from);
    const to = rate.effective_to ? new Date(rate.effective_to) : null;
    
    if (from > today) return false;
    if (to && to < today) return false;
    return true;
  };

  // Agrupar por aseguradora
  const ratesByInsurer = rates.reduce((acc, rate) => {
    if (!acc[rate.insurer]) acc[rate.insurer] = [];
    acc[rate.insurer].push(rate);
    return acc;
  }, {} as Record<string, CommissionRate[]>);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Tasas de Comisión
              </CardTitle>
              <CardDescription>
                Configura las tasas de comisión por aseguradora y ramo
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={openNewModal} data-testid="new-rate-btn">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Tasa
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : rates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Settings className="h-12 w-12 mb-4 opacity-50" />
              <p>No hay tasas de comisión configuradas</p>
              {canEdit && (
                <Button variant="link" onClick={openNewModal}>
                  Agregar primera tasa
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(ratesByInsurer).map(([insurer, insurerRates]) => (
                <div key={insurer} className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 font-medium">
                    {insurer}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ramo</TableHead>
                        <TableHead className="text-center">Tasa %</TableHead>
                        <TableHead>Vigencia Desde</TableHead>
                        <TableHead>Vigencia Hasta</TableHead>
                        <TableHead>Estado</TableHead>
                        {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insurerRates.map((rate) => (
                        <TableRow key={rate.id} data-testid={`rate-row-${rate.id}`}>
                          <TableCell>
                            <Badge variant="outline">
                              {LINE_LABELS[rate.line] || rate.line}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-bold text-green-700">
                            {rate.rate_pct}%
                          </TableCell>
                          <TableCell>{formatDate(rate.effective_from)}</TableCell>
                          <TableCell>
                            {rate.effective_to ? formatDate(rate.effective_to) : 'Indefinido'}
                          </TableCell>
                          <TableCell>
                            {isRateActive(rate) ? (
                              <Badge className="bg-green-100 text-green-800">Activa</Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800">Inactiva</Badge>
                            )}
                          </TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditModal(rate)}
                                  data-testid={`edit-rate-${rate.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(rate)}
                                  className="text-red-600 hover:text-red-700"
                                  data-testid={`delete-rate-${rate.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Crear/Editar */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {editingRate ? 'Editar Tasa de Comisión' : 'Nueva Tasa de Comisión'}
            </DialogTitle>
            <DialogDescription>
              Define la tasa de comisión para una combinación de aseguradora y ramo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Aseguradora */}
            <div className="space-y-2">
              <Label htmlFor="insurer">Aseguradora *</Label>
              <div className="flex gap-2">
                <Select value={formInsurer} onValueChange={setFormInsurer}>
                  <SelectTrigger className="flex-1" data-testid="insurer-select">
                    <SelectValue placeholder="Seleccionar o escribir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {insurers.map(ins => (
                      <SelectItem key={ins} value={ins}>{ins}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="insurer"
                  placeholder="Nueva..."
                  value={formInsurer}
                  onChange={(e) => setFormInsurer(e.target.value)}
                  className="w-32"
                  data-testid="insurer-input"
                />
              </div>
            </div>

            {/* Ramo */}
            <div className="space-y-2">
              <Label htmlFor="line">Ramo *</Label>
              <Select value={formLine} onValueChange={(v) => setFormLine(v as PolicyLine)}>
                <SelectTrigger data-testid="line-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LINE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tasa */}
            <div className="space-y-2">
              <Label htmlFor="rate_pct">Tasa de Comisión (%) *</Label>
              <Input
                id="rate_pct"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Ej: 15"
                value={formRatePct}
                onChange={(e) => setFormRatePct(e.target.value)}
                data-testid="rate-pct-input"
              />
            </div>

            {/* Vigencia Desde */}
            <div className="space-y-2">
              <Label htmlFor="effective_from">Vigencia Desde *</Label>
              <Input
                id="effective_from"
                type="date"
                value={formEffectiveFrom}
                onChange={(e) => setFormEffectiveFrom(e.target.value)}
                data-testid="effective-from-input"
              />
            </div>

            {/* Vigencia Hasta */}
            <div className="space-y-2">
              <Label htmlFor="effective_to">Vigencia Hasta (opcional)</Label>
              <Input
                id="effective_to"
                type="date"
                value={formEffectiveTo}
                onChange={(e) => setFormEffectiveTo(e.target.value)}
                min={formEffectiveFrom}
                data-testid="effective-to-input"
              />
              <p className="text-xs text-muted-foreground">
                Dejar vacío para vigencia indefinida
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowModal(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !formInsurer || !formRatePct}
              data-testid="save-rate-btn"
            >
              {isSubmitting ? 'Guardando...' : editingRate ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CommissionRatesConfig;
