'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  createAlliedAgent,
  updateAlliedAgent,
} from '@/lib/services/allied-agents.service';
import { getBrowserClient } from '@/lib/supabase/client';
import type { AlliedAgent, CreateAlliedAgentInput, UpdateAlliedAgentInput } from '@/types/allied-agents';
import { IDENTIFICATION_TYPES } from '@/types/allied-agents';

interface AlliedAgentFormProps {
  agent?: AlliedAgent | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AlliedAgentForm({ agent, onSuccess, onCancel }: AlliedAgentFormProps) {
  const [saving, setSaving] = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');
  const isEditing = !!agent;

  const [formData, setFormData] = useState({
    full_name: agent?.full_name || '',
    identification_type: agent?.identification_type || 'cc',
    identification: agent?.identification || '',
    birth_date: agent?.birth_date || '',
    phone: agent?.phone || '',
    email: agent?.email || '',
    address: agent?.address || '',
    city: agent?.city || '',
    commission_percentage: agent?.commission_percentage || 60,
    commercial_user_id: agent?.commercial_user_id || '',
  });

  useEffect(() => {
    const loadTenantInfo = async () => {
      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userTenantId = user?.app_metadata?.tenant_id;
      
      if (userTenantId) {
        setTenantId(userTenantId);
        
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('slug')
          .eq('id', userTenantId)
          .single();
        
        const tenant = tenantData as { slug: string } | null;
        if (tenant?.slug) {
          setTenantSlug(tenant.slug);
        }
      }
    };
    
    loadTenantInfo();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!tenantId) {
        throw new Error('No se encontró el tenant');
      }

      if (!tenantSlug) {
        throw new Error('No se encontró el slug del tenant');
      }

      if (isEditing && agent?.id) {
        const updateData: UpdateAlliedAgentInput = {
          full_name: formData.full_name,
          identification_type: formData.identification_type,
          identification: formData.identification,
          birth_date: formData.birth_date || null,
          phone: formData.phone,
          address: formData.address || null,
          city: formData.city || null,
          commission_percentage: Number(formData.commission_percentage),
          commercial_user_id: formData.commercial_user_id || null,
        };
        await updateAlliedAgent(agent.id, updateData);
        toast.success('Aliado actualizado exitosamente');
      } else {
        const inviteResponse = await fetch('/api/allied-agents/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            full_name: formData.full_name,
            tenantSlug: tenantSlug,
          }),
        });

        const inviteResult = await inviteResponse.json();

        if (!inviteResponse.ok) {
          throw new Error(inviteResult.error || 'Error al enviar invitación');
        }

        const createData: CreateAlliedAgentInput = {
          full_name: formData.full_name,
          identification_type: formData.identification_type,
          identification: formData.identification,
          birth_date: formData.birth_date || null,
          phone: formData.phone,
          email: formData.email,
          address: formData.address || null,
          city: formData.city || null,
          commission_percentage: Number(formData.commission_percentage),
          commercial_user_id: formData.commercial_user_id || null,
          is_active: true,
          auth_user_id: inviteResult.userId,
        };
        
        await createAlliedAgent(createData, tenantId);
        toast.success('Aliado creado exitosamente. Se envió un email de invitación.');
      }

      onSuccess();
    } catch (error: unknown) {
      let errorMessage = 'Error al guardar aliado';

      if (error && typeof error === 'object' && 'code' in error) {
        const pgError = error as { code: string; message: string };
        if (pgError.code === '23505') {
          if (pgError.message?.includes('email')) {
            errorMessage = 'Ya existe un aliado registrado con este correo electrónico';
          } else if (pgError.message?.includes('identification')) {
            errorMessage = 'Ya existe un aliado registrado con esta identificación';
          } else {
            errorMessage = 'Ya existe un aliado con estos datos. Verifica el correo o la identificación.';
          }
        } else {
          errorMessage = pgError.message || errorMessage;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nombre Completo */}
        <div className="space-y-1">
          <Label htmlFor="full_name">Nombre Completo *</Label>
          <Input
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            required
          />
        </div>

        {/* Correo Electrónico */}
        <div className="space-y-1">
          <Label htmlFor="email">Correo Electrónico *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            disabled={isEditing}
            required
          />
          {!isEditing && (
            <p className="text-xs text-muted-foreground">
              Se enviará un email de invitación
            </p>
          )}
        </div>

        {/* Tipo de Identificación */}
        <div className="space-y-1">
          <Label>Tipo de Identificación *</Label>
          <Select
            value={formData.identification_type}
            onValueChange={(v) => setFormData(prev => ({ ...prev, identification_type: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IDENTIFICATION_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Número de Identificación */}
        <div className="space-y-1">
          <Label htmlFor="identification">Número de Identificación *</Label>
          <Input
            id="identification"
            name="identification"
            value={formData.identification}
            onChange={handleChange}
            required
          />
        </div>

        {/* Fecha de Nacimiento */}
        <div className="space-y-1">
          <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
          <Input
            id="birth_date"
            name="birth_date"
            type="date"
            value={formData.birth_date}
            onChange={handleChange}
          />
        </div>

        {/* Teléfono */}
        <div className="space-y-1">
          <Label htmlFor="phone">Teléfono *</Label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
          />
        </div>

        {/* Dirección */}
        <div className="space-y-1">
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
          />
        </div>

        {/* Ciudad */}
        <div className="space-y-1">
          <Label htmlFor="city">Ciudad</Label>
          <Input
            id="city"
            name="city"
            value={formData.city}
            onChange={handleChange}
          />
        </div>

        {/* % Comisión */}
        <div className="space-y-1">
          <Label htmlFor="commission_percentage">% Comisión Aliado</Label>
          <div className="flex items-center gap-2">
            <Input
              id="commission_percentage"
              name="commission_percentage"
              type="number"
              min="0"
              max="100"
              value={formData.commission_percentage}
              onChange={handleChange}
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              / {100 - Number(formData.commission_percentage)}% Agencia
            </span>
          </div>
        </div>

        {/* Comercial */}
        <div className="space-y-1">
          <Label>Comercial</Label>
          <Input
            value="No disponible aún"
            disabled
            className="bg-gray-100"
          />
          <p className="text-xs text-muted-foreground">Próximamente</p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || !tenantSlug}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Guardando...' : 'Creando y enviando invitación...'}
            </>
          ) : (
            isEditing ? 'Guardar' : 'Crear y Enviar Invitación'
          )}
        </Button>
      </div>
    </form>
  );
}
