'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { clientSchema, type ClientFormData } from '@/lib/validations/clients';
import { createClient, updateClient } from '@/lib/services/clients.service';
import { createBrowserClient } from '@/lib/supabase/client';
import { Loader2, Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlliedAgent {
  id: string;
  full_name: string;
}

interface ClientFormProps {
  initialData?: ClientFormData & { id?: string };
  tenantId: string;
  agentId: string;
}

export function ClientForm({ initialData, tenantId, agentId }: ClientFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alliedAgents, setAlliedAgents] = useState<AlliedAgent[]>([]);
  const [loadingAllies, setLoadingAllies] = useState(true);
  const [allyOpen, setAllyOpen] = useState(false);
  const [allySearch, setAllySearch] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData || {
      full_name: '',
      doc_type: 'cedula',
      doc_number: '',
      email: '',
      phone: '',
      address: '',
      segment: 'persona_natural',
      allied_agent_id: null,
    },
  });

  const selectedAllyId = watch('allied_agent_id');

  // Cargar aliados
  useEffect(() => {
    async function loadAlliedAgents() {
      try {
        const supabase = createBrowserClient();
        const { data, error } = await (supabase as any)
          .from('allied_agents')
          .select('id, full_name')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('full_name');

        if (!error && data) {
          setAlliedAgents(data);
        }
      } catch (err) {
        console.error('Error loading allied agents:', err);
      } finally {
        setLoadingAllies(false);
      }
    }
    loadAlliedAgents();
  }, [tenantId]);

  const onSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true);
    try {
      const clientData = {
        ...data,
        tenant_id: tenantId,
        agent_id: agentId,
        allied_agent_id: data.allied_agent_id || null,
      };

      if (initialData?.id) {
        await updateClient(initialData.id, clientData);
      } else {
        await createClient(clientData);
      }

      router.push('/clientes');
      router.refresh();
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Error al guardar el cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrar aliados por búsqueda
  const filteredAllies = alliedAgents.filter((ally) =>
    ally.full_name.toLowerCase().includes(allySearch.toLowerCase())
  );

  // Obtener nombre del aliado seleccionado
  const selectedAllyName = selectedAllyId
    ? alliedAgents.find((a) => a.id === selectedAllyId)?.full_name
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialData?.id ? 'Editar Cliente' : 'Nuevo Cliente'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Nombre Completo */}
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre Completo *</Label>
            <Input
              id="full_name"
              {...register('full_name')}
              placeholder="Nombre del cliente"
            />
            {errors.full_name && (
              <p className="text-sm text-red-500">{errors.full_name.message}</p>
            )}
          </div>

          {/* Tipo y Número de Documento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doc_type">Tipo de Documento *</Label>
              <Select
                defaultValue={initialData?.doc_type || 'cedula'}
                onValueChange={(value) => setValue('doc_type', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cedula">Cédula</SelectItem>
                  <SelectItem value="pasaporte">Pasaporte</SelectItem>
                  <SelectItem value="ruc">RUC</SelectItem>
                  <SelectItem value="nit">NIT</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
              {errors.doc_type && (
                <p className="text-sm text-red-500">{errors.doc_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc_number">Número de Documento *</Label>
              <Input
                id="doc_number"
                {...register('doc_number')}
                placeholder="Número de documento"
              />
              {errors.doc_number && (
                <p className="text-sm text-red-500">{errors.doc_number.message}</p>
              )}
            </div>
          </div>

          {/* Email y Teléfono */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="correo@ejemplo.com"
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+593 999 999 999"
              />
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone.message}</p>
              )}
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              {...register('address')}
              placeholder="Dirección del cliente"
            />
            {errors.address && (
              <p className="text-sm text-red-500">{errors.address.message}</p>
            )}
          </div>

          {/* Segmento */}
          <div className="space-y-2">
            <Label htmlFor="segment">Segmento *</Label>
            <Select
              defaultValue={initialData?.segment || 'persona_natural'}
              onValueChange={(value) => setValue('segment', value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="persona_natural">Persona Natural</SelectItem>
                <SelectItem value="persona_juridica">Persona Jurídica</SelectItem>
              </SelectContent>
            </Select>
            {errors.segment && (
              <p className="text-sm text-red-500">{errors.segment.message}</p>
            )}
          </div>

          {/* Aliado / Referido por */}
          <div className="space-y-2">
            <Label>Aliado / Referido por</Label>
            <Popover open={allyOpen} onOpenChange={setAllyOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={allyOpen}
                  className="w-full justify-between"
                  disabled={loadingAllies}
                >
                  {loadingAllies ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando...
                    </span>
                  ) : selectedAllyName ? (
                    selectedAllyName
                  ) : (
                    'Directo (sin aliado)'
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <div className="p-2">
                  <div className="flex items-center border-b px-2 pb-2">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                      placeholder="Buscar aliado..."
                      value={allySearch}
                      onChange={(e) => setAllySearch(e.target.value)}
                      className="border-0 focus-visible:ring-0"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto py-2">
                    {/* Opción Directo */}
                    <div
                      className={cn(
                        'flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
                        !selectedAllyId && 'bg-accent'
                      )}
                      onClick={() => {
                        setValue('allied_agent_id', null);
                        setAllyOpen(false);
                        setAllySearch('');
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          !selectedAllyId ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      Directo (sin aliado)
                    </div>

                    {/* Lista de aliados */}
                    {filteredAllies.length === 0 ? (
                      <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No se encontraron aliados
                      </p>
                    ) : (
                      filteredAllies.map((ally) => (
                        <div
                          key={ally.id}
                          className={cn(
                            'flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
                            selectedAllyId === ally.id && 'bg-accent'
                          )}
                          onClick={() => {
                            setValue('allied_agent_id', ally.id);
                            setAllyOpen(false);
                            setAllySearch('');
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedAllyId === ally.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          {ally.full_name}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Selecciona el aliado que refirió a este cliente, o deja &quot;Directo&quot; si no aplica.
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : initialData?.id ? (
                'Actualizar Cliente'
              ) : (
                'Crear Cliente'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
