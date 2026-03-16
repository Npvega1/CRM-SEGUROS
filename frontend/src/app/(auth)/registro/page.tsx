'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Shield, Mail, Lock, User, Building2, AlertCircle, CheckCircle } from 'lucide-react';

// Schema de validación para registro
const registroSchema = z.object({
  agencyName: z.string().min(2, 'El nombre de la agencia debe tener al menos 2 caracteres').max(200),
  agencySlug: z.string()
    .min(3, 'El identificador debe tener al menos 3 caracteres')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
  email: z.string().email('Ingresa un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword']
});

type RegistroFormData = z.infer<typeof registroSchema>;

export default function RegistroPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<RegistroFormData>({
    resolver: zodResolver(registroSchema)
  });

  const watchAgencyName = watch('agencyName', '');

  // Generar slug automático del nombre
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const onSubmit = async (data: RegistroFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Este correo ya está registrado');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (!authData.user) {
        setError('Error al crear usuario');
        return;
      }

      // 2. Crear tenant (agencia)
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: data.agencyName,
          slug: data.agencySlug
        })
        .select('id')
        .single();

      if (tenantError) {
        if (tenantError.message.includes('duplicate')) {
          setError('Este identificador de agencia ya existe');
        } else {
          setError(`Error al crear agencia: ${tenantError.message}`);
        }
        // Eliminar usuario si falla la creación del tenant
        await supabase.auth.admin?.deleteUser(authData.user.id);
        return;
      }

      // 3. Crear registro en tabla users
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          tenant_id: tenantData.id,
          email: data.email,
          full_name: data.fullName,
          role: 'admin' // El creador de la agencia es admin
        });

      if (userError) {
        setError(`Error al crear perfil: ${userError.message}`);
        return;
      }

      // Éxito
      setSuccess(true);

    } catch (err) {
      setError('Error al registrar. Intenta nuevamente.');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">¡Registro exitoso!</h2>
              <p className="text-muted-foreground">
                Hemos enviado un correo de verificación. 
                Por favor revisa tu bandeja de entrada y confirma tu cuenta.
              </p>
              <Button 
                onClick={() => router.push('/login')} 
                className="w-full mt-4"
                data-testid="go-to-login-button"
              >
                Ir a iniciar sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 py-12">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Registrar Agencia</h1>
          <p className="text-muted-foreground mt-1">Crea tu cuenta y comienza a gestionar</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Datos de registro</CardTitle>
            <CardDescription>
              Completa la información para crear tu agencia
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {/* Error general */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Nombre de la agencia */}
              <div className="space-y-2">
                <Label htmlFor="agencyName">Nombre de la agencia</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="agencyName"
                    placeholder="Mi Agencia de Seguros"
                    className="pl-10"
                    disabled={isLoading}
                    data-testid="registro-agency-name-input"
                    {...register('agencyName')}
                  />
                </div>
                {errors.agencyName && (
                  <p className="text-sm text-destructive">{errors.agencyName.message}</p>
                )}
              </div>

              {/* Slug de la agencia */}
              <div className="space-y-2">
                <Label htmlFor="agencySlug">Identificador único</Label>
                <Input
                  id="agencySlug"
                  placeholder="mi-agencia"
                  disabled={isLoading}
                  defaultValue={generateSlug(watchAgencyName)}
                  data-testid="registro-agency-slug-input"
                  {...register('agencySlug')}
                />
                <p className="text-xs text-muted-foreground">
                  URL: crm.tudominio.com/<span className="font-medium">{watch('agencySlug') || 'mi-agencia'}</span>
                </p>
                {errors.agencySlug && (
                  <p className="text-sm text-destructive">{errors.agencySlug.message}</p>
                )}
              </div>

              <hr className="my-2" />

              {/* Nombre completo */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Tu nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="Juan Pérez"
                    className="pl-10"
                    disabled={isLoading}
                    data-testid="registro-fullname-input"
                    {...register('fullName')}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    className="pl-10"
                    disabled={isLoading}
                    data-testid="registro-email-input"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    disabled={isLoading}
                    data-testid="registro-password-input"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    disabled={isLoading}
                    data-testid="registro-confirm-password-input"
                    {...register('confirmPassword')}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="registro-submit-button"
              >
                {isLoading ? (
                  <>
                    <Spinner size="sm" className="text-primary-foreground" />
                    <span>Creando agencia...</span>
                  </>
                ) : (
                  'Crear agencia'
                )}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                ¿Ya tienes cuenta?{' '}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Iniciar sesión
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
