'use client';

// =====================================================
// PÁGINA: Login del Portal
// Módulo 07: Portal del Cliente
// Magic Link OTP (MOCK por ahora)
// Modo desarrollo: permite login con contraseña
// =====================================================

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowRight, CheckCircle2, AlertCircle, Building2, KeyRound } from 'lucide-react';

export default function PortalLoginPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Ingresa un email válido');
      isValid = false;
    }

    if (devMode && !password) {
      setPasswordError('Ingresa tu contraseña');
      isValid = false;
    }

    return isValid;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Verificar que el email pertenece a un cliente del tenant
      const { data: clientData, error: clientError } = await supabase
        .rpc('get_portal_client_by_email', {
          p_tenant_slug: tenantSlug,
          p_email: email
        });

      if (clientError) {
        throw new Error('Error verificando tu cuenta');
      }

      if (!clientData || clientData.length === 0) {
        setError('Este email no está registrado como cliente. Contacta a tu agente de seguros.');
        setIsLoading(false);
        return;
      }

      // ============================================
      // MODO DESARROLLO: Login con contraseña
      // ============================================
      if (devMode && password) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (authError) {
          setError('Credenciales inválidas. Verifica tu email y contraseña.');
          setIsLoading(false);
          return;
        }

        // Login exitoso, redirigir al dashboard
        router.push(`/${tenantSlug}/dashboard`);
        return;
      }

      // ============================================
      // MAGIC LINK REAL
      // ============================================
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/${tenantSlug}/auth/callback`,
        }
      });
      
      if (authError) {
        console.error('Auth error:', authError);
        setError('Error al enviar el código. Intenta de nuevo.');
        setIsLoading(false);
        return;
      }

      setIsEmailSent(true);

    } catch (e) {
      console.error('Login error:', e);
      setError(e instanceof Error ? e.message : 'Error al enviar el código');
    } finally {
      setIsLoading(false);
    }
  };

  // Pantalla de confirmación después de enviar el email
  if (isEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">¡Revisa tu email!</CardTitle>
            <CardDescription className="mt-2">
              Hemos enviado un enlace de acceso a
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="font-medium text-lg text-primary mb-6">
              {email}
            </p>
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800 mb-6">
              <p className="mb-2">
                <strong>Nota:</strong> El enlace expira en 1 hora.
              </p>
              <p>
                Si no ves el email, revisa tu carpeta de spam.
              </p>
            </div>
            
            {/* MOCK Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-6">
              <p className="font-medium mb-1">📧 Email enviado</p>
              <p>Revisa tu bandeja de entrada y haz clic en el enlace para acceder.</p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsEmailSent(false)}
              data-testid="portal-login-retry"
            >
              Usar otro email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Portal del Cliente</CardTitle>
          <CardDescription className="mt-2">
            Ingresa tu email para acceder a tu portal de seguros
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  className="pl-10 h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="portal-login-email"
                />
              </div>
              {emailError && (
                <p className="text-sm text-red-600">{emailError}</p>
              )}
            </div>

            {/* Campo de contraseña (modo desarrollo) */}
            {devMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Tu contraseña"
                    className="pl-10 h-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="portal-login-password"
                  />
                </div>
                {passwordError && (
                  <p className="text-sm text-red-600">{passwordError}</p>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={isLoading}
              data-testid="portal-login-submit"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {devMode ? 'Ingresando...' : 'Enviando...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {devMode ? 'Ingresar' : 'Enviar código de acceso'}
                  <ArrowRight className="h-5 w-5" />
                </span>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              {devMode 
                ? 'Modo desarrollo: ingresa con email y contraseña de Supabase Auth'
                : 'Te enviaremos un enlace seguro para iniciar sesión. No necesitas contraseña.'
              }
            </p>

            {/* Toggle modo desarrollo */}
            <div className="pt-4 border-t">
              <button
                type="button"
                onClick={() => setDevMode(!devMode)}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {devMode ? '← Volver a Magic Link' : '🔧 Modo desarrollo (login con contraseña)'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
