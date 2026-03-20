'use client';

// =====================================================
// PÁGINA: Dashboard del Portal
// Módulo 07: Portal del Cliente
// Vista principal con resumen y acciones rápidas
// =====================================================

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePortal } from '@/lib/context/PortalContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPortalDate, daysUntil } from '@/lib/validations/portal';
import {
  FileText,
  AlertTriangle,
  MessageCircle,
  Calendar,
  ArrowRight,
  Shield,
  Clock,
  Bell
} from 'lucide-react';

export default function PortalDashboardPage() {
  const params = useParams();
  const tenantSlug = params?.tenantSlug as string;
  const { client, summary, settings } = usePortal();

  const welcomeMessage = settings?.portal_welcome_message || 
    `Bienvenido a tu portal de seguros. Aquí puedes consultar tus pólizas, reportar siniestros y comunicarte con tu agente.`;

  const daysToRenewal = summary?.next_renewal ? daysUntil(summary.next_renewal) : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="portal-dashboard">
      {/* Header de bienvenida */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-6 lg:p-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              ¡Hola, {client.client_name?.split(' ')[0] || 'Cliente'}!
            </h1>
            <p className="mt-2 text-gray-600 max-w-2xl">
              {welcomeMessage}
            </p>
          </div>
          <div className="hidden lg:block">
            <Shield className="h-16 w-16 text-primary/20" />
          </div>
        </div>

        {/* Agente asignado */}
        {client.agent_name && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <span>Tu agente:</span>
            <span className="font-medium text-gray-900">{client.agent_name}</span>
            <Link href={`/${tenantSlug}/chat`}>
              <Button variant="link" size="sm" className="h-auto p-0">
                Enviar mensaje
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pólizas activas */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pólizas Activas</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {summary?.active_policies_count || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Próxima renovación */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Próxima Renovación</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {summary?.next_renewal ? formatPortalDate(summary.next_renewal) : 'Sin renovaciones'}
                </p>
                {daysToRenewal !== null && daysToRenewal <= 30 && daysToRenewal > 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    En {daysToRenewal} días
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Siniestros en proceso */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Siniestros en Proceso</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {summary?.active_claims_count || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mensajes sin leer */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mensajes Sin Leer</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {summary?.unread_messages_count || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Bell className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Acciones rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>¿Qué necesitas hacer hoy?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Ver pólizas */}
            <Link href={`/${tenantSlug}/policies`}>
              <div className="group p-4 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Ver mis pólizas</h3>
                    <p className="text-sm text-muted-foreground">
                      Consulta coberturas y documentos
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </Link>

            {/* Reportar siniestro */}
            <Link href={`/${tenantSlug}/claims/new`}>
              <div className="group p-4 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-red-100 group-hover:bg-red-200 flex items-center justify-center transition-colors">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Reportar siniestro</h3>
                    <p className="text-sm text-muted-foreground">
                      Inicia un nuevo reclamo
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </Link>

            {/* Chat con agente */}
            <Link href={`/${tenantSlug}/chat`}>
              <div className="group p-4 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center transition-colors">
                    <MessageCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Chat con mi agente</h3>
                    <p className="text-sm text-muted-foreground">
                      Envía un mensaje directo
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Alertas de renovación */}
      {daysToRenewal !== null && daysToRenewal <= 30 && daysToRenewal > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-orange-900">
                  Tienes una póliza próxima a vencer
                </h3>
                <p className="text-sm text-orange-800 mt-1">
                  Una de tus pólizas vence el {formatPortalDate(summary?.next_renewal || '')}. 
                  Contacta a tu agente para renovarla y mantener tu cobertura activa.
                </p>
                <div className="mt-3">
                  <Link href={`/${tenantSlug}/policies`}>
                    <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                      Ver mis pólizas
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información de contacto */}
      {(settings?.support_email || settings?.support_phone) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">¿Necesitas ayuda?</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {settings?.support_email && (
                    <a href={`mailto:${settings.support_email}`} className="hover:text-primary">
                      {settings.support_email}
                    </a>
                  )}
                  {settings?.support_phone && (
                    <a href={`tel:${settings.support_phone}`} className="hover:text-primary">
                      {settings.support_phone}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
