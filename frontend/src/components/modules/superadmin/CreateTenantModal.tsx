'use client';

// =====================================================
// COMPONENT: Create Tenant Modal
// Modal para crear un nuevo tenant manualmente
// =====================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Building2, User, Mail, Lock, Loader2 } from 'lucide-react';
import { createTenantSchema, type CreateTenantInput } from '@/lib/validations/superadmin';

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTenantModal({ isOpen, onClose, onSuccess }: CreateTenantModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = getUntypedClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: '',
      slug: '',
      admin_email: '',
      admin_name: '',
      admin_password: '',
    },
  });

  // Name is watched for reference (auto-slug)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const name = watch('name');
  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    const slug = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setValue('slug', slug);
  };

  const onSubmit = async (data: CreateTenantInput) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Verificar que el slug no exista
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', data.slug)
        .single();

      if (existingTenant) {
        setError('Ya existe un tenant con este slug');
        setIsSubmitting(false);
        return;
      }

      // 2. Crear el tenant
      const { data: newTenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: data.name,
          slug: data.slug,
          is_active: true,
          settings: {},
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 3. Crear el usuario admin en auth (esto requiere service_role, que se maneja desde el backend)
      // Por ahora, creamos solo el registro en la tabla users
      // NOTA: En producción, esto debería hacerse vía una Edge Function con service_role
      
      // Log audit
      await supabase.from('audit_logs').insert({
        action: 'tenant.created',
        entity_type: 'tenant',
        entity_id: newTenant.id,
        new_values: { name: data.name, slug: data.slug, admin_email: data.admin_email },
      });

      // TODO: Enviar email de bienvenida al admin (MOCK)
      console.log('[MOCK EMAIL] Enviando email de bienvenida a:', data.admin_email);

      reset();
      onSuccess();
    } catch (err) {
      console.error('Error creating tenant:', err);
      setError('Error al crear el tenant. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-red-500" />
            Crear Nuevo Tenant
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Tenant Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-zinc-300">
                Nombre de la agencia
              </Label>
              <div className="relative mt-1.5">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  id="name"
                  {...register('name', {
                    onChange: (e) => handleNameChange(e.target.value),
                  })}
                  placeholder="Mi Agencia de Seguros"
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  data-testid="tenant-name-input"
                />
              </div>
              {errors.name && (
                <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="slug" className="text-zinc-300">
                Slug (URL)
              </Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">/</span>
                <Input
                  id="slug"
                  {...register('slug')}
                  placeholder="mi-agencia"
                  className="pl-7 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono"
                  data-testid="tenant-slug-input"
                />
              </div>
              {errors.slug && (
                <p className="text-red-400 text-xs mt-1">{errors.slug.message}</p>
              )}
            </div>
          </div>

          {/* Admin Info */}
          <div className="pt-4 border-t border-zinc-800 space-y-4">
            <p className="text-sm text-zinc-400">Usuario administrador</p>

            <div>
              <Label htmlFor="admin_name" className="text-zinc-300">
                Nombre completo
              </Label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  id="admin_name"
                  {...register('admin_name')}
                  placeholder="Juan Pérez"
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  data-testid="admin-name-input"
                />
              </div>
              {errors.admin_name && (
                <p className="text-red-400 text-xs mt-1">{errors.admin_name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="admin_email" className="text-zinc-300">
                Email
              </Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  id="admin_email"
                  type="email"
                  {...register('admin_email')}
                  placeholder="admin@agencia.com"
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  data-testid="admin-email-input"
                />
              </div>
              {errors.admin_email && (
                <p className="text-red-400 text-xs mt-1">{errors.admin_email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="admin_password" className="text-zinc-300">
                Contraseña
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  id="admin_password"
                  type="password"
                  {...register('admin_password')}
                  placeholder="••••••••"
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  data-testid="admin-password-input"
                />
              </div>
              {errors.admin_password && (
                <p className="text-red-400 text-xs mt-1">{errors.admin_password.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-red-500 hover:bg-red-600 text-white"
              data-testid="create-tenant-submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Tenant'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
