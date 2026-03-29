'use client';

// =====================================================
// COMPONENTE: PolicyForm
// Formulario para crear/editar pólizas
// Con selección en cascada y carga automática de comisión
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
  type PolicyStatus
} from '@/lib/validations/policies';
import { Loader2, Save, X, Building, Layers, FileText, Upload, Trash2, File, Calendar } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';

// Labels para estados (sin cotización)
const POLICY_STATUS_OPTIONS: { value: PolicyStatus; label: string }[] = [
  { value: 'activa', label: 'Activa' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'renovacion', label: 'En Renovación' },
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

// Tipo para documentos
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
  // ✅ ACTUALIZADO: onSubmit ahora recibe los documentos
  onSubmit: (
    data: PolicyFormData, 
    polizaDocuments: PolicyDocument[], 
    soporteDocuments: PolicyDocument[]
  ) => Promise<void>;
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
  const [loadingCommission, setLoadingCommission] = useState(false);

  // Estados para selección en cascada
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Estados para documentos
  const [polizaDocuments, setPolizaDocuments] = useState<PolicyDocument[]>([]);
  const [soporteDocuments, setSoporteDocuments] = useState<PolicyDocument[]>([]);

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

  // Calcular total automáticamente
  useEffect(() => {
    const total = Number(premium) + Number(gastosExpedicion) + Number(iva);
    setValue('total_a_pagar', total);
  }, [premium, gastosExpedicion, iva, setValue]);

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
          // Si no hay comisión configurada, usar 10% por defecto
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

  // ✅ CORREGIDO: Ahora pasa los documentos al onSubmit
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

      {/* Número de Póliza + Anexo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="policy_number">Número de Póliza *</Label>
          <Input
            id="policy_number"
            placeholder="POL-2024-001"
            {...register('policy_number')}
            disabled={loading}
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
            <SelectTrigger>
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
      </div>

      {/* Selección en cascada: Compañía → Grupo → Ramo */}
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

            {/* Grupo (Línea de seguro) */}
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

            {/* Ramo (Grupo de seguro) */}
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

      {/* Estado */}
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
        {isEditing && (
          <p className="text-xs text-muted-foreground">
            Para cambiar el estado, usa el stepper de estados
          </p>
        )}
      </div>

      {/* Valores de la Póliza */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Layers className="h-5 w-5 text-primary" />
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
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('premium', { valueAsNumber: true })}
              disabled={loading}
            />
          </div>

          {/* Gastos Expedición */}
          <div className="space-y-2">
            <Label>Gastos Exp.</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('gastos_expedicion', { valueAsNumber: true })}
              disabled={loading}
            />
          </div>

          {/* IVA */}
          <div className="space-y-2">
            <Label>IVA</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('iva', { valueAsNumber: true })}
              disabled={loading}
            />
          </div>

          {/* Total */}
          <div className="space-y-2">
            <Label>Total</Label>
            <Input
              type="number"
              step="0.01"
              {...register('total_a_pagar', { valueAsNumber: true })}
              disabled
              className="bg-muted font-semibold"
            />
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
              />
              {loadingCommission && <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3" />}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          El total se calcula automáticamente. La comisión se carga según la compañía y ramo seleccionados (modificable).
        </p>
      </div>

      {/* Fechas: Expedición, Inicio, Vencimiento */}
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
            <p className="text-xs text-muted-foreground">Fecha en que se expide la póliza</p>
          </div>

          <div className="space-y-2">
            <Label>Fecha de Inicio</Label>
            <Input
              type="date"
              value={startDate || ''}
              onChange={handleStartDateChange}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">Al cambiar, se calcula el vencimiento a 1 año</p>
          </div>

          <div className="space-y-2">
            <Label>Fecha de Vencimiento</Label>
            <Input
              type="date"
              {...register('end_date')}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">Puedes ajustar manualmente</p>
          </div>
        </div>
      </div>

      {/* Documentos Adjuntos */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5 text-primary" />
          <span>Documentos Adjuntos</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Documentos de Póliza */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Documentos de Póliza</Label>
              <span className="text-xs text-muted-foreground">{polizaDocuments.length} / 5</span>
            </div>

            {polizaDocuments.length < 5 && (
              <div className="relative">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handlePolizaFileChange}
                  disabled={loading}
                  className="cursor-pointer"
                  multiple
                />
                <Upload className="h-4 w-4 absolute right-3 top-3 text-muted-foreground pointer-events-none" />
              </div>
            )}

            {polizaDocuments.length > 0 && (
              <div className="space-y-2">
                {polizaDocuments.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-blue-600" />
                      <span className="text-sm truncate max-w-[200px]">{doc.file_name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePolizaDoc(index)}
                      disabled={loading}
                      className="h-8 w-8 p-0 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documentos de Soporte */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Documentos de Soporte</Label>
              <span className="text-xs text-muted-foreground">{soporteDocuments.length} / 8</span>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Sarlaft, Cédula, CCB, RUT, Estados Financieros
            </p>

            {soporteDocuments.length < 8 && (
              <div className="relative">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleSoporteFileChange}
                  disabled={loading}
                  className="cursor-pointer"
                  multiple
                />
                <Upload className="h-4 w-4 absolute right-3 top-3 text-muted-foreground pointer-events-none" />
              </div>
            )}

            {soporteDocuments.length > 0 && (
              <div className="space-y-2">
                {soporteDocuments.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-green-600" />
                      <span className="text-sm truncate max-w-[200px]">{doc.file_name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSoporteDoc(index)}
                      disabled={loading}
                      className="h-8 w-8 p-0 hover:bg-red-100"
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

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading}>
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
}
