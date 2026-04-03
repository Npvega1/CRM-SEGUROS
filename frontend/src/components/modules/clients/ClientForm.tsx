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
import { Loader2, Check, ChevronsUpDown, Search, Lock, Users, Briefcase, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    comercial_id?: string | null;
    grupo_empresarial_id?: string | null;
  };
  tenantId: string;
  agentId: string;
}

export function ClientForm({ initialData, tenantId, agentId }: ClientFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Aliados
  const [alliedAgents, setAlliedAgents] = useState<AlliedAgent[]>([]);
  const [loadingAllies, setLoadingAllies] = useState(true);
  const [allyOpen, setAllyOpen] = useState(false);
  const [allySearch, setAllySearch] = useState('');
  const [initialAllyName, setInitialAllyName] = useState<string | null>(null);

  // Comerciales
  const [comerciales, setComerciales] = useState<Comercial[]>([]);
  const [loadingComerciales, setLoadingComerciales] = useState(true);
  const [comercialOpen, setComercialOpen] = useState(false);
  const [comercialSearch, setComercialSearch] = useState('');
  const [initialComercialName, setInitialComercialName] = useState<string | null>(null);

  // Grupos Empresariales
  const [gruposEmpresariales, setGruposEmpresariales] = useState<GrupoEmpresarial[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(true);
  const [grupoOpen, setGrupoOpen] = useState(false);
  const [grupoSearch, setGrupoSearch] = useState('');
  const [initialGrupoName, setInitialGrupoName] = useState<string | null>(null);

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
      comercial_id: initialData?.comercial_id || null,
      grupo_empresarial_id: initialData?.grupo_empresarial_id || null,
    },
  });

  const selectedAllyId = watch('allied_agent_id');
  const selectedComercialId = watch('comercial_id');
  const selectedGrupoId = watch('grupo_empresarial_id');

  // Cargar rol del usuario y permisos
  useEffect(() => {
    async function loadUserPermissions() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: userData } = await (supabase as any)
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

          if (userData) {
            setUserRole(userData.role);
          }

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

          if (initialData?.allied_agent_id) {
            const initialAlly = data.find((a: AlliedAgent) => a.id === initialData.allied_agent_id);
            if (initialAlly) {
              setInitialAllyName(initialAlly.full_name);
            } else {
              const { data: allyData } = await (supabase as any)
                .from('allied_agents')
                .select('full_name')
                .eq('id', initialData.allied_agent_id)
                .single();
              if (allyData) {
                setInitialAllyName(allyData.full_name);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error loading allied agents:', err);
      } finally {
        setLoadingAllies(false);
      }
    }
    loadAlliedAgents();
  }, [tenantId, initialData?.allied_agent_id]);

  // Cargar comerciales (usuarios con rol 'comercial')
  useEffect(() => {
    async function loadComerciales() {
      try {
        const supabase = createClient();
        const { data, error } = await (supabase as any)
          .from('users')
          .select('id, full_name')
          .eq('tenant_id', tenantId)
          .eq('role', 'comercial')
          .eq('is_active', true)
          .order('full_name');

        if (!error && data) {
          setComerciales(data);

          if (initialData?.comercial_id) {
            const initialComercial = data.find((c: Comercial) => c.id === initialData.comercial_id);
            if (initialComercial) {
              setInitialComercialName(initialComercial.full_name);
            } else {
              const { data: comercialData } = await (supabase as any)
                .from('users')
                .select('full_name')
                .eq('id', initialData.comercial_id)
                .single();
              if (comercialData) {
                setInitialComercialName(comercialData.full_name);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error loading comerciales:', err);
      } finally {
        setLoadingComerciales(false);
      }
    }
    loadComerciales();
  }, [tenantId, initialData?.comercial_id]);

  // Cargar grupos empresariales
  useEffect(() => {
    async function loadGruposEmpresariales() {
      try {
        const supabase = createClient();
        const { data, error } = await (supabase as any)
          .from('grupos_empresariales')
          .select('id, nombre')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('nombre');

        if (!error && data) {
          setGruposEmpresariales(data);

          if (initialData?.grupo_empresarial_id) {
            const initialGrupo = data.find((g: GrupoEmpresarial) => g.id === initialData.grupo_empresarial_id);
            if (initialGrupo) {
              setInitialGrupoName(initialGrupo.nombre);
            } else {
              const { data: grupoData } = await (supabase as any)
                .from('grupos_empresariales')
                .select('nombre')
                .eq('id', initialData.grupo_empresarial_id)
                .single();
              if (grupoData) {
                setInitialGrupoName(grupoData.nombre);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error loading grupos empresariales:', err);
      } finally {
        setLoadingGrupos(false);
      }
    }
    loadGruposEmpresariales();
  }, [tenantId, initialData?.grupo_empresarial_id]);

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
        comercial_id: data.comercial_id || null,
        grupo_empresarial_id: data.grupo_empresarial_id || null,
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

  const filteredComerciales = comerciales.filter((comercial) =>
    comercial.full_name.toLowerCase().includes(comercialSearch.toLowerCase())
  );

  const filteredGrupos = gruposEmpresariales.filter((grupo) =>
    grupo.nombre.toLowerCase().includes(grupoSearch.toLowerCase())
  );

  // Nombres para mostrar
  const selectedAllyName = selectedAllyId
    ? alliedAgents.find((a) => a.id === selectedAllyId)?.full_name || initialAllyName
    : null;

  const selectedComercialName = selectedComercialId
    ? comerciales.find((c) => c.id === selectedComercialId)?.full_name || initialComercialName
    : null;

  const selectedGrupoName = selectedGrupoId
    ? gruposEmpresariales.find((g) => g.id === selectedGrupoId)?.nombre || initialGrupoName
    : null;

  const displayAllyName = initialAllyName || selectedAllyName || 'Directo (sin aliado)';

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Información Básica */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Users className="h-4 w-4 text-blue-600" />
              <h3 className="font-medium text-sm text-gray-700">Información Básica</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="full_name">Nombre Completo *</Label>
                <Input id="full_name" {...register('full_name')} />
                {errors.full_name && (
                  <p className="text-red-500 text-xs">{String(errors.full_name.message)}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tipo de Documento *</Label>
                <Select
                  defaultValue={initialData?.doc_type || 'cedula'}
                  onValueChange={(value) => setValue('doc_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cedula">Cédula de Ciudadanía</SelectItem>
                    <SelectItem value="pasaporte">Pasaporte</SelectItem>
                    <SelectItem value="nit">NIT</SelectItem>
                    <SelectItem value="rut">RUT</SelectItem>
                    <SelectItem value="cedula_extranjeria">Cédula Extranjería</SelectItem>
                    <SelectItem value="carnet_diplomatico">Carnet Diplomático</SelectItem>
                    <SelectItem value="consorcio">Consorcio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc_number">Número de Documento *</Label>
                <Input id="doc_number" {...register('doc_number')} />
                {errors.doc_number && (
                  <p className="text-red-500 text-xs">{String(errors.doc_number.message)}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" {...register('phone')} />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" {...register('address')} />
              </div>

              <div className="space-y-2">
                <Label>Segmento *</Label>
                <Select
                  defaultValue={initialData?.segment || 'persona_natural'}
                  onValueChange={(value) => setValue('segment', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="persona_natural">Persona Natural</SelectItem>
                    <SelectItem value="persona_juridica">Persona Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Vinculaciones CRM */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Briefcase className="h-4 w-4 text-purple-600" />
              <h3 className="font-medium text-sm text-gray-700">Vinculaciones CRM</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Aliado / Referido por */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Aliado / Referido por</Label>
                  {!canEditAlliedField && !loadingPermissions && <Lock className="h-3 w-3 text-gray-400" />}
                </div>

                {loadingPermissions || loadingAllies ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando...
                  </div>
                ) : !canEditAlliedField ? (
                  <Input value={displayAllyName} disabled className="bg-gray-100" />
                ) : (
                  <Popover open={allyOpen} onOpenChange={setAllyOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {selectedAllyName || initialAllyName || 'Directo (sin aliado)'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder="Buscar aliado..."
                          value={allySearch}
                          onChange={(e) => setAllySearch(e.target.value)}
                          className="border-0 focus-visible:ring-0"
                        />
                      </div>
                      <div className="max-h-60 overflow-auto p-1">
                        <div
                          className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          onClick={() => {
                            setValue('allied_agent_id', null);
                            setAllyOpen(false);
                            setAllySearch('');
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !selectedAllyId ? "opacity-100" : "opacity-0")} />
                          Directo (sin aliado)
                        </div>
                        {filteredAllies.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-500">No se encontraron aliados</div>
                        ) : (
                          filteredAllies.map((ally) => (
                            <div
                              key={ally.id}
                              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                              onClick={() => {
                                setValue('allied_agent_id', ally.id);
                                setAllyOpen(false);
                                setAllySearch('');
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedAllyId === ally.id ? "opacity-100" : "opacity-0")} />
                              {ally.full_name}
                            </div>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <p className="text-xs text-gray-500">
                  {!canEditAlliedField && !loadingPermissions
                    ? 'Solo un administrador puede modificar el aliado.'
                    : 'Aliado que refirió a este cliente.'}
                </p>
              </div>

              {/* Comercial */}
              <div className="space-y-2">
                <Label>Comercial Asignado</Label>
                {loadingComerciales ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando...
                  </div>
                ) : comerciales.length === 0 ? (
                  <div className="text-sm text-amber-600 p-2 bg-amber-50 rounded">
                    No hay usuarios comerciales configurados.
                  </div>
                ) : (
                  <Popover open={comercialOpen} onOpenChange={setComercialOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {selectedComercialName || initialComercialName || 'Sin comercial asignado'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder="Buscar comercial..."
                          value={comercialSearch}
                          onChange={(e) => setComercialSearch(e.target.value)}
                          className="border-0 focus-visible:ring-0"
                        />
                      </div>
                      <div className="max-h-60 overflow-auto p-1">
                        <div
                          className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          onClick={() => {
                            setValue('comercial_id', null);
                            setComercialOpen(false);
                            setComercialSearch('');
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !selectedComercialId ? "opacity-100" : "opacity-0")} />
                          Sin comercial asignado
                        </div>
                        {filteredComerciales.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-500">No se encontraron comerciales</div>
                        ) : (
                          filteredComerciales.map((comercial) => (
                            <div
                              key={comercial.id}
                              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                              onClick={() => {
                                setValue('comercial_id', comercial.id);
                                setComercialOpen(false);
                                setComercialSearch('');
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedComercialId === comercial.id ? "opacity-100" : "opacity-0")} />
                              {comercial.full_name}
                            </div>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <p className="text-xs text-gray-500">Usuario comercial responsable de este cliente.</p>
              </div>

              {/* Grupo Empresarial */}
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <Label>Grupo Empresarial</Label>
                </div>
                {loadingGrupos ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando...
                  </div>
                ) : gruposEmpresariales.length === 0 ? (
                  <div className="text-sm text-gray-500 p-2 bg-gray-50 rounded">
                    No hay grupos empresariales creados. Puedes crear uno desde Configuración.
                  </div>
                ) : (
                  <Popover open={grupoOpen} onOpenChange={setGrupoOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {selectedGrupoName || initialGrupoName || 'Sin grupo empresarial'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder="Buscar grupo..."
                          value={grupoSearch}
                          onChange={(e) => setGrupoSearch(e.target.value)}
                          className="border-0 focus-visible:ring-0"
                        />
                      </div>
                      <div className="max-h-60 overflow-auto p-1">
                        <div
                          className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          onClick={() => {
                            setValue('grupo_empresarial_id', null);
                            setGrupoOpen(false);
                            setGrupoSearch('');
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !selectedGrupoId ? "opacity-100" : "opacity-0")} />
                          Sin grupo empresarial
                        </div>
                        {filteredGrupos.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-500">No se encontraron grupos</div>
                        ) : (
                          filteredGrupos.map((grupo) => (
                            <div
                              key={grupo.id}
                              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                              onClick={() => {
                                setValue('grupo_empresarial_id', grupo.id);
                                setGrupoOpen(false);
                                setGrupoSearch('');
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedGrupoId === grupo.id ? "opacity-100" : "opacity-0")} />
                              {grupo.nombre}
                            </div>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <p className="text-xs text-gray-500">
                  Agrupa clientes con diferentes documentos que pertenecen al mismo grupo económico.
                </p>
              </div>

            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
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
