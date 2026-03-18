'use client';

// =====================================================
// PÁGINA: Nuevo Cliente
// /clientes/nuevo
// =====================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClientForm } from '@/components/modules/clients/ClientForm';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';

// Tipo para el formulario
interface ClientFormData {
  full_name: string;
  doc_type: 'rut' | 'nit' | 'cedula' | 'pasaporte';
  doc_number: string;
  email?: string;
  phone?: string;
  segment: 'individual' | 'empresa' | 'vip';
  agent_id?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export default function NewClientPage() {
  const router = useRouter();
  const { isLoading: isLoadingTenant, tenantName } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: ClientFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/clientes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        router.push(`/clientes/${result.id}`);
      } else {
        setError(result.error || 'Error al crear cliente');
        setIsLoading(false);
      }
    } catch {
      setError('Error de conexión. Por favor, intenta de nuevo.');
      setIsLoading(false);
    }
  };

  if (isLoadingTenant) {
    return <LoadingScreen message="Cargando..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/clientes">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{tenantName || 'CRM Seguros'}</h1>
                <p className="text-xs text-muted-foreground">Nuevo Cliente</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Cliente</CardTitle>
            <CardDescription>
              Ingresa los datos del nuevo cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-2 p-3 mb-6 bg-red-50 text-red-700 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
            <ClientForm
              onSubmit={handleSubmit}
              onCancel={() => router.push('/clientes')}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
