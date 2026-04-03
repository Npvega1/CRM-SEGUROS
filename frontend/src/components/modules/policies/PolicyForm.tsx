'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Trash2,
  Upload,
  Sparkles,
  CheckCircle,
  AlertTriangle
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

  // Estados para IA
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

  // Cargar estado de IA del tenant
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
