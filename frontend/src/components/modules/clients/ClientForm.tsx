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
import { CreateClientInputSchema } from '@/lib/validations/clients';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Check, ChevronsUpDown, Search, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlliedAgent {
  id: string;
  full_name: string;
}

interface ClientFormProps {
  initialData?: {
    id?: string;
    full_name: string;
    doc_type: string;
    doc_number: string;
    email?: string;
    phone?: string;
    address?: string;
    segment: string;
    allied_agent_id?: string | null;
  };
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
  
  // Permisos
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canModifyAllied, setCanModifyAllied] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  const isEditing = Boolean(initialData?.id);
  const clientHasAllied = Boolean(initialData?.allied_agent_id);

  // Determinar si puede modificar el aliado
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const canEditAlliedField = isAdmin || !isEditing || !clientHasAllied || canModifyAllied;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(CreateClientInputSchema) as any,
    defaultValues: {
      full_name: initialData?.full_name || '',
      doc_type: initialData?.doc_type || 'cedula',
      doc_number: initialData?.doc_number || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      address: initialData?.address || '',
      segment: initialData?.segment || 'persona_natural',
      allied_agent_id: initialData?.allied_agent_id || null,
    },
  });

  const selectedAllyId = watch('allied_agent_id');

  // Cargar rol del usuario y permisos
  useEffect(() => {
    async function loadUserPermissions() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Obtener rol del usuario
          const { data: userData } = await (supabase as any)
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();
          
          if (userData) {
            setUserRole(userData.role);
          }

          // Si no es admin, verificar permiso especifico
          if (userData?.role !== 'admin' && userData?.role !== 'superadmin') {
            const { data: permData } = await (supabase as any)
              .from('user_permissions')
              .select('can_modify_allied')
              .eq('user_id', user.id)
              .eq('section', 'clientes')
              .single();
            
            if (permData) {
              setCanModifyAllied(permData.can_modify_allied || false);
            }
          }
        }
      } catch (err) {
        console.error('Error loading permissions:', err);
      } finally {
        setLoadingPermissions(false);
      }
    }
    loadUserPermissions();
  }, []);

  // Cargar aliados
  useEffect(() => {
    async function loadAlliedAgents() {
      try {
        const supabase = createClient();
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

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      
      const clientData: any = {
        full_name: data.full_name,
        doc_type: data.doc_type,
        doc_number: data.doc_number,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        segment: data.segment,
        tenant_id: tenantId,
        agent_id: agentId,
      };

      // Solo incluir allied_agent_id si puede modificarlo
      if (canEditAlliedField) {
        clientData.allied_agent_id = data.allied_agent_id || null;
      }

      if (isEditing && initialData?.id) {
        const { error } = await (supabase as any)
          .from('clients')
          .update(clientData)
          .eq('id', initialData.id);
        
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('clients')
          .insert(clientData);
        
        if (error) throw error;
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

  const filteredAllies = alliedAgents.filter((ally) =>
    ally.full_name.toLowerCase().includes(allySearch.toLowerCase())
  );

  const selectedAllyName = selectedAllyId
    ? alliedAgents.find((a) => a.id === selectedAllyId)?.full_name
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre Completo *</Label>
            <Input
              id="full_name"
              {...register('full_name')}
              placeholder="Nombre del cliente"
            />
            {errors.full_name && (
              <p className="text-sm text-red-500">{String(errors.full_name.message)}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doc_type">Tipo de Documento *</Label>
              <Select
                defaultValue={initialData?.doc_type || 'cedula'}
                onValueChange={(value) => setValue('doc_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cedula">Cedula</SelectItem>
                  <SelectItem value="pasaporte">Pasaporte</SelectItem>
                  <SelectItem value="nit">NIT</SelectItem>
                  <SelectItem value="rut">RUT</SelectItem>
                  <SelectItem value="cedula_extranjeria">Cedula Extranjeria</SelectItem>
                  <SelectItem value="carnet_diplomatico">Carnet Diplomatico</SelectItem>
                  <SelectItem value="consorcio">Consorcio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc_number">Numero de Documento *</Label>
              <Input
                id="doc_number"
                {...register('doc_number')}
                placeholder="Numero de documento"
              />
              {errors.doc_number && (
                <p className="text-sm text-red-500">{String(errors.doc_number.message)}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+593 999 999 999"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Direccion</Label>
            <Input
              id="address"
              {...register('address')}
              placeholder="Direccion del cliente"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="segment">Segmento *</Label>
            <Select
              defaultValue={initialData?.segment || 'persona_natural'}
              onValueChange={(value) => setValue('segment', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="persona_natural">Persona Natural</SelectItem>
                <SelectItem value="persona_juridica">Persona Juridica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Aliado / Referido por */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Aliado / Referido por
              {!canEditAlliedField && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            
            {loadingPermissions ? (
              <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : !canEditAlliedField ? (
              // Campo bloqueado - mostrar solo lectura
              <div className="flex items-center justify-between h-10 px-3 border rounded-md bg-muted">
                <span className="text-sm">
                  {selectedAllyName || 'Directo (sin aliado)'}
                </span>
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              // Campo editable
              <Popover open={allyOpen} onOpenChange={setAllyOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={allyOpen}
                    className="w-full justify-between"
                    disabled={loadingAllies}
                    type="button"
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
            )}
            
            <p className="text-xs text-muted-foreground">
              {!canEditAlliedField 
                ? 'Solo un administrador puede modificar el aliado de este cliente.'
                : 'Selecciona el aliado que refirio a este cliente, o deja Directo si no aplica.'
              }
            </p>
          </div>

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
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </span>
              ) : isEditing ? (
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
