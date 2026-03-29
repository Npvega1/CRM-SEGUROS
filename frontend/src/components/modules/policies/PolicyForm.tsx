'use client';

// =====================================================
// COMPONENTE: PolicyForm
// Formulario para crear/editar pólizas
// Orden: Datos básicos → Producto → Fechas → Valores → Documentos
// Valores con formato de miles (1.000.000)
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
import { Loader2, Save, X, Building, Layers, FileText, Upload, Trash2, File, Calendar, User } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';

// Función para formatear número con separadores de miles (punto)
const formatNumber = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('es-CO', { maximumFractionDigits: 0 });
};

// Función para parsear número formateado a número real
const parseFormattedNumber = (value: string): number => {
  if (!value) return 0;
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

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
interface PolicyDocument {
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

// Tipo para cliente
interface ClientInfo {
  id: string;
  full_name: string;
  document_number?: string;
  email?: string;
}

interface PolicyFormProps {
  policy?: Policy;
  clientId?: string;
  clientInfo?: ClientInfo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: (data: any) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function PolicyForm({
  policy,
  clientId,
  clientInfo,
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
  const [displayPremium, setDisplayPremium] = useState('');
  const [displayGastos, setDisplayGastos] = useState('');
  const [displayIva, setDisplayIva] = useState('');
  const [displayTotal, setDisplayTotal] = useState('');

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

  // Inicializar valores formateados
  useEffect(() => {
    if (policy) {
      setDisplayPremium(formatNumber(policy.premium || 0));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDisplayGastos(formatNumber((policy as any).gastos_expedicion || 0));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDisplayIva(formatNumber((policy as any).iva || 0));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDisplayTotal(formatNumber((policy as any).total_a_pagar || 0));
    }
  }, [policy]);

  // Calcular total automáticamente
  useEffect(() => {
    const total = Number(premium) + Number(gastosExpedicion) + Number(iva);
    setValue('total_a_pagar', total);
    setDisplayTotal(formatNumber(total));
  }, [premium, gastosExpedicion, iva, setValue]);

  // Handlers para inputs con formato
  const handlePremiumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\./g, '');
    if (rawValue === '' || /^\d+$/.test(rawValue)) {
      const numValue = parseFormattedNumber(rawValue);
      setValue('premium', numValue);
      setDisplayPremium(rawValue ? formatNumber(numValue) : '');
    }
  };

  const handleGastosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\./g, '');
    if (rawValue === '' || /^\d+$/.test(rawValue)) {
      const numValue = parseFormattedNumber(rawValue);
      setValue('gastos_expedicion', numValue);
      setDisplayGastos(rawValue ? formatNumber(numValue) : '');
    }
  };

  const handleIvaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\./g, '');
    if (rawValue === '' || /^\d+$/.test(rawValue)) {
      const numValue = parseFormattedNumber(rawValue);
      setValue('iva', numValue);
      setDisplayIva(rawValue ? formatNumber(numValue) : '');
    }
  };

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

  useEffect(() => {
    if (clientId && !isEditing) {
      setValue('client_id', clientId);
    }
  }, [clientId, isEditing, setValue]);

  // Auto-calcular fecha de vencimiento
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
    await onSubmit(data);
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
    <form onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-6 max-w-4xl mx-auto">
      {/* Client ID (oculto) */}
      <input type="hidden" {...register('client_id')} />

      {/* ========== CLIENTE SELECCIONADO ========== */}
      {clientInfo && (
        <div className="p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-slate-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-500 font-medium">Cliente seleccionado</p>
              <p className="text-lg font-semibold text-slate-800">{clientInfo.full_name}</p>
              {clientInfo.document_number && (
                <p className="text-sm text-slate-600">Doc: {clientInfo.document_number}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== DATOS DE LA PÓLIZA ========== */}
      <div className="p-6 border rounded-lg bg-white shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Datos de la Póliza
        </h3>

        {/* 1. Número de Póliza + Anexo + Estado (misma fila) */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <div className="md:col-span-3 space-y-2">
            <Label htmlFor="policy_number">Número de Póliza *</Label>
            <Input
              id="policy_number"
              placeholder="Ej: POL-2024-001"
              {...register('policy_number')}
              disabled={loading}
              data-testid="policy-number-input"
              className="h-11"
            />
            {errors.policy_number && (
              <p className="text-sm text-red-500">{errors.policy_number.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="anexo">Anexo</Label>
            <Select
              value={watch('anexo') || '00'}
              onValueChange={(value) => setValue('anexo', value)}
              disabled={loading}
            >
              <SelectTrigger id="anexo" data-testid="policy-anexo-select" className="h-11">
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
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="status">Estado *</Label>
            <Select
              value={status}
              onValueChange={(value: PolicyStatus) => setValue('status', value)}
              disabled={loading || isEditing}
            >
              <SelectTrigger id="status" data-testid="policy-status-select" className="h-11">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activa">Activa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 2. Selección de Producto */}
        <div className="space-y-4 p-5 border rounded-lg bg-slate-50 mb-6">
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
                  <SelectTrigger id="company" data-testid="policy-company-select" className="h-11">
                    <SelectValue placeholder="Seleccionar..." />
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

              {/* Grupo */}
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
                  <SelectTrigger id="line" data-testid="policy-line-select" className="h-11">
                    <SelectValue placeholder={!selectedCompanyId ? "Primero selecciona compañía" : "Seleccionar..."} />
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
                <Label htmlFor="group" className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Ramo *
                </Label>
                <Select
                  value={selectedGroupId}
                  onValueChange={setSelectedGroupId}
                  disabled={loading || !selectedLineId || availableGroups.length === 0}
                >
                  <SelectTrigger id="group" data-testid="policy-group-select" className="h-11">
                    <SelectValue placeholder={!selectedLineId ? "Primero selecciona grupo" : "Seleccionar..."} />
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

          <input type="hidden" {...register('insurer')} />
          <input type="hidden" {...register('line')} />
        </div>

        {/* 3. Fechas */}
        <div className="space-y-4 p-5 border rounded-lg bg-slate-50 mb-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Calendar className="h-4 w-4" />
            Fechas
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha_expedicion">Fecha de Expedición</Label>
              <Input
                id="fecha_expedicion"
                type="date"
                {...register('fecha_expedicion')}
                disabled={loading}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Fecha en que se expide la póliza</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_date">Fecha de Inicio</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate || ''}
                onChange={handleStartDateChange}
                disabled={loading}
                data-testid="policy-start-date-input"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Al cambiar, se calcula el vencimiento a 1 año</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Fecha de Vencimiento</Label>
              <Input
                id="end_date"
                type="date"
                {...register('end_date')}
                disabled={loading}
                data-testid="policy-end-date-input"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Puedes ajustar manualmente</p>
            </div>
          </div>
        </div>

        {/* 4. Valores de la Póliza */}
        <div className="space-y-4 p-5 border rounded-lg bg-slate-50">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            Valores de la Póliza
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {/* Moneda */}
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <Select
                value={watch('currency') || 'COP'}
                onValueChange={(value) => setValue('currency', value)}
                disabled={loading}
              >
                <SelectTrigger id="currency" className="h-11">
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
              <Label htmlFor="premium">Prima *</Label>
              <Input
                id="premium"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={displayPremium}
                onChange={handlePremiumChange}
                disabled={loading}
                data-testid="policy-premium-input"
                className="h-11"
              />
            </div>

            {/* Gastos Expedición */}
            <div className="space-y-2">
              <Label htmlFor="gastos_expedicion">Gastos Exp.</Label>
              <Input
                id="gastos_expedicion"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={displayGastos}
                onChange={handleGastosChange}
                disabled={loading}
                className="h-11"
              />
            </div>

            {/* IVA */}
            <div className="space-y-2">
              <Label htmlFor="iva">IVA</Label>
              <Input
                id="iva"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={displayIva}
                onChange={handleIvaChange}
                disabled={loading}
                className="h-11"
              />
            </div>

            {/* Total */}
            <div className="space-y-2">
              <Label htmlFor="total_a_pagar">Total</Label>
              <Input
                id="total_a_pagar"
                type="text"
                value={displayTotal}
                disabled
                className="bg-blue-50 font-semibold h-11"
              />
            </div>

            {/* Comisión */}
            <div className="space-y-2">
              <Label htmlFor="commission_pct" className="flex items-center gap-1">
                Comisión %
                {loadingCommission && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              <Input
                id="commission_pct"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
                {...register('commission_pct', { valueAsNumber: true })}
                disabled={loading}
                className="h-11"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            El total se calcula automáticamente. La comisión se carga según la compañía y ramo seleccionados (modificable).
          </p>
        </div>
      </div>

      {/* ========== DOCUMENTOS ADJUNTOS ========== */}
      <div className="p-6 border rounded-lg bg-white shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Documentos Adjuntos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Documentos de Póliza */}
          <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
            <div className="flex justify-between items-center">
              <p className="font-medium text-slate-700">Documentos de Póliza</p>
              <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">
                {polizaDocuments.length} / 5
              </span>
            </div>

            <input
              type="file"
              id="poliza-upload"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              multiple
              onChange={handlePolizaFileChange}
              className="hidden"
              disabled={loading || polizaDocuments.length >= 5}
            />

            {polizaDocuments.length < 5 && (
              <label
                htmlFor="poliza-upload"
                className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
              >
                <Upload className="h-6 w-6 text-blue-500 mb-1" />
                <span className="text-sm text-blue-600 font-medium">Subir documento de póliza</span>
              </label>
            )}

            {polizaDocuments.length > 0 && (
              <div className="space-y-2 mt-3">
                {polizaDocuments.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex items-center gap-2 min-w-0">
                      <File className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="text-sm truncate">{doc.file_name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePolizaDoc(index)}
                      disabled={loading}
                      className="h-8 w-8 p-0 hover:bg-red-100 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documentos de Soporte */}
          <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-slate-700">Documentos de Soporte</p>
                <p className="text-xs text-slate-500">Sarlaft, Cédula, CCB, RUT, Estados Financieros</p>
              </div>
              <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">
                {soporteDocuments.length} / 8
              </span>
            </div>

            <input
              type="file"
              id="soporte-upload"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              multiple
              onChange={handleSoporteFileChange}
              className="hidden"
              disabled={loading || soporteDocuments.length >= 8}
            />

            {soporteDocuments.length < 8 && (
              <label
                htmlFor="soporte-upload"
                className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-emerald-300 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors"
              >
                <Upload className="h-6 w-6 text-emerald-500 mb-1" />
                <span className="text-sm text-emerald-600 font-medium">Subir documentos soporte</span>
              </label>
            )}

            {soporteDocuments.length > 0 && (
              <div className="space-y-2 mt-3">
                {soporteDocuments.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex items-center gap-2 min-w-0">
                      <File className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-sm truncate">{doc.file_name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSoporteDoc(index)}
                      disabled={loading}
                      className="h-8 w-8 p-0 hover:bg-red-100 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
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
