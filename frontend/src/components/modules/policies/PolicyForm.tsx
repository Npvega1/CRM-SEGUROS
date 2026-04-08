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
  UpdatePolicyInputSchema,
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
  Trash2,
  Upload,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Car
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
  placa?: string;
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

  const [aiEnabled, setAiEnabled] = useState(false);
  const [loadingAiStatus, setLoadingAiStatus] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtractingAI, setIsExtractingAI] = useState(false);
  const [aiExtractionResult, setAiExtractionResult] = useState<{
    success: boolean;
    needsVerification: boolean;
    verificationFields?: string[];
    error?: string;
  } | null>(null);

  const [tenantCompanies, setTenantCompanies] = useState<TenantCompany[]>([]);
  const [availableLines, setAvailableLines] = useState<InsuranceLine[]>([]);
  const [availableGroups, setAvailableGroups] = useState<InsuranceGroup[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [loadingCommission, setLoadingCommission] = useState(false);

  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  const [clientAlliedAgent, setClientAlliedAgent] = useState<AlliedAgentOption | null>(null);
  const [loadingAlliedAgent, setLoadingAlliedAgent] = useState(false);
  const [alliedAgentPctValue, setAlliedAgentPctValue] = useState(() => {
    if (isEditing && policy) return (policy as any).allied_agent_pct || 0;
    return 0;
  });

  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [comercialName, setComercialName] = useState('');
  const [grupoEmpresarialName, setGrupoEmpresarialName] = useState('');

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

  const [valorAseguradoDisplay, setValorAseguradoDisplay] = useState('');
  const [premiumDisplay, setPremiumDisplay] = useState('');
  const [gastosDisplay, setGastosDisplay] = useState('');
  const [ivaDisplay, setIvaDisplay] = useState('');
  const [notasValue, setNotasValue] = useState('');

  const [aseguradoDiferente, setAseguradoDiferente] = useState(false);
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [mostrarBeneficiarios, setMostrarBeneficiarios] = useState(false);

  const [placaValue, setPlacaValue] = useState(isEditing ? ((policy as any)?.placa || '') : '');
  const isAutoRamo = availableLines.find(l => l.id === selectedLineId)?.name?.toLowerCase().includes('auto') || false;

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

  useEffect(() => {
    async function loadAiStatus() {
      if (!tenantId) return;
      try {
        const { data } = await (supabase as any)
          .from('tenants')
          .select('ai_enabled')
          .eq('id', tenantId)
          .single();
        if (data) {
          setAiEnabled(data.ai_enabled || false);
        }
      } catch (err) {
        console.error('Error loading AI status:', err);
      } finally {
        setLoadingAiStatus(false);
      }
    }
    loadAiStatus();
  }, [tenantId, supabase]);

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
          setValue('tomador_nombre', data.full_name || '');
          setValue('tomador_tipo_identificacion', data.doc_type || 'cedula_ciudadania');
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

  useEffect(() => {
    const total = Number(premium) + Number(gastosExpedicion) + Number(iva);
    setValue('total_a_pagar', total);
  }, [premium, gastosExpedicion, iva, setValue]);

  useEffect(() => {
    const dias = calcularDiasVigencia(startDate, endDate);
    setValue('dias_vigencia', dias);
  }, [startDate, endDate, setValue]);

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
          if (groupsData.length > 0 && !isEditing) {
            setSelectedGroupId(groupsData[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading groups:', error);
      }
    }
    loadGroupsForLine();
  }, [selectedLineId, supabase, isEditing]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(file.type)) {
        alert('Por favor seleccione un archivo PDF o DOCX');
        return;
      }
      setSelectedFile(file);
      setAiExtractionResult(null);
    }
  };

  const handleExtractWithAI = async () => {
    if (!selectedFile || !tenantId) return;
    setIsExtractingAI(true);
    setAiExtractionResult(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });
      const fileType = selectedFile.type === 'application/pdf' ? 'pdf' : 'docx';
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/ai/extract-policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          file_name: selectedFile.name,
          file_type: fileType,
          base64_content: base64
        })
      });
      const result = await response.json();
      if (result.success && result.data) {
        const data = result.data;
        if (data.datos_generales) {
          if (data.datos_generales.numero_poliza) setValue('policy_number', data.datos_generales.numero_poliza);
          if (data.datos_generales.anexo) setValue('anexo', data.datos_generales.anexo);
          if (data.datos_generales.tipo_movimiento) setValue('tipo_movimiento', data.datos_generales.tipo_movimiento);
          if (data.datos_generales.fecha_expedicion) setValue('fecha_expedicion', data.datos_generales.fecha_expedicion);
        }
        if (data.vigencia) {
          if (data.vigencia.fecha_desde) setValue('start_date', data.vigencia.fecha_desde);
          if (data.vigencia.fecha_hasta) setValue('end_date', data.vigencia.fecha_hasta);
        }
        if (data.tomador) {
          if (data.tomador.nombre) setValue('tomador_nombre', data.tomador.nombre);
          if (data.tomador.tipo_identificacion) setValue('tomador_tipo_identificacion', data.tomador.tipo_identificacion);
          if (data.tomador.numero_identificacion) setValue('tomador_numero_identificacion', data.tomador.numero_identificacion);
        }
        if (data.asegurado) {
          setAseguradoDiferente(data.asegurado.es_diferente_tomador || false);
          if (data.asegurado.es_diferente_tomador) {
            if (data.asegurado.nombre) setValue('asegurado_nombre', data.asegurado.nombre);
            if (data.asegurado.tipo_identificacion) setValue('asegurado_tipo_identificacion', data.asegurado.tipo_identificacion);
            if (data.asegurado.numero_identificacion) setValue('asegurado_numero_identificacion', data.asegurado.numero_identificacion);
          }
        }
        if (data.valores) {
          if (data.valores.valor_asegurado) {
            setValue('valor_asegurado', data.valores.valor_asegurado);
            setValorAseguradoDisplay(formatCurrency(data.valores.valor_asegurado));
          }
          if (data.valores.prima_neta) {
            setValue('premium', data.valores.prima_neta);
            setPremiumDisplay(formatCurrency(data.valores.prima_neta));
          }
          if (data.valores.gastos_expedicion) {
            setValue('gastos_expedicion', data.valores.gastos_expedicion);
            setGastosDisplay(formatCurrency(data.valores.gastos_expedicion));
          }
          if (data.valores.iva) {
            setValue('iva', data.valores.iva);
            setIvaDisplay(formatCurrency(data.valores.iva));
          }
        }
        if (data.beneficiarios && data.beneficiarios.length > 0) {
          setBeneficiarios(data.beneficiarios);
          setMostrarBeneficiarios(true);
        }
        if (data.notas_extraccion) {
          setNotasValue(data.notas_extraccion);
        }
        if (result.needs_verification) {
          setValue('status', 'verificacion');
        }
        setAiExtractionResult({
          success: true,
          needsVerification: result.needs_verification,
          verificationFields: result.verification_fields
        });
      } else {
        setAiExtractionResult({
          success: false,
          needsVerification: false,
          error: result.error || 'Error al extraer datos'
        });
      }
    } catch (error) {
      console.error('Error extracting with AI:', error);
      setAiExtractionResult({
        success: false,
        needsVerification: false,
        error: 'Error de conexión con el servicio de IA'
      });
    } finally {
      setIsExtractingAI(false);
    }
  };

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
    if (isAutoRamo && (!placaValue || placaValue.length < 4 || placaValue.length > 8)) {
      alert('Para el ramo de Automóviles, la placa es obligatoria (4 a 8 caracteres).');
      return;
    }
    const dataWithExtras: PolicyFormData = {
      ...data,
      placa: isAutoRamo ? placaValue.toUpperCase() : undefined,
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

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-8">

      {/* Lectura Automática con IA */}
      {!isEditing && aiEnabled && !loadingAiStatus && (
        <div className="space-y-4 p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Lectura Automática con IA
            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">Beta</span>
          </h3>
          <p className="text-sm text-muted-foreground">
            Sube el PDF de la póliza y la IA extraerá los datos automáticamente.
          </p>
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              disabled={loading || isExtractingAI}
              className="max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExtractWithAI}
              disabled={!selectedFile || isExtractingAI || loading}
            >
              {isExtractingAI ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Extrayendo...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" />
                  Extraer Datos
                </>
              )}
            </Button>
          </div>
          {selectedFile && (
            <p className="text-xs text-muted-foreground">
              Archivo: {selectedFile.name}
            </p>
          )}
          {aiExtractionResult && (
            <div className="mt-2">
              {aiExtractionResult.success ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                  {aiExtractionResult.needsVerification ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  )}
                  <div className="text-sm">
                    {aiExtractionResult.needsVerification ? (
                      <>
                        <strong>Datos extraídos con observaciones.</strong> Verifica los siguientes campos: {aiExtractionResult.verificationFields?.join(', ')}
                      </>
                    ) : (
                      <strong>Datos extraídos correctamente.</strong>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-800">{aiExtractionResult.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!isEditing && !aiEnabled && !loadingAiStatus && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          La lectura automática con IA no está habilitada para tu cuenta. Contacta al administrador para activarla.
        </div>
      )}

      {/* ======================================= */}
      {/* 1. Datos Generales de la Póliza         */}
      {/* ======================================= */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          1. Datos Generales de la Póliza
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Número de Póliza *</Label>
            <Input {...register('policy_number')} disabled={loading} placeholder="Ej: 1234567" />
            {errors.policy_number && (
              <p className="text-xs text-red-500 mt-1">{errors.policy_number.message}</p>
            )}
          </div>

          <div>
            <Label>Anexo</Label>
            <Select
              defaultValue={(policy as any)?.anexo || '00'}
              onValueChange={(value) => setValue('anexo', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="00" />
              </SelectTrigger>
              <SelectContent>
                {anexoOptions.map((num) => (
                  <SelectItem key={num} value={num}>{num}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Aseguradora *</Label>
            {loadingCatalogs ? (
              <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
              </div>
            ) : tenantCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No tienes compañías activas configuradas.
              </p>
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
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar aseguradora" />
                </SelectTrigger>
                <SelectContent>
                  {tenantCompanies.map((tc) => (
                    <SelectItem key={tc.company_id} value={tc.company_id}>
                      <span className="flex items-center gap-2">
                        {tc.company.name}
                        {tc.company_code && (<span className="text-xs text-muted-foreground">({tc.company_code})</span>)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
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

          <div>
            <Label>Tipo de Movimiento *</Label>
            <Select
              defaultValue={(policy as any)?.tipo_movimiento || 'expedicion'}
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

          <div>
            <Label>Fecha de Expedición</Label>
            <Input type="date" {...register('fecha_expedicion')} disabled={loading} />
          </div>

          {/* Campo Placa - Solo para ramo Automóviles */}
          {isAutoRamo && (
            <div>
              <Label className="flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5" />
                Placa *
              </Label>
              <Input
                value={placaValue}
                onChange={(e) => setPlacaValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                placeholder="Ej: ABC123"
                disabled={loading}
                maxLength={8}
                className={!placaValue || placaValue.length < 4 ? 'border-red-300' : ''}
              />
              {isAutoRamo && placaValue.length > 0 && placaValue.length < 4 && (
                <p className="text-xs text-red-500 mt-1">Mínimo 4 caracteres</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ======================================= */}
      {/* 2. Vigencia de la Póliza                */}
      {/* ======================================= */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          2. Vigencia de la Póliza
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label>Vigencia Desde *</Label>
            <Input type="date" {...register('start_date')} onChange={handleStartDateChange} disabled={loading} />
          </div>
          <div>
            <Label>Vigencia Hasta *</Label>
            <Input type="date" {...register('end_date')} disabled={loading} />
          </div>
          <div>
            <Label>Días de Vigencia</Label>
            <Input
              value={diasVigencia > 0 ? `${diasVigencia} días` : '-'}
              disabled
              className="bg-gray-50"
            />
          </div>
          <div>
            <Label>Estado de la Póliza *</Label>
            <Select
              defaultValue={policy?.status || 'activa'}
              onValueChange={(value) => setValue('status', value as PolicyStatus)}
              disabled={loading || !isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isEditing && (
              <p className="text-xs text-muted-foreground mt-1">
                Estado inicial: Activa
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ======================================= */}
      {/* 3. Asegurado y Beneficiario             */}
      {/* ======================================= */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          3. Asegurado y Beneficiario
        </h3>

        <div className="flex items-center gap-2">
          <Checkbox
            id="asegurado_diferente"
            checked={aseguradoDiferente}
            onCheckedChange={(checked) => setAseguradoDiferente(checked === true)}
            disabled={loading}
          />
          <Label htmlFor="asegurado_diferente" className="cursor-pointer">
            El asegurado es diferente al tomador
          </Label>
        </div>

        {aseguradoDiferente && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Nombre del Asegurado *</Label>
              <Input {...register('asegurado_nombre')} disabled={loading} />
            </div>
            <div>
              <Label>Tipo de Identificación *</Label>
              <Select
                defaultValue={(policy as any)?.asegurado_tipo_identificacion || 'cedula_ciudadania'}
                onValueChange={(value) => setValue('asegurado_tipo_identificacion', value)}
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
            <div>
              <Label>Número de Identificación *</Label>
              <Input {...register('asegurado_numero_identificacion')} disabled={loading} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id="mostrar_beneficiarios"
            checked={mostrarBeneficiarios}
            onCheckedChange={(checked) => setMostrarBeneficiarios(checked === true)}
            disabled={loading}
          />
          <Label htmlFor="mostrar_beneficiarios" className="cursor-pointer">
            Agregar beneficiarios diferentes
          </Label>
        </div>

        {mostrarBeneficiarios && (
          <Button type="button" variant="outline" size="sm" onClick={handleAddBeneficiario} disabled={loading}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        )}

        {mostrarBeneficiarios && beneficiarios.length > 0 && (
          <div className="space-y-3">
            {beneficiarios.map((ben, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 border rounded-lg">
                <div>
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={ben.nombre}
                    onChange={(e) => handleBeneficiarioChange(index, 'nombre', e.target.value)}
                    placeholder="Nombre del beneficiario"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo ID</Label>
                  <Select
                    defaultValue={ben.tipo_identificacion}
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
                <div>
                  <Label className="text-xs">Número ID</Label>
                  <Input
                    value={ben.numero_identificacion}
                    onChange={(e) => handleBeneficiarioChange(index, 'numero_identificacion', e.target.value)}
                    placeholder="Número"
                    disabled={loading}
                  />
                </div>
                <div className="flex items-end">
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================= */}
      {/* 4. Valores de la Póliza                 */}
      {/* ======================================= */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          4. Valores de la Póliza
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <Label>Valor Asegurado *</Label>
            <Input
              value={valorAseguradoDisplay}
              onChange={handleValorAseguradoChange}
              placeholder="$0"
              disabled={loading}
            />
          </div>
          <div>
            <Label>Prima Neta *</Label>
            <Input
              value={premiumDisplay}
              onChange={handlePremiumChange}
              placeholder="$0"
              disabled={loading}
            />
          </div>
          <div>
            <Label>Gastos Expedición</Label>
            <Input
              value={gastosDisplay}
              onChange={handleGastosChange}
              placeholder="$0"
              disabled={loading}
            />
          </div>
          <div>
            <Label>IVA</Label>
            <Input
              value={ivaDisplay}
              onChange={handleIvaChange}
              placeholder="$0"
              disabled={loading}
            />
          </div>
          <div>
            <Label>Total a Pagar</Label>
            <Input
              value={formatCurrency(Number(premium) + Number(gastosExpedicion) + Number(iva))}
              disabled
              className="bg-gray-50 font-semibold"
            />
          </div>
          <div>
            <Label>Comisión %</Label>
            <Input
              type="number"
              step="0.01"
              {...register('commission_pct', { valueAsNumber: true })}
              disabled={loading}
            />
            {loadingCommission && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mt-1" />
            )}
          </div>
        </div>
      </div>

      {/* ======================================= */}
      {/* 5. Gestión Interna CRM                  */}
      {/* ======================================= */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Settings className="h-4 w-4" />
          5. Gestión Interna CRM
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <Label>Usuario</Label>
            <Input value={currentUser?.full_name || ''} disabled className="bg-gray-50" />
          </div>
          <div>
            <Label>Comercial</Label>
            <Input value={comercialName || '-'} disabled className="bg-gray-50" />
          </div>
          <div>
            <Label>Aliado</Label>
            {loadingAlliedAgent ? (
              <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
              </div>
            ) : (
              <Input value={clientAlliedAgent?.full_name || 'Sin aliado'} disabled className="bg-gray-50" />
            )}
          </div>
          <div>
            <Label>Grupo Empresarial</Label>
            <Input value={grupoEmpresarialName || '-'} disabled className="bg-gray-50" />
          </div>

          {clientAlliedAgent && (
            <div>
              <Label>% Comisión Aliado</Label>
              <Input
                type="number"
                step="0.01"
                value={alliedAgentPctValue}
                onChange={(e) => setAlliedAgentPctValue(parseFloat(e.target.value) || 0)}
                disabled={loading}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Porcentaje sobre la comisión de la agencia
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ======================================= */}
      {/* Notas y Comentarios                     */}
      {/* ======================================= */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Notas y Comentarios
        </h3>
        <Textarea
          value={notasValue}
          onChange={(e) => setNotasValue(e.target.value)}
          placeholder="Notas adicionales sobre la póliza..."
          rows={3}
          disabled={loading}
        />
      </div>

      {/* ======================================= */}
      {/* Botones de acción                       */}
      {/* ======================================= */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
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
