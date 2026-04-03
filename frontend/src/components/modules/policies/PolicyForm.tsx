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
  Building, 
  FileText, 
  Calendar, 
  MessageSquare, 
  Handshake,
  User,
  Users,
  DollarSign,
  Settings,
  AlertCircle,
  Plus,
  Trash2
} from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';

// =====================================================
// CONSTANTES Y TIPOS
// =====================================================

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
  grupo_empresarial_id?: string | null;
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
  // Tomador
  tomador_nombre: string;
  tomador_tipo_identificacion: string;
  tomador_numero_identificacion: string;
  // Asegurado
  asegurado_diferente: boolean;
  asegurado_nombre?: string;
  asegurado_tipo_identificacion?: string;
  asegurado_numero_identificacion?: string;
  // Beneficiarios
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

// =====================================================
// UTILIDADES
// =====================================================

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

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

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

  // Estado para datos del cliente/tomador
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  // Allied agent (viene del cliente)
  const [clientAlliedAgent, setClientAlliedAgent] = useState<AlliedAgentOption | null>(null);
  const [loadingAlliedAgent, setLoadingAlliedAgent] = useState(false);
  const [alliedAgentPctValue, setAlliedAgentPctValue] = useState(() => {
    if (isEditing && policy) return (policy as any).allied_agent_pct || 0;
    return 0;
  });

  // Usuario actual (quien crea la póliza)
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);

  // Comercial del cliente
  const [comercialName, setComercialName] = useState<string>('');

  // Grupo empresarial del cliente
  const [grupoEmpresarialName, setGrupoEmpresarialName] = useState<string>('');

  // Selecciones de catálogos
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    if (isEditing && policy) return (policy as any).insurer_id || '';
    return '';
  });
  const [selectedLineId, setSelectedLineId] = useState(() => {
    if (isEditing && policy) return (policy as any).line_id || '';
    return '';
  });
  const [selectedGroupId, setSelectedGroupId] = useState(() => {
    if (isEditing && policy) return (policy as any).group_id || '';
    return '';
  });

  // Displays de valores formateados
  const [valorAseguradoDisplay, setValorAseguradoDisplay] = useState('');
  const [premiumDisplay, setPremiumDisplay] = useState('');
  const [gastosDisplay, setGastosDisplay] = useState('');
  const [ivaDisplay, setIvaDisplay] = useState('');
  const [notasValue, setNotasValue] = useState('');

  // Asegurado diferente al tomador
  const [aseguradoDiferente, setAseguradoDiferente] = useState(false);

  // Beneficiarios (múltiples)
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [mostrarBeneficiarios, setMostrarBeneficiarios] = useState(false);

  // Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<PolicyFormData>({
    resolver: zodResolver(CreatePolicyInputSchema) as any,
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

  // Watchers
  const premium = watch('premium') || 0;
  const gastosExpedicion = watch('gastos_expedicion') || 0;
  const iva = watch('iva') || 0;
  const startDate = watch('start_date');
  const endDate = watch('end_date');

  const statusOptions = isEditing
    ? POLICY_STATUS_OPTIONS
    : POLICY_STATUS_OPTIONS.filter(o => o.value === 'activa' || o.value === 'verificacion');

  // =====================================================
  // EFFECTS
  // =====================================================

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

  // Cargar datos del cliente/tomador
  useEffect(() => {
    async function loadClientData() {
      const cId = clientId || (isEditing && policy ? policy.client_id : null);
      if (!cId) return;

      setLoadingClient(true);
      try {
        const { data } = await (supabase as any)
          .from('clients')
          .select('id, full_name, doc_type, doc_number, allied_agent_id, comercial_id, grupo_empresarial_id')
          .eq('id', cId)
          .single();

        if (data) {
          setClientData(data);
          // Auto-llenar campos del tomador
          setValue('tomador_nombre', data.full_name || '');
          setValue('tomador_tipo_identificacion', data.doc_type || 'cedula_ciudadania');
          setValue('tomador_numero_identificacion', data.doc_number || '');

          // Cargar nombre del comercial si existe
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

          // Cargar nombre del grupo empresarial si existe
          if (data.grupo_empresarial_id) {
            const { data: grupoData } = await (supabase as any)
              .from('grupos_empresariales')
              .select('nombre')
              .eq('id', data.grupo_empresarial_id)
              .single();
            if (grupoData) {
              setGrupoEmpresarialName(grupoData.nombre);
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

  // Inicializar displays de valores cuando hay policy existente
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

  // Cargar aliado del CLIENTE automáticamente
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

  // Cargar comisión cuando cambia compañía + grupo
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

  // Cargar líneas cuando cambia la compañía seleccionada
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

  // Cargar grupos cuando cambia la línea seleccionada
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

  // Sincronizar compañía seleccionada → form values
  useEffect(() => {
    if (selectedCompanyId) {
      const company = tenantCompanies.find(tc => tc.company_id === selectedCompanyId)?.company;
      if (company) {
        setValue('insurer', company.name);
        setValue('insurer_id', company.id);
      }
    }
  }, [selectedCompanyId, tenantCompanies, setValue]);

  // Sincronizar línea seleccionada → form values
  useEffect(() => {
    if (selectedLineId) {
      const line = availableLines.find(l => l.id === selectedLineId);
      if (line) {
        setValue('line', line.slug);
        setValue('line_id', line.id);
      }
    }
  }, [selectedLineId, availableLines, setValue]);

  // Sincronizar grupo seleccionado → form values
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
      grupo_empresarial_id: clientData?.grupo_empresarial_id || null,
      usuario_id: currentUser?.id || null,
      asegurado_diferente: aseguradoDiferente,
      beneficiarios: beneficiarios.length > 0 ? beneficiarios : undefined,
    };
    await onSubmit(dataWithExtras);
  };

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
    <form onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-6">
      
      {/* ============================================= */}
      {/* MARCO 1: DATOS GENERALES DE LA PÓLIZA */}
      {/* ============================================= */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">1. Datos Generales de la Póliza</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Número de Póliza */}
          <div className="space-y-2">
            <Label htmlFor="policy_number">Número de Póliza *</Label>
            <Input
              id="policy_number"
              {...register('policy_number')}
              placeholder="Ej: POL-2024-001"
              disabled={loading}
              className="uppercase"
            />
            {errors.policy_number && (
              <p className="text-red-500 text-xs">{errors.policy_number.message}</p>
            )}
          </div>

          {/* Anexo */}
          <div className="space-y-2">
            <Label>Anexo</Label>
            <Select
              value={watch('anexo') || '00'}
              onValueChange={(value) => setValue('anexo', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {anexoOptions.map((num) => (
                  <SelectItem key={num} value={num}>{num}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aseguradora */}
          <div className="space-y-2">
            <Label>Aseguradora *</Label>
            {loadingCatalogs ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
              </div>
            ) : tenantCompanies.length === 0 ? (
              <div className="text-amber-600 text-sm p-2 bg-amber-50 rounded">
                No tienes compañías activas configuradas.
              </div>
            ) : (
              <Select
                value={selectedCompanyId}
                onValueChange={(value) => {
                  setSelectedCompanyId(value);
                  setSelectedLineId('');
                  setSelectedGroupId('');
                  setAvailableGroups([]);
                }}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar aseguradora" />
                </SelectTrigger>
                <SelectContent>
                  {tenantCompanies.map((tc) => (
                    <SelectItem key={tc.company_id} value={tc.company_id}>
                      <span className="flex items-center gap-2">
                        {tc.company.name}
                        {tc.company_code && <span className="text-gray-400">({tc.company_code})</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Ramo (Línea) */}
          <div className="space-y-2">
            <Label>Ramo *</Label>
            <Select
              value={selectedLineId}
              onValueChange={(value) => {
                setSelectedLineId(value);
                setSelectedGroupId('');
                setAvailableGroups([]);
              }}
              disabled={loading || !selectedCompanyId || availableLines.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar ramo" />
              </SelectTrigger>
              <SelectContent>
                {availableLines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Movimiento */}
          <div className="space-y-2">
            <Label>Tipo de Movimiento *</Label>
            <Select
              value={watch('tipo_movimiento') || 'expedicion'}
              onValueChange={(value) => setValue('tipo_movimiento', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_MOVIMIENTO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha de Expedición */}
          <div className="space-y-2">
            <Label htmlFor="fecha_expedicion">Fecha de Expedición</Label>
            <Input
              id="fecha_expedicion"
              type="date"
              {...register('fecha_expedicion')}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* MARCO 2: VIGENCIA DE LA PÓLIZA */}
      {/* ============================================= */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <Calendar className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">2. Vigencia de la Póliza</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Vigencia Desde */}
          <div className="space-y-2">
            <Label htmlFor="start_date">Vigencia Desde *</Label>
            <Input
              id="start_date"
              type="date"
              {...register('start_date')}
              onChange={handleStartDateChange}
              disabled={loading}
            />
          </div>

          {/* Vigencia Hasta */}
          <div className="space-y-2">
            <Label htmlFor="end_date">Vigencia Hasta *</Label>
            <Input
              id="end_date"
              type="date"
              {...register('end_date')}
              disabled={loading}
            />
          </div>

          {/* Días de Vigencia (calculado) */}
          <div className="space-y-2">
            <Label>Días de Vigencia</Label>
            <Input
              value={diasVigencia > 0 ? `${diasVigencia} días` : '-'}
              disabled
              className="bg-gray-50"
            />
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <Label>Estado de la Póliza *</Label>
            <Select
              value={watch('status') || 'activa'}
              onValueChange={(value) => setValue('status', value as PolicyStatus)}
              disabled={loading || !isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isEditing && (
              <p className="text-xs text-gray-500">Estado inicial: Activa</p>
            )}
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* MARCO 3: INFORMACIÓN DEL TOMADOR */}
      {/* ============================================= */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <User className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">3. Información del Tomador</h3>
        </div>
        
        {loadingClient ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando datos del tomador...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Nombre / Razón Social */}
            <div className="space-y-2">
              <Label htmlFor="tomador_nombre">Nombre / Razón Social *</Label>
              <Input
                id="tomador_nombre"
                {...register('tomador_nombre')}
                placeholder="Nombre completo o razón social"
                disabled={loading}
                className="bg-gray-50"
              />
            </div>

            {/* Tipo de Identificación */}
            <div className="space-y-2">
              <Label>Tipo de Identificación *</Label>
              <Select
                value={watch('tomador_tipo_identificacion') || 'cedula_ciudadania'}
                onValueChange={(value) => setValue('tomador_tipo_identificacion', value)}
                disabled={loading}
              >
                <SelectTrigger className="bg-gray-50">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_IDENTIFICACION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Número de Identificación */}
            <div className="space-y-2">
              <Label htmlFor="tomador_numero_identificacion">Número de Identificación *</Label>
              <Input
                id="tomador_numero_identificacion"
                {...register('tomador_numero_identificacion')}
                placeholder="Número de documento"
                disabled={loading}
                className="bg-gray-50"
              />
            </div>
          </div>
        )}
        
        {clientData && (
          <p className="text-xs text-gray-500 mt-2">
            Datos cargados automáticamente desde la HV del cliente. Para modificarlos, edita la Hoja de Vida.
          </p>
        )}
      </div>

      {/* ============================================= */}
      {/* MARCO 4: ASEGURADO Y BENEFICIARIO */}
      {/* ============================================= */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <Users className="h-5 w-5 text-orange-600" />
          <h3 className="font-semibold text-gray-900">4. Asegurado y Beneficiario</h3>
        </div>
        
        {/* Checkbox: Asegurado diferente al tomador */}
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox
            id="asegurado_diferente"
            checked={aseguradoDiferente}
            onCheckedChange={(checked) => setAseguradoDiferente(checked === true)}
            disabled={loading}
          />
          <Label htmlFor="asegurado_diferente" className="text-sm font-normal cursor-pointer">
            El asegurado es diferente al tomador
          </Label>
        </div>

        {/* Campos de Asegurado (solo si es diferente) */}
        {aseguradoDiferente && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-orange-50 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="asegurado_nombre">Nombre del Asegurado *</Label>
              <Input
                id="asegurado_nombre"
                {...register('asegurado_nombre')}
                placeholder="Nombre completo"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Identificación *</Label>
              <Select
                value={watch('asegurado_tipo_identificacion') || 'cedula_ciudadania'}
                onValueChange={(value) => setValue('asegurado_tipo_identificacion', value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_IDENTIFICACION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asegurado_numero_identificacion">Número de Identificación *</Label>
              <Input
                id="asegurado_numero_identificacion"
                {...register('asegurado_numero_identificacion')}
                placeholder="Número de documento"
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Beneficiarios */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mostrar_beneficiarios"
                checked={mostrarBeneficiarios}
                onCheckedChange={(checked) => setMostrarBeneficiarios(checked === true)}
                disabled={loading}
              />
              <Label htmlFor="mostrar_beneficiarios" className="text-sm font-normal cursor-pointer">
                Agregar beneficiarios diferentes
              </Label>
            </div>
            {mostrarBeneficiarios && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddBeneficiario}
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            )}
          </div>

          {mostrarBeneficiarios && beneficiarios.length > 0 && (
            <div className="space-y-3">
              {beneficiarios.map((ben, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg items-end">
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
                    size="sm"
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
      </div>

      {/* ============================================= */}
      {/* MARCO 5: VALORES DE LA PÓLIZA */}
      {/* ============================================= */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <DollarSign className="h-5 w-5 text-emerald-600" />
          <h3 className="font-semibold text-gray-900">5. Valores de la Póliza</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {/* Valor Asegurado */}
          <div className="space-y-2">
            <Label htmlFor="valor_asegurado">Valor Asegurado *</Label>
            <Input
              id="valor_asegurado"
              value={valorAseguradoDisplay}
              onChange={handleValorAseguradoChange}
              placeholder="$0"
              disabled={loading}
            />
          </div>

          {/* Prima Neta */}
          <div className="space-y-2">
            <Label htmlFor="premium">Prima Neta *</Label>
            <Input
              id="premium"
              value={premiumDisplay}
              onChange={handlePremiumChange}
              placeholder="$0"
              disabled={loading}
            />
          </div>

          {/* Gastos de Expedición */}
          <div className="space-y-2">
            <Label htmlFor="gastos_expedicion">Gastos Expedición</Label>
            <Input
              id="gastos_expedicion"
              value={gastosDisplay}
              onChange={handleGastosChange}
              placeholder="$0"
              disabled={loading}
            />
          </div>

          {/* IVA */}
          <div className="space-y-2">
            <Label htmlFor="iva">IVA</Label>
            <Input
              id="iva"
              value={ivaDisplay}
              onChange={handleIvaChange}
              placeholder="$0"
              disabled={loading}
            />
          </div>

          {/* Total a Pagar */}
          <div className="space-y-2">
            <Label>Total a Pagar</Label>
            <Input
              value={formatCurrency(watch('total_a_pagar') || 0)}
              disabled
              className="bg-emerald-50 font-semibold text-emerald-700"
            />
          </div>

          {/* Comisión % */}
          <div className="space-y-2">
            <Label htmlFor="commission_pct">Comisión %</Label>
            <div className="relative">
              <Input
                id="commission_pct"
                type="number"
                step="0.01"
                {...register('commission_pct', { valueAsNumber: true })}
                disabled={loading}
              />
              {loadingCommission && (
                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* MARCO 6: GESTIÓN INTERNA CRM */}
      {/* ============================================= */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <Settings className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">6. Gestión Interna CRM</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Usuario del Tenant (quien crea) */}
          <div className="space-y-2">
            <Label>Usuario</Label>
            <Input
              value={currentUser?.full_name || 'Cargando...'}
              disabled
              className="bg-gray-100"
            />
            <p className="text-xs text-gray-500">Usuario que crea la póliza</p>
          </div>

          {/* Comercial */}
          <div className="space-y-2">
            <Label>Comercial</Label>
            <Input
              value={comercialName || 'No asignado en HV'}
              disabled
              className="bg-gray-100"
            />
            <p className="text-xs text-gray-500">Viene de la HV del tomador</p>
          </div>

          {/* Aliado */}
          <div className="space-y-2">
            <Label>Aliado</Label>
            {loadingAlliedAgent ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
              </div>
            ) : (
              <Input
                value={clientAlliedAgent?.full_name || 'Directo (sin aliado)'}
                disabled
                className="bg-gray-100"
              />
            )}
            <p className="text-xs text-gray-500">Viene de la HV del tomador</p>
          </div>

          {/* Grupo Empresarial */}
          <div className="space-y-2">
            <Label>Grupo Empresarial</Label>
            <Input
              value={grupoEmpresarialName || 'No asignado en HV'}
              disabled
              className="bg-gray-100"
            />
            <p className="text-xs text-gray-500">Viene de la HV del tomador</p>
          </div>
        </div>

        {/* % Comisión Aliado (si aplica) */}
        {clientAlliedAgent && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="allied_agent_pct">% Comisión Aliado</Label>
                <Input
                  id="allied_agent_pct"
                  type="number"
                  step="0.01"
                  value={alliedAgentPctValue}
                  onChange={(e) => setAlliedAgentPctValue(parseFloat(e.target.value) || 0)}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">Porcentaje sobre la comisión de la agencia</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================= */}
      {/* NOTAS Y COMENTARIOS */}
      {/* ============================================= */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <MessageSquare className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Notas y Comentarios</h3>
        </div>
        
        <Textarea
          placeholder="Observaciones adicionales sobre la póliza..."
          value={notasValue}
          onChange={(e) => setNotasValue(e.target.value)}
          disabled={loading}
          rows={3}
        />
      </div>

      {/* ============================================= */}
      {/* BOTONES DE ACCIÓN */}
      {/* ============================================= */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
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
