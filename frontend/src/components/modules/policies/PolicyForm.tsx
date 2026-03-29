'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  CreatePolicyInputSchema,
  type Policy,
  type PolicyStatus
} from '@/lib/validations/policies';
import { Loader2, Save, X, Building, Layers, FileText, Calendar, MessageSquare } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';

const POLICY_STATUS_OPTIONS: { value: PolicyStatus; label: string }[] = [
  { value: 'activa', label: 'Activa' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'renovacion', label: 'En Renovación' },
];

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

export interface PolicyFormData {
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
  notas?: string;
  metadata?: Record<string, unknown>;
}

interface PolicyFormProps {
  policy?: Policy;
  clientId?: string;
  onSubmit: (data: PolicyFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const parseCurrencyValue = (value: string): number => {
  const cleaned = value.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
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

  const [tenantCompanies, setTenantCompanies] = useState<TenantCompany[]>([]);
  const [availableLines, setAvailableLines] = useState<InsuranceLine[]>([]);
  const [availableGroups, setAvailableGroups] = useState<InsuranceGroup[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [loadingCommission, setLoadingCommission] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [premiumDisplay, setPremiumDisplay] = useState('');
  const [gastosDisplay, setGastosDisplay] = useState('');
  const [ivaDisplay, setIvaDisplay] = useState('');

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notas: (policy as any).notas || '',
    } : {
      client_id: clientId || '',
      anexo: '00',
      line: 'otro',
      status: 'activa' as PolicyStatus,
      currency: 'COP',
      premium: 0,
      gastos_expedicion: 0,
      iva: 0,
      total_a_pagar: 0,
      commission_pct: 0,
      notas: ''
    }
  });

  const premium = watch('premium') || 0;
  const gastosExpedicion = watch('gastos_expedicion') || 0;
  const iva = watch('iva') || 0;
  const status = watch('status');
  const startDate = watch('start_date');

  useEffect(() => {
    if (policy) {
      setPremiumDisplay(formatCurrency(policy.premium || 0));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setGastosDisplay(formatCurrency((policy as any).gastos_expedicion || 0));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setIvaDisplay(formatCurrency((policy as any).iva || 0));
    }
  }, [policy]);

  useEffect(() => {
    const total = Number(premium) + Number(gastosExpedicion) + Number(iva);
    setValue('total_a_pagar', total);
  }, [premium, gastosExpedicion, iva, setValue]);

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

  useEffect(() => {
    async function loadTenantCompanies() {
      if (!tenantId) return;
      setLoadingCatalogs(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tcData } = await (supabase as any)
          .from('tenant_companies')
          .select(`company_id, is_active, company_code, company:insurance_companies(id, name, slug)`)
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

  useEffect(() => {
    async function loadLinesForCompany() {
      if (!selectedCompanyId) {
        setAvailableLines([]);
        setSelectedLineId('');
        return;
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: clData } = await (supabase as any)
          .from('company_lines')
          .select(`line_id, line:insurance_lines(id, name, slug, unit)`)
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

  useEffect(() => {
    async function loadGroupsForLine() {
      if (!selectedLineId) {
        setAvailableGroups([]);
        setSelectedGroupId('');
        return;
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: groupsData } = await (supabase as any)
          .from('insurance_groups')
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

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    setValue('start_date', newStartDate);
    if (newStartDate) {
      const start = new Date(newStartDate);
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      setValue('end_date', end.toISOString().split('T')[0]);
    }
  };

  const handlePremiumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseCurrencyValue(e.target.value);
    setValue('premium', numericValue);
    setPremiumDisplay(formatCurrency(numericValue));
  };

  const handleGastosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseCurrencyValue(e.target.value);
    setValue('gastos_expedicion', numericValue);
    setGastosDisplay(formatCurrency(numericValue));
  };

  const handleIvaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseCurrencyValue(e.target.value);
    setValue('iva', numericValue);
    setIvaDisplay(formatCurrency(numericValue));
  };

  const handleFormSubmit = async (data: PolicyFormData) => {
    await onSubmit(data);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onError = (errors: any) => {
    console.error('Form validation errors:', errors);
  };

  const loading = isLoading || isSubmitting;
  const anexoOptions = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-6">
      <input type="hidden" {...register('client_id')} />

      {/* SECCIÓN 1: Identificación */}
      <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <FileText className="h-4 w-4" />
          Identificación de la Póliza
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="policy_number">Número de Póliza *</Label>
            <Input id="policy_number" placeholder="Ej: POL-2024-001" {...register('policy_number')} disabled={loading} />
            {errors.policy_number && <p className="text-sm text-red-500">{errors.policy_number.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="anexo">Anexo</Label>
            <Select value={watch('anexo') || '00'} onValueChange={(value) => setValue('anexo', value)} disabled={loading}>
              <SelectTrigger id="anexo"><SelectValue placeholder="00" /></SelectTrigger>
              <SelectContent>
                {anexoOptions.map((num) => (<SelectItem key={num} value={num}>{num}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Estado *</Label>
            <Select value={status} onValueChange={(value: PolicyStatus) => setValue('status', value)} disabled={loading || !isEditing}>
              <SelectTrigger id="status"><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
              <SelectContent>
                {POLICY_STATUS_OPTIONS.map(({ value, label }) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
              </SelectContent>
            </Select>
            {!isEditing && <p className="text-xs text-muted-foreground">Estado inicial: Activa</p>}
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: Producto */}
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
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Building className="h-3 w-3" />Compañía *</Label>
              <Select value={selectedCompanyId} onValueChange={(value) => { setSelectedCompanyId(value); setSelectedLineId(''); setSelectedGroupId(''); }} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="Seleccionar compañía" /></SelectTrigger>
                <SelectContent>
                  {tenantCompanies.map((tc) => (<SelectItem key={tc.company_id} value={tc.company_id}>{tc.company.name}{tc.company_code && <span className="text-muted-foreground ml-2">({tc.company_code})</span>}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Layers className="h-3 w-3" />Grupo *</Label>
              <Select value={selectedLineId} onValueChange={(value) => { setSelectedLineId(value); setSelectedGroupId(''); }} disabled={loading || !selectedCompanyId || availableLines.length === 0}>
                <SelectTrigger><SelectValue placeholder={!selectedCompanyId ? "Primero selecciona compañía" : "Seleccionar grupo"} /></SelectTrigger>
                <SelectContent>
                  {availableLines.map((line) => (<SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><FileText className="h-3 w-3" />Ramo *</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId} disabled={loading || !selectedLineId || availableGroups.length === 0}>
                <SelectTrigger><SelectValue placeholder={!selectedLineId ? "Primero selecciona grupo" : "Seleccionar ramo"} /></SelectTrigger>
                <SelectContent>
                  {availableGroups.map((group) => (<SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <input type="hidden" {...register('insurer')} />
        <input type="hidden" {...register('line')} />
      </div>

      {/* SECCIÓN 3: Fechas */}
      <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Calendar className="h-4 w-4" />
          Fechas
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fecha_expedicion">Fecha de Expedición</Label>
            <Input id="fecha_expedicion" type="date" {...register('fecha_expedicion')} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="start_date">Fecha de Inicio</Label>
            <Input id="start_date" type="date" value={startDate || ''} onChange={handleStartDateChange} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">Fecha de Vencimiento</Label>
            <Input id="end_date" type="date" {...register('end_date')} disabled={loading} />
          </div>
        </div>
      </div>

      {/* SECCIÓN 4: Valores */}
      <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <FileText className="h-4 w-4" />
          Valores de la Póliza
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Moneda</Label>
            <Select value={watch('currency') || 'COP'} onValueChange={(value) => setValue('currency', value)} disabled={loading}>
              <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="COP">COP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="premium">Prima *</Label>
            <Input id="premium" type="text" placeholder="$0" value={premiumDisplay} onChange={handlePremiumChange} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gastos_expedicion">Gastos Exp.</Label>
            <Input id="gastos_expedicion" type="text" placeholder="$0" value={gastosDisplay} onChange={handleGastosChange} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="iva">IVA</Label>
            <Input id="iva" type="text" placeholder="$0" value={ivaDisplay} onChange={handleIvaChange} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total">Total</Label>
            <Input id="total" type="text" value={formatCurrency(watch('total_a_pagar') || 0)} disabled={true} className="bg-green-50 font-semibold" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commission_pct">Comisión %</Label>
            <div className="relative">
              <Input id="commission_pct" type="number" step="0.01" min="0" max="100" {...register('commission_pct', { valueAsNumber: true })} disabled={loading} />
              {loadingCommission && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin" />}
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 5: Notas y Comentarios */}
      <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <MessageSquare className="h-4 w-4" />
          Notas y Comentarios
        </div>
        <div className="space-y-2">
          <Label htmlFor="notas">Comentarios adicionales</Label>
          <Textarea
            id="notas"
            placeholder="Ingresa cualquier nota o comentario importante sobre esta póliza..."
            {...register('notas')}
            disabled={loading}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Puedes agregar observaciones, condiciones especiales, o cualquier información relevante.
          </p>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            <X className="w-4 h-4 mr-2" />Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isEditing ? 'Guardar Cambios' : 'Crear Póliza'}
        </Button>
      </div>
    </form>
  );
}
