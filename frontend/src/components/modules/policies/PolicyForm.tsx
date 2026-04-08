'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Upload,
  Car,
  Download,
  Eye,
  Paperclip
} from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/validations/clients';

// =====================================================
// CONSTANTS
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

const DOC_TYPE_DISPLAY: Record<string, string> = {
  'CC': 'Cédula de Ciudadanía',
  'CE': 'Cédula de Extranjería',
  'PA': 'Pasaporte',
  'TE': 'Tarjeta de Extranjería',
  'RC': 'Registro Civil',
  'NIT': 'NIT',
  'nit': 'NIT',
  'cedula': 'Cédula de Ciudadanía',
  'cedula_ciudadania': 'Cédula de Ciudadanía',
  'cedula_extranjeria': 'Cédula de Extranjería',
  'nit_extranjero': 'NIT Extranjero',
  'pasaporte': 'Pasaporte',
  'carnet_diplomatico': 'Carnet Diplomático',
  'consorcio': 'Consorcio',
  'rut': 'RUT',
};

// =====================================================
// INTERFACES
// =====================================================

interface InsuranceCompany { id: string; name: string; slug: string; }
interface InsuranceLine { id: string; name: string; slug: string; unit: string; }
interface InsuranceGroup { id: string; name: string; slug: string; line_id: string; }
interface TenantCompany { company_id: string; is_active: boolean; company_code: string | null; company: InsuranceCompany; }
interface AlliedAgentOption { id: string; full_name: string; commission_percentage: number; }
interface ClientData { id: string; full_name: string; doc_type: string; doc_number: string; allied_agent_id?: string | null; comercial_id?: string | null; grupo_empresarial_id?: string | null; }
interface Beneficiario { nombre: string; tipo_identificacion: string; numero_identificacion: string; }
interface PendingDocument { file_name: string; file_url: string; file_size: number; document_type: string; }

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
  pendingDocuments?: PendingDocument[];
  metadata?: Record<string, unknown>;
}

interface PolicyFormProps {
  policy?: Policy;
  clientId?: string;
  selectedClient?: Client;
  onSubmit: (data: PolicyFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

// =====================================================
// HELPERS
// =====================================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
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
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// FIX: Mapea doc_type del cliente al enum Zod válido
const mapDocTypeToEnum = (docType: string | undefined | null): string => {
  if (!docType) return 'cedula_ciudadania';
  const mapping: Record<string, string> = {
    'CC': 'cedula_ciudadania',
    'CE': 'cedula_extranjeria',
    'PA': 'pasaporte',
    'TE': 'cedula_extranjeria',
    'RC': 'cedula_ciudadania',
    'NIT': 'nit',
    'nit': 'nit',
    'cedula': 'cedula_ciudadania',
    'cedula_ciudadania': 'cedula_ciudadania',
    'cedula_extranjeria': 'cedula_extranjeria',
    'nit_extranjero': 'nit_extranjero',
    'pasaporte': 'pasaporte',
    'carnet_diplomatico': 'cedula_extranjeria',
    'consorcio': 'nit',
    'rut': 'nit',
  };
  return mapping[docType] || 'cedula_ciudadania';
};

// =====================================================
// COMPONENT
// =====================================================

export function PolicyForm({
  policy,
  clientId,
  selectedClient,
  onSubmit,
  onCancel,
  isLoading = false
}: PolicyFormProps) {
  const isEditing = !!policy;
  const isCreateMode = !isEditing && !!selectedClient;
  const { tenantId } = useTenant();
  const supabase = createClient();

  // =====================================================
  // STATE
  // =====================================================

  const [tenantCompanies, setTenantCompanies] = useState<TenantCompany[]>([]);
  const [availableLines, setAvailableLines] = useState<InsuranceLine[]>([]);
  const [availableGroups, setAvailableGroups] = useState<InsuranceGroup[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [loadingCommission, setLoadingCommission] = useState(false);

  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  const [clientAlliedAgent, setClientAlliedAgent] = useState<AlliedAgentOption | null>(null);
  const [loadingAlliedAgent, setLoadingAlliedAgent] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [alliedAgentPctValue, setAlliedAgentPctValue] = useState(() => {
    if (isEditing && policy) return (policy as any).allied_agent_pct || 0;
    return 0;
  });

  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [comercialName, setComercialName] = useState('');
  const [grupoEmpresarialName, setGrupoEmpresarialName] = useState('');

  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (isEditing && policy) return (policy as any).insurer_id || '';
    return '';
  });
  const [selectedLineId, setSelectedLineId] = useState(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (isEditing && policy) return (policy as any).line_id || '';
    return '';
  });
  const [selectedGroupId, setSelectedGroupId] = useState(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [placaValue, setPlacaValue] = useState(isEditing ? ((policy as any)?.placa || '') : '');
  const isAutoRamo = availableLines.find(l => l.id === selectedLineId)?.name?.toLowerCase().includes('auto') || false;

  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // FIX: Estado para mostrar errores de validación visualmente
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // =====================================================
  // FORM
  // =====================================================

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<PolicyFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(isEditing ? {} : { resolver: zodResolver(CreatePolicyInputSchema) as any }),
    defaultValues: policy ? {
      client_id: policy.client_id,
      policy_number: policy.policy_number,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      anexo: (policy as any).anexo || '00',
      insurer: policy.insurer,
      line: policy.line,
      status: policy.status as PolicyStatus,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tipo_movimiento: (policy as any).tipo_movimiento || 'expedicion',
      currency: policy.currency || 'COP',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      valor_asegurado: (policy as any).valor_asegurado || 0,
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
      tomador_nombre: (policy as any).tomador_nombre || '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tomador_tipo_identificacion: (policy as any).tomador_tipo_identificacion || 'cedula_ciudadania',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tomador_numero_identificacion: (policy as any).tomador_numero_identificacion || '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      asegurado_diferente: (policy as any).asegurado_diferente || false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      asegurado_nombre: (policy as any).asegurado_nombre || '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      asegurado_tipo_identificacion: (policy as any).asegurado_tipo_identificacion || '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      asegurado_numero_identificacion: (policy as any).asegurado_numero_identificacion || '',
    } : {
      // FIX: Agregados insurer y policy_number a los defaults para que Zod no falle con undefined
      client_id: clientId || '',
      policy_number: '',
      insurer: '',
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
      tomador_nombre: selectedClient?.full_name || '',
      // FIX: Usar mapDocTypeToEnum para garantizar valor válido en el enum Zod
      tomador_tipo_identificacion: mapDocTypeToEnum(selectedClient?.doc_type),
      tomador_numero_identificacion: selectedClient?.doc_number || '',
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

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: userData } = await (supabase as any).from('users').select('id, full_name').eq('id', user.id).maybeSingle();
          if (userData) setCurrentUser(userData);
        }
      } catch (err) { console.error('Error loading current user:', err); }
    }
    loadCurrentUser();
  }, [supabase]);

  useEffect(() => {
    async function loadClientData() {
      const cId = clientId || (isEditing && policy ? policy.client_id : null);
      if (!cId) return;
      setLoadingClient(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).from('clients').select('id, full_name, doc_type, doc_number, allied_agent_id, comercial_id, grupo_empresarial_id').eq('id', cId).maybeSingle();
        if (data) {
          setClientData(data);
          setValue('tomador_nombre', data.full_name || '');
          // FIX: Usar mapDocTypeToEnum
          setValue('tomador_tipo_identificacion', mapDocTypeToEnum(data.doc_type));
          setValue('tomador_numero_identificacion', data.doc_number || '');
          if (data.comercial_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: cd } = await (supabase as any).from('users').select('full_name').eq('id', data.comercial_id).maybeSingle();
            if (cd) setComercialName(cd.full_name);
          }
          if (data.grupo_empresarial_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: gd } = await (supabase as any).from('grupos_empresariales').select('nombre').eq('id', data.grupo_empresarial_id).maybeSingle();
            if (gd) setGrupoEmpresarialName(gd.nombre);
          }
        }
      } catch (err) { console.error('Error loading client data:', err); }
      setLoadingClient(false);
    }
    loadClientData();
  }, [clientId, isEditing, policy, supabase, setValue]);

  useEffect(() => {
    if (policy) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = policy as any;
      setNotasValue(p.notas || '');
      setValorAseguradoDisplay(formatCurrency(p.valor_asegurado || 0));
      setPremiumDisplay(formatCurrency(policy.premium || 0));
      setGastosDisplay(formatCurrency(p.gastos_expedicion || 0));
      setIvaDisplay(formatCurrency(p.iva || 0));
      setAseguradoDiferente(p.asegurado_diferente || false);
      setBeneficiarios(p.beneficiarios || []);
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
      if (!cId || !tenantId) { setClientAlliedAgent(null); if (!isEditing) setAlliedAgentPctValue(0); return; }
      setLoadingAlliedAgent(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: cr } = await (supabase as any).from('clients').select('allied_agent_id').eq('id', cId).maybeSingle();
        if (cr?.allied_agent_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: ad } = await (supabase as any).from('allied_agents').select('id, full_name, commission_percentage').eq('id', cr.allied_agent_id).maybeSingle();
          if (ad) { setClientAlliedAgent(ad as AlliedAgentOption); if (!isEditing) setAlliedAgentPctValue(ad.commission_percentage); }
          else { setClientAlliedAgent(null); if (!isEditing) setAlliedAgentPctValue(0); }
        } else { setClientAlliedAgent(null); if (!isEditing) setAlliedAgentPctValue(0); }
      } catch (err) { console.error('Error loading allied agent:', err); setClientAlliedAgent(null); }
      setLoadingAlliedAgent(false);
    }
    loadClientAlliedAgent();
  }, [clientId, tenantId, isEditing, policy, supabase]);

  useEffect(() => {
    async function loadCommission() {
      if (!selectedCompanyId || !selectedGroupId) return;
      setLoadingCommission(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).from('company_group_commissions').select('commission_pct').eq('company_id', selectedCompanyId).eq('group_id', selectedGroupId).maybeSingle();
        if (data && !error) setValue('commission_pct', data.commission_pct);
        else setValue('commission_pct', 10);
      } catch (err) { console.error('Error loading commission:', err); setValue('commission_pct', 10); }
      finally { setLoadingCommission(false); }
    }
    loadCommission();
  }, [selectedCompanyId, selectedGroupId, setValue, supabase]);

  useEffect(() => {
    async function loadTenantCompanies() {
      if (!tenantId) return;
      setLoadingCatalogs(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tcData } = await (supabase as any).from('tenant_companies').select('company_id, is_active, company_code, company:insurance_companies(id, name, slug)').eq('tenant_id', tenantId).eq('is_active', true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (tcData) setTenantCompanies(tcData.map((tc: any) => ({ company_id: tc.company_id, is_active: tc.is_active, company_code: tc.company_code, company: tc.company })));
      } catch (error) { console.error('Error loading tenant companies:', error); }
      finally { setLoadingCatalogs(false); }
    }
    loadTenantCompanies();
  }, [tenantId, supabase]);

  useEffect(() => {
    async function loadLinesForCompany() {
      if (!selectedCompanyId) { setAvailableLines([]); return; }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: clData } = await (supabase as any).from('company_lines').select('line_id, line:insurance_lines(id, name, slug, unit)').eq('company_id', selectedCompanyId).eq('is_active', true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (clData) setAvailableLines(clData.map((cl: any) => cl.line).filter(Boolean));
      } catch (error) { console.error('Error loading lines:', error); }
    }
    loadLinesForCompany();
  }, [selectedCompanyId, supabase]);

  useEffect(() => {
    async function loadGroupsForLine() {
      if (!selectedLineId) { setAvailableGroups([]); return; }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: gd } = await (supabase as any).from('insurance_groups').select('id, name, slug, line_id').eq('line_id', selectedLineId).eq('is_active', true).order('display_order');
        if (gd) { setAvailableGroups(gd as InsuranceGroup[]); if (gd.length > 0 && !isEditing) setSelectedGroupId(gd[0].id); }
      } catch (error) { console.error('Error loading groups:', error); }
    }
    loadGroupsForLine();
  }, [selectedLineId, supabase, isEditing]);

  useEffect(() => {
    if (selectedCompanyId) {
      const company = tenantCompanies.find(tc => tc.company_id === selectedCompanyId)?.company;
      if (company) { setValue('insurer', company.name); setValue('insurer_id', company.id); }
    }
  }, [selectedCompanyId, tenantCompanies, setValue]);

  useEffect(() => {
    if (selectedLineId) {
      const line = availableLines.find(l => l.id === selectedLineId);
      if (line) { setValue('line', line.slug); setValue('line_id', line.id); }
    }
  }, [selectedLineId, availableLines, setValue]);

  useEffect(() => {
    if (selectedGroupId) setValue('group_id', selectedGroupId);
  }, [selectedGroupId, setValue]);

  useEffect(() => {
    if (clientId && !isEditing) setValue('client_id', clientId);
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
    const v = parseCurrencyValue(e.target.value);
    setValue('valor_asegurado', v);
    setValorAseguradoDisplay(formatCurrency(v));
  };
  const handlePremiumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseCurrencyValue(e.target.value);
    setValue('premium', v);
    setPremiumDisplay(formatCurrency(v));
  };
  const handleGastosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseCurrencyValue(e.target.value);
    setValue('gastos_expedicion', v);
    setGastosDisplay(formatCurrency(v));
  };
  const handleIvaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseCurrencyValue(e.target.value);
    setValue('iva', v);
    setIvaDisplay(formatCurrency(v));
  };

  const handleAddBeneficiario = () => {
    setBeneficiarios([...beneficiarios, { nombre: '', tipo_identificacion: 'cedula_ciudadania', numero_identificacion: '' }]);
  };
  const handleRemoveBeneficiario = (index: number) => {
    setBeneficiarios(beneficiarios.filter((_, i) => i !== index));
  };
  const handleBeneficiarioChange = (index: number, field: keyof Beneficiario, value: string) => {
    const updated = [...beneficiarios];
    updated[index] = { ...updated[index], [field]: value };
    setBeneficiarios(updated);
  };

  // Documentos (solo modo creación)
  const handleDocUpload = async (file: File) => {
    if (!tenantId) return;
    setUploadingDoc(true);
    try {
      const filePath = `${tenantId}/policies/new_${Date.now()}_${file.name}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: uploadError } = await (supabase as any).storage.from('policy-documents').upload(filePath, file);
      if (uploadError) { alert('Error al subir archivo: ' + uploadError.message); }
      else { setPendingDocuments(prev => [...prev, { file_name: file.name, file_url: filePath, file_size: file.size, document_type: 'soporte' }]); }
    } catch (err) { console.error('Error uploading:', err); alert('Error al subir el archivo'); }
    setUploadingDoc(false);
  };

  const handleDocView = async (fileUrl: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data }: { data: any } = await (supabase as any).storage.from('policy-documents').createSignedUrl(fileUrl, 60);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
      else alert('No se pudo generar el enlace');
    } catch (err) { console.error('Error viewing doc:', err); }
  };

  const handleDocRemove = async (index: number) => {
    const doc = pendingDocuments[index];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).storage.from('policy-documents').remove([doc.file_url]);
    } catch (err) { console.error('Error removing from storage:', err); }
    setPendingDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = async (data: PolicyFormData) => {
    // Limpiar errores previos
    setFormErrors([]);

    if (isCreateMode && isAutoRamo && (!placaValue || placaValue.length < 4 || placaValue.length > 8)) {
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
      pendingDocuments: isCreateMode ? pendingDocuments : undefined,
    };
    // Crear: si asegurado NO es diferente, copiar datos del tomador
    if (isCreateMode && selectedClient && !aseguradoDiferente) {
      dataWithExtras.asegurado_nombre = selectedClient.full_name;
      // FIX: Usar mapDocTypeToEnum
      dataWithExtras.asegurado_tipo_identificacion = mapDocTypeToEnum(selectedClient.doc_type);
      dataWithExtras.asegurado_numero_identificacion = selectedClient.doc_number;
      if (!beneficiarios || beneficiarios.length === 0) {
        dataWithExtras.beneficiarios = [{
          nombre: selectedClient.full_name,
          // FIX: Usar mapDocTypeToEnum
          tipo_identificacion: mapDocTypeToEnum(selectedClient.doc_type),
          numero_identificacion: selectedClient.doc_number
        }];
      }
    }
    // Crear: forzar estado y tipo movimiento
    if (isCreateMode) {
      dataWithExtras.status = 'activa' as PolicyStatus;
      dataWithExtras.tipo_movimiento = 'expedicion';
      dataWithExtras.tomador_nombre = selectedClient?.full_name || data.tomador_nombre;
      // FIX: Usar mapDocTypeToEnum
      dataWithExtras.tomador_tipo_identificacion = mapDocTypeToEnum(selectedClient?.doc_type) || data.tomador_tipo_identificacion;
      dataWithExtras.tomador_numero_identificacion = selectedClient?.doc_number || data.tomador_numero_identificacion;
    }
    await onSubmit(dataWithExtras);
  };

  // FIX: onError ahora muestra los errores visualmente en lugar de solo console.error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onError = (errs: any) => {
    console.error('Form validation errors:', errs);
    const messages: string[] = [];
    Object.entries(errs).forEach(([key, val]: [string, any]) => {
      if (val?.message) messages.push(`${key}: ${val.message}`);
      else messages.push(`${key}: Campo inválido`);
    });
    setFormErrors(messages);
  };

  // =====================================================
  // COMPUTED
  // =====================================================

  const loading = isLoading || isSubmitting;
  const anexoOptions = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));
  const diasVigencia = calcularDiasVigencia(startDate, endDate);

  // ###################################################
  // CREATE MODE RENDER
  // ###################################################

  if (isCreateMode && selectedClient) {
    return (
      <form onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-6">

        {/* 1. INFORMACIÓN DEL TOMADOR */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Información del Tomador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Nombre</Label>
                <p className="text-sm font-medium">{selectedClient.full_name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo Identificación</Label>
                <p className="text-sm font-medium">{DOC_TYPE_DISPLAY[selectedClient.doc_type] || selectedClient.doc_type}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Número Identificación</Label>
                <p className="text-sm font-medium">{selectedClient.doc_number}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Teléfono</Label>
                <p className="text-sm font-medium">{selectedClient.phone || '-'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dirección</Label>
                <p className="text-sm font-medium">{selectedClient.address || '-'}</p>
              </div>
            </div>

            {/* Asegurado */}
            <div className="pt-3 border-t space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="aseg_dif_create" checked={aseguradoDiferente} onCheckedChange={(c) => setAseguradoDiferente(c === true)} disabled={loading} />
                <Label htmlFor="aseg_dif_create" className="cursor-pointer text-sm">El asegurado es diferente al tomador</Label>
              </div>
              {aseguradoDiferente && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><Label>Nombre del Asegurado *</Label><Input {...register('asegurado_nombre')} disabled={loading} /></div>
                  <div>
                    <Label>Tipo de Identificación *</Label>
                    <Select defaultValue="cedula_ciudadania" onValueChange={(v) => setValue('asegurado_tipo_identificacion', v)} disabled={loading}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPO_IDENTIFICACION_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Número de Identificación *</Label><Input {...register('asegurado_numero_identificacion')} disabled={loading} /></div>
                </div>
              )}

              {/* Beneficiarios */}
              <div className="flex items-center gap-2">
                <Checkbox id="ben_create" checked={mostrarBeneficiarios} onCheckedChange={(c) => setMostrarBeneficiarios(c === true)} disabled={loading} />
                <Label htmlFor="ben_create" className="cursor-pointer text-sm">Agregar beneficiarios diferentes</Label>
              </div>
              {mostrarBeneficiarios && (
                <Button type="button" variant="outline" size="sm" onClick={handleAddBeneficiario} disabled={loading}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
              )}
              {mostrarBeneficiarios && beneficiarios.length > 0 && (
                <div className="space-y-3">
                  {beneficiarios.map((ben, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 border rounded-lg">
                      <div><Label className="text-xs">Nombre</Label><Input value={ben.nombre} onChange={(e) => handleBeneficiarioChange(index, 'nombre', e.target.value)} disabled={loading} /></div>
                      <div>
                        <Label className="text-xs">Tipo ID</Label>
                        <Select defaultValue={ben.tipo_identificacion} onValueChange={(v) => handleBeneficiarioChange(index, 'tipo_identificacion', v)} disabled={loading}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{TIPO_IDENTIFICACION_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Número ID</Label><Input value={ben.numero_identificacion} onChange={(e) => handleBeneficiarioChange(index, 'numero_identificacion', e.target.value)} disabled={loading} /></div>
                      <div className="flex items-end"><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveBeneficiario(index)} disabled={loading} className="text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. DATOS GENERALES DE LA PÓLIZA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Datos Generales de la Póliza
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Número de Póliza *</Label>
                <Input {...register('policy_number')} disabled={loading} placeholder="Ej: 1234567" />
                {errors.policy_number && <p className="text-xs text-red-500 mt-1">{errors.policy_number.message}</p>}
              </div>
              <div>
                <Label>Anexo</Label>
                <Select defaultValue="00" onValueChange={(v) => setValue('anexo', v)} disabled={loading}>
                  <SelectTrigger><SelectValue placeholder="00" /></SelectTrigger>
                  <SelectContent>{anexoOptions.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Aseguradora *</Label>
                {loadingCatalogs ? (
                  <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando...</div>
                ) : (
                  <Select defaultValue={selectedCompanyId} onValueChange={(v) => { setSelectedCompanyId(v); setSelectedLineId(''); setSelectedGroupId(''); setAvailableGroups([]); }} disabled={loading}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar aseguradora" /></SelectTrigger>
                    <SelectContent>{tenantCompanies.map((tc) => (<SelectItem key={tc.company_id} value={tc.company_id}><span className="flex items-center gap-2">{tc.company.name}{tc.company_code && (<span className="text-xs text-muted-foreground">({tc.company_code})</span>)}</span></SelectItem>))}</SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>Ramo *</Label>
                <Select defaultValue={selectedLineId} onValueChange={(v) => { setSelectedLineId(v); setSelectedGroupId(''); setAvailableGroups([]); }} disabled={loading || !selectedCompanyId || availableLines.length === 0}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar ramo" /></SelectTrigger>
                  <SelectContent>{availableLines.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              {availableGroups.length > 0 && (
                <div>
                  <Label>Grupo</Label>
                  <Select defaultValue={selectedGroupId} onValueChange={(v) => setSelectedGroupId(v)} disabled={loading}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar grupo" /></SelectTrigger>
                    <SelectContent>{availableGroups.map((g) => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              )}
              {isAutoRamo && (
                <div>
                  <Label className="flex items-center gap-1.5"><Car className="h-3.5 w-3.5" />Placa *</Label>
                  <Input
                    value={placaValue}
                    onChange={(e) => setPlacaValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                    placeholder="Ej: ABC123" disabled={loading} maxLength={8}
                    className={!placaValue || placaValue.length < 4 ? 'border-red-300' : ''}
                  />
                  {placaValue.length > 0 && placaValue.length < 4 && <p className="text-xs text-red-500 mt-1">Mínimo 4 caracteres</p>}
                </div>
              )}
              <div>
                <Label>Tipo de Movimiento</Label>
                <Input value="Expedición" disabled className="bg-gray-50" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. VIGENCIA DE LA PÓLIZA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Vigencia de la Póliza
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div><Label>Fecha de Expedición</Label><Input type="date" {...register('fecha_expedicion')} disabled={loading} /></div>
              <div><Label>Vigencia Desde *</Label><Input type="date" {...register('start_date')} onChange={handleStartDateChange} disabled={loading} /></div>
              <div><Label>Vigencia Hasta *</Label><Input type="date" {...register('end_date')} disabled={loading} /></div>
              <div><Label>Días de Vigencia</Label><Input value={diasVigencia > 0 ? `${diasVigencia} días` : '-'} disabled className="bg-gray-50" /></div>
            </div>
          </CardContent>
        </Card>

        {/* 4. VALORES DE LA PÓLIZA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Valores de la Póliza
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div><Label>Valor Asegurado *</Label><Input value={valorAseguradoDisplay} onChange={handleValorAseguradoChange} placeholder="$0" disabled={loading} /></div>
              <div><Label>Prima Neta *</Label><Input value={premiumDisplay} onChange={handlePremiumChange} placeholder="$0" disabled={loading} /></div>
              <div><Label>Gastos Expedición</Label><Input value={gastosDisplay} onChange={handleGastosChange} placeholder="$0" disabled={loading} /></div>
              <div><Label>IVA</Label><Input value={ivaDisplay} onChange={handleIvaChange} placeholder="$0" disabled={loading} /></div>
              <div><Label>Total a Pagar</Label><Input value={formatCurrency(Number(premium) + Number(gastosExpedicion) + Number(iva))} disabled className="bg-gray-50 font-semibold" /></div>
              <div><Label>Comisión %</Label><Input type="number" step="0.01" {...register('commission_pct', { valueAsNumber: true })} disabled={loading} />{loadingCommission && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mt-1" />}</div>
            </div>
          </CardContent>
        </Card>

        {/* 5. GESTIÓN INTERNA CRM */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Gestión Interna CRM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div><Label>Usuario</Label><Input value={currentUser?.full_name || ''} disabled className="bg-gray-50" /></div>
              <div><Label>Comercial</Label><Input value={comercialName || '-'} disabled className="bg-gray-50" /></div>
              <div>
                <Label>Aliado</Label>
                {loadingAlliedAgent ? (<div className="flex items-center gap-2 h-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando...</div>) : (<Input value={clientAlliedAgent?.full_name || 'Sin aliado'} disabled className="bg-gray-50" />)}
              </div>
              <div><Label>Grupo Empresarial</Label><Input value={grupoEmpresarialName || '-'} disabled className="bg-gray-50" /></div>
              {clientAlliedAgent && (
                <div>
                  <Label>% Comisión Aliado</Label>
                  <Input type="number" step="0.01" value={alliedAgentPctValue} onChange={(e) => setAlliedAgentPctValue(parseFloat(e.target.value) || 0)} disabled={loading} />
                  <p className="text-[10px] text-muted-foreground mt-1">Porcentaje sobre la comisión de la agencia</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 6. NOTAS Y COMENTARIOS */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Notas y Comentarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={notasValue} onChange={(e) => setNotasValue(e.target.value)} placeholder="Notas adicionales sobre la póliza..." rows={3} disabled={loading} />
          </CardContent>
        </Card>

        {/* 7. DOCUMENTOS */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Documentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { handleDocUpload(file); e.target.value = ''; }
                }}
                disabled={uploadingDoc || loading}
                className="max-w-xs text-sm"
              />
              {uploadingDoc && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Subiendo...</div>}
            </div>
            {pendingDocuments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{pendingDocuments.length} documento(s) adjunto(s):</p>
                {pendingDocuments.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded border text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{doc.file_name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDocView(doc.file_url)}><Eye className="h-3.5 w-3.5" /></Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleDocRemove(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pendingDocuments.length === 0 && <p className="text-xs text-muted-foreground italic">Sin documentos adjuntos</p>}
          </CardContent>
        </Card>

        {/* FIX: ERRORES DE VALIDACIÓN VISIBLES */}
        {formErrors.length > 0 && (
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-sm font-medium text-red-800">Corrige los siguientes errores:</p>
            </div>
            <ul className="list-disc pl-5 text-xs text-red-700 space-y-1">
              {formErrors.map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </div>
        )}

        {/* BOTÓN CREAR PÓLIZA */}
        <div className="flex items-center justify-end pt-4 border-t">
          <Button type="submit" disabled={loading}>
            {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</>) : (<><Save className="h-4 w-4 mr-2" />Crear Póliza</>)}
          </Button>
        </div>
      </form>
    );
  }

  // ###################################################
  // EDIT MODE RENDER (sin cambios respecto al original)
  // ###################################################

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-8">

      {/* 1. Datos Generales de la Póliza */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          1. Datos Generales de la Póliza
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Número de Póliza *</Label>
            <Input {...register('policy_number')} disabled={loading} placeholder="Ej: 1234567" />
            {errors.policy_number && <p className="text-xs text-red-500 mt-1">{errors.policy_number.message}</p>}
          </div>
          <div>
            <Label>Anexo</Label>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Select defaultValue={(policy as any)?.anexo || '00'} onValueChange={(v) => setValue('anexo', v)} disabled={loading}>
              <SelectTrigger><SelectValue placeholder="00" /></SelectTrigger>
              <SelectContent>{anexoOptions.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Aseguradora *</Label>
            {loadingCatalogs ? (
              <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando...</div>
            ) : tenantCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No tienes compañías activas configuradas.</p>
            ) : (
              <Select defaultValue={selectedCompanyId} onValueChange={(v) => { setSelectedCompanyId(v); setSelectedLineId(''); setSelectedGroupId(''); setAvailableGroups([]); }} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="Seleccionar aseguradora" /></SelectTrigger>
                <SelectContent>{tenantCompanies.map((tc) => (<SelectItem key={tc.company_id} value={tc.company_id}><span className="flex items-center gap-2">{tc.company.name}{tc.company_code && (<span className="text-xs text-muted-foreground">({tc.company_code})</span>)}</span></SelectItem>))}</SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Ramo *</Label>
            <Select defaultValue={selectedLineId} onValueChange={(v) => { setSelectedLineId(v); setSelectedGroupId(''); setAvailableGroups([]); }} disabled={loading || !selectedCompanyId || availableLines.length === 0}>
              <SelectTrigger><SelectValue placeholder="Seleccionar ramo" /></SelectTrigger>
              <SelectContent>{availableLines.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Movimiento *</Label>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Select defaultValue={(policy as any)?.tipo_movimiento || 'expedicion'} onValueChange={(v) => setValue('tipo_movimiento', v)} disabled={loading}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{TIPO_MOVIMIENTO_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha de Expedición</Label>
            <Input type="date" {...register('fecha_expedicion')} disabled={loading} />
          </div>
        </div>
      </div>

      {/* 2. Vigencia de la Póliza */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          2. Vigencia de la Póliza
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><Label>Vigencia Desde *</Label><Input type="date" {...register('start_date')} onChange={handleStartDateChange} disabled={loading} /></div>
          <div><Label>Vigencia Hasta *</Label><Input type="date" {...register('end_date')} disabled={loading} /></div>
          <div><Label>Días de Vigencia</Label><Input value={diasVigencia > 0 ? `${diasVigencia} días` : '-'} disabled className="bg-gray-50" /></div>
          <div>
            <Label>Estado de la Póliza *</Label>
            <Select defaultValue={policy?.status || 'activa'} onValueChange={(v) => setValue('status', v as PolicyStatus)} disabled={loading || !isEditing}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statusOptions.map(({ value, label }) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}</SelectContent>
            </Select>
            {!isEditing && <p className="text-xs text-muted-foreground mt-1">Estado inicial: Activa</p>}
          </div>
        </div>
      </div>

      {/* 3. Información del Tomador */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <User className="h-4 w-4" />
          3. Información del Tomador
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><Label>Nombre del Tomador *</Label><Input {...register('tomador_nombre')} disabled={loading} /></div>
          <div>
            <Label>Tipo de Identificación *</Label>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Select defaultValue={(policy as any)?.tomador_tipo_identificacion || 'cedula_ciudadania'} onValueChange={(v) => setValue('tomador_tipo_identificacion', v)} disabled={loading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPO_IDENTIFICACION_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div><Label>Número de Identificación *</Label><Input {...register('tomador_numero_identificacion')} disabled={loading} /></div>
        </div>
      </div>

      {/* 4. Asegurado y Beneficiario */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          4. Asegurado y Beneficiario
        </h3>
        <div className="flex items-center gap-2">
          <Checkbox id="asegurado_diferente" checked={aseguradoDiferente} onCheckedChange={(c) => setAseguradoDiferente(c === true)} disabled={loading} />
          <Label htmlFor="asegurado_diferente" className="cursor-pointer">El asegurado es diferente al tomador</Label>
        </div>
        {aseguradoDiferente && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><Label>Nombre del Asegurado *</Label><Input {...register('asegurado_nombre')} disabled={loading} /></div>
            <div>
              <Label>Tipo de Identificación *</Label>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Select defaultValue={(policy as any)?.asegurado_tipo_identificacion || 'cedula_ciudadania'} onValueChange={(v) => setValue('asegurado_tipo_identificacion', v)} disabled={loading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPO_IDENTIFICACION_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div><Label>Número de Identificación *</Label><Input {...register('asegurado_numero_identificacion')} disabled={loading} /></div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Checkbox id="mostrar_beneficiarios" checked={mostrarBeneficiarios} onCheckedChange={(c) => setMostrarBeneficiarios(c === true)} disabled={loading} />
          <Label htmlFor="mostrar_beneficiarios" className="cursor-pointer">Agregar beneficiarios diferentes</Label>
        </div>
        {mostrarBeneficiarios && (
          <Button type="button" variant="outline" size="sm" onClick={handleAddBeneficiario} disabled={loading}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
        )}
        {mostrarBeneficiarios && beneficiarios.length > 0 && (
          <div className="space-y-3">
            {beneficiarios.map((ben, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 border rounded-lg">
                <div><Label className="text-xs">Nombre</Label><Input value={ben.nombre} onChange={(e) => handleBeneficiarioChange(index, 'nombre', e.target.value)} placeholder="Nombre del beneficiario" disabled={loading} /></div>
                <div>
                  <Label className="text-xs">Tipo ID</Label>
                  <Select defaultValue={ben.tipo_identificacion} onValueChange={(v) => handleBeneficiarioChange(index, 'tipo_identificacion', v)} disabled={loading}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPO_IDENTIFICACION_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Número ID</Label><Input value={ben.numero_identificacion} onChange={(e) => handleBeneficiarioChange(index, 'numero_identificacion', e.target.value)} placeholder="Número" disabled={loading} /></div>
                <div className="flex items-end"><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveBeneficiario(index)} disabled={loading} className="text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Valores de la Póliza */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          5. Valores de la Póliza
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div><Label>Valor Asegurado *</Label><Input value={valorAseguradoDisplay} onChange={handleValorAseguradoChange} placeholder="$0" disabled={loading} /></div>
          <div><Label>Prima Neta *</Label><Input value={premiumDisplay} onChange={handlePremiumChange} placeholder="$0" disabled={loading} /></div>
          <div><Label>Gastos Expedición</Label><Input value={gastosDisplay} onChange={handleGastosChange} placeholder="$0" disabled={loading} /></div>
          <div><Label>IVA</Label><Input value={ivaDisplay} onChange={handleIvaChange} placeholder="$0" disabled={loading} /></div>
          <div><Label>Total a Pagar</Label><Input value={formatCurrency(Number(premium) + Number(gastosExpedicion) + Number(iva))} disabled className="bg-gray-50 font-semibold" /></div>
          <div><Label>Comisión %</Label><Input type="number" step="0.01" {...register('commission_pct', { valueAsNumber: true })} disabled={loading} />{loadingCommission && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mt-1" />}</div>
        </div>
      </div>

      {/* 6. Gestión Interna CRM */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Settings className="h-4 w-4" />
          6. Gestión Interna CRM
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div><Label>Usuario</Label><Input value={currentUser?.full_name || ''} disabled className="bg-gray-50" /></div>
          <div><Label>Comercial</Label><Input value={comercialName || '-'} disabled className="bg-gray-50" /></div>
          <div>
            <Label>Aliado</Label>
            {loadingAlliedAgent ? (<div className="flex items-center gap-2 h-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando...</div>) : (<Input value={clientAlliedAgent?.full_name || 'Sin aliado'} disabled className="bg-gray-50" />)}
          </div>
          <div><Label>Grupo Empresarial</Label><Input value={grupoEmpresarialName || '-'} disabled className="bg-gray-50" /></div>
          {clientAlliedAgent && (
            <div>
              <Label>% Comisión Aliado</Label>
              <Input type="number" step="0.01" value={alliedAgentPctValue} onChange={(e) => setAlliedAgentPctValue(parseFloat(e.target.value) || 0)} disabled={loading} />
              <p className="text-[10px] text-muted-foreground mt-1">Porcentaje sobre la comisión de la agencia</p>
            </div>
          )}
        </div>
      </div>

      {/* Notas y Comentarios */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Notas y Comentarios
        </h3>
        <Textarea value={notasValue} onChange={(e) => setNotasValue(e.target.value)} placeholder="Notas adicionales sobre la póliza..." rows={3} disabled={loading} />
      </div>

      {/* FIX: ERRORES DE VALIDACIÓN VISIBLES (modo edición) */}
      {formErrors.length > 0 && (
        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-sm font-medium text-red-800">Corrige los siguientes errores:</p>
          </div>
          <ul className="list-disc pl-5 text-xs text-red-700 space-y-1">
            {formErrors.map((msg, i) => <li key={i}>{msg}</li>)}
          </ul>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            <X className="h-4 w-4 mr-2" />Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>) : (<><Save className="h-4 w-4 mr-2" />{isEditing ? 'Actualizar Póliza' : 'Crear Póliza'}</>)}
        </Button>
      </div>
    </form>
  );
}
