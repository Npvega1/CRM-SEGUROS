'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  createAlliedAgent,
  updateAlliedAgent,
} from '@/lib/services/allied-agents.service';
import { getBrowserClient } from '@/lib/supabase/client';
import type { AlliedAgent, CreateAlliedAgentInput, UpdateAlliedAgentInput } from '@/types/allied-agents';

interface AlliedAgentFormProps {
  agent?: AlliedAgent | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AlliedAgentForm({ agent, onSuccess, onCancel }: AlliedAgentFormProps) {
  const [saving, setSaving] = useState(false);
  const isEditing = !!agent;

  const [formData, setFormData] = useState({
    full_name: agent?.full_name || '',
    identification: agent?.identification || '',
    phone: agent?.phone || '',
    email: agent?.email || '',
    address: agent?.address || '',
    commission_percentage: agent?.commission_percentage || 60,
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.app_metadata?.tenant_id;

      if (!tenantId) {
        throw new Error('No se encontró el tenant');
      }

      if (isEditing && agent?.id) {
        const updateData: UpdateAlliedAgentInput = {
          full_name: formData.full_name,
          identification: formData.identification,
          phone: formData.phone,
          address: formData.address,
          commission_percentage: Number(formData.commission_percentage),
        };
        await updateAlliedAgent(agent.id, updateData);
        toast.success('Aliado actualizado exitosamente');
      } else {
        if (!formData.password || formData.password.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres');
          setSaving(false);
          return;
        }
        const createData: CreateAlliedAgentInput = {
          full_name: formData.full_name,
          identification: formData.identification,
          phone: formData.phone,
          email: formData.email,
          address: formData.address || null,
          commission_percentage: Number(formData.commission_percentage),
          password: formData.password,
          is_active: true,
        };
        await createAlliedAgent(createData, tenantId);
        toast.success('Aliado creado exitosamente');
      }

      onSuccess();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar aliado';
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Nombre Completo *</Label>
          <Input
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="identification">Identificación *</Label>
          <Input
            id="identification"
            name="identification"
            value={formData.identification}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono *</Label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
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
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Dirección</Label>
          <Textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            rows={2}
          />
        </div>

        <div className="space-y-2">
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
          <p className="text-xs text-muted-foreground">
            Porcentaje de la comisión que recibe el aliado
          </p>
        </div>

        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña *</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Mínimo 6 caracteres"
              required={!isEditing}
            />
            <p className="text-xs text-muted-foreground">
              El aliado usará este correo y contraseña para acceder al portal
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar'
          )}
        </Button>
      </div>
    </form>
  );
}
