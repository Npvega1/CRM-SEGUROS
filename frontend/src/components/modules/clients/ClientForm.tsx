'use client';

// =====================================================
// COMPONENTE: ClientForm
// Formulario para crear/editar clientes
// =====================================================

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useMemo } from 'react';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  CreateClientInputSchema,
  type Client,
  DOC_TYPE_LABELS,
  SEGMENT_LABELS,
  type DocType,
  type ClientSegment
} from '@/lib/validations/clients';
import { getActiveAlliedAgents } from '@/lib/services/allied-agents.service';
import type { AlliedAgent } from '@/types/allied-agents';
import { Loader2, Save, X, ChevronsUpDown, Check, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Tipo para el formulario
interface ClientFormData {
  full_name: string;
  doc_type: DocType;
  doc_number: string;
  email?: string;
  phone?: string;
  address?: string;
  segment: ClientSegment;
  agent_id?: string | null;
  allied_agent_id?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: ClientFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ClientForm({ 
  client, 
  onSubmit, 
  onCancel,
  isLoading = false 
}: ClientFormProps) {
  const isEditing = !!client;
  const [alliedAgents, setAlliedAgents] = useState<AlliedAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [alliedOpen, setAlliedOpen] = useState(false);
  const [alliedSearch, setAlliedSearch] = useState('');

  // Cargar aliados activos
  useEffect(() => {
    const loadAlliedAgents = async () => {
      try {
        const agents = await getActiveAlliedAgents();
        setAlliedAgents(agents);
      } catch (error) {
        console.error('Error loading allied agents:', error);
      } finally {
        setLoadingAgents(false);
      }
    };
    loadAlliedAgents();
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ClientFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(CreateClientInputSchema) as any,
    defaultValues: client ? {
      full_name: client.full_name,
      doc_type: client.doc_type as DocType,
      doc_number: client.doc_number,
      email: client.email || '',
      phone: client.phone || '',
      address: (client as any).address || '',
      segment: client.segment as ClientSegment,
      allied_agent_id: (client as any).allied_agent_id || null,
      tags: client.tags || []
    } : {
      full_name: '',
      doc_type: 'cedula',
      doc_number: '',
      email: '',
      phone: '',
      address: '',
      segment: 'individual',
      allied_agent_id: null,
      tags: []
    }
  });

  const docType = watch('doc_type');
  const segment = watch('segment');
  const alliedAgentId = watch('allied_agent_id');

  // Filtrar aliados según búsqueda
  const filteredAlliedAgents = useMemo(() => {
    if (!alliedSearch) return alliedAgents;
    const search = alliedSearch.toLowerCase();
    return alliedAgents.filter(agent => 
      agent.full_name.toLowerCase().includes(search) ||
      agent.identification.includes(search)
    );
  }, [alliedAgents, alliedSearch]);

  // Obtener nombre del aliado seleccionado
  const selectedAlliedAgent = useMemo(() => {
    if (!alliedAgentId) return null;
    if (alliedAgentId === 'direct') return { full_name: 'Directo (sin aliado)' };
    return alliedAgents.find(a => a.id === alliedAgentId);
  }, [alliedAgentId, alliedAgents]);

  const handleFormSubmit = async (data: ClientFormData) => {
    // Si es "direct", enviar null
    const submitData = {
      ...data,
      allied_agent_id: data.allied_agent_id === 'direct' ? null : data.allied_agent_id
    };
    await onSubmit(submitData);
  };

  const loading = isLoading || isSubmitting;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Nombre Completo */}
      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre Completo *</Label>
        <Input
          id="full_name"
          placeholder="Ej: Juan Pérez García"
          {...register('full_name')}
          disabled={loading}
          data-testid="client-full-name-input"
        />
        {errors.full_name && (
          <p className="text-sm text-red-500">{errors.full_name.message}</p>
        )}
      </div>

      {/* Tipo y Número de Documento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="doc_type">Tipo de Documento *</Label>
          <Select
            value={docType}
            onValueChange={(value: DocType) => setValue('doc_type', value)}
            disabled={loading}
          >
            <SelectTrigger id="doc_type" data-testid="client-doc-type-select">
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
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
            placeholder="Ej: 12345678"
            {...register('doc_number')}
            disabled={loading}
            data-testid="client-doc-number-input"
          />
          {errors.doc_number && (
            <p className="text-sm text-red-500">{errors.doc_number.message}</p>
          )}
        </div>
      </div>

      {/* Email y Teléfono */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="correo@ejemplo.com"
            {...register('email')}
            disabled={loading}
            data-testid="client-email-input"
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+57 300 123 4567"
            {...register('phone')}
            disabled={loading}
            data-testid="client-phone-input"
          />
          {errors.phone && (
            <p className="text-sm text-red-500">{errors.phone.message}</p>
          )}
        </div>
      </div>

      {/* Dirección */}
      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        <Textarea
          id="address"
          placeholder="Ej: Calle 123 #45-67, Bogotá"
          {...register('address')}
          disabled={loading}
          rows={2}
          data-testid="client-address-input"
        />
        {errors.address && (
          <p className="text-sm text-red-500">{(errors.address as any)?.message}</p>
        )}
      </div>

      {/* Segmento y Aliado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="segment">Segmento *</Label>
          <Select
            value={segment}
            onValueChange={(value: ClientSegment) => setValue('segment', value)}
            disabled={loading}
          >
            <SelectTrigger id="segment" data-testid="client-segment-select">
              <SelectValue placeholder="Seleccionar segmento" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(SEGMENT_LABELS) as [ClientSegment, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.segment && (
            <p className="text-sm text-red-500">{errors.segment.message}</p>
          )}
        </div>

        {/* Selector de Aliado con búsqueda */}
        <div className="space-y-2">
          <Label>Aliado / Referido por</Label>
          <Popover open={alliedOpen} onOpenChange={setAlliedOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={alliedOpen}
                className="w-full justify-between font-normal"
                disabled={loading || loadingAgents}
                data-testid="client-allied-select"
              >
                {loadingAgents ? (
                  <span className="text-muted-foreground">Cargando aliados...</span>
                ) : selectedAlliedAgent ? (
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    {selectedAlliedAgent.full_name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Seleccionar aliado...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput 
                  placeholder="Buscar aliado por nombre o documento..." 
                  value={alliedSearch}
                  onValueChange={setAlliedSearch}
                />
                <CommandList>
                  <CommandEmpty>No se encontraron aliados.</CommandEmpty>
                  <CommandGroup>
                    {/* Opción Directo */}
                    <CommandItem
                      value="direct"
                      onSelect={() => {
                        setValue('allied_agent_id', 'direct');
                        setAlliedOpen(false);
                        setAlliedSearch('');
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          alliedAgentId === 'direct' ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-medium">Directo (sin aliado)</span>
                    </CommandItem>
                    
                    {/* Lista de aliados */}
                    {filteredAlliedAgents.map((agent) => (
                      <CommandItem
                        key={agent.id}
                        value={agent.id}
                        onSelect={() => {
                          setValue('allied_agent_id', agent.id!);
                          setAlliedOpen(false);
                          setAlliedSearch('');
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            alliedAgentId === agent.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{agent.full_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {agent.identification} • {agent.commission_percentage}% comisión
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            Si el cliente fue referido por un aliado, selecciónalo aquí
          </p>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading} data-testid="client-submit-button">
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isEditing ? 'Guardar Cambios' : 'Crear Cliente'}
        </Button>
      </div>
    </form>
  );
}
