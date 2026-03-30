'use client';

import { useForm, ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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

// Parsea valores de moneda INCLUYENDO negativos
const parseCurrencyValue = (value: string): number => {
  if (!value) return 0;
  const isNegative = value.includes('-');
  const cleaned = value.replace(/[^0-9]/g, '');
  const numericValue = cleaned ? parseInt(cleaned) : 0;
  return isNegative ? -numericValue : numericValue;
};

// Formatea moneda INCLUYENDO negativos
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
  const [displayValues, setDisplayValues] = useState({
    premium: defaultValues?.premium ? formatCurrency(defaultValues.premium) : '$0',
    gastos_expedicion: defaultValues?.gastos_expedicion ? formatCurrency(defaultValues.gastos_expedicion) : '$0',
    iva: defaultValues?.iva ? formatCurrency(defaultValues.iva) : '$0',
    total_a_pagar: defaultValues?.total_a_pagar ? formatCurrency(defaultValues.total_a_pagar) : '$0',
  });

  const form = useForm<PolicyFormValues>({
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

  // Actualizar form cuando cambian defaultValues
  useEffect(() => {
    if (defaultValues) {
      Object.entries(defaultValues).forEach(([key, value]) => {
        if (value !== undefined) {
          form.setValue(key as keyof PolicyFormValues, value as never);
        }
      });
      setDisplayValues({
        premium: defaultValues.premium ? formatCurrency(defaultValues.premium) : '$0',
        gastos_expedicion: defaultValues.gastos_expedicion ? formatCurrency(defaultValues.gastos_expedicion) : '$0',
        iva: defaultValues.iva ? formatCurrency(defaultValues.iva) : '$0',
        total_a_pagar: defaultValues.total_a_pagar ? formatCurrency(defaultValues.total_a_pagar) : '$0',
      });
    }
  }, [defaultValues, form]);

  // Calcular totales automáticamente
  const watchPremium = form.watch('premium');
  const watchGastos = form.watch('gastos_expedicion');
  const watchIva = form.watch('iva');

  useEffect(() => {
    const total = (watchPremium || 0) + (watchGastos || 0) + (watchIva || 0);
    form.setValue('total_a_pagar', total);
    setDisplayValues(prev => ({
      ...prev,
      total_a_pagar: formatCurrency(total),
    }));
  }, [watchPremium, watchGastos, watchIva, form]);

  const handleCurrencyChange = (
    field: 'premium' | 'gastos_expedicion' | 'iva',
    value: string
  ) => {
    const numericValue = parseCurrencyValue(value);
    form.setValue(field, numericValue);
    setDisplayValues(prev => ({
      ...prev,
      [field]: formatCurrency(numericValue),
    }));
  };

  const handleCurrencyInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'premium' | 'gastos_expedicion' | 'iva'
  ) => {
    const value = e.target.value.replace(/[^0-9,.$-]/g, '');
    handleCurrencyChange(field, value);
  };

  const handleFormSubmit = async (data: PolicyFormValues) => {
    const submitData = {
      policy_number: data.policy_number,
      anexo: data.anexo,
      client_id: data.client_id,
      insurer_id: data.insurer_id,
      line_id: data.line_id,
      group_id: data.group_id || null,
      status: data.status,
      premium: data.premium,
      gastos_expedicion: data.gastos_expedicion,
      iva: data.iva,
      total_a_pagar: data.total_a_pagar,
      commission_pct: data.commission_pct,
      start_date: data.start_date,
      end_date: data.end_date,
      fecha_expedicion: data.fecha_expedicion || null,
      notas: data.notas || null,
      ...(isModification && parentPolicyInfo ? {
        parent_policy_id: parentPolicyInfo.id,
        policy_type: 'modificacion',
      } : {}),
    };
    await onSubmit(submitData as PolicyFormValues & { parent_policy_id?: string; policy_type?: string });
  };

  // Helper para renderizar campos de texto
  const renderTextField = (
    name: keyof PolicyFormValues,
    label: string,
    placeholder: string,
    disabled?: boolean
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }: { field: ControllerRenderProps<PolicyFormValues, typeof name> }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input 
              placeholder={placeholder} 
              {...field} 
              value={field.value as string}
              disabled={disabled}
              className={disabled ? 'bg-gray-100' : ''}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  // Helper para renderizar campos de fecha
  const renderDateField = (
    name: keyof PolicyFormValues,
    label: string
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }: { field: ControllerRenderProps<PolicyFormValues, typeof name> }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="date" {...field} value={field.value as string} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Indicador visual de modificación */}
        {isModification && parentPolicyInfo && (
          <div className="border border-amber-500 bg-amber-50 rounded-lg p-4 flex gap-3">
            <FileEdit className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-amber-800">
              <strong>Creando Modificación (Anexo {form.getValues('anexo')})</strong>
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
            {renderTextField('policy_number', 'Número de Póliza *', 'Ej: POL-2024-001')}
            {renderTextField('anexo', 'Anexo', '00', isModification)}
            
            <FormField
              control={form.control}
              name="status"
              render={({ field }: { field: ControllerRenderProps<PolicyFormValues, 'status'> }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="vigente">Vigente</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                      <SelectItem value="vencida">Vencida</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Cliente y Aseguradora */}
        <Card>
          <CardHeader>
            <CardTitle>Cliente y Aseguradora</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }: { field: ControllerRenderProps<PolicyFormValues, 'client_id'> }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="insurer_id"
              render={({ field }: { field: ControllerRenderProps<PolicyFormValues, 'insurer_id'> }) => (
                <FormItem>
                  <FormLabel>Aseguradora *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar aseguradora" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {insurers.map((insurer) => (
                        <SelectItem key={insurer.id} value={insurer.id}>
                          {insurer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="line_id"
              render={({ field }: { field: ControllerRenderProps<PolicyFormValues, 'line_id'> }) => (
                <FormItem>
                  <FormLabel>Ramo *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar ramo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lines.map((line) => (
                        <SelectItem key={line.id} value={line.id}>
                          {line.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="group_id"
              render={({ field }: { field: ControllerRenderProps<PolicyFormValues, 'group_id'> }) => (
                <FormItem>
                  <FormLabel>Grupo (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar grupo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Sin grupo</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Fechas */}
        <Card>
          <CardHeader>
            <CardTitle>Vigencia</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderDateField('start_date', 'Fecha de Inicio *')}
            {renderDateField('end_date', 'Fecha de Fin *')}
            {renderDateField('fecha_expedicion', 'Fecha de Expedición')}
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
            <FormField
              control={form.control}
              name="premium"
              render={({ field }: { field: ControllerRenderProps<PolicyFormValues, 'premium'> }) => (
                <FormItem>
                  <FormLabel>Prima Neta *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="$0"
                      value={displayValues.premium}
                      onChange={(e) => handleCurrencyInput(e, 'premium')}
                      className={field.value < 0 ? 'text-red-600 font-semibold' : ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gastos_expedicion"
              render={({ field }: { field: ControllerRenderProps<PolicyFormValues, 'gastos_expedicion'> }) => (
                <FormItem>
                  <FormLabel>Gastos Expedición</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="$0"
                      value={displayValues.gastos_expedicion}
                      onChange={(e) => handleCurrencyInput(e, 'gastos_expedicion')}
                      className={field.value < 0 ? 'text-red-600 font-semibold' : ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="iva"
              render={({ field }: { field: ControllerRenderProps<PolicyFormValues, 'iva'> }) => (
                <FormItem>
                  <FormLabel>IVA</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="$0"
                      value={displayValues.iva}
                      onChange={(e) => handleCurrencyInput(e, 'iva')}
                      className={field.value < 0 ? 'text-red-600 font-semibold' : ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="total_a_pagar"
              render={({ field }: { field: ControllerRenderProps<PolicyFormValues, 'total_a_pagar'> }) => (
                <FormItem>
                  <FormLabel>Total a Pagar</FormLabel>
                  <FormControl>
                    <Input
                      value={displayValues.total_a_pagar}
                      disabled
                      className={`bg-gray-100 ${field.value < 0 ? 'text-red-600 font-bold' : 'font-semibold'}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="commission_pct"
              render={({ field }: { field: ControllerRenderProps<PolicyFormValues, 'commission_pct'> }) => (
                <FormItem>
                  <FormLabel>Comisión %</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="0"
                      value={field.value}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Notas */}
        <Card>
          <CardHeader>
            <CardTitle>Notas / Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notas"
              render={({ field }: { field: ControllerRenderProps<PolicyFormValues, 'notas'> }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Agregue notas o comentarios sobre esta póliza..."
                      className="min-h-[100px]"
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
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
    </Form>
  );
}

export default PolicyForm;
