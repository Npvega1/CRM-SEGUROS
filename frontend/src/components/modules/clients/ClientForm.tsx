'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import {
  Loader2,
  Check,
  ChevronsUpDown,
  Search,
  Lock,
  Users,
  Briefcase,
  Building2,
  Upload,
  FileText,
  Trash2,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  User,
  MapPin,
  DollarSign,
  FileCheck,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =====================================================
// INTERFACES
// =====================================================

interface AlliedAgent {
  id: string;
  full_name: string;
}

interface Comercial {
  id: string;
  full_name: string;
}

interface GrupoEmpresarial {
  id: string;
  nombre: string;
}

interface UploadedDocument {
  id: string;
  name: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_at: string;
  status: 'pendiente' | 'cargado';
}

interface ClientFormProps {
  initialData?: any;
  tenantId: string;
  agentId: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const TIPO_IDENTIFICACION_NATURAL = [
  { value: 'CC', label: 'Cedula de Ciudadania' },
  { value: 'CE', label: 'Cedula de Extranjeria' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'TE', label: 'Tarjeta de Extranjeria' },
  { value: 'RC', label: 'Registro Civil' },
];

const TIPO_IDENTIFICACION_JURIDICA = [
  { value: 'CC', label: 'Cedula de Ciudadania' },
  { value: 'CE', label: 'Cedula de Extranjeria' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'TE', label: 'Tarjeta de Extranjeria' },
  { value: 'RC', label: 'Registro Civil' },
];

const ESTADO_CIVIL_OPTIONS = [
  { value: 'soltero', label: 'Soltero(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'union_libre', label: 'Union Libre' },
  { value: 'separado', label: 'Separado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viudo', label: 'Viudo(a)' },
];

const TIPO_SOLICITUD_OPTIONS = [
  { value: 'vinculacion', label: 'Vinculacion' },
  { value: 'renovacion', label: 'Renovacion' },
  { value: 'actualizacion', label: 'Actualizacion' },
];

const TIPO_EMPRESA_OPTIONS = [
  { value: 'publica', label: 'Publica' },
  { value: 'privada', label: 'Privada' },
  { value: 'mixta', label: 'Mixta' },
  { value: 'sin_animo_lucro', label: 'Sin Animo de Lucro' },
];

const TIPO_EMPLEO_OPTIONS = [
  { value: 'empleado', label: 'Empleado' },
  { value: 'independiente', label: 'Independiente' },
  { value: 'pensionado', label: 'Pensionado' },
];

// =====================================================
// HELPER FUNCTIONS
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

// =====================================================
// MAIN COMPONENT
// =====================================================

export function ClientForm({ initialData, tenantId, agentId }: ClientFormProps) {
  const router = useRouter();
  const { tenantPlan } = useTenant();
  const supabase = createClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Errores de validacion
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  // Tipo de cliente
  const [clientType, setClientType] = useState<'persona_natural' | 'persona_juridica'>(
    initialData?.segment || 'persona_natural'
  );

  // IA
  const [isExtractingAI, setIsExtractingAI] = useState(false);
  const [aiExtractionResult, setAiExtractionResult] = useState<{
    success: boolean;
    needsVerification: boolean;
    verificationFields?: string[];
    error?: string;
  } | null>(null);

  // Documentos
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Aliados
  const [alliedAgents, setAlliedAgents] = useState<AlliedAgent[]>([]);
  const [loadingAllies, setLoadingAllies] = useState(true);
  const [allyOpen, setAllyOpen] = useState(false);
  const [allySearch, setAllySearch] = useState('');
  const [selectedAllyId, setSelectedAllyId] = useState<string | null>(initialData?.allied_agent_id || null);

  // Comerciales
  const [comerciales, setComerciales] = useState<Comercial[]>([]);
  const [loadingComerciales, setLoadingComerciales] = useState(true);
  const [comercialOpen, setComercialOpen] = useState(false);
  const [comercialSearch, setComercialSearch] = useState('');
  const [selectedComercialId, setSelectedComercialId] = useState<string | null>(initialData?.comercial_id || null);

  // Grupos Empresariales
  const [gruposEmpresariales, setGruposEmpresariales] = useState<GrupoEmpresarial[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(true);
  const [grupoOpen, setGrupoOpen] = useState(false);
  const [grupoSearch, setGrupoSearch] = useState('');
  const [selectedGrupoId, setSelectedGrupoId] = useState<string | null>(initialData?.grupo_empresarial_id || null);

  // Usuario actual
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);

  // Permisos
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canModifyAllied, setCanModifyAllied] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  const isEditing = Boolean(initialData?.id);
  const clientHasAllied = Boolean(initialData?.allied_agent_id);
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const canEditAlliedField = isAdmin || !isEditing || !clientHasAllied || canModifyAllied;
  const hasPremiumAccess = tenantPlan === 'premium' || tenantPlan === 'trial';

  // Form state para Persona Natural
  const [formNatural, setFormNatural] = useState({
    primer_apellido: initialData?.primer_apellido || '',
    segundo_apellido: initialData?.segundo_apellido || '',
    primer_nombre: initialData?.primer_nombre || '',
    otros_nombres: initialData?.otros_nombres || '',
    tipo_identificacion: initialData?.doc_type || 'CC',
    numero_identificacion: initialData?.doc_number || '',
    lugar_expedicion: initialData?.lugar_expedicion || '',
    fecha_expedicion: initialData?.fecha_expedicion || '',
    fecha_nacimiento: initialData?.fecha_nacimiento || '',
    lugar_nacimiento: initialData?.lugar_nacimiento || '',
    nacionalidad: initialData?.nacionalidad || 'Colombiana',
    sexo: initialData?.sexo || '',
    estado_civil: initialData?.estado_civil || '',
    tipo_solicitud: initialData?.tipo_solicitud || 'vinculacion',
    direccion_residencia: initialData?.address || '',
    municipio_residencia: initialData?.municipio_residencia || '',
    departamento_residencia: initialData?.departamento_residencia || '',
    pais_residencia: initialData?.pais_residencia || 'Colombia',
    direccion_laboral: initialData?.direccion_laboral || '',
    municipio_laboral: initialData?.municipio_laboral || '',
    departamento_laboral: initialData?.departamento_laboral || '',
    telefono_fijo: initialData?.telefono_fijo || '',
    celular: initialData?.phone || '',
    correo_electronico: initialData?.email || '',
    ocupacion: initialData?.ocupacion || '',
    nombre_empresa: initialData?.nombre_empresa || '',
    cargo: initialData?.cargo || '',
    actividad_economica_ciiu: initialData?.actividad_economica_ciiu || '',
    tipo_empleo: initialData?.tipo_empleo || '',
    ingresos_mensuales: initialData?.ingresos_mensuales || 0,
    egresos_mensuales: initialData?.egresos_mensuales || 0,
    total_activos: initialData?.total_activos || 0,
    total_pasivos: initialData?.total_pasivos || 0,
    otros_ingresos: initialData?.otros_ingresos || 0,
    concepto_otros_ingresos: initialData?.concepto_otros_ingresos || '',
  });

  // Form state para Persona Juridica
  const [formJuridica, setFormJuridica] = useState({
    razon_social: initialData?.full_name || '',
    nit: initialData?.doc_number || '',
    digito_verificacion: initialData?.digito_verificacion || '',
    tipo_empresa: initialData?.tipo_empresa || '',
    actividad_economica_ciiu_principal: initialData?.actividad_economica_ciiu_principal || '',
    actividad_economica_ciiu_secundaria: initialData?.actividad_economica_ciiu_secundaria || '',
    numero_empleados: initialData?.numero_empleados || '',
    tipo_solicitud: initialData?.tipo_solicitud || 'vinculacion',
    direccion_principal: initialData?.address || '',
    municipio: initialData?.municipio || '',
    departamento: initialData?.departamento || '',
    pais: initialData?.pais || 'Colombia',
    direccion_sucursal: initialData?.direccion_sucursal || '',
    telefono: initialData?.phone || '',
    celular: initialData?.celular || '',
    correo_electronico: initialData?.email || '',
    rep_primer_apellido: initialData?.rep_primer_apellido || '',
    rep_segundo_apellido: initialData?.rep_segundo_apellido || '',
    rep_nombres: initialData?.rep_nombres || '',
    rep_tipo_identificacion: initialData?.rep_tipo_identificacion || 'CC',
    rep_numero_identificacion: initialData?.rep_numero_identificacion || '',
    rep_lugar_expedicion: initialData?.rep_lugar_expedicion || '',
    rep_fecha_expedicion: initialData?.rep_fecha_expedicion || '',
    rep_fecha_nacimiento: initialData?.rep_fecha_nacimiento || '',
    rep_lugar_nacimiento: initialData?.rep_lugar_nacimiento || '',
    rep_sexo: initialData?.rep_sexo || '',
    rep_estado_civil: initialData?.rep_estado_civil || '',
    rep_nacionalidad: initialData?.rep_nacionalidad || 'Colombiana',
    total_activos: initialData?.total_activos || 0,
    total_pasivos: initialData?.total_pasivos || 0,
    total_patrimonio: initialData?.total_patrimonio || 0,
    ingresos_mensuales: initialData?.ingresos_mensuales || 0,
    egresos_mensuales: initialData?.egresos_mensuales || 0,
    otros_ingresos: initialData?.otros_ingresos || 0,
  });

  const [currencyDisplays, setCurrencyDisplays] = useState({
    ingresos_mensuales: formatCurrency(formNatural.ingresos_mensuales),
    egresos_mensuales: formatCurrency(formNatural.egresos_mensuales),
    total_activos: formatCurrency(formNatural.total_activos),
    total_pasivos: formatCurrency(formNatural.total_pasivos),
    otros_ingresos: formatCurrency(formNatural.otros_ingresos),
    jur_total_activos: formatCurrency(formJuridica.total_activos),
    jur_total_pasivos: formatCurrency(formJuridica.total_pasivos),
    jur_total_patrimonio: formatCurrency(formJuridica.total_patrimonio),
    jur_ingresos_mensuales: formatCurrency(formJuridica.ingresos_mensuales),
    jur_egresos_mensuales: formatCurrency(formJuridica.egresos_mensuales),
    jur_otros_ingresos: formatCurrency(formJuridica.otros_ingresos),
  });

  const patrimonioNatural = formNatural.total_activos - formNatural.total_pasivos;

  // Helper para clase de error
  const err = (field: string) => formErrors[field] ? 'border-red-500 focus-visible:ring-red-500' : '';
  const errSelect = (field: string) => formErrors[field] ? 'border-red-500' : '';

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await (supabase as any)
            .from('users')
            .select('id, full_name, role')
            .eq('id', user.id)
            .single();
          if (userData) {
            setCurrentUser(userData);
            setUserRole(userData.role);
          }
        }
      } catch (e) {
        console.error('Error loading current user:', e);
      } finally {
        setLoadingPermissions(false);
      }
    }
    loadCurrentUser();
  }, [supabase]);

  useEffect(() => {
    async function loadAlliedAgents() {
      try {
        const { data, error } = await (supabase as any).from('allied_agents').select('id, full_name').eq('tenant_id', tenantId).eq('status', 'active').order('full_name');
        if (!error && data) setAlliedAgents(data);
      } catch (e) { console.error('Error loading allied agents:', e); } finally { setLoadingAllies(false); }
    }
    loadAlliedAgents();
  }, [tenantId, supabase]);

  useEffect(() => {
    async function loadComerciales() {
      try {
        const { data, error } = await (supabase as any).from('users').select('id, full_name').eq('tenant_id', tenantId).eq('role', 'comercial').eq('is_active', true).order('full_name');
        if (!error && data) setComerciales(data);
      } catch (e) { console.error('Error loading comerciales:', e); } finally { setLoadingComerciales(false); }
    }
    loadComerciales();
  }, [tenantId, supabase]);

  useEffect(() => {
    async function loadGruposEmpresariales() {
      try {
        const { data, error } = await (supabase as any).from('grupos_empresariales').select('id, nombre').eq('tenant_id', tenantId).eq('is_active', true).order('nombre');
        if (!error && data) setGruposEmpresariales(data);
      } catch (e) { console.error('Error loading grupos empresariales:', e); } finally { setLoadingGrupos(false); }
    }
    loadGruposEmpresariales();
  }, [tenantId, supabase]);

  useEffect(() => {
    async function loadDocuments() {
      if (!initialData?.id) return;
      try {
        const { data, error } = await (supabase as any).from('client_documents').select('*').eq('client_id', initialData.id).order('created_at', { ascending: false });
        if (!error && data) {
          setDocuments(data.map((doc: any) => ({ id: doc.id, name: doc.document_type, file_name: doc.file_name, file_url: doc.file_url, file_type: doc.file_type, uploaded_at: doc.created_at, status: 'cargado' as const })));
        }
      } catch (e) { console.error('Error loading documents:', e); }
    }
    loadDocuments();
  }, [initialData?.id, supabase]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleNaturalChange = (field: string, value: any) => {
    setFormNatural(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: false }));
  };

  const handleJuridicaChange = (field: string, value: any) => {
    setFormJuridica(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: false }));
  };

  const handleCurrencyChange = (field: string, value: string, isJuridica: boolean = false) => {
    const numericValue = parseCurrencyValue(value);
    if (isJuridica) {
      setFormJuridica(prev => ({ ...prev, [field]: numericValue }));
      setCurrencyDisplays(prev => ({ ...prev, [`jur_${field}`]: formatCurrency(numericValue) }));
    } else {
      setFormNatural(prev => ({ ...prev, [field]: numericValue }));
      setCurrencyDisplays(prev => ({ ...prev, [field]: formatCurrency(numericValue) }));
    }
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: false }));
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const docKey = `doc_${Date.now()}`;
    setUploadingDoc(docKey);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('client-documents').upload(fileName, file);
      if (uploadError) { console.error('Upload error:', uploadError); alert('Error al subir el archivo'); return; }
      // Guardamos solo la ruta del archivo, NO la URL publica (el bucket es privado)
      const newDoc: UploadedDocument = { id: `temp_${Date.now()}`, name: docKey, file_name: file.name, file_url: fileName, file_type: fileExt || 'pdf', uploaded_at: new Date().toISOString(), status: 'cargado' };
      setDocuments(prev => [...prev, newDoc]);
    } catch (e) { console.error('Error uploading file:', e); alert('Error al subir el archivo'); } finally { setUploadingDoc(null); }
  };

  // Extraer ruta de storage (compatible con URLs publicas viejas y rutas nuevas)
  const getStoragePath = (fileUrl: string): string => {
    if (!fileUrl.startsWith('http')) return fileUrl;
    const marker = '/client-documents/';
    const idx = fileUrl.indexOf(marker);
    if (idx !== -1) return decodeURIComponent(fileUrl.substring(idx + marker.length));
    return fileUrl;
  };

  const handleViewDocument = async (fileUrl: string) => {
    try {
      const path = getStoragePath(fileUrl);
      const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(path, 300);
      if (error || !data?.signedUrl) { alert('Error al generar enlace del documento'); return; }
      window.open(data.signedUrl, '_blank');
    } catch (e) { console.error('Error generating signed URL:', e); alert('Error al abrir el documento'); }
  };

  const handleDownloadDocument = async (fileUrl: string, fileName: string) => {
    try {
      const path = getStoragePath(fileUrl);
      const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(path, 300, { download: fileName });
      if (error || !data?.signedUrl) { alert('Error al generar enlace de descarga'); return; }
      window.open(data.signedUrl, '_blank');
    } catch (e) { console.error('Error generating download URL:', e); alert('Error al descargar el documento'); }
  };

  const handleRemoveDocument = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    // Si es un documento guardado en BD (no temporal), eliminarlo de Supabase
    if (!doc.id.startsWith('temp_')) {
      try {
        // Eliminar de la tabla client_documents
        await (supabase as any).from('client_documents').delete().eq('id', docId);
        // Eliminar el archivo del storage
        const path = getStoragePath(doc.file_url);
        await supabase.storage.from('client-documents').remove([path]);
      } catch (e) {
        console.error('Error eliminando documento:', e);
        alert('Error al eliminar el documento');
        return;
      }
    }

    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const handleExtractWithAI = async () => {
    if (documents.length === 0) { alert('Por favor, carga al menos un documento para analizar'); return; }
    setIsExtractingAI(true);
    setAiExtractionResult(null);
    try {
      // Para la IA, necesitamos obtener el archivo via signed URL
      const filesForAI = await Promise.all(
        documents.map(async (doc) => {
          try {
            const path = getStoragePath(doc.file_url);
            const { data: signedData } = await supabase.storage.from('client-documents').createSignedUrl(path, 120);
            if (!signedData?.signedUrl) return null;
            const response = await fetch(signedData.signedUrl);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(blob); });
            return { name: doc.file_name, file_type: doc.file_type, base64_content: base64 };
          } catch (e) { console.error(`Error reading file ${doc.file_name}:`, e); return null; }
        })
      );
      const validFiles = filesForAI.filter(f => f !== null);
      if (validFiles.length === 0) { setAiExtractionResult({ success: false, needsVerification: false, error: 'No se pudieron leer los archivos' }); return; }
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/ai/extract-client`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, client_type: clientType, files: validFiles }) });
      const result = await response.json();
      if (result.success && result.data) {
        if (clientType === 'persona_natural') {
          const data = result.data;
          if (data.informacion_personal) { const ip = data.informacion_personal; setFormNatural(prev => ({ ...prev, primer_apellido: ip.primer_apellido || prev.primer_apellido, segundo_apellido: ip.segundo_apellido || prev.segundo_apellido, primer_nombre: ip.primer_nombre || prev.primer_nombre, otros_nombres: ip.otros_nombres || prev.otros_nombres, tipo_identificacion: ip.tipo_identificacion || prev.tipo_identificacion, numero_identificacion: ip.numero_identificacion || prev.numero_identificacion, lugar_expedicion: ip.lugar_expedicion || prev.lugar_expedicion, fecha_expedicion: ip.fecha_expedicion || prev.fecha_expedicion, fecha_nacimiento: ip.fecha_nacimiento || prev.fecha_nacimiento, lugar_nacimiento: ip.lugar_nacimiento || prev.lugar_nacimiento, nacionalidad: ip.nacionalidad || prev.nacionalidad, sexo: ip.sexo || prev.sexo, estado_civil: ip.estado_civil || prev.estado_civil, tipo_solicitud: ip.tipo_solicitud || prev.tipo_solicitud })); }
          if (data.ubicacion_contacto) { const uc = data.ubicacion_contacto; setFormNatural(prev => ({ ...prev, direccion_residencia: uc.direccion_residencia || prev.direccion_residencia, municipio_residencia: uc.municipio_residencia || prev.municipio_residencia, departamento_residencia: uc.departamento_residencia || prev.departamento_residencia, pais_residencia: uc.pais_residencia || prev.pais_residencia, direccion_laboral: uc.direccion_laboral || prev.direccion_laboral, municipio_laboral: uc.municipio_laboral || prev.municipio_laboral, departamento_laboral: uc.departamento_laboral || prev.departamento_laboral, telefono_fijo: uc.telefono_fijo || prev.telefono_fijo, celular: uc.celular || prev.celular, correo_electronico: uc.correo_electronico || prev.correo_electronico })); }
          if (data.informacion_laboral) { const il = data.informacion_laboral; setFormNatural(prev => ({ ...prev, ocupacion: il.ocupacion || prev.ocupacion, nombre_empresa: il.nombre_empresa || prev.nombre_empresa, cargo: il.cargo || prev.cargo, actividad_economica_ciiu: il.actividad_economica_ciiu || prev.actividad_economica_ciiu, tipo_empleo: il.tipo_empleo || prev.tipo_empleo })); }
          if (data.informacion_financiera) { const inf = data.informacion_financiera; if (inf.ingresos_mensuales) handleCurrencyChange('ingresos_mensuales', String(inf.ingresos_mensuales)); if (inf.egresos_mensuales) handleCurrencyChange('egresos_mensuales', String(inf.egresos_mensuales)); if (inf.total_activos) handleCurrencyChange('total_activos', String(inf.total_activos)); if (inf.total_pasivos) handleCurrencyChange('total_pasivos', String(inf.total_pasivos)); if (inf.otros_ingresos) handleCurrencyChange('otros_ingresos', String(inf.otros_ingresos)); if (inf.concepto_otros_ingresos) setFormNatural(prev => ({ ...prev, concepto_otros_ingresos: inf.concepto_otros_ingresos })); }
        } else {
          const data = result.data;
          if (data.informacion_general) { const ig = data.informacion_general; setFormJuridica(prev => ({ ...prev, razon_social: ig.razon_social || prev.razon_social, nit: ig.nit || prev.nit, digito_verificacion: ig.digito_verificacion || prev.digito_verificacion, tipo_empresa: ig.tipo_empresa || prev.tipo_empresa, actividad_economica_ciiu_principal: ig.actividad_economica_ciiu_principal || prev.actividad_economica_ciiu_principal, actividad_economica_ciiu_secundaria: ig.actividad_economica_ciiu_secundaria || prev.actividad_economica_ciiu_secundaria, numero_empleados: ig.numero_empleados || prev.numero_empleados, tipo_solicitud: ig.tipo_solicitud || prev.tipo_solicitud })); }
          if (data.ubicacion_contacto) { const uc = data.ubicacion_contacto; setFormJuridica(prev => ({ ...prev, direccion_principal: uc.direccion_principal || prev.direccion_principal, municipio: uc.municipio || prev.municipio, departamento: uc.departamento || prev.departamento, pais: uc.pais || prev.pais, direccion_sucursal: uc.direccion_sucursal || prev.direccion_sucursal, telefono: uc.telefono || prev.telefono, celular: uc.celular || prev.celular, correo_electronico: uc.correo_electronico || prev.correo_electronico })); }
          if (data.representante_legal) { const rl = data.representante_legal; setFormJuridica(prev => ({ ...prev, rep_primer_apellido: rl.primer_apellido || prev.rep_primer_apellido, rep_segundo_apellido: rl.segundo_apellido || prev.rep_segundo_apellido, rep_nombres: rl.nombres || prev.rep_nombres, rep_tipo_identificacion: rl.tipo_identificacion || prev.rep_tipo_identificacion, rep_numero_identificacion: rl.numero_identificacion || prev.rep_numero_identificacion, rep_lugar_expedicion: rl.lugar_expedicion || prev.rep_lugar_expedicion, rep_fecha_expedicion: rl.fecha_expedicion || prev.rep_fecha_expedicion, rep_fecha_nacimiento: rl.fecha_nacimiento || prev.rep_fecha_nacimiento, rep_lugar_nacimiento: rl.lugar_nacimiento || prev.rep_lugar_nacimiento, rep_sexo: rl.sexo || prev.rep_sexo, rep_estado_civil: rl.estado_civil || prev.rep_estado_civil, rep_nacionalidad: rl.nacionalidad || prev.rep_nacionalidad })); }
          if (data.informacion_financiera) { const inf = data.informacion_financiera; if (inf.total_activos) handleCurrencyChange('total_activos', String(inf.total_activos), true); if (inf.total_pasivos) handleCurrencyChange('total_pasivos', String(inf.total_pasivos), true); if (inf.total_patrimonio) handleCurrencyChange('total_patrimonio', String(inf.total_patrimonio), true); if (inf.ingresos_mensuales) handleCurrencyChange('ingresos_mensuales', String(inf.ingresos_mensuales), true); if (inf.egresos_mensuales) handleCurrencyChange('egresos_mensuales', String(inf.egresos_mensuales), true); if (inf.otros_ingresos) handleCurrencyChange('otros_ingresos', String(inf.otros_ingresos), true); }
        }
        setAiExtractionResult({ success: true, needsVerification: result.needs_verification, verificationFields: result.verification_fields });
      } else {
        setAiExtractionResult({ success: false, needsVerification: false, error: result.error || 'Error al extraer datos' });
      }
    } catch (e) {
      console.error('Error extracting with AI:', e);
      setAiExtractionResult({ success: false, needsVerification: false, error: 'Error de conexion con el servicio de IA' });
    } finally { setIsExtractingAI(false); }
  };

  // =====================================================
  // VALIDACION
  // =====================================================

  const validateForm = (): boolean => {
    const errors: Record<string, boolean> = {};

    if (clientType === 'persona_natural') {
      if (!formNatural.primer_apellido.trim()) errors.primer_apellido = true;
      if (!formNatural.primer_nombre.trim()) errors.primer_nombre = true;
      if (!formNatural.numero_identificacion.trim()) errors.numero_identificacion = true;
      if (!formNatural.celular.trim()) errors.celular = true;
      if (!formNatural.correo_electronico.trim()) errors.correo_electronico = true;
      if (formNatural.ingresos_mensuales <= 0) errors.ingresos_mensuales = true;
      if (formNatural.egresos_mensuales <= 0) errors.egresos_mensuales = true;
      if (formNatural.total_activos <= 0) errors.total_activos = true;
      if (formNatural.total_pasivos < 0) errors.total_pasivos = true;
    } else {
      if (!formJuridica.razon_social.trim()) errors.razon_social = true;
      if (!formJuridica.nit.trim()) errors.nit = true;
      if (!formJuridica.digito_verificacion.trim()) errors.digito_verificacion = true;
      if (!formJuridica.direccion_principal.trim()) errors.direccion_principal = true;
      if (!formJuridica.municipio.trim()) errors.municipio = true;
      if (!formJuridica.departamento.trim()) errors.departamento = true;
      if (!formJuridica.telefono.trim()) errors.telefono = true;
      if (!formJuridica.celular.trim()) errors.celular = true;
      if (!formJuridica.correo_electronico.trim()) errors.correo_electronico = true;
      if (!formJuridica.rep_primer_apellido.trim()) errors.rep_primer_apellido = true;
      if (!formJuridica.rep_nombres.trim()) errors.rep_nombres = true;
      if (!formJuridica.rep_numero_identificacion.trim()) errors.rep_numero_identificacion = true;
      if (!formJuridica.rep_lugar_expedicion.trim()) errors.rep_lugar_expedicion = true;
      if (!formJuridica.rep_fecha_expedicion) errors.rep_fecha_expedicion = true;
      if (!formJuridica.rep_fecha_nacimiento) errors.rep_fecha_nacimiento = true;
      if (!formJuridica.rep_lugar_nacimiento.trim()) errors.rep_lugar_nacimiento = true;
      if (formJuridica.total_activos <= 0) errors.jur_total_activos = true;
      if (formJuridica.total_pasivos < 0) errors.jur_total_pasivos = true;
      if (formJuridica.ingresos_mensuales <= 0) errors.jur_ingresos_mensuales = true;
      if (formJuridica.egresos_mensuales <= 0) errors.jur_egresos_mensuales = true;
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return false;
    }
    return true;
  };

  // =====================================================
  // SUBMIT
  // =====================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      let clientData: any = {
        tenant_id: tenantId,
        agent_id: agentId,
        segment: clientType,
        allied_agent_id: canEditAlliedField ? (selectedAllyId || null) : (initialData?.allied_agent_id || null),
        comercial_id: selectedComercialId || null,
        grupo_empresarial_id: selectedGrupoId || null,
        created_by: currentUser?.id || agentId,
      };
      if (hasPremiumAccess && aiExtractionResult?.success) { clientData.status = 'en_verificacion'; } else { clientData.status = 'verificado'; }

      if (clientType === 'persona_natural') {
        const fullName = `${formNatural.primer_nombre} ${formNatural.otros_nombres} ${formNatural.primer_apellido} ${formNatural.segundo_apellido}`.replace(/\s+/g, ' ').trim();
        clientData = { ...clientData, full_name: fullName, doc_type: formNatural.tipo_identificacion, doc_number: formNatural.numero_identificacion, email: formNatural.correo_electronico || null, phone: formNatural.celular || null, address: formNatural.direccion_residencia || null, primer_apellido: formNatural.primer_apellido, segundo_apellido: formNatural.segundo_apellido, primer_nombre: formNatural.primer_nombre, otros_nombres: formNatural.otros_nombres, lugar_expedicion: formNatural.lugar_expedicion, fecha_expedicion: formNatural.fecha_expedicion || null, fecha_nacimiento: formNatural.fecha_nacimiento || null, lugar_nacimiento: formNatural.lugar_nacimiento, nacionalidad: formNatural.nacionalidad, sexo: formNatural.sexo, estado_civil: formNatural.estado_civil, tipo_solicitud: formNatural.tipo_solicitud, municipio_residencia: formNatural.municipio_residencia, departamento_residencia: formNatural.departamento_residencia, pais_residencia: formNatural.pais_residencia, direccion_laboral: formNatural.direccion_laboral, municipio_laboral: formNatural.municipio_laboral, departamento_laboral: formNatural.departamento_laboral, telefono_fijo: formNatural.telefono_fijo, ocupacion: formNatural.ocupacion, nombre_empresa: formNatural.nombre_empresa, cargo: formNatural.cargo, actividad_economica_ciiu: formNatural.actividad_economica_ciiu, tipo_empleo: formNatural.tipo_empleo, ingresos_mensuales: formNatural.ingresos_mensuales, egresos_mensuales: formNatural.egresos_mensuales, total_activos: formNatural.total_activos, total_pasivos: formNatural.total_pasivos, total_patrimonio: patrimonioNatural, otros_ingresos: formNatural.otros_ingresos, concepto_otros_ingresos: formNatural.concepto_otros_ingresos };
      } else {
        clientData = { ...clientData, full_name: formJuridica.razon_social, doc_type: 'NIT', doc_number: `${formJuridica.nit}-${formJuridica.digito_verificacion}`, email: formJuridica.correo_electronico || null, phone: formJuridica.telefono || null, address: formJuridica.direccion_principal || null, razon_social: formJuridica.razon_social, nit: formJuridica.nit, digito_verificacion: formJuridica.digito_verificacion, tipo_empresa: formJuridica.tipo_empresa, actividad_economica_ciiu_principal: formJuridica.actividad_economica_ciiu_principal, actividad_economica_ciiu_secundaria: formJuridica.actividad_economica_ciiu_secundaria, numero_empleados: formJuridica.numero_empleados ? parseInt(formJuridica.numero_empleados) : null, tipo_solicitud: formJuridica.tipo_solicitud, municipio: formJuridica.municipio, departamento: formJuridica.departamento, pais: formJuridica.pais, direccion_sucursal: formJuridica.direccion_sucursal, celular: formJuridica.celular, rep_primer_apellido: formJuridica.rep_primer_apellido, rep_segundo_apellido: formJuridica.rep_segundo_apellido, rep_nombres: formJuridica.rep_nombres, rep_tipo_identificacion: formJuridica.rep_tipo_identificacion, rep_numero_identificacion: formJuridica.rep_numero_identificacion, rep_lugar_expedicion: formJuridica.rep_lugar_expedicion, rep_fecha_expedicion: formJuridica.rep_fecha_expedicion || null, rep_fecha_nacimiento: formJuridica.rep_fecha_nacimiento || null, rep_lugar_nacimiento: formJuridica.rep_lugar_nacimiento, rep_sexo: formJuridica.rep_sexo, rep_estado_civil: formJuridica.rep_estado_civil, rep_nacionalidad: formJuridica.rep_nacionalidad, total_activos: formJuridica.total_activos, total_pasivos: formJuridica.total_pasivos, total_patrimonio: formJuridica.total_patrimonio, ingresos_mensuales: formJuridica.ingresos_mensuales, egresos_mensuales: formJuridica.egresos_mensuales, otros_ingresos: formJuridica.otros_ingresos };
      }

      let clientId = initialData?.id;
      if (isEditing && clientId) {
        const { error } = await (supabase as any).from('clients').update(clientData).eq('id', clientId);
        if (error) throw error;
      } else {
        const { data: newClient, error } = await (supabase as any).from('clients').insert(clientData).select().single();
        if (error) throw error;
        clientId = newClient.id;
      }

      for (const doc of documents) {
        if (doc.id.startsWith('temp_')) {
          await (supabase as any).from('client_documents').insert({ client_id: clientId, tenant_id: tenantId, document_type: doc.name, file_name: doc.file_name, file_url: doc.file_url, file_type: doc.file_type });
        }
      }

      router.push('/clientes');
      router.refresh();
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Error al guardar el cliente');
    } finally { setIsSubmitting(false); }
  };

  // Filter functions
  const filteredAllies = alliedAgents.filter((a) => a.full_name.toLowerCase().includes(allySearch.toLowerCase()));
  const filteredComerciales = comerciales.filter((c) => c.full_name.toLowerCase().includes(comercialSearch.toLowerCase()));
  const filteredGrupos = gruposEmpresariales.filter((g) => g.nombre.toLowerCase().includes(grupoSearch.toLowerCase()));
  const selectedAllyName = selectedAllyId ? alliedAgents.find((a) => a.id === selectedAllyId)?.full_name : null;
  const selectedComercialName = selectedComercialId ? comerciales.find((c) => c.id === selectedComercialId)?.full_name : null;
  const selectedGrupoName = selectedGrupoId ? gruposEmpresariales.find((g) => g.id === selectedGrupoId)?.nombre : null;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 w-full">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Mensaje de error de validacion */}
          {Object.keys(formErrors).length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">Por favor, completa los campos obligatorios marcados en rojo antes de guardar.</p>
            </div>
          )}

          {/* Selector de Tipo de Cliente */}
          <div className="space-y-2">
            <Label>Tipo de Cliente *</Label>
            <Select value={clientType} onValueChange={(value: 'persona_natural' | 'persona_juridica') => { setClientType(value); setFormErrors({}); }} disabled={isEditing}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="persona_natural"><div className="flex items-center gap-2"><User className="w-4 h-4" /> Persona Natural</div></SelectItem>
                <SelectItem value="persona_juridica"><div className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Persona Juridica</div></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* LECTURA AUTOMATICA CON IA */}
          {hasPremiumAccess && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">Lectura Automatica con IA</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Beta</span>
              </div>
              <p className="text-sm text-blue-700">Sube los documentos en la seccion de Documentos Adjuntos y luego presiona el boton para que la IA extraiga los datos automaticamente.</p>
              <Button type="button" onClick={handleExtractWithAI} disabled={isExtractingAI || documents.length === 0} className="bg-blue-600 hover:bg-blue-700">
                {isExtractingAI ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extrayendo...</>) : (<><Sparkles className="mr-2 h-4 w-4" />Analizar con IA</>)}
              </Button>
              {aiExtractionResult && (
                <div className={cn("p-3 rounded-lg", aiExtractionResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200")}>
                  {aiExtractionResult.success ? (
                    <div className="flex items-start gap-2">
                      {aiExtractionResult.needsVerification ? <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" /> : <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />}
                      <div>
                        {aiExtractionResult.needsVerification ? (<><p className="font-medium text-yellow-800">Datos extraidos con observaciones</p><p className="text-sm text-yellow-700">Verifica los siguientes campos: {aiExtractionResult.verificationFields?.join(', ')}</p></>) : (<p className="font-medium text-green-800">Datos extraidos correctamente</p>)}
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-700">{aiExtractionResult.error}</p>
                  )}
                </div>
              )}
            </div>
          )}
          {!hasPremiumAccess && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-600">La lectura automatica con IA no esta disponible en tu plan. Actualiza a Pro para usar esta funcion.</p>
            </div>
          )}

          {/* ============================================= */}
          {/* PERSONA NATURAL */}
          {/* ============================================= */}
          {clientType === 'persona_natural' && (
            <>
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" /> Seccion 1 - Informacion Personal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Primer Apellido *</Label>
                    <Input value={formNatural.primer_apellido} onChange={(e) => handleNaturalChange('primer_apellido', e.target.value)} className={err('primer_apellido')} />
                    {formErrors.primer_apellido && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Segundo Apellido</Label>
                    <Input value={formNatural.segundo_apellido} onChange={(e) => handleNaturalChange('segundo_apellido', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Primer Nombre *</Label>
                    <Input value={formNatural.primer_nombre} onChange={(e) => handleNaturalChange('primer_nombre', e.target.value)} className={err('primer_nombre')} />
                    {formErrors.primer_nombre && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Otros Nombres</Label>
                    <Input value={formNatural.otros_nombres} onChange={(e) => handleNaturalChange('otros_nombres', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Identificacion *</Label>
                    <Select value={formNatural.tipo_identificacion} onValueChange={(v) => handleNaturalChange('tipo_identificacion', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPO_IDENTIFICACION_NATURAL.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Numero de Identificacion *</Label>
                    <Input value={formNatural.numero_identificacion} onChange={(e) => handleNaturalChange('numero_identificacion', e.target.value)} className={err('numero_identificacion')} />
                    {formErrors.numero_identificacion && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Lugar de Expedicion</Label>
                    <Input value={formNatural.lugar_expedicion} onChange={(e) => handleNaturalChange('lugar_expedicion', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de Expedicion</Label>
                    <Input type="date" value={formNatural.fecha_expedicion} onChange={(e) => handleNaturalChange('fecha_expedicion', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de Nacimiento</Label>
                    <Input type="date" value={formNatural.fecha_nacimiento} onChange={(e) => handleNaturalChange('fecha_nacimiento', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Lugar de Nacimiento</Label>
                    <Input value={formNatural.lugar_nacimiento} onChange={(e) => handleNaturalChange('lugar_nacimiento', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nacionalidad</Label>
                    <Input value={formNatural.nacionalidad} onChange={(e) => handleNaturalChange('nacionalidad', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <Select value={formNatural.sexo} onValueChange={(v) => handleNaturalChange('sexo', v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Femenino</SelectItem></SelectContent></Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado Civil</Label>
                    <Select value={formNatural.estado_civil} onValueChange={(v) => handleNaturalChange('estado_civil', v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{ESTADO_CIVIL_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent></Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Solicitud *</Label>
                    <Select value={formNatural.tipo_solicitud} onValueChange={(v) => handleNaturalChange('tipo_solicitud', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPO_SOLICITUD_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent></Select>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Seccion 2 - Ubicacion y Contacto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Direccion de Residencia</Label>
                    <Input value={formNatural.direccion_residencia} onChange={(e) => handleNaturalChange('direccion_residencia', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Municipio</Label>
                    <Input value={formNatural.municipio_residencia} onChange={(e) => handleNaturalChange('municipio_residencia', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Departamento</Label>
                    <Input value={formNatural.departamento_residencia} onChange={(e) => handleNaturalChange('departamento_residencia', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pais</Label>
                    <Input value={formNatural.pais_residencia} onChange={(e) => handleNaturalChange('pais_residencia', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Direccion Laboral (opcional)</Label>
                    <Input value={formNatural.direccion_laboral} onChange={(e) => handleNaturalChange('direccion_laboral', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Municipio Laboral</Label>
                    <Input value={formNatural.municipio_laboral} onChange={(e) => handleNaturalChange('municipio_laboral', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Departamento Laboral</Label>
                    <Input value={formNatural.departamento_laboral} onChange={(e) => handleNaturalChange('departamento_laboral', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefono Fijo</Label>
                    <Input value={formNatural.telefono_fijo} onChange={(e) => handleNaturalChange('telefono_fijo', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Celular *</Label>
                    <Input value={formNatural.celular} onChange={(e) => handleNaturalChange('celular', e.target.value)} className={err('celular')} />
                    {formErrors.celular && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Correo Electronico *</Label>
                    <Input type="email" value={formNatural.correo_electronico} onChange={(e) => handleNaturalChange('correo_electronico', e.target.value)} className={err('correo_electronico')} />
                    {formErrors.correo_electronico && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4" /> Seccion 3 - Informacion Laboral y Economica</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Ocupacion / Profesion / Oficio</Label>
                    <Input value={formNatural.ocupacion} onChange={(e) => handleNaturalChange('ocupacion', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de la Empresa</Label>
                    <Input value={formNatural.nombre_empresa} onChange={(e) => handleNaturalChange('nombre_empresa', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Input value={formNatural.cargo} onChange={(e) => handleNaturalChange('cargo', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Actividad Economica (CIIU)</Label>
                    <Input value={formNatural.actividad_economica_ciiu} onChange={(e) => handleNaturalChange('actividad_economica_ciiu', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Empleo</Label>
                    <Select value={formNatural.tipo_empleo} onValueChange={(v) => handleNaturalChange('tipo_empleo', v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{TIPO_EMPLEO_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent></Select>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4" /> Seccion 4 - Informacion Financiera (SARLAFT)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Ingresos Mensuales *</Label>
                    <Input value={currencyDisplays.ingresos_mensuales} onChange={(e) => handleCurrencyChange('ingresos_mensuales', e.target.value)} className={err('ingresos_mensuales')} />
                    {formErrors.ingresos_mensuales && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Egresos Mensuales *</Label>
                    <Input value={currencyDisplays.egresos_mensuales} onChange={(e) => handleCurrencyChange('egresos_mensuales', e.target.value)} className={err('egresos_mensuales')} />
                    {formErrors.egresos_mensuales && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Total Activos *</Label>
                    <Input value={currencyDisplays.total_activos} onChange={(e) => handleCurrencyChange('total_activos', e.target.value)} className={err('total_activos')} />
                    {formErrors.total_activos && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Total Pasivos *</Label>
                    <Input value={currencyDisplays.total_pasivos} onChange={(e) => handleCurrencyChange('total_pasivos', e.target.value)} className={err('total_pasivos')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Patrimonio (calculado)</Label>
                    <Input value={formatCurrency(patrimonioNatural)} disabled className="bg-gray-100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Otros Ingresos Mensuales</Label>
                    <Input value={currencyDisplays.otros_ingresos} onChange={(e) => handleCurrencyChange('otros_ingresos', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Concepto de Otros Ingresos</Label>
                    <Input value={formNatural.concepto_otros_ingresos} onChange={(e) => handleNaturalChange('concepto_otros_ingresos', e.target.value)} placeholder="Ej: Arrendamientos, dividendos..." />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ============================================= */}
          {/* PERSONA JURIDICA */}
          {/* ============================================= */}
          {clientType === 'persona_juridica' && (
            <>
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> Seccion 1 - Informacion General</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Razon Social / Denominacion Social *</Label>
                    <Input value={formJuridica.razon_social} onChange={(e) => handleJuridicaChange('razon_social', e.target.value)} className={err('razon_social')} />
                    {formErrors.razon_social && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>NIT *</Label>
                    <Input value={formJuridica.nit} onChange={(e) => handleJuridicaChange('nit', e.target.value)} className={err('nit')} />
                    {formErrors.nit && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Digito de Verificacion *</Label>
                    <Input value={formJuridica.digito_verificacion} onChange={(e) => handleJuridicaChange('digito_verificacion', e.target.value)} maxLength={1} className={err('digito_verificacion')} />
                    {formErrors.digito_verificacion && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Empresa *</Label>
                    <Select value={formJuridica.tipo_empresa} onValueChange={(v) => handleJuridicaChange('tipo_empresa', v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{TIPO_EMPRESA_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent></Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Actividad Economica CIIU Principal</Label>
                    <Input value={formJuridica.actividad_economica_ciiu_principal} onChange={(e) => handleJuridicaChange('actividad_economica_ciiu_principal', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Actividad Economica CIIU Secundaria</Label>
                    <Input value={formJuridica.actividad_economica_ciiu_secundaria} onChange={(e) => handleJuridicaChange('actividad_economica_ciiu_secundaria', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Numero de Empleados</Label>
                    <Input type="number" value={formJuridica.numero_empleados} onChange={(e) => handleJuridicaChange('numero_empleados', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Solicitud *</Label>
                    <Select value={formJuridica.tipo_solicitud} onValueChange={(v) => handleJuridicaChange('tipo_solicitud', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPO_SOLICITUD_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent></Select>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Seccion 2 - Ubicacion y Contacto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Direccion Principal *</Label>
                    <Input value={formJuridica.direccion_principal} onChange={(e) => handleJuridicaChange('direccion_principal', e.target.value)} className={err('direccion_principal')} />
                    {formErrors.direccion_principal && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Municipio *</Label>
                    <Input value={formJuridica.municipio} onChange={(e) => handleJuridicaChange('municipio', e.target.value)} className={err('municipio')} />
                    {formErrors.municipio && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Departamento *</Label>
                    <Input value={formJuridica.departamento} onChange={(e) => handleJuridicaChange('departamento', e.target.value)} className={err('departamento')} />
                    {formErrors.departamento && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Pais *</Label>
                    <Input value={formJuridica.pais} onChange={(e) => handleJuridicaChange('pais', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Direccion Sucursal o Agencia (opcional)</Label>
                    <Input value={formJuridica.direccion_sucursal} onChange={(e) => handleJuridicaChange('direccion_sucursal', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefono *</Label>
                    <Input value={formJuridica.telefono} onChange={(e) => handleJuridicaChange('telefono', e.target.value)} className={err('telefono')} />
                    {formErrors.telefono && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Celular *</Label>
                    <Input value={formJuridica.celular} onChange={(e) => handleJuridicaChange('celular', e.target.value)} className={err('celular')} />
                    {formErrors.celular && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Correo Electronico *</Label>
                    <Input type="email" value={formJuridica.correo_electronico} onChange={(e) => handleJuridicaChange('correo_electronico', e.target.value)} className={err('correo_electronico')} />
                    {formErrors.correo_electronico && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" /> Seccion 3 - Representante Legal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Primer Apellido *</Label>
                    <Input value={formJuridica.rep_primer_apellido} onChange={(e) => handleJuridicaChange('rep_primer_apellido', e.target.value)} className={err('rep_primer_apellido')} />
                    {formErrors.rep_primer_apellido && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Segundo Apellido</Label>
                    <Input value={formJuridica.rep_segundo_apellido} onChange={(e) => handleJuridicaChange('rep_segundo_apellido', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Nombre(s) *</Label>
                    <Input value={formJuridica.rep_nombres} onChange={(e) => handleJuridicaChange('rep_nombres', e.target.value)} className={err('rep_nombres')} />
                    {formErrors.rep_nombres && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Identificacion *</Label>
                    <Select value={formJuridica.rep_tipo_identificacion} onValueChange={(v) => handleJuridicaChange('rep_tipo_identificacion', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPO_IDENTIFICACION_JURIDICA.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent></Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Numero de Identificacion *</Label>
                    <Input value={formJuridica.rep_numero_identificacion} onChange={(e) => handleJuridicaChange('rep_numero_identificacion', e.target.value)} className={err('rep_numero_identificacion')} />
                    {formErrors.rep_numero_identificacion && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Lugar de Expedicion *</Label>
                    <Input value={formJuridica.rep_lugar_expedicion} onChange={(e) => handleJuridicaChange('rep_lugar_expedicion', e.target.value)} className={err('rep_lugar_expedicion')} />
                    {formErrors.rep_lugar_expedicion && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de Expedicion *</Label>
                    <Input type="date" value={formJuridica.rep_fecha_expedicion} onChange={(e) => handleJuridicaChange('rep_fecha_expedicion', e.target.value)} className={err('rep_fecha_expedicion')} />
                    {formErrors.rep_fecha_expedicion && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de Nacimiento *</Label>
                    <Input type="date" value={formJuridica.rep_fecha_nacimiento} onChange={(e) => handleJuridicaChange('rep_fecha_nacimiento', e.target.value)} className={err('rep_fecha_nacimiento')} />
                    {formErrors.rep_fecha_nacimiento && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Lugar de Nacimiento *</Label>
                    <Input value={formJuridica.rep_lugar_nacimiento} onChange={(e) => handleJuridicaChange('rep_lugar_nacimiento', e.target.value)} className={err('rep_lugar_nacimiento')} />
                    {formErrors.rep_lugar_nacimiento && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <Select value={formJuridica.rep_sexo} onValueChange={(v) => handleJuridicaChange('rep_sexo', v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Femenino</SelectItem></SelectContent></Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado Civil</Label>
                    <Select value={formJuridica.rep_estado_civil} onValueChange={(v) => handleJuridicaChange('rep_estado_civil', v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{ESTADO_CIVIL_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent></Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nacionalidad</Label>
                    <Input value={formJuridica.rep_nacionalidad} onChange={(e) => handleJuridicaChange('rep_nacionalidad', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4" /> Seccion 4 - Informacion Financiera</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Total Activos *</Label>
                    <Input value={currencyDisplays.jur_total_activos} onChange={(e) => handleCurrencyChange('total_activos', e.target.value, true)} className={err('jur_total_activos')} />
                    {formErrors.jur_total_activos && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Total Pasivos *</Label>
                    <Input value={currencyDisplays.jur_total_pasivos} onChange={(e) => handleCurrencyChange('total_pasivos', e.target.value, true)} className={err('jur_total_pasivos')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Patrimonio *</Label>
                    <Input value={currencyDisplays.jur_total_patrimonio} onChange={(e) => handleCurrencyChange('total_patrimonio', e.target.value, true)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ingresos Mensuales *</Label>
                    <Input value={currencyDisplays.jur_ingresos_mensuales} onChange={(e) => handleCurrencyChange('ingresos_mensuales', e.target.value, true)} className={err('jur_ingresos_mensuales')} />
                    {formErrors.jur_ingresos_mensuales && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Egresos Mensuales *</Label>
                    <Input value={currencyDisplays.jur_egresos_mensuales} onChange={(e) => handleCurrencyChange('egresos_mensuales', e.target.value, true)} className={err('jur_egresos_mensuales')} />
                    {formErrors.jur_egresos_mensuales && <p className="text-xs text-red-500">Campo obligatorio</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Otros Ingresos Mensuales</Label>
                    <Input value={currencyDisplays.jur_otros_ingresos} onChange={(e) => handleCurrencyChange('otros_ingresos', e.target.value, true)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ============================================= */}
          {/* PROPIEDAD CRM */}
          {/* ============================================= */}
          <div className="border rounded-lg p-4 space-y-4 bg-slate-50">
            <h3 className="font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4" /> Propiedad CRM</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Usuario Tenant</Label>
                <Input value={currentUser?.full_name || 'Cargando...'} disabled className="bg-gray-100" />
                <p className="text-xs text-muted-foreground">Se asigna automaticamente</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">Aliado / Referido por{!canEditAlliedField && !loadingPermissions && <Lock className="w-3 h-3 text-muted-foreground" />}</Label>
                {loadingPermissions || loadingAllies ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>
                ) : !canEditAlliedField ? (
                  <Input value={selectedAllyName || 'Directo (sin aliado)'} disabled className="bg-gray-100" />
                ) : (
                  <Popover open={allyOpen} onOpenChange={setAllyOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">{selectedAllyName || 'Directo (sin aliado)'}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><input placeholder="Buscar aliado..." value={allySearch} onChange={(e) => setAllySearch(e.target.value)} className="flex h-10 w-full bg-transparent py-3 text-sm outline-none" /></div>
                      <div className="max-h-60 overflow-auto p-1">
                        <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent" onClick={() => { setSelectedAllyId(null); setAllyOpen(false); setAllySearch(''); }}><Check className={cn("mr-2 h-4 w-4", !selectedAllyId ? "opacity-100" : "opacity-0")} /> Directo (sin aliado)</div>
                        {filteredAllies.map((ally) => (<div key={ally.id} className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent" onClick={() => { setSelectedAllyId(ally.id); setAllyOpen(false); setAllySearch(''); }}><Check className={cn("mr-2 h-4 w-4", selectedAllyId === ally.id ? "opacity-100" : "opacity-0")} /> {ally.full_name}</div>))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="space-y-2">
                <Label>Comercial Asignado</Label>
                {loadingComerciales ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>
                ) : comerciales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay usuarios comerciales configurados.</p>
                ) : (
                  <Popover open={comercialOpen} onOpenChange={setComercialOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">{selectedComercialName || 'Sin comercial asignado'}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><input placeholder="Buscar comercial..." value={comercialSearch} onChange={(e) => setComercialSearch(e.target.value)} className="flex h-10 w-full bg-transparent py-3 text-sm outline-none" /></div>
                      <div className="max-h-60 overflow-auto p-1">
                        <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent" onClick={() => { setSelectedComercialId(null); setComercialOpen(false); setComercialSearch(''); }}><Check className={cn("mr-2 h-4 w-4", !selectedComercialId ? "opacity-100" : "opacity-0")} /> Sin comercial asignado</div>
                        {filteredComerciales.map((c) => (<div key={c.id} className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent" onClick={() => { setSelectedComercialId(c.id); setComercialOpen(false); setComercialSearch(''); }}><Check className={cn("mr-2 h-4 w-4", selectedComercialId === c.id ? "opacity-100" : "opacity-0")} /> {c.full_name}</div>))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">Grupo Empresarial <Building2 className="w-3 h-3 text-muted-foreground" /></Label>
                {loadingGrupos ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>
                ) : gruposEmpresariales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay grupos empresariales creados.</p>
                ) : (
                  <Popover open={grupoOpen} onOpenChange={setGrupoOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">{selectedGrupoName || 'Sin grupo empresarial'}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /><input placeholder="Buscar grupo..." value={grupoSearch} onChange={(e) => setGrupoSearch(e.target.value)} className="flex h-10 w-full bg-transparent py-3 text-sm outline-none" /></div>
                      <div className="max-h-60 overflow-auto p-1">
                        <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent" onClick={() => { setSelectedGrupoId(null); setGrupoOpen(false); setGrupoSearch(''); }}><Check className={cn("mr-2 h-4 w-4", !selectedGrupoId ? "opacity-100" : "opacity-0")} /> Sin grupo empresarial</div>
                        {filteredGrupos.map((g) => (<div key={g.id} className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent" onClick={() => { setSelectedGrupoId(g.id); setGrupoOpen(false); setGrupoSearch(''); }}><Check className={cn("mr-2 h-4 w-4", selectedGrupoId === g.id ? "opacity-100" : "opacity-0")} /> {g.nombre}</div>))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <p className="text-xs text-muted-foreground">Agrupa clientes del mismo grupo economico</p>
              </div>
            </div>
          </div>

          {/* ============================================= */}
          {/* DOCUMENTOS ADJUNTOS */}
          {/* ============================================= */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Documentos Adjuntos</h3>
            <p className="text-sm text-muted-foreground">Adjunta los documentos necesarios del cliente (Cedula, RUT, extractos, etc.). Puedes subir varios archivos.</p>
            <div className="flex items-center gap-3">
              <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => { const file = e.target.files?.[0]; if (file) { handleFileUpload(file); e.target.value = ''; } }} disabled={uploadingDoc !== null} className="text-sm" />
              {uploadingDoc && (<div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</div>)}
            </div>
            {documents.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{documents.length} documento(s) adjunto(s):</Label>
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between bg-green-50 border border-green-200 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span
                        onClick={() => handleViewDocument(doc.file_url)}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        title={doc.file_name}
                      >
                        {doc.file_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewDocument(doc.file_url)}
                        className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded cursor-pointer"
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(doc.file_url, doc.file_name)}
                        className="text-xs text-green-600 bg-green-100 hover:bg-green-200 px-2 py-0.5 rounded cursor-pointer"
                      >
                        Descargar
                      </button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveDocument(doc.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BOTONES */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>) : isEditing ? 'Actualizar Cliente' : 'Crear Cliente'}
            </Button>
          </div>

        </CardContent>
      </Card>
    </form>
  );
}
