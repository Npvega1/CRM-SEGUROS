'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, X, AlertTriangle, FileEdit } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';

// Schema especial para modificaciones (permite prima negativa)
const ModificationSchema = z.object({
  client_id: z.string().uuid('Cliente inválido'),
  policy_number: z.string().min(1, 'El número de póliza es requerido'),
  anexo: z.string(),
  insurer: z.string().min(1, 'La aseguradora es requerida'),
  insurer_id: z.string().uuid().optional().nullable(),
  line: z.string().min(1, 'La línea es requerida'),
  line_id: z.string().uuid().optional().nullable(),
  group_id: z.string().uuid().optional().nullable(),
  status: z.enum(['cotizacion', 'activa', 'vencida', 'cancelada', 'renovacion']),
  premium: z.coerce.number(), // Permite negativos
  gastos_expedicion: z.coerce.number().min(0).default(0),
  iva: z.coerce.number().min(0).default(0),
  total_a_pagar: z.coerce.number().default(0),
  currency: z.string().default('COP'),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  fecha_expedicion: z.string().optional().nullable(),
  commission_pct: z.coerce.number().min(0).max(100).default(0),
  policy_type: z.string().default('modificacion'),
  parent_policy_id: z.string().uuid(),
  notas: z.string().optional()
});

type ModificationFormData = z.infer<typeof ModificationSchema>;

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

interface ParentPolicyInfo {
  id: string;
  policy_number: string;
  anexo: string;
  client_id: string;
  client_name: string;
  insurer: string;
  insurer_id: string | null;
  line: string;
  line_id: string | null;
  group_id: string | null;
  start_date: string | null;
  end_date: string | null;
  premium: number;
  commission_pct: number;
}

interface PolicyModificationFormProps {
  parentPolicy: ParentPolicyInfo;
  nextAnexo: string;
  onSubmit: (data: ModificationFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

// Formato de moneda que muestra negativos en rojo
const formatCurrency = (value: number): string => {
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.abs(value));
  
  return value < 0 ? `-${formatted}` : formatted;
};

// Parser que acepta valores negativos
const parseCurrencyValue = (value: string): number => {
  const isNegative = value.includes('-');
  const cleaned = value.replace(/[^0-9]/g, '');
  const numericValue = parseInt(cleaned, 10) || 0;
  return isNegative ? -numericValue : numericValue;
};

export function PolicyModificationForm({
  parentPolicy,
  nextAnexo,
  onSubmit,
  onCancel,
  isLoading = false
}: PolicyModificationFormProps) {
  const { tenantId } = useTenant();
  const supabase = createClient();

  const [tenantCompanies, setTenantCompanies] = useState<TenantCompany[]>([]);
  const [availableLines, setAvailableLines] = useState<InsuranceLine[]>([]);
  const [availableGroups, setAvailableGroups] = useState<InsuranceGroup[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [loadingCommission, setLoadingCommission] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(parentPolicy.insurer_id || '');
  const [selectedLineId, setSelectedLineId] = useState(parentPolicy.line_id || '');
  const [selectedGroupId, setSelectedGroupId] = useState(parentPolicy.group_id || '');
  const [premiumDisplay, setPremiumDisplay] = useState('$0');
  const [gastosDisplay, setGastosDisplay] = useState('$0');
  const [ivaDisplay, setIvaDisplay] = useState('$0');
  const [notasValue, setNotasValue] = useState('');
  const [isNegativePremium, setIsNegativePremium] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ModificationFormData>({
    resolver: zodResolver(ModificationSchema),
    defaultValues: {
      client_id: parentPolicy.client_id,
      policy_number: parentPolicy.policy_number,
      anexo: nextAnexo,
      insurer: parentPolicy.insurer,
      insurer_id: parentPolicy.insurer_id,
      line: parentPolicy.line,
      line_id: parentPolicy.line_id,
      group_id: parentPolicy.group_id,
      status: 'activa',
      currency: 'COP',
      premium: 0,
      gastos_expedicion: 0,
      iva: 0,
      total_a_pagar: 0,
      commission_pct: parentPolicy.commission_pct || 0,
      start_date: parentPolicy.start_date,
      end_date: parentPolicy.end_date,
      policy_type: 'modificacion',
      parent_policy_id: parentPolicy.id
    }
  });

  const premium = watch('premium') || 0;
  const gastosExpedicion = watch('gastos_expedicion') || 0;
  const iva = watch('iva') || 0;

  // Calcular total (permite negativos)
  useEffect(() => {
    const total = Number(premium) + Number(gastosExpedicion) + Number(iva);
    setValue('total_a_pagar', total);
  }, [premium, gastosExpedicion, iva, setValue]);

  // Cargar compañías del tenant
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

  // Cargar líneas cuando cambia la compañía
  useEffect(() => {
    async function loadLinesForCompany() {
      if (!selectedCompanyId) {
        setAvailableLines([]);
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

  // Cargar grupos cuando cambia la línea
  useEffect(() => {
    async function loadGroupsForLine() {
      if (!selectedLineId) {
        setAvailableGroups([]);
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

  // Cargar comisión cuando cambian compañía y grupo
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
        }
      } catch (err) {
        console.error('Error loading commission:', err);
      } finally {
        setLoadingCommission(false);
      }
    }
    loadCommission();
  }, [selectedCompanyId, selectedGroupId, setValue, supabase]);

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

  const handlePremiumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const numericValue = parseCurrencyValue(inputValue);
    setValue('premium', numericValue);
    setPremiumDisplay(formatCurrency(numericValue));
    setIsNegativePremium(numericValue < 0);
  };

  const handleToggleNegative = () => {
    const currentPremium = watch('premium') || 0;
    const newValue = -currentPremium;
    setValue('premium', newValue);
    setPremiumDisplay(formatCurrency(newValue));
    setIsNegativePremium(newValue < 0);
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

  const handleFormSubmit = async (data: ModificationFormData) => {
    const dataWithNotas: ModificationFormData = {
      ...data,
      notas: notasValue || undefined
    };
    await onSubmit(dataWithNotas);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onError = (errors: any) => {
    console.error('Form validation errors:', errors);
  };

  const loading = isLoading || isSubmitting;
  const totalAPagar = Number(premium) + Number(gastosExpedicion) + Number(iva);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-6">
      {/* Indicador de Modificación */}
      <Alert className="bg-amber-50 border-amber-200">
        <FileEdit className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>Creando Modificación (Anexo {nextAnexo})</strong> sobre la Póliza{' '}
          <strong>{parentPolicy.policy_number}</strong>
          {parentPolicy.anexo !== '00' && ` - Anexo ${parentPolicy.anexo}`}
          <br />
          <span className="text-sm">Cliente: {parentPolicy.client_name}</span>
        </AlertDescription>
      </Alert>

      {/* Identificación de la Póliza */}
      <div className="bg-white p-6 rounded-lg border space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
          Identificación de la Póliza
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Número de Póliza</Label>
            <Input
              {...register('policy_number')}
              disabled={true}
              className="bg-slate-100"
            />
          </div>

          <div className="space-y-2">
            <Label>Anexo</Label>
            <Input
              value={nextAnexo}
              disabled={true}
              className="bg-slate-100 font-bold text-amber-600"
            />
            <p className="text-xs text-slate-500">Calculado automáticamente</p>
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Input
              value="Activa"
              disabled={true}
              className="bg-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Selección de Producto */}
      <div className="bg-white p-6 rounded-lg border space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
          Producto de Seguro
        </h3>

        {loadingCatalogs ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando catálogos...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      {tc.company.name}
                      {tc.company_code && ` (${tc.company_code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                  <SelectValue placeholder="Seleccionar grupo" />
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

            <div className="space-y-2">
              <Label>Ramo *</Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
                disabled={loading || !selectedLineId || availableGroups.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ramo" />
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
      </div>

      {/* Fechas */}
      <div className="bg-white p-6 rounded-lg border space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
          Fechas
        </h3>

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
              {...register('start_date')}
              disabled={loading}
            />
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

      {/* Valores de la Modificación */}
      <div className="bg-white p-6 rounded-lg border space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
          Valores de la Modificación
        </h3>

        {/* Información sobre valores negativos */}
        <Alert className="bg-blue-50 border-blue-200">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            <strong>Nota:</strong> Si la modificación reduce la prima, usa el botón &quot;Negativo&quot; 
            para ingresar valores negativos. Una prima negativa genera un crédito a favor del cliente.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select
              defaultValue="COP"
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

          <div className="space-y-2 md:col-span-2">
            <Label>Prima (Ajuste) *</Label>
            <div className="flex gap-2">
              <Input
                value={premiumDisplay}
                onChange={handlePremiumChange}
                onFocus={(e) => e.target.select()}
                disabled={loading}
                className={isNegativePremium ? 'text-red-600 font-bold' : ''}
              />
              <Button
                type="button"
                variant={isNegativePremium ? "destructive" : "outline"}
                size="sm"
                onClick={handleToggleNegative}
                disabled={loading}
                className="whitespace-nowrap"
              >
                {isNegativePremium ? '+ Positivo' : '- Negativo'}
              </Button>
            </div>
            {errors.premium && (
              <p className="text-sm text-red-500">{errors.premium.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Gastos Exp.</Label>
            <Input
              value={gastosDisplay}
              onChange={handleGastosChange}
              onFocus={(e) => e.target.select()}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>IVA</Label>
            <Input
              value={ivaDisplay}
              onChange={handleIvaChange}
              onFocus={(e) => e.target.select()}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Total</Label>
            <Input
              value={formatCurrency(totalAPagar)}
              disabled={true}
              className={`bg-slate-100 font-bold ${totalAPagar < 0 ? 'text-red-600' : 'text-green-600'}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label>Comisión %</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register('commission_pct')}
                disabled={loading}
              />
              {loadingCommission && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>
          </div>
        </div>

        {/* Resumen visual */}
        {totalAPagar !== 0 && (
          <div className={`p-4 rounded-lg ${totalAPagar < 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <p className={`font-semibold ${totalAPagar < 0 ? 'text-red-700' : 'text-green-700'}`}>
              {totalAPagar < 0 
                ? `⚠️ Esta modificación genera un CRÉDITO de ${formatCurrency(Math.abs(totalAPagar))} a favor del cliente`
                : `✓ Esta modificación genera un CARGO adicional de ${formatCurrency(totalAPagar)}`
              }
            </p>
          </div>
        )}
      </div>

      {/* Notas */}
      <div className="bg-white p-6 rounded-lg border space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
          Notas y Comentarios
        </h3>

        <div className="space-y-2">
          <Label htmlFor="notas">Descripción de la modificación</Label>
          <Textarea
            id="notas"
            value={notasValue}
            onChange={(e) => setNotasValue(e.target.value)}
            placeholder="Describe el motivo de esta modificación (ej: Aumento de cobertura, Inclusión de beneficiario, etc.)"
            className="min-h-[100px]"
            disabled={loading}
          />
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Guardar Modificación (Anexo {nextAnexo})
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
