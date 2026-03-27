'use client';

// =====================================================
// PÁGINA: Callback de Auth para el Portal de Aliados
// Maneja la confirmación de invitación y setup de password
// =====================================================

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function AlliedAuthCallbackPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug as string;
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando tu invitación...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Obtener tokens del hash de la URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (setSessionError) {
            console.error('Error setting session:', setSessionError);
            setStatus('error');
            setMessage('Error al verificar la invitación. El enlace puede haber expirado.');
            return;
          }

          // Si es una invitación, redirigir al setup de contraseña
          if (type === 'invite' || type === 'signup' || type === 'recovery') {
            setStatus('success');
            setMessage('¡Invitación verificada! Redirigiendo...');
            
            setTimeout(() => {
              router.push(`/${tenantSlug}/aliado/setup`);
            }, 1000);
            return;
          }

          // Si ya tiene sesión, verificar que es un aliado y redirigir al dashboard
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user?.app_metadata?.role === 'allied_agent') {
            setStatus('success');
            setMessage('¡Sesión verificada! Redirigiendo...');
            
            setTimeout(() => {
              router.push(`/${tenantSlug}/aliado`);
            }, 1000);
          } else {
            setStatus('error');
            setMessage('No tienes permisos de agente aliado.');
          }
        } else {
          // Intentar obtener sesión existente
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            router.push(`/${tenantSlug}/aliado`);
          } else {
            setStatus('error');
            setMessage('No se encontró una invitación válida.');
          }
        }

      } catch (e) {
        console.error('Callback error:', e);
        setStatus('error');
        setMessage('Error inesperado. Intenta de nuevo.');
      }
    };

    handleCallback();
  }, [tenantSlug, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardContent className="pt-8 pb-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">{message}</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Verificado!</h2>
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
                href={`/${tenantSlug}/aliado/login`}
                className="text-blue-600 hover:underline"
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
