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
import { Loader2, Save, X, FileEdit } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';

// Schema especial para modificaciones (permite valores negativos, fechas obligatorias)
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
  premium: z.coerce.number(),
  gastos_expedicion: z.coerce.number().default(0),
  iva: z.coerce.number().default(0),
  total_a_pagar: z.coerce.number().default(0),
  currency: z.string().default('COP'),
  start_date: z.string().min(1, 'La fecha de inicio es obligatoria'),
  end_date: z.string().min(1, 'La fecha de vencimiento es obligatoria'),
  fecha_expedicion: z.string().min(1, 'La fecha de expedición es obligatoria'),
  commission_pct: z.coerce.number().min(0).max(100).default(0),
  policy_type: z.string().default('anexo'),
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ModificationFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ModificationSchema) as any,
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
      start_date: parentPolicy.start_date || '',
      end_date: parentPolicy.end_date || '',
      fecha_expedicion: '',
      policy_type: 'anexo',
      parent_policy_id: parentPolicy.id
    }
  });

  const premium = watch('premium') || 0;
  const gastosExpedicion = watch('gastos_expedicion') || 0;
  const iva = watch('iva') || 0;

  // Computar si la prima es negativa (sin estado separado)
  const isNegativePremium = Number(premium) < 0;

  // Calcular total - cuando prima es negativa, gastos e IVA también son negativos
  useEffect(() => {
    const premiumNum = Number(premium);
    const gastosNum = Math.abs(Number(gastosExpedicion));
    const ivaNum = Math.abs(Number(iva));

    let total: number;
    if (premiumNum < 0) {
      total = premiumNum - gastosNum - ivaNum;
    } else {
      total = premiumNum + gastosNum + ivaNum;
    }

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

    // Permitir escribir solo "-" para empezar un número negativo
    if (inputValue === '-' || inputValue === '-$' || inputValue === '-$0') {
      setPremiumDisplay('-');
      setValue('premium', 0);
      return;
    }

    const numericValue = parseCurrencyValue(inputValue);
    setValue('premium', numericValue);
    setPremiumDisplay(formatCurrency(numericValue));
  };

  const handleGastosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseCurrencyValue(e.target.value);
    setValue('gastos_expedicion', Math.abs(numericValue));
    setGastosDisplay(formatCurrency(Math.abs(numericValue)));
  };

  const handleIvaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseCurrencyValue(e.target.value);
    setValue('iva', Math.abs(numericValue));
    setIvaDisplay(formatCurrency(Math.abs(numericValue)));
  };

  const handleFormSubmit = async (data: ModificationFormData) => {
    const premiumNum = Number(data.premium);
    const gastosNum = Math.abs(Number(data.gastos_expedicion));
    const ivaNum = Math.abs(Number(data.iva));

    const adjustedData: ModificationFormData = {
      ...data,
      gastos_expedicion: premiumNum < 0 ? -gastosNum : gastosNum,
      iva: premiumNum < 0 ? -ivaNum : ivaNum,
      notas: notasValue || undefined
    };

    await onSubmit(adjustedData);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onError = (errors: any) => {
    console.error('Form validation errors:', errors);
  };

  const loading = isLoading || isSubmitting;

  // Calcular total para mostrar
  const premiumNum = Number(premium);
  const gastosNum = Math.abs(Number(gastosExpedicion));
  const ivaNum = Math.abs(Number(iva));
  const totalAPagar = premiumNum < 0
    ? premiumNum - gastosNum - ivaNum
    : premiumNum + gastosNum + ivaNum;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-8">
      {/* Indicador de Modificación */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
          <FileEdit className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              <strong>Creando Modificación (Anexo {nextAnexo})</strong> sobre la Póliza{' '}
              <strong>{parentPolicy.policy_number}</strong>
              {parentPolicy.anexo !== '00' && ` - Anexo ${parentPolicy.anexo}`}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Cliente: {parentPolicy.client_name}
            </p>
          </div>
        </div>
      </div>

      {/* Identificación de la Póliza */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Identificación de la Póliza</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Número de Póliza</Label>
            <Input {...register('policy_number')} disabled className="bg-muted" />
          </div>
          <div>
            <Label>Anexo</Label>
            <Input value={nextAnexo} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground mt-1">Calculado automáticamente</p>
          </div>
          <div>
            <Label>Estado</Label>
            <Input value="Activa" disabled className="bg-muted" />
          </div>
        </div>
      </div>

      {/* Selección de Producto */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Producto de Seguro</h3>
        {loadingCatalogs ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando catálogos...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
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
            <div>
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
            <div>
              <Label>Ramo *</Label>
              <Select
                value={selectedGroupId}
                onValueChange={(value) => setSelectedGroupId(value)}
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
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Fechas (Obligatorias)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Fecha de Expedición *</Label>
            <Input type="date" {...register('fecha_expedicion')} disabled={loading} />
            {errors.fecha_expedicion && (
              <p className="text-xs text-red-500 mt-1">{errors.fecha_expedicion.message}</p>
            )}
          </div>
          <div>
            <Label>Fecha de Inicio *</Label>
            <Input type="date" {...register('start_date')} disabled={loading} />
            {errors.start_date && (
              <p className="text-xs text-red-500 mt-1">{errors.start_date.message}</p>
            )}
          </div>
          <div>
            <Label>Fecha de Vencimiento *</Label>
            <Input type="date" {...register('end_date')} disabled={loading} />
            {errors.end_date && (
              <p className="text-xs text-red-500 mt-1">{errors.end_date.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Valores de la Modificación */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Valores de la Modificación</h3>

        {/* Nota actualizada */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Nota:</strong> Si la modificación reduce la prima, escriba el signo <strong>-</strong> antes del valor (ej: -500000).
            Cuando la prima es negativa, los gastos e IVA también se aplicarán como negativos automáticamente.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
          <div>
            <Label>Moneda</Label>
            <Select
              value={watch('currency')}
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

          <div>
            <Label>Prima (Ajuste) *</Label>
            <Input
              type="text"
              value={premiumDisplay}
              onChange={handlePremiumChange}
              onFocus={(e) => e.target.select()}
              disabled={loading}
              className={isNegativePremium ? 'text-red-600 font-bold' : ''}
              placeholder="$0 o -$500000"
            />
            {errors.premium && (
              <p className="text-xs text-red-500 mt-1">{errors.premium.message}</p>
            )}
          </div>

          <div>
            <Label>Gastos Exp. {isNegativePremium && <span className="text-red-500">(−)</span>}</Label>
            <Input
              type="text"
              value={gastosDisplay}
              onChange={handleGastosChange}
              onFocus={(e) => e.target.select()}
              disabled={loading}
              className={isNegativePremium ? 'text-red-600' : ''}
            />
          </div>

          <div>
            <Label>IVA {isNegativePremium && <span className="text-red-500">(−)</span>}</Label>
            <Input
              type="text"
              value={ivaDisplay}
              onChange={handleIvaChange}
              onFocus={(e) => e.target.select()}
              disabled={loading}
              className={isNegativePremium ? 'text-red-600' : ''}
            />
          </div>

          <div>
            <Label>Total</Label>
            <div className={`p-2 rounded-md border text-sm font-semibold ${totalAPagar < 0 ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>
              {formatCurrency(totalAPagar)}
            </div>
          </div>

          <div>
            <Label>Comisión %</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                {...register('commission_pct')}
                disabled={loading}
                className="w-24"
              />
              {loadingCommission && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        {/* Resumen visual */}
        {totalAPagar !== 0 && (
          <div className={`p-3 rounded-lg text-sm font-medium ${totalAPagar < 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {totalAPagar < 0
              ? `Esta modificación genera un CRÉDITO de ${formatCurrency(Math.abs(totalAPagar))} a favor del cliente`
              : `Esta modificación genera un CARGO adicional de ${formatCurrency(totalAPagar)}`
            }
          </div>
        )}
      </div>

      {/* Notas */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Notas y Comentarios</h3>
        <div>
          <Label>Descripción de la modificación</Label>
          <Textarea
            value={notasValue}
            onChange={(e) => setNotasValue(e.target.value)}
            placeholder="Describa el motivo y alcance de esta modificación..."
            rows={3}
            disabled={loading}
          />
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
          Guardar Modificación
        </Button>
      </div>
    </form>
  );
}
