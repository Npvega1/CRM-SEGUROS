'use client';

// =====================================================
// COMPONENTE: PolicyForm
// Formulario para crear/editar pólizas
// =====================================================

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  CreatePolicyInputSchema,
  type Policy,
  POLICY_LINE_LABELS,
  POLICY_STATUS_LABELS,
  type PolicyLine,
  type PolicyStatus
} from '@/lib/validations/policies';
import { Loader2, Save, X } from 'lucide-react';

// Tipo para el formulario
interface PolicyFormData {
  client_id: string;
  policy_number: string;
  insurer: string;
  line: PolicyLine;
  status: PolicyStatus;
  premium: number;
  currency?: string;
  start_date?: string | null;
  end_date?: string | null;
  commission_pct?: number;
  metadata?: Record<string, unknown>;
}

interface PolicyFormProps {
  policy?: Policy;
  clientId?: string;
  onSubmit: (data: PolicyFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function PolicyForm({
  policy,
  clientId,
  onSubmit,
  onCancel,
  isLoading = false
}: PolicyFormProps) {
  const isEditing = !!policy;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<PolicyFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(CreatePolicyInputSchema) as any,
    defaultValues: policy ? {
      client_id: policy.client_id,
      policy_number: policy.policy_number,
      insurer: policy.insurer,
      line: policy.line as PolicyLine,
      status: policy.status as PolicyStatus,
      premium: policy.premium,
      currency: policy.currency || 'COP',
      start_date: policy.start_date || '',
      end_date: policy.end_date || '',
      commission_pct: policy.commission_pct || 0
    } : {
      client_id: clientId || '',
      line: 'otro',
      status: 'cotizacion',
      currency: 'COP',
      premium: 0,
      commission_pct: 0
    }
  });

  // Actualizar client_id cuando cambie la prop
  useEffect(() => {
    if (clientId && !isEditing) {
      setValue('client_id', clientId);
    }
  }, [clientId, isEditing, setValue]);

  const line = watch('line');
  const status = watch('status');
  const startDate = watch('start_date');

  // Auto-calcular fecha de vencimiento cuando cambia la fecha de inicio
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    setValue('start_date', newStartDate);
    
    // Si hay fecha de inicio, calcular vencimiento = inicio + 1 año
    if (newStartDate) {
      const start = new Date(newStartDate);
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      
      // Formatear como YYYY-MM-DD
      const endDateStr = end.toISOString().split('T')[0];
      setValue('end_date', endDateStr);
    }
  };

  const handleFormSubmit = async (data: PolicyFormData) => {
    console.log('Form data submitted:', data);
    await onSubmit(data);
  };

  // Mostrar errores de validación en consola para debug
  const onError = (errors: Record<string, unknown>) => {
    console.error('Form validation errors:', errors);
  };

  const loading = isLoading || isSubmitting;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-6">
      {/* Client ID (oculto si viene predefinido) */}
      <input type="hidden" {...register('client_id')} />

      {/* Número de Póliza e Insurer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="policy_number">Número de Póliza *</Label>
          <Input
            id="policy_number"
            placeholder="Ej: POL-2024-001"
            {...register('policy_number')}
            disabled={loading}
            data-testid="policy-number-input"
          />
          {errors.policy_number && (
            <p className="text-sm text-red-500">{errors.policy_number.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="insurer">Aseguradora *</Label>
          <Input
            id="insurer"
            placeholder="Ej: Seguros Bolívar"
            {...register('insurer')}
            disabled={loading}
            data-testid="policy-insurer-input"
          />
          {errors.insurer && (
            <p className="text-sm text-red-500">{errors.insurer.message}</p>
          )}
        </div>
      </div>

      {/* Línea y Estado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="line">Línea de Seguro *</Label>
          <Select
            value={line}
            onValueChange={(value: PolicyLine) => setValue('line', value)}
            disabled={loading}
          >
            <SelectTrigger id="line" data-testid="policy-line-select">
              <SelectValue placeholder="Seleccionar línea" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(POLICY_LINE_LABELS) as [PolicyLine, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.line && (
            <p className="text-sm text-red-500">{errors.line.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Estado *</Label>
          <Select
            value={status}
            onValueChange={(value: PolicyStatus) => setValue('status', value)}
            disabled={loading || isEditing} // No editar estado directamente
          >
            <SelectTrigger id="status" data-testid="policy-status-select">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(POLICY_STATUS_LABELS) as [PolicyStatus, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isEditing && (
            <p className="text-xs text-muted-foreground">
              Para cambiar el estado, usa el stepper de estados
            </p>
          )}
        </div>
      </div>

      {/* Prima y Comisión */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="premium">Prima *</Label>
          <Input
            id="premium"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('premium', { valueAsNumber: true })}
            disabled={loading}
            data-testid="policy-premium-input"
          />
          {errors.premium && (
            <p className="text-sm text-red-500">{errors.premium.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Moneda</Label>
          <Select
            value={watch('currency') || 'COP'}
            onValueChange={(value) => setValue('currency', value)}
            disabled={loading}
          >
            <SelectTrigger id="currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COP">COP</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="commission_pct">Comisión %</Label>
          <Input
            id="commission_pct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="0.00"
            {...register('commission_pct', { valueAsNumber: true })}
            disabled={loading}
            data-testid="policy-commission-input"
          />
          {errors.commission_pct && (
            <p className="text-sm text-red-500">{errors.commission_pct.message}</p>
          )}
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Fecha de Inicio</Label>
          <Input
            id="start_date"
            type="date"
            value={startDate || ''}
            onChange={handleStartDateChange}
            disabled={loading}
            data-testid="policy-start-date-input"
          />
          <p className="text-xs text-muted-foreground">
            Al cambiar, se calcula automáticamente el vencimiento a 1 año
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date">Fecha de Vencimiento</Label>
          <Input
            id="end_date"
            type="date"
            {...register('end_date')}
            disabled={loading}
            data-testid="policy-end-date-input"
          />
          <p className="text-xs text-muted-foreground">
            Puedes ajustar manualmente si la póliza no es anual
          </p>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading} data-testid="policy-submit-button">
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isEditing ? 'Guardar Cambios' : 'Crear Póliza'}
        </Button>
      </div>
    </form>
  );
}
