'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Loader2,
  Save,
  X,
  FileText,
  Calendar,
  MessageSquare,
  User,
  Users,
  DollarSign,
  Settings,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';

const POLICY_STATUS_OPTIONS: { value: PolicyStatus; label: string }[] = [
  { value: 'activa', label: 'Activa' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'renovacion', label: 'En Renovación' },
  { value: 'verificacion', label: 'En Verificación' },
];

const TIPO_MOVIMIENTO_OPTIONS = [
  { value: 'expedicion', label: 'Expedición' },
  { value: 'renovacion', label: 'Renovación' },
  { value: 'modificacion', label: 'Modificación' },
  { value: 'cancelacion', label: 'Cancelación' },
];

const TIPO_IDENTIFICACION_OPTIONS = [
  { value: 'nit', label: 'NIT' },
  { value: 'cedula_ciudadania', label: 'Cédula de Ciudadanía' },
  { value: 'cedula_extranjeria', label: 'Cédula de Extranjería' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'nit_extranjero', label: 'NIT Extranjero' },
];

// Mapeo de doc_type de clientes al formato del enum de pólizas
const DOC_TYPE_MAP: Record<string, string> = {
  'CC': 'cedula_ciudadania',
  'cc': 'cedula_ciudadania',
  'cedula': 'cedula_ciudadania',
  'cedula_ciudadania': 'cedula_ciudadania',
  'NIT': 'nit',
  'nit': 'nit',
  'CE': 'cedula_extranjeria',
  'ce': 'cedula_extranjeria',
  'cedula_extranjeria': 'cedula_extranjeria',
  'pasaporte': 'pasaporte',
  'nit_extranjero': 'nit_extranjero',
};

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

interface AlliedAgentOption {
  id: string;
  full_name: string;
  commission_percentage: number;
}

interface ClientData {
  id: string;
  full_name: string;
  doc_type: string;
  doc_number: string;
  allied_agent_id?: string | null;
  comercial_id?: string | null;
  business_group_id?: string | null;
}

interface Beneficiario {
  nombre: string;
  tipo_identificacion: string;
  numero_identificacion: string;
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
  tipo_movimiento: string;
  currency: string;
  valor_asegurado: number;
  premium: number;
  gastos_expedicion: number;
  iva: number;
  total_a_pagar: number;
  commission_pct: number;
  allied_agent_id?: string | null;
  allied_agent_pct?: number;
  comercial_id?: string | null;
  grupo_empresarial_id?: string | null;
  usuario_id?: string | null;
  fecha_expedicion?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  dias_vigencia?: number;
  tomador_nombre: string;
  tomador_tipo_identificacion: string;
  tomador_numero_identificacion: string;
  asegurado_diferente: boolean;
  asegurado_nombre?: string;
  asegurado_tipo_identificacion?: string;
  asegurado_numero_identificacion?: string;
  beneficiarios?: Beneficiario[];
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

const calcularDiasVigencia = (startDate: string | null | undefined, endDate: string | null | undefined): number => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
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

  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  const [clientAlliedAgent, setClientAlliedAgent] = useState<AlliedAgentOption | null>(null);
  const [loadingAlliedAgent, setLoadingAlliedAgent] = useState(false);
  const [alliedAgentPctValue, setAlliedAgentPctValue] = useState<number>(() => {
    if (isEditing && policy) return (policy as any).allied_agent_pct || 0;
    return 0;
  });

  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [comercialName, setComercialName] = useState('');
  const [grupoEmpresarialName, setGrupoEmpresarialName] = useState('');

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    if (isEditing && policy) return (policy as any).insurer_id || '';
    return '';
  });
  const [selectedLineId, setSelectedLineId] = useState<string>(() => {
    if (isEditing && policy) return (policy as any).line_id || '';
    return '';
  });
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    if (isEditing && policy) return (policy as any).group_id || '';
    return '';
  });

  const [valorAseguradoDisplay, setValorAseguradoDisplay] = useState('');
  const [premiumDisplay, setPremiumDisplay] = useState('');
  const [gastosDisplay, setGastosDisplay] = useState('');
  const [ivaDisplay, setIvaDisplay] = useState('');
  const [notasValue, setNotasValue] = useState('');

  const [aseguradoDiferente, setAseguradoDiferente] = useState(false);
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [mostrarBeneficiarios, setMostrarBeneficiarios] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<PolicyFormData>({
    ...(isEditing ? {} : { resolver: zodResolver(CreatePolicyInputSchema) as any }),
    defaultValues: policy ? {
      client_id: policy.client_id,
      policy_number: policy.policy_number,
      anexo: (policy as any).anexo || '00',
      insurer: policy.insurer,
      line: policy.line,
      status: policy.status as PolicyStatus,
      tipo_movimiento: (policy as any).tipo_movimiento || 'expedicion',
      currency: policy.currency || 'COP',
      valor_asegurado: (policy as any).valor_asegurado || 0,
      premium: policy.premium,
      gastos_expedicion: (policy as any).gastos_expedicion || 0,
      iva: (policy as any).iva || 0,
      total_a_pagar: (policy as any).total_a_pagar || 0,
      commission_pct: (policy as any).commission_pct || 0,
      fecha_expedicion: (policy as any).fecha_expedicion || '',
      start_date: policy.start_date || '',
      end_date: policy.end_date || '',
      tomador_nombre: (policy as any).tomador_nombre || '',
      tomador_tipo_identificacion: (policy as any).tomador_tipo_identificacion || 'cedula_ciudadania',
      tomador_numero_identificacion: (policy as any).tomador_numero_identificacion || '',
      asegurado_diferente: (policy as any).asegurado_diferente || false,
      asegurado_nombre: (policy as any).asegurado_nombre || '',
      asegurado_tipo_identificacion: (policy as any).asegurado_tipo_identificacion || '',
      asegurado_numero_identificacion: (policy as any).asegurado_numero_identificacion || '',
    } : {
      client_id: clientId || '',
      anexo: '00',
      line: 'otro',
      status: 'activa' as PolicyStatus,
      tipo_movimiento: 'expedicion',
      currency: 'COP',
      valor_asegurado: 0,
      premium: 0,
      gastos_expedicion: 0,
      iva: 0,
      total_a_pagar: 0,
      commission_pct: 0,
      tomador_nombre: '',
      tomador_tipo_identificacion: 'cedula_ciudadania',
      tomador_numero_identificacion: '',
      asegurado_diferente: false,
    }
  });

  const premium = watch('premium') || 0;
  const gastosExpedicion = watch('gastos_expedicion') || 0;
  const iva = watch('iva') || 0;
  const startDate = watch('start_date');
  const endDate = watch('end_date');

  const statusOptions = isEditing
    ? POLICY_STATUS_OPTIONS
    : POLICY_STATUS_OPTIONS.filter(o => o.value === 'activa' || o.value === 'verificacion');

  // Cargar usuario actual
  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await (supabase as any)
            .from('users')
            .select('id, full_name')
            .eq('id', user.id)
            .single();
          if (userData) {
            setCurrentUser(userData);
          }
        }
      } catch (err) {
        console.error('Error loading current user:', err);
      }
    }
    loadCurrentUser();
  }, [supabase]);

  // Cargar datos del cliente (tomador, comercial, grupo empresarial)
  useEffect(() => {
    async function loadClientData() {
      const cId = clientId || (isEditing && policy ? policy.client_id : null);
      if (!cId) return;
      setLoadingClient(true);
      try {
        const { data } = await (supabase as any)
          .from('clients')
          .select('id, full_name, doc_type, doc_number, allied_agent_id, comercial_id, business_group_id')
          .eq('id', cId)
          .single();
        if (data) {
          setClientData(data);
          setValue('tomador_nombre', data.full_name || '');
          // Mapear doc_type al formato del enum
          setValue('tomador_tipo_identificacion', DOC_TYPE_MAP[data.doc_type] || 'cedula_ciudadania');
          setValue('tomador_numero_identificacion', data.doc_number || '');
          if (data.comercial_id) {
            const { data: comercialData } = await (supabase as any)
              .from('users')
              .select('full_name')
              .eq('id', data.comercial_id)
              .single();
            if (comercialData) {
              setComercialName(comercialData.full_name);
            }
          }
          if (data.business_group_id) {
            const { data: grupoData } = await (supabase as any)
              .from('business_groups')
              .select('name')
              .eq('id', data.business_group_id)
              .single();
            if (grupoData) {
              setGrupoEmpresarialName(grupoData.name);
            }
          }
        }
      } catch (err) {
        console.error('Error loading client data:', err);
      }
      setLoadingClient(false);
    }
    loadClientData();
  }, [clientId, isEditing, policy, supabase, setValue]);

  // Inicializar displays cuando se edita
  useEffect(() => {
    if (policy) {
      setNotasValue((policy as any).notas || '');
      setValorAseguradoDisplay(formatCurrency((policy as any).valor_asegurado || 0));
      setPremiumDisplay(formatCurrency(policy.premium || 0));
      setGastosDisplay(formatCurrency((policy as any).gastos_expedicion || 0));
      setIvaDisplay(formatCurrency((policy as any).iva || 0));
      setAseguradoDiferente((policy as any).asegurado_diferente || false);
      setBeneficiarios((policy as any).beneficiarios || []);
    }
  }, [policy]);

  // Calcular total automáticamente
  useEffect(() => {
    const total = Number(premium) + Number(gastosExpedicion) + Number(iva);
    setValue('total_a_pagar', total);
  }, [premium, gastosExpedicion, iva, setValue]);

  // Calcular días de vigencia
  useEffect(() => {
    const dias = calcularDiasVigencia(startDate, endDate);
    setValue('dias_vigencia', dias);
  }, [startDate, endDate, setValue]);

  // Cargar aliado del cliente
  useEffect(() => {
    async function loadClientAlliedAgent() {
      const cId = clientId || (isEditing && policy ? policy.client_id : null);
      if (!cId || !tenantId) {
        setClientAlliedAgent(null);
        if (!isEditing) setAlliedAgentPctValue(0);
        return;
      }
      setLoadingAlliedAgent(true);
      try {
        const { data: clientDataRes } = await (supabase as any)
          .from('clients')
          .select('allied_agent_id')
          .eq('id', cId)
          .single();
        if (clientDataRes?.allied_agent_id) {
          const { data: agentData } = await (supabase as any)
            .from('allied_agents')
            .select('id, full_name, commission_percentage')
            .eq('id', clientDataRes.allied_agent_id)
            .single();
          if (agentData) {
            setClientAlliedAgent(agentData as AlliedAgentOption);
            if (!isEditing) {
              setAlliedAgentPctValue(agentData.commission_percentage);
            }
          } else {
            setClientAlliedAgent(null);
            if (!isEditing) setAlliedAgentPctValue(0);
          }
        } else {
          setClientAlliedAgent(null);
          if (!isEditing) setAlliedAgentPctValue(0);
        }
      } catch (err) {
        console.error('Error loading client allied agent:', err);
        setClientAlliedAgent(null);
      }
      setLoadingAlliedAgent(false);
    }
    loadClientAlliedAgent();
  }, [clientId, tenantId, isEditing, policy, supabase]);

  // Cargar comisión por compañía + grupo
  useEffect(() => {
    async function loadCommission() {
      if (!selectedCompanyId || !selectedGroupId) return;
      setLoadingCommission(true);
      try {
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

  // Cargar compañías del tenant
  useEffect(() => {
    async function loadTenantCompanies() {
      if (!tenantId) return;
      setLoadingCatalogs(true);
      try {
        const { data: tcData } = await (supabase as any)
          .from('tenant_companies')
          .select(`company_id, is_active, company_code, company:insurance_companies(id, name, slug)`)
          .eq('tenant_id', tenantId)
          .eq('is_active', true);
        if (tcData) {
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

  // Cargar líneas (ramos) por compañía
  useEffect(() => {
    async function loadLinesForCompany() {
      if (!selectedCompanyId) {
        setAvailableLines([]);
        return;
      }
      try {
        const { data: clData } = await (supabase as any)
          .from('company_lines')
          .select(`line_id, line:insurance_lines(id, name, slug, unit)`)
          .eq('company_id', selectedCompanyId)
          .eq('is_active', true);
        if (clData) {
          const lines = clData.map((cl: any) => cl.line).filter(Boolean);
          setAvailableLines(lines);
        }
      } catch (error) {
        console.error('Error loading lines:', error);
      }
    }
    loadLinesForCompany();
  }, [selectedCompanyId, supabase]);

  // Cargar grupos por línea (ramo)
  useEffect(() => {
    async function loadGroupsForLine() {
      if (!selectedLineId) {
        setAvailableGroups([]);
        return;
      }
      try {
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

  // Sincronizar selects con form values
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

  // =====================================================
  // HANDLERS
  // =====================================================

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

  const handleValorAseguradoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseCurrencyValue(e.target.value);
    setValue('valor_asegurado', numericValue);
    setValorAseguradoDisplay(formatCurrency(numericValue));
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

  const handleAddBeneficiario = () => {
    setBeneficiarios([...beneficiarios, {
      nombre: '',
      tipo_identificacion: 'cedula_ciudadania',
      numero_identificacion: ''
    }]);
  };

  const handleRemoveBeneficiario = (index: number) => {
    setBeneficiarios(beneficiarios.filter((_, i) => i !== index));
  };

  const handleBeneficiarioChange = (index: number, field: keyof Beneficiario, value: string) => {
    const updated = [...beneficiarios];
    updated[index] = { ...updated[index], [field]: value };
    setBeneficiarios(updated);
  };

  const handleFormSubmit = async (data: PolicyFormData) => {
    const dataWithExtras: PolicyFormData = {
      ...data,
      notas: notasValue || undefined,
      allied_agent_id: clientAlliedAgent?.id || null,
      allied_agent_pct: clientAlliedAgent ? alliedAgentPctValue : 0,
      comercial_id: clientData?.comercial_id || null,
      grupo_empresarial_id: clientData?.business_group_id || null,
      usuario_id: currentUser?.id || null,
      asegurado_diferente: aseguradoDiferente,
      beneficiarios: beneficiarios.length > 0 ? beneficiarios : undefined,
    };
    await onSubmit(dataWithExtras);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onError = (errors: any) => {
    console.error('Form validation errors:', errors);
  };

  const loading = isLoading || isSubmitting;
  const anexoOptions = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));
  const diasVigencia = calcularDiasVigencia(startDate, endDate);

  // =====================================================
  // RENDER
  // =====================================================
  return (
    <form onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-8">

      {/* ============================================= */}
      {/* SECCION 1: DATOS GENERALES */}
      {/* ============================================= */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
          <FileText className="h-5 w-5" />
          1. Datos Generales de la Póliza
        </h3>

        {/* Fila 1: Número | Anexo | Aseguradora */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.policy_number.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Anexo</Label>
            <Select
              defaultValue={(policy as any)?.anexo || '00'}
              onValueChange={(value) => setValue('anexo', value)}
              disabled={loading}
            >
              <SelectTrigger data-testid="anexo-select">
                <SelectValue placeholder="00" />
              </SelectTrigger>
              <SelectContent>
                {anexoOptions.map((num) => (
                  <SelectItem key={num} value={num}>{num}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Aseguradora *</Label>
            {loadingCatalogs ? (
              <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : tenantCompanies.length === 0 ? (
              <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-amber-50 text-amber-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs">No tienes compañías activas configuradas.</span>
              </div>
            ) : (
              <Select
                defaultValue={selectedCompanyId}
                onValueChange={(value) => {
                  setSelectedCompanyId(value);
                  setSelectedLineId('');
                  setSelectedGroupId('');
                  setAvailableGroups([]);
                }}
                disabled={loading}
              >
                <SelectTrigger data-testid="insurer-select">
                  <SelectValue placeholder="Seleccionar aseguradora" />
                </SelectTrigger>
                <SelectContent>
                  {tenantCompanies.map((tc) => (
                    <SelectItem key={tc.company_id} value={tc.company_id}>
                      <span className="flex items-center gap-2">
                        {tc.company.name}
                        {tc.company_code && (<span className="text-muted-foreground text-xs">({tc.company_code})</span>)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Fila 2: Ramo | Grupo | Tipo de Movimiento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Ramo *</Label>
            <Select
              defaultValue={selectedLineId}
              onValueChange={(value) => {
                setSelectedLineId(value);
                setSelectedGroupId('');
                setAvailableGroups([]);
              }}
              disabled={loading || !selectedCompanyId || availableLines.length === 0}
            >
              <SelectTrigger data-testid="line-select">
                <SelectValue placeholder="Seleccionar ramo" />
              </SelectTrigger>
              <SelectContent>
                {availableLines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Grupo</Label>
            <Select
              value={selectedGroupId}
              onValueChange={(value) => {
                setSelectedGroupId(value);
              }}
              disabled={loading || !selectedLineId || availableGroups.length === 0}
            >
              <SelectTrigger data-testid="group-select">
                <SelectValue placeholder="Seleccionar grupo" />
              </SelectTrigger>
              <SelectContent>
                {availableGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Movimiento *</Label>
            {isEditing ? (
              <Select
                defaultValue={(policy as any)?.tipo_movimiento || 'expedicion'}
                onValueChange={(value) => setValue('tipo_movimiento', value)}
                disabled={loading}
              >
                <SelectTrigger data-testid="tipo-movimiento-select">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_MOVIMIENTO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={(policy as any)?.tipo_movimiento === 'renovacion' ? 'Renovación' : 'Expedición'}
                disabled
                className="bg-gray-50"
                data-testid="tipo-movimiento-fixed"
              />
            )}
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* SECCION 2: VIGENCIA */}
      {/* ============================================= */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
          <Calendar className="h-5 w-5" />
          2. Vigencia de la Póliza
        </h3>

        {/* Fila 1: Fecha Expedición | Vigencia Desde | Vigencia Hasta */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fecha_expedicion">Fecha de Expedición</Label>
            <Input
              id="fecha_expedicion"
              type="date"
              {...register('fecha_expedicion')}
              disabled={loading}
              data-testid="fecha-expedicion-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_date">Vigencia Desde *</Label>
            <Input
              id="start_date"
              type="date"
              {...register('start_date')}
              onChange={handleStartDateChange}
              disabled={loading}
              data-testid="start-date-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_date">Vigencia Hasta *</Label>
            <Input
              id="end_date"
              type="date"
              {...register('end_date')}
              disabled={loading}
              data-testid="end-date-input"
            />
          </div>
        </div>

        {/* Fila 2: Días de Vigencia | Estado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Días de Vigencia</Label>
            <Input
              value={diasVigencia > 0 ? `${diasVigencia} días` : '-'}
              disabled
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label>Estado de la Póliza *</Label>
            <Select
              defaultValue={policy?.status || 'activa'}
              onValueChange={(value) => setValue('status', value as PolicyStatus)}
              disabled={loading || !isEditing}
            >
              <SelectTrigger data-testid="status-select">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isEditing && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                Estado inicial: Activa
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* SECCION 3: TOMADOR */}
      {/* ============================================= */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
          <User className="h-5 w-5" />
          3. Información del Tomador
        </h3>

        {loadingClient ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm text-muted-foreground">Cargando datos del tomador...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tomador_nombre">Nombre / Razón Social *</Label>
              <Input
                id="tomador_nombre"
                {...register('tomador_nombre')}
                disabled={loading}
                data-testid="tomador-nombre-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Identificación *</Label>
              <Select
                defaultValue={(policy as any)?.tomador_tipo_identificacion || 'cedula_ciudadania'}
                onValueChange={(value) => setValue('tomador_tipo_identificacion', value)}
                disabled={loading}
              >
                <SelectTrigger data-testid="tomador-tipo-id-select">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_IDENTIFICACION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tomador_numero_identificacion">Número de Identificación *</Label>
              <Input
                id="tomador_numero_identificacion"
                {...register('tomador_numero_identificacion')}
                disabled={loading}
                data-testid="tomador-numero-id-input"
              />
            </div>
          </div>
        )}
      </div>

      {/* ============================================= */}
      {/* SECCION 4: ASEGURADO Y BENEFICIARIO */}
      {/* ============================================= */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
          <Users className="h-5 w-5" />
          4. Asegurado y Beneficiario
        </h3>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="asegurado_diferente"
            checked={aseguradoDiferente}
            onCheckedChange={(checked) => setAseguradoDiferente(checked === true)}
            disabled={loading}
          />
          <Label htmlFor="asegurado_diferente" className="text-sm cursor-pointer">
            El asegurado es diferente al tomador
          </Label>
        </div>

        {aseguradoDiferente && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6 border-l-2 border-primary/20">
            <div className="space-y-2">
              <Label>Nombre del Asegurado *</Label>
              <Input
                {...register('asegurado_nombre')}
                disabled={loading}
                data-testid="asegurado-nombre-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Identificación *</Label>
              <Select
                defaultValue={(policy as any)?.asegurado_tipo_identificacion || ''}
                onValueChange={(value) => setValue('asegurado_tipo_identificacion', value)}
                disabled={loading}
              >
                <SelectTrigger data-testid="asegurado-tipo-id-select">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_IDENTIFICACION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Número de Identificación *</Label>
              <Input
                {...register('asegurado_numero_identificacion')}
                disabled={loading}
                data-testid="asegurado-numero-id-input"
              />
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Checkbox
            id="mostrar_beneficiarios"
            checked={mostrarBeneficiarios}
            onCheckedChange={(checked) => setMostrarBeneficiarios(checked === true)}
            disabled={loading}
          />
          <Label htmlFor="mostrar_beneficiarios" className="text-sm cursor-pointer">
            Agregar beneficiarios diferentes
          </Label>
        </div>

        {mostrarBeneficiarios && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={handleAddBeneficiario} disabled={loading}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </div>
        )}

        {mostrarBeneficiarios && beneficiarios.length > 0 && (
          <div className="space-y-3 pl-6 border-l-2 border-primary/20">
            {beneficiarios.map((ben, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={ben.nombre}
                    onChange={(e) => handleBeneficiarioChange(index, 'nombre', e.target.value)}
                    placeholder="Nombre del beneficiario"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Tipo ID</Label>
                  <Select
                    value={ben.tipo_identificacion}
                    onValueChange={(value) => handleBeneficiarioChange(index, 'tipo_identificacion', value)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_IDENTIFICACION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Número ID</Label>
                  <Input
                    value={ben.numero_identificacion}
                    onChange={(e) => handleBeneficiarioChange(index, 'numero_identificacion', e.target.value)}
                    placeholder="Número"
                    disabled={loading}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveBeneficiario(index)}
                  disabled={loading}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================= */}
      {/* SECCION 5: VALORES */}
      {/* ============================================= */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
          <DollarSign className="h-5 w-5" />
          5. Valores de la Póliza
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Valor Asegurado *</Label>
            <Input
              value={valorAseguradoDisplay}
              onChange={handleValorAseguradoChange}
              placeholder="$0"
              disabled={loading}
              data-testid="valor-asegurado-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Prima Neta *</Label>
            <Input
              value={premiumDisplay}
              onChange={handlePremiumChange}
              placeholder="$0"
              disabled={loading}
              data-testid="premium-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Gastos Expedición</Label>
            <Input
              value={gastosDisplay}
              onChange={handleGastosChange}
              placeholder="$0"
              disabled={loading}
              data-testid="gastos-input"
            />
          </div>

          <div className="space-y-2">
            <Label>IVA</Label>
            <Input
              value={ivaDisplay}
              onChange={handleIvaChange}
              placeholder="$0"
              disabled={loading}
              data-testid="iva-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Total a Pagar</Label>
            <Input
              value={formatCurrency(Number(premium) + Number(gastosExpedicion) + Number(iva))}
              disabled
              className="bg-gray-50 font-semibold"
              data-testid="total-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Comisión %</Label>
            <div className="relative">
              <Input
                type="number"
                {...register('commission_pct', { valueAsNumber: true })}
                disabled={loading}
                min={0}
                max={100}
                data-testid="commission-input"
              />
              {loadingCommission && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* SECCION 6: GESTION INTERNA CRM */}
      {/* ============================================= */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
          <Settings className="h-5 w-5" />
          6. Gestión Interna CRM
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Usuario</Label>
            <Input
              value={currentUser?.full_name || ''}
              disabled
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label>Comercial</Label>
            <Input
              value={comercialName || 'No asignado en HV'}
              disabled
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label>Aliado</Label>
            {loadingAlliedAgent ? (
              <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs text-muted-foreground">Cargando...</span>
              </div>
            ) : (
              <Input
                value={clientAlliedAgent?.full_name || 'No asignado en HV'}
                disabled
                className="bg-gray-50"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Grupo Empresarial</Label>
            <Input
              value={grupoEmpresarialName || 'No asignado en HV'}
              disabled
              className="bg-gray-50"
            />
          </div>
        </div>

        {clientAlliedAgent && (
          <div className="border-t pt-4">
            <div className="max-w-xs space-y-2">
              <Label>% Comisión Aliado</Label>
              <Input
                type="number"
                value={alliedAgentPctValue}
                onChange={(e) => setAlliedAgentPctValue(parseFloat(e.target.value) || 0)}
                disabled={loading}
                min={0}
                max={100}
                data-testid="allied-agent-pct-input"
              />
              <p className="text-xs text-muted-foreground">
                Porcentaje sobre la comisión de la agencia
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ============================================= */}
      {/* NOTAS Y COMENTARIOS */}
      {/* ============================================= */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
          <MessageSquare className="h-5 w-5" />
          Notas y Comentarios
        </h3>
        <Textarea
          value={notasValue}
          onChange={(e) => setNotasValue(e.target.value)}
          placeholder="Notas adicionales sobre la póliza..."
          rows={3}
          disabled={loading}
          data-testid="notas-textarea"
        />
      </div>

      {/* ============================================= */}
      {/* BOTONES */}
      {/* ============================================= */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading} data-testid="submit-policy-btn">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isEditing ? 'Actualizando...' : 'Creando...'}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? 'Actualizar Póliza' : 'Crear Póliza'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
