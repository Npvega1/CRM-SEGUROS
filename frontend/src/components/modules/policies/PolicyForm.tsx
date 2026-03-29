'use client';

// =====================================================
// COMPONENTE: PolicyForm
// Formulario para crear/editar pólizas
// Con selección en cascada, carga automática de comisión
// y formato de moneda ($1.000.000)
// =====================================================

import { useEffect, useState, useCallback } from 'react';
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
  type PolicyStatus
} from '@/lib/validations/policies';
import { Loader2, Save, X, Building, FileText, Upload, Trash2, File, Calendar, DollarSign } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';

// ✅ Solo estado "Activa" visible
const POLICY_STATUS_OPTIONS: { value: PolicyStatus; label: string }[] = [
  { value: 'activa', label: 'Activa' },
];

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

// Tipo para documentos - EXPORTADO
export interface PolicyDocument {
  id?: string;
  file: File | null;
  file_url?: string;
  file_name: string;
  document_type: 'poliza' | 'soporte';
  document_name: string;
}

// Tipo para el formulario
interface PolicyFormData {
  client_id: string;
  policy_number: string;
  anexo: string;
  insurer: string;
  insurer_id?: string;
  line: string;
  line_id?: string;
  group_id?: string;
  status: PolicyStatus;
  currency: string;
  premium: number;
  gastos_expedicion: number;
  iva: number;
  total_a_pagar: number;
  commission_pct: number;
  fecha_expedicion?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  metadata?: Record<string, unknown>;
}

interface PolicyFormProps {
  policy?: Policy;
  clientId?: string;
  onSubmit: (
    data: PolicyFormData,
    polizaDocuments: PolicyDocument[],
    soporteDocuments: PolicyDocument[]
  ) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

// Funciones para formatear moneda
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const parseCurrencyInput = (value: string): number => {
  const numericValue = value.replace(/[^0-9]/g, '');
  return parseInt(numericValue, 10) || 0;
};

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
  const [loadingCommission, setLoadingCommission] = useState(false);

  // Estados para selección en cascada
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Estados para documentos
  const [polizaDocuments, setPolizaDocuments] = useState<PolicyDocument[]>([]);
  const [soporteDocuments, setSoporteDocuments] = useState<PolicyDocument[]>([]);

  // Estados para valores formateados (display)
  const [displayPremium, setDisplayPremium] = useState('$0');
  const [displayGastos, setDisplayGastos] = useState('$0');
  const [displayIva, setDisplayIva] = useState('$0');
  const [displayTotal, setDisplayTotal] = useState('$0');

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      anexo: (policy as any).anexo || '00',
      insurer: policy.insurer,
      line: policy.line,
      status: policy.status as PolicyStatus,
      currency: policy.currency || 'COP',
      premium: policy.premium,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gastos_expedicion: (policy as any).gastos_expedicion || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iva: (policy as any).iva || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      total_a_pagar: (policy as any).total_a_pagar || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      commission_pct: (policy as any).commission_pct || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fecha_expedicion: (policy as any).fecha_expedicion || '',
      start_date: policy.start_date || '',
      end_date: policy.end_date || '',
    } : {
      client_id: clientId || '',
      anexo: '00',
      line: 'otro',
      status: 'activa',
      currency: 'COP',
      premium: 0,
      gastos_expedicion: 0,
      iva: 0,
      total_a_pagar: 0,
      commission_pct: 0
    }
  });

  const premium = watch('premium') || 0;
  const gastosExpedicion = watch('gastos_expedicion') || 0;
  const iva = watch('iva') || 0;
  const status = watch('status');
  const startDate = watch('start_date');

  // Inicializar displays formateados
  useEffect(() => {
    if (policy) {
      setDisplayPremium(formatCurrency(policy.premium || 0));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDisplayGastos(formatCurrency((policy as any).gastos_expedicion || 0));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDisplayIva(formatCurrency((policy as any).iva || 0));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDisplayTotal(formatCurrency((policy as any).total_a_pagar || 0));
    }
  }, [policy]);

  // Calcular total automáticamente y actualizar display
  useEffect(() => {
    const total = Number(premium) + Number(gastosExpedicion) + Number(iva);
    setValue('total_a_pagar', total);
    setDisplayTotal(formatCurrency(total));
  }, [premium, gastosExpedicion, iva, setValue]);

  // Handlers para inputs de moneda
  const handlePremiumChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseCurrencyInput(e.target.value);
    setValue('premium', numericValue);
    setDisplayPremium(formatCurrency(numericValue));
  }, [setValue]);

  const handleGastosChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseCurrencyInput(e.target.value);
    setValue('gastos_expedicion', numericValue);
    setDisplayGastos(formatCurrency(numericValue));
  }, [setValue]);

  const handleIvaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseCurrencyInput(e.target.value);
    setValue('iva', numericValue);
    setDisplayIva(formatCurrency(numericValue));
  }, [setValue]);

  // Cargar comisión cuando se selecciona compañía + ramo
  useEffect(() => {
    async function loadCommission() {
      if (!selectedCompanyId || !selectedGroupId) return;

      setLoadingCommission(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('company_group_commissions')
          .select('commission_pct')
          .eq('company_id', selectedCompanyId)
          .eq('group_id', selectedGroupId)
          .single();

        if (data && !error) {
          setValue('commission_pct', data.commission_pct);
        } else {
          setValue('commission_pct', 10);
        }
      } catch (err) {
        console.error('Error loading commission:', err);
        setValue('commission_pct', 10);
      } finally {
        setLoadingCommission(false);
      }
    }

    loadCommission();
  }, [selectedCompanyId, selectedGroupId, setValue, supabase]);

  // Cargar compañías activas del tenant
  useEffect(() => {
    async function loadTenantCompanies() {
      if (!tenantId) return;

      setLoadingCatalogs(true);
      try {
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

  // Auto-calcular fecha de vencimiento cuando cambia la fecha de inicio
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    setValue('start_date', newStartDate);

    if (newStartDate) {
      const start = new Date(newStartDate);
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      const endDateStr = end.toISOString().split('T')[0];
      setValue('end_date', endDateStr);
    }
  };

  // Manejo de documentos - Póliza
  const handlePolizaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 5 - polizaDocuments.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);

    const newDocs: PolicyDocument[] = filesToAdd.map(file => ({
      file,
      file_name: file.name,
      document_type: 'poliza',
      document_name: 'Póliza'
    }));

    setPolizaDocuments(prev => [...prev, ...newDocs]);
    e.target.value = '';
  };

  // Manejo de documentos - Soporte
  const handleSoporteFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 8 - soporteDocuments.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);

    const newDocs: PolicyDocument[] = filesToAdd.map(file => ({
      file,
      file_name: file.name,
      document_type: 'soporte',
      document_name: file.name.split('.')[0]
    }));

    setSoporteDocuments(prev => [...prev, ...newDocs]);
    e.target.value = '';
  };

  const removePolizaDoc = (index: number) => {
    setPolizaDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const removeSoporteDoc = (index: number) => {
    setSoporteDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = async (data: PolicyFormData) => {
    console.log('Form data submitted:', data);
    console.log('Poliza documents:', polizaDocuments);
    console.log('Soporte documents:', soporteDocuments);
    await onSubmit(data, polizaDocuments, soporteDocuments);
  };

  const onError = (errors: Record<string, unknown>) => {
    console.error('Form validation errors:', errors);
  };

  const loading = isLoading || isSubmitting;

  // Generar opciones de anexo (00-99)
  const anexoOptions = Array.from({ length: 100 }, (_, i) =>
    i.toString().padStart(2, '0')
  );

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-6">
      {/* Client ID (oculto) */}
      <input type="hidden" {...register('client_id')} />

      {/* ============================================= */}
      {/* SECCIÓN 1: Número de Póliza + Anexo + Estado */}
      {/* ============================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="policy_number">Número de Póliza *</Label>
          <Input
            id="policy_number"
            placeholder="POL-2024-001"
            {...register('policy_number')}
            disabled={loading}
            className="text-lg"
          />
          {errors.policy_number && (
            <p className="text-sm text-destructive">
              {errors.policy_number.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Anexo</Label>
          <Select
            value={watch('anexo') || '00'}
            onValueChange={(value) => setValue('anexo', value)}
            disabled={loading}
          >
            <SelectTrigger className="text-lg">
              <SelectValue placeholder="00" />
            </SelectTrigger>
            <SelectContent>
              {anexoOptions.map((num) => (
                <SelectItem key={num} value={num}>
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Estado *</Label>
          <Select
            value={status}
            onValueChange={(value) => setValue('status', value as PolicyStatus)}
            disabled={loading || isEditing}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              {POLICY_STATUS_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ============================================= */}
      {/* SECCIÓN 2: Selección de Producto */}
      {/* ============================================= */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Building className="h-5 w-5 text-primary" />
          <span>Selección de Producto</span>
        </div>

        {loadingCatalogs ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Cargando catálogos...</span>
          </div>
        ) : tenantCompanies.length === 0 ? (
          <div className="text-amber-600 bg-amber-50 p-3 rounded-md">
            <p className="font-medium">No tienes compañías activas configuradas.</p>
            <p className="text-sm">Ve a Configuración → Compañías para activarlas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Compañía */}
            <div className="space-y-2">
              <Label>Compañía *</Label>
              <Select
                value={selectedCompanyId}
                onValueChange={(value) => {
                  setSelectedCompanyId(value);
                  setSelectedLineId('');
                  setSelectedGroupId('');
                }}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar compañía" />
                </SelectTrigger>
                <SelectContent>
                  {tenantCompanies.map((tc) => (
                    <SelectItem key={tc.company_id} value={tc.company_id}>
                      <span className="flex items-center gap-2">
                        {tc.company.name}
                        {tc.company_code && (
                          <span className="text-xs text-muted-foreground">({tc.company_code})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grupo */}
            <div className="space-y-2">
              <Label>Grupo *</Label>
              <Select
                value={selectedLineId}
                onValueChange={(value) => {
                  setSelectedLineId(value);
                  setSelectedGroupId('');
                }}
                disabled={loading || !selectedCompanyId || availableLines.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!selectedCompanyId ? 'Primero selecciona compañía' : 'Seleccionar grupo'} />
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

            {/* Ramo */}
            <div className="space-y-2">
              <Label>Ramo *</Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
                disabled={loading || !selectedLineId || availableGroups.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!selectedLineId ? 'Primero selecciona grupo' : 'Seleccionar ramo'} />
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

        {/* Campos ocultos */}
        <input type="hidden" {...register('insurer')} />
        <input type="hidden" {...register('insurer_id')} />
        <input type="hidden" {...register('line')} />
        <input type="hidden" {...register('line_id')} />
        <input type="hidden" {...register('group_id')} />
      </div>

      {/* ============================================= */}
      {/* SECCIÓN 3: Fechas */}
      {/* ============================================= */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-primary" />
          <span>Fechas</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Fecha de Expedición</Label>
            <Input
              type="date"
              {...register('fecha_expedicion')}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha de Inicio</Label>
            <Input
              type="date"
              value={startDate || ''}
              onChange={handleStartDateChange}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">Al cambiar, se calcula vencimiento a 1 año</p>
          </div>

          <div className="space-y-2">
            <Label>Fecha de Vencimiento</Label>
            <Input
              type="date"
              {...register('end_date')}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* SECCIÓN 4: Valores de la Póliza */}
      {/* ============================================= */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <DollarSign className="h-5 w-5 text-primary" />
          <span>Valores de la Póliza</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Moneda */}
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select
              value={watch('currency') || 'COP'}
              onValueChange={(value) => setValue('currency', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COP">COP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prima */}
          <div className="space-y-2">
            <Label>Prima *</Label>
            <Input
              type="text"
              placeholder="$0"
              value={displayPremium}
              onChange={handlePremiumChange}
              disabled={loading}
              className="text-right font-semibold"
            />
            <input type="hidden" {...register('premium', { valueAsNumber: true })} />
          </div>

          {/* Gastos Expedición */}
          <div className="space-y-2">
            <Label>Gastos Exp.</Label>
            <Input
              type="text"
              placeholder="$0"
              value={displayGastos}
              onChange={handleGastosChange}
              disabled={loading}
              className="text-right"
            />
            <input type="hidden" {...register('gastos_expedicion', { valueAsNumber: true })} />
          </div>

          {/* IVA */}
          <div className="space-y-2">
            <Label>IVA</Label>
            <Input
              type="text"
              placeholder="$0"
              value={displayIva}
              onChange={handleIvaChange}
              disabled={loading}
              className="text-right"
            />
            <input type="hidden" {...register('iva', { valueAsNumber: true })} />
          </div>

          {/* Total */}
          <div className="space-y-2">
            <Label>Total</Label>
            <Input
              type="text"
              value={displayTotal}
              disabled
              className="bg-primary/10 font-bold text-right text-primary"
            />
            <input type="hidden" {...register('total_a_pagar', { valueAsNumber: true })} />
          </div>

          {/* Comisión */}
          <div className="space-y-2">
            <Label>Comisión %</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                placeholder="10.00"
                {...register('commission_pct', { valueAsNumber: true })}
                disabled={loading}
                className="text-right"
              />
              {loadingCommission && <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3" />}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          El total se calcula automáticamente. La comisión se carga según la compañía y ramo seleccionados.
        </p>
      </div>

      {/* ============================================= */}
      {/* SECCIÓN 5: Documentos Adjuntos */}
      {/* ============================================= */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5 text-primary" />
          <span>Documentos Adjuntos</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Documentos de Póliza */}
          <div className="p-4 border rounded-lg bg-background">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium">Documentos de Póliza</h4>
                <p className="text-xs text-muted-foreground">PDF de la póliza emitida</p>
              </div>
              <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                {polizaDocuments.length} / 5
              </span>
            </div>

            {polizaDocuments.length < 5 && (
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Seleccionar archivos</span>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handlePolizaFileChange}
                  disabled={loading}
                  className="hidden"
                  multiple
                />
              </label>
            )}

            {polizaDocuments.length > 0 && (
              <div className="mt-3 space-y-2">
                {polizaDocuments.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2 min-w-0">
                      <File className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span className="text-sm truncate">{doc.file_name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePolizaDoc(index)}
                      disabled={loading}
                      className="h-7 w-7 p-0 hover:bg-red-100 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documentos de Soporte */}
          <div className="p-4 border rounded-lg bg-background">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium">Documentos de Soporte</h4>
                <p className="text-xs text-muted-foreground">Sarlaft, Cédula, CCB, RUT, Estados Financieros</p>
              </div>
              <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                {soporteDocuments.length} / 8
              </span>
            </div>

            {soporteDocuments.length < 8 && (
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Seleccionar archivos</span>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleSoporteFileChange}
                  disabled={loading}
                  className="hidden"
                  multiple
                />
              </label>
            )}

            {soporteDocuments.length > 0 && (
              <div className="mt-3 space-y-2">
                {soporteDocuments.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2 min-w-0">
                      <File className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm truncate">{doc.file_name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSoporteDoc(index)}
                      disabled={loading}
                      className="h-7 w-7 p-0 hover:bg-red-100 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* Botones */}
      {/* ============================================= */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading} size="lg">
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isEditing ? 'Guardar Cambios' : 'Crear Póliza'}
        </Button>
      </div>
    </form>
  );
