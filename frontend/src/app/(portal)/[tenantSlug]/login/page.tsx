'use client';

// =====================================================
// PÁGINA: Login del Portal del Cliente
// Módulo 07: Portal del Cliente
// Login simplificado con número de documento
// =====================================================

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, ArrowRight, AlertCircle, Building2, Loader2 } from 'lucide-react';

export default function PortalLoginPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug as string;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docNumber, setDocNumber] = useState('');
  const [docError, setDocError] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('');

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Cargar nombre del tenant al montar
  useState(() => {
    const loadTenant = async () => {
      const { data } = await supabase
        .from('tenants')
        .select('name')
        .eq('slug', tenantSlug)
        .single();
      
      const tenant = data as { name: string } | null;
      if (tenant?.name) {
        setTenantName(tenant.name);
      }
    };
    loadTenant();
  });

  const validateForm = (): boolean => {
    setDocError(null);

    if (!docNumber || docNumber.trim().length < 5) {
      setDocError('Ingresa un número de documento válido');
      return false;
    }

    return true;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Obtener el tenant_id
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (tenantError || !tenantData) {
        setError('Portal no encontrado');
        setIsLoading(false);
        return;
      }

      // Buscar cliente por número de documento en este tenant
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, full_name, email, doc_number')
        .eq('tenant_id', tenantData.id)
        .eq('doc_number', docNumber.trim())
        .eq('is_active', true)
        .single();

      if (clientError || !clientData) {
        setError('No encontramos un cliente con este número de documento. Verifica el número o contacta a tu agente de seguros.');
        setIsLoading(false);
        return;
      }

      // Cliente encontrado - guardar en sessionStorage y redirigir
      sessionStorage.setItem('portal_client_id', clientData.id);
      sessionStorage.setItem('portal_client_name', clientData.full_name);
      sessionStorage.setItem('portal_client_email', clientData.email || '');
      sessionStorage.setItem('portal_tenant_slug', tenantSlug);

      // Redirigir al dashboard
      router.push(`/${tenantSlug}/dashboard`);

    } catch (e) {
      console.error('Login error:', e);
      setError('Error al verificar tu documento. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Portal del Cliente</CardTitle>
          {tenantName && (
            <p className="text-primary font-medium">{tenantName}</p>
          )}
          <CardDescription className="mt-2">
            Ingresa tu número de documento para acceder
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
              <Label htmlFor="docNumber">Número de Documento</Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="docNumber"
                  type="text"
                  placeholder="Ej: 1234567890"
                  className="pl-10 h-12 text-lg tracking-wide"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={15}
                  data-testid="portal-login-doc"
                />
              </div>
              {docError && (
                <p className="text-sm text-red-600">{docError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Ingresa tu cédula o NIT sin puntos ni guiones
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={isLoading}
              data-testid="portal-login-submit"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Ingresar al Portal
                  <ArrowRight className="h-5 w-5" />
                </span>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Acceso rápido y seguro. No necesitas contraseña.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
