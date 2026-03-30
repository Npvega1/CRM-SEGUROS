'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileEdit } from 'lucide-react';

// Schema de validación
const policyFormSchema = z.object({
  policy_number: z.string().min(1, 'Número de póliza requerido'),
  anexo: z.string().min(1, 'Anexo requerido'),
  client_id: z.string().min(1, 'Cliente requerido'),
  insurer_id: z.string().min(1, 'Aseguradora requerida'),
  line_id: z.string().min(1, 'Ramo requerido'),
  group_id: z.string().optional(),
  status: z.string().min(1, 'Estado requerido'),
  premium: z.number(),
  gastos_expedicion: z.number(),
  iva: z.number(),
  total_a_pagar: z.number(),
  commission_pct: z.number().min(0).max(100),
  start_date: z.string().min(1, 'Fecha de inicio requerida'),
  end_date: z.string().min(1, 'Fecha de fin requerida'),
  fecha_expedicion: z.string().optional(),
  notas: z.string().optional(),
});

type PolicyFormValues = z.infer<typeof policyFormSchema>;

interface Client {
  id: string;
  name: string;
  email: string;
}

interface Insurer {
  id: string;
  name: string;
}

interface Line {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
}

interface ParentPolicyInfo {
  id: string;
  policy_number: string;
  anexo: string;
  client_name?: string;
}

interface PolicyFormProps {
  clients: Client[];
  insurers: Insurer[];
  lines: Line[];
  groups: Group[];
  onSubmit: (data: PolicyFormValues & { 
    parent_policy_id?: string;
    policy_type?: string;
  }) => Promise<void>;
  isLoading?: boolean;
  defaultValues?: Partial<PolicyFormValues>;
  isModification?: boolean;
  parentPolicyInfo?: ParentPolicyInfo | null;
}

const parseCurrencyValue = (value: string): number => {
  if (!value) return 0;
  const isNegative = value.includes('-');
  const cleaned = value.replace(/[^0-9]/g, '');
  const numericValue = cleaned ? parseInt(cleaned) : 0;
  return isNegative ? -numericValue : numericValue;
};

const formatCurrency = (value: number): string => {
  if (value === 0) return '$0';
  const isNegative = value < 0;
  const absoluteValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absoluteValue);
  return isNegative ? `-${formatted}` : formatted;
};

export function PolicyForm({
  clients,
  insurers,
  lines,
  groups,
  onSubmit,
  isLoading = false,
  defaultValues,
  isModification = false,
  parentPolicyInfo = null,
}: PolicyFormProps) {
  const [displayPremium, setDisplayPremium] = useState(defaultValues?.premium ? formatCurrency(defaultValues.premium) : '$0');
  const [displayGastos, setDisplayGastos] = useState(defaultValues?.gastos_expedicion ? formatCurrency(defaultValues.gastos_expedicion) : '$0');
  const [displayIva, setDisplayIva] = useState(defaultValues?.iva ? formatCurrency(defaultValues.iva) : '$0');
  const [displayTotal, setDisplayTotal] = useState(defaultValues?.total_a_pagar ? formatCurrency(defaultValues.total_a_pagar) : '$0');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      policy_number: defaultValues?.policy_number || '',
      anexo: defaultValues?.anexo || '00',
      client_id: defaultValues?.client_id || '',
      insurer_id: defaultValues?.insurer_id || '',
      line_id: defaultValues?.line_id || '',
      group_id: defaultValues?.group_id || '',
      status: defaultValues?.status || 'vigente',
      premium: defaultValues?.premium || 0,
      gastos_expedicion: defaultValues?.gastos_expedicion || 0,
      iva: defaultValues?.iva || 0,
      total_a_pagar: defaultValues?.total_a_pagar || 0,
      commission_pct: defaultValues?.commission_pct || 0,
      start_date: defaultValues?.start_date || '',
      end_date: defaultValues?.end_date || '',
      fecha_expedicion: defaultValues?.fecha_expedicion || '',
      notas: defaultValues?.notas || '',
    },
  });

  const watchPremium = watch('premium');
  const watchGastos = watch('gastos_expedicion');
  const watchIva = watch('iva');
  const watchAnexo = watch('anexo');

  useEffect(() => {
    const total = (watchPremium || 0) + (watchGastos || 0) + (watchIva || 0);
    setValue('total_a_pagar', total);
    setDisplayTotal(formatCurrency(total));
  }, [watchPremium, watchGastos, watchIva, setValue]);

  useEffect(() => {
    if (defaultValues) {
      Object.entries(defaultValues).forEach(([key, value]) => {
        if (value !== undefined) {
          setValue(key as keyof PolicyFormValues, value as never);
        }
      });
      setDisplayPremium(defaultValues.premium ? formatCurrency(defaultValues.premium) : '$0');
      setDisplayGastos(defaultValues.gastos_expedicion ? formatCurrency(defaultValues.gastos_expedicion) : '$0');
      setDisplayIva(defaultValues.iva ? formatCurrency(defaultValues.iva) : '$0');
      setDisplayTotal(defaultValues.total_a_pagar ? formatCurrency(defaultValues.total_a_pagar) : '$0');
    }
  }, [defaultValues, setValue]);

  const handleCurrencyInput = (
    value: string,
    field: 'premium' | 'gastos_expedicion' | 'iva'
  ) => {
    const numericValue = parseCurrencyValue(value);
    setValue(field, numericValue);
    const formatted = formatCurrency(numericValue);
    if (field === 'premium') setDisplayPremium(formatted);
    if (field === 'gastos_expedicion') setDisplayGastos(formatted);
    if (field === 'iva') setDisplayIva(formatted);
  };

  const onFormSubmit = async (data: PolicyFormValues) => {
    const submitData = {
      ...data,
      group_id: data.group_id || null,
      fecha_expedicion: data.fecha_expedicion || null,
      notas: data.notas || null,
      ...(isModification && parentPolicyInfo ? {
        parent_policy_id: parentPolicyInfo.id,
        policy_type: 'modificacion',
      } : {}),
    };
    await onSubmit(submitData as PolicyFormValues & { parent_policy_id?: string; policy_type?: string });
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Indicador visual de modificación */}
      {isModification && parentPolicyInfo && (
        <div className="border border-amber-500 bg-amber-50 rounded-lg p-4 flex gap-3">
          <FileEdit className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-amber-800">
            <strong>Creando Modificación (Anexo {watchAnexo})</strong>
            <br />
            Póliza Original: <strong>{parentPolicyInfo.policy_number}</strong> - Anexo {parentPolicyInfo.anexo}
            {parentPolicyInfo.client_name && (
              <> | Cliente: <strong>{parentPolicyInfo.client_name}</strong></>
            )}
            <br />
            <span className="text-sm">
              Los valores negativos en prima representan reducciones/créditos a favor del cliente.
            </span>
          </div>
        </div>
      )}

      {/* Información básica */}
      <Card>
        <CardHeader>
          <CardTitle>Información de la Póliza</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Número de Póliza *</label>
            <Input placeholder="Ej: POL-2024-001" {...register('policy_number')} />
            {errors.policy_number && <p className="text-sm text-red-500">{errors.policy_number.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Anexo</label>
            <Input 
              placeholder="00" 
              {...register('anexo')} 
              disabled={isModification}
              className={isModification ? 'bg-gray-100' : ''}
            />
            {errors.anexo && <p className="text-sm text-red-500">{errors.anexo.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Estado</label>
            <Select onValueChange={(val) => setValue('status', val)} defaultValue={defaultValues?.status || 'vigente'}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vigente">Vigente</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cliente y Aseguradora */}
      <Card>
        <CardHeader>
          <CardTitle>Cliente y Aseguradora</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Cliente *</label>
            <Select onValueChange={(val) => setValue('client_id', val)} defaultValue={defaultValues?.client_id}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.client_id && <p className="text-sm text-red-500">{errors.client_id.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Aseguradora *</label>
            <Select onValueChange={(val) => setValue('insurer_id', val)} defaultValue={defaultValues?.insurer_id}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar aseguradora" />
              </SelectTrigger>
              <SelectContent>
                {insurers.map((insurer) => (
                  <SelectItem key={insurer.id} value={insurer.id}>
                    {insurer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.insurer_id && <p className="text-sm text-red-500">{errors.insurer_id.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ramo *</label>
            <Select onValueChange={(val) => setValue('line_id', val)} defaultValue={defaultValues?.line_id}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar ramo" />
              </SelectTrigger>
              <SelectContent>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.line_id && <p className="text-sm text-red-500">{errors.line_id.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Grupo (Opcional)</label>
            <Select onValueChange={(val) => setValue('group_id', val)} defaultValue={defaultValues?.group_id || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin grupo</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Fechas */}
      <Card>
        <CardHeader>
          <CardTitle>Vigencia</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha de Inicio *</label>
            <Input type="date" {...register('start_date')} />
            {errors.start_date && <p className="text-sm text-red-500">{errors.start_date.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha de Fin *</label>
            <Input type="date" {...register('end_date')} />
            {errors.end_date && <p className="text-sm text-red-500">{errors.end_date.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha de Expedición</label>
            <Input type="date" {...register('fecha_expedicion')} />
          </div>
        </CardContent>
      </Card>

      {/* Valores Financieros */}
      <Card>
        <CardHeader>
          <CardTitle>
            Valores Financieros
            {isModification && (
              <span className="text-sm font-normal text-amber-600 ml-2">
                (Use valores negativos para reducciones)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Prima Neta *</label>
            <Input
              placeholder="$0"
              value={displayPremium}
              onChange={(e) => handleCurrencyInput(e.target.value, 'premium')}
              className={watchPremium < 0 ? 'text-red-600 font-semibold' : ''}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Gastos Expedición</label>
            <Input
              placeholder="$0"
              value={displayGastos}
              onChange={(e) => handleCurrencyInput(e.target.value, 'gastos_expedicion')}
              className={watchGastos < 0 ? 'text-red-600 font-semibold' : ''}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">IVA</label>
            <Input
              placeholder="$0"
              value={displayIva}
              onChange={(e) => handleCurrencyInput(e.target.value, 'iva')}
              className={watchIva < 0 ? 'text-red-600 font-semibold' : ''}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Total a Pagar</label>
            <Input
              value={displayTotal}
              disabled
              className={`bg-gray-100 ${(watchPremium + watchGastos + watchIva) < 0 ? 'text-red-600 font-bold' : 'font-semibold'}`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Comisión %</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="0"
              {...register('commission_pct', { valueAsNumber: true })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notas */}
      <Card>
        <CardHeader>
          <CardTitle>Notas / Observaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Agregue notas o comentarios sobre esta póliza..."
            className="min-h-[100px]"
            {...register('notas')}
          />
        </CardContent>
      </Card>

      {/* Botones */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : isModification ? 'Crear Modificación' : 'Crear Póliza'}
        </Button>
      </div>
    </form>
  );
}

export default PolicyForm;
