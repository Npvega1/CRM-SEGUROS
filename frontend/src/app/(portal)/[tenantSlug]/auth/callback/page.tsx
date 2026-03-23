'use client';

// =====================================================
// PÁGINA: Callback de Auth para el Portal
// Maneja la redirección después del magic link
// =====================================================

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function PortalAuthCallbackPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug as string;
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando tu sesión...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Obtener la sesión del hash de la URL (magic link)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          setStatus('error');
          setMessage('Error al verificar tu sesión. Intenta de nuevo.');
          return;
        }

        if (!session) {
          // Intentar intercambiar el código por una sesión
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (setSessionError) {
              setStatus('error');
              setMessage('Error al establecer la sesión.');
              return;
            }
          } else {
            setStatus('error');
            setMessage('No se encontró una sesión válida.');
            return;
          }
        }

        // Verificar que el usuario es un cliente del tenant
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user?.email) {
          setStatus('error');
          setMessage('No se pudo obtener la información del usuario.');
          return;
        }

        const { data: clientData } = await supabase
          .rpc('get_portal_client_by_email', {
            p_tenant_slug: tenantSlug,
            p_email: user.email
          });

        if (!clientData || clientData.length === 0) {
          setStatus('error');
          setMessage('Tu email no está registrado como cliente de este portal.');
          return;
        }

        setStatus('success');
        setMessage('¡Sesión verificada! Redirigiendo...');

        // Redirigir al dashboard del portal
        setTimeout(() => {
          router.push(`/${tenantSlug}/dashboard`);
        }, 1000);

      } catch (e) {
        console.error('Callback error:', e);
        setStatus('error');
        setMessage('Error inesperado. Intenta de nuevo.');
      }
    };

    handleCallback();
  }, [tenantSlug, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardContent className="pt-8 pb-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-gray-600">{message}</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Bienvenido!</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <a 
                href={`/${tenantSlug}/login`}
                className="text-primary hover:underline"
              >
                Volver al login
              </a>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
