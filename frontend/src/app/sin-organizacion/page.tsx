import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ArrowLeft } from 'lucide-react';

export default function SinOrganizacionPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-amber-600" />
          </div>
          <CardTitle>Sin organización asignada</CardTitle>
          <CardDescription>
            Tu cuenta no está asociada a ninguna agencia de seguros
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Esto puede suceder si:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-6">
            <li>Tu invitación aún no ha sido procesada</li>
            <li>Fuiste removido de una organización</li>
            <li>Hubo un error durante el registro</li>
          </ul>
          
          <div className="pt-4 space-y-2">
            <Link href="/registro">
              <Button className="w-full" data-testid="create-agency-button">
                Crear nueva agencia
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="w-full" data-testid="back-to-login-button">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
