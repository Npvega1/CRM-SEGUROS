'use client';

// =====================================================
// COMPONENTE: PolicyForm
// Formulario para crear/editar pólizas
// Con selección en cascada: Compañía → Grupo → Ramo
// =====================================================

import { useEffect, useState } from 'react';
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
  POLICY_STATUS_LABELS,
  type PolicyStatus
} from '@/lib/validations/policies';
import { Loader2, Save, X, Building, Layers, FileText } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';

// Tipos para catálogos de seguros
interface InsuranceCompany {
  id: string;
  name: string;
  slug: string;
}

interface InsuranceLine {
  id: string;
  name: string;
  slug: string;
  unit: string;
}

interface InsuranceGroup {
  id: string;
  name: string;
  slug: string;
  line_id: string;
}

interface TenantCompany {
  company_id: string;
  is_active: boolean;
  company_code: string | null;
  company: InsuranceCompany;
}

// Tipo para el formulario
interface PolicyFormData {
  client_id: string;
  policy_number: string;
  insurer: string;
  insurer_id?: string;
  line: string;
  line_id?: string;
  group_id?: string;
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
  const { tenantId } = useTenant();
  const supabase = createClient();

  // Estados para catálogos
  const [tenantCompanies, setTenantCompanies] = useState<TenantCompany[]>([]);
  const [availableLines, setAvailableLines] = useState<InsuranceLine[]>([]);
  const [availableGroups, setAvailableGroups] = useState<InsuranceGroup[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);

  // Estados para selección en cascada
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

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
      line: policy.line,
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

  // Cargar compañías activas del tenant
  useEffect(() => {
    async function loadTenantCompanies() {
      if (!tenantId) return;
      setLoadingCatalogs(true);

      try {
        // Cargar compañías activas del tenant con datos de la compañía
        const { data: tcData } = await (supabase.from('tenant_companies') as ReturnType<typeof supabase.from>)
          .select(`
            company_id,
            is_active,
            company_code,
            company:insurance_companies(id, name, slug)
          `)
          .eq('tenant_id', tenantId)
          .eq('is_active', true);

        if (tcData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formattedData = tcData.map((tc: any) => ({
            company_id: tc.company_id,
            is_active: tc.is_active,
            company_code: tc.company_code,
            company: tc.company
          }));
          setTenantCompanies(formattedData);
        }
      } catch (error) {
        console.error('Error loading tenant companies:', error);
      } finally {
        setLoadingCatalogs(false);
      }
    }

    loadTenantCompanies();
  }, [tenantId, supabase]);

  // Cargar grupos (líneas) cuando se selecciona una compañía
  useEffect(() => {
    async function loadLinesForCompany() {
      if (!selectedCompanyId) {
        setAvailableLines([]);
        setSelectedLineId('');
        return;
      }

      try {
        // Cargar líneas disponibles para esta compañía
        const { data: clData } = await (supabase.from('company_lines') as ReturnType<typeof supabase.from>)
          .select(`
            line_id,
            line:insurance_lines(id, name, slug, unit)
          `)
          .eq('company_id', selectedCompanyId)
          .eq('is_active', true);

        if (clData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lines = clData.map((cl: any) => cl.line).filter(Boolean);
          setAvailableLines(lines);
        }
      } catch (error) {
        console.error('Error loading lines:', error);
      }
    }

    loadLinesForCompany();
  }, [selectedCompanyId, supabase]);

  // Cargar ramos cuando se selecciona un grupo (línea)
  useEffect(() => {
    async function loadGroupsForLine() {
      if (!selectedLineId) {
        setAvailableGroups([]);
        setSelectedGroupId('');
        return;
      }

      try {
        const { data: groupsData } = await (supabase.from('insurance_groups') as ReturnType<typeof supabase.from>)
          .select('id, name, slug, line_id')
          .eq('line_id', selectedLineId)
          .eq('is_active', true)
          .order('display_order');

        if (groupsData) {
          setAvailableGroups(groupsData as InsuranceGroup[]);
        }
      } catch (error) {
        console.error('Error loading groups:', error);
      }
    }

    loadGroupsForLine();
  }, [selectedLineId, supabase]);

  // Actualizar valores del formulario cuando cambian las selecciones
  useEffect(() => {
    if (selectedCompanyId) {
      const company = tenantCompanies.find(tc => tc.company_id === selectedCompanyId)?.company;
      if (company) {
        setValue('insurer', company.name);
        setValue('insurer_id', company.id);
      }
    }
  }, [selectedCompanyId, tenantCompanies, setValue]);

  useEffect(() => {
    if (selectedLineId) {
      const line = availableLines.find(l => l.id === selectedLineId);
      if (line) {
        setValue('line', line.slug);
        setValue('line_id', line.id);
      }
    }
  }, [selectedLineId, availableLines, setValue]);

  useEffect(() => {
    if (selectedGroupId) {
      setValue('group_id', selectedGroupId);
    }
  }, [selectedGroupId, setValue]);

  // Actualizar client_id cuando cambie la prop
  useEffect(() => {
    if (clientId && !isEditing) {
      setValue('client_id', clientId);
    }
  }, [clientId, isEditing, setValue]);

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

      {/* Número de Póliza */}
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

      {/* Selección en cascada: Compañía → Grupo → Ramo */}
      <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Building className="h-4 w-4" />
          Selección de Producto
        </div>
        
        {loadingCatalogs ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Cargando catálogos...</span>
          </div>
        ) : tenantCompanies.length === 0 ? (
          <div className="text-center py-4 text-amber-600 bg-amber-50 rounded-lg">
            <p className="text-sm">No tienes compañías activas configuradas.</p>
            <p className="text-xs mt-1">Ve a Configuración → Compañías para activarlas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Compañía */}
            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-1">
                <Building className="h-3 w-3" />
                Compañía *
              </Label>
              <Select
                value={selectedCompanyId}
                onValueChange={(value) => {
                  setSelectedCompanyId(value);
                  setSelectedLineId('');
                  setSelectedGroupId('');
                }}
                disabled={loading}
              >
                <SelectTrigger id="company" data-testid="policy-company-select">
                  <SelectValue placeholder="Seleccionar compañía" />
                </SelectTrigger>
                <SelectContent>
                  {tenantCompanies.map((tc) => (
                    <SelectItem key={tc.company_id} value={tc.company_id}>
                      {tc.company.name}
                      {tc.company_code && (
                        <span className="text-muted-foreground ml-2">({tc.company_code})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grupo (Línea de seguro) */}
            <div className="space-y-2">
              <Label htmlFor="line" className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                Grupo *
              </Label>
              <Select
                value={selectedLineId}
                onValueChange={(value) => {
                  setSelectedLineId(value);
                  setSelectedGroupId('');
                }}
                disabled={loading || !selectedCompanyId || availableLines.length === 0}
              >
                <SelectTrigger id="line" data-testid="policy-line-select">
                  <SelectValue placeholder={!selectedCompanyId ? "Primero selecciona compañía" : "Seleccionar grupo"} />
                </SelectTrigger>
                <SelectContent>
                  {availableLines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ramo (Grupo de seguro) */}
            <div className="space-y-2">
              <Label htmlFor="group" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Ramo *
              </Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
                disabled={loading || !selectedLineId || availableGroups.length === 0}
              >
                <SelectTrigger id="group" data-testid="policy-group-select">
                  <SelectValue placeholder={!selectedLineId ? "Primero selecciona grupo" : "Seleccionar ramo"} />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        
        {/* Campos ocultos para el formulario */}
        <input type="hidden" {...register('insurer')} />
        <input type="hidden" {...register('line')} />
      </div>

      {/* Estado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Estado *</Label>
          <Select
            value={status}
            onValueChange={(value: PolicyStatus) => setValue('status', value)}
            disabled={loading || isEditing}
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
