'use client';

// =====================================================
// COMPONENTE: ClientForm
// Formulario para crear/editar clientes
// =====================================================

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  CreateClientInputSchema,
  type Client,
  DOC_TYPE_LABELS,
  SEGMENT_LABELS,
  type DocType,
  type ClientSegment
} from '@/lib/validations/clients';
import { Loader2, Save, X } from 'lucide-react';

// Tipo para el formulario
interface ClientFormData {
  full_name: string;
  doc_type: DocType;
  doc_number: string;
  email?: string;
  phone?: string;
  segment: ClientSegment;
  agent_id?: string | null;
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
      segment: client.segment as ClientSegment,
      tags: client.tags || []
    } : {
      full_name: '',
      doc_type: 'cedula',
      doc_number: '',
      email: '',
      phone: '',
      segment: 'individual',
      tags: []
    }
  });

  const docType = watch('doc_type');
  const segment = watch('segment');

  const handleFormSubmit = async (data: ClientFormData) => {
    await onSubmit(data);
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

      {/* Segmento */}
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
