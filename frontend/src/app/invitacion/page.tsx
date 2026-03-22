'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, CheckCircle, XCircle, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Invitation {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
  expires_at: string;
  tenants?: { name: string; slug: string };
}

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const { toast } = useToast();
  const supabase = createClient();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setError('Token de invitación no válido');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await (supabase
          .from('invitations') as any)
          .select('id, email, role, tenant_id, expires_at, tenants(name, slug)')
          .eq('token', token)
          .is('accepted_at', null)
          .single();

        if (fetchError || !data) {
          setError('Invitación no encontrada o ya fue utilizada');
          setLoading(false);
          return;
        }

        if (new Date(data.expires_at) < new Date()) {
          setError('Esta invitación ha expirado');
          setLoading(false);
          return;
        }

        setInvitation(data);
      } catch (err) {
        setError('Error al cargar la invitación');
      } finally {
        setLoading(false);
      }
    }

    loadInvitation();
  }, [token, supabase]);

  const handleAccept = async () => {
    if (!invitation || !fullName || !password) return;

    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Las contraseñas no coinciden', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'Error', description: 'La contraseña debe tener al menos 6 caracteres', variant: 'destructive' });
      return;
    }

    setAccepting(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
  email: invitation.email,
  password: password,
  options: {
    data: {
      tenant_id: invitation.tenant_id,
      full_name: fullName,
      role: invitation.role,
    }
  }
});

      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo crear el usuario');

      const { error: userError } = await (supabase.from('users') as any).insert({
        id: authData.user.id,
        tenant_id: invitation.tenant_id,
        email: invitation.email,
        full_name: fullName,
        role: invitation.role,
        is_active: true,
      });

      if (userError) throw userError;

      await (supabase.from('invitations') as any)
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);

      setAccepted(true);
      toast({ title: '¡Bienvenido!', description: 'Tu cuenta ha sido creada exitosamente' });

      setTimeout(() => { router.push('/login'); }, 3000);

    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo aceptar la invitación', variant: 'destructive' });
    } finally {
      setAccepting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador', superadmin: 'Super Admin',
      senior_agent: 'Agente Senior', agent: 'Agente', readonly: 'Solo Lectura',
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invitación no válida</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button className="mt-4" onClick={() => router.push('/login')}>Ir al inicio</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">¡Cuenta creada!</h2>
            <p className="text-muted-foreground">Redirigiendo al login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Aceptar Invitación</CardTitle>
          <CardDescription>
            Has sido invitado a unirte a <strong>{invitation?.tenants?.name || 'la organización'}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{invitation?.email}</span>
            </div>
            <Badge variant="secondary">{getRoleLabel(invitation?.role || '')}</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input id="fullName" placeholder="Tu nombre" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input id="confirmPassword" type="password" placeholder="Repite la contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>

          <Button className="w-full" onClick={handleAccept} disabled={accepting || !fullName || !password || !confirmPassword}>
            {accepting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando cuenta...</> : 'Aceptar invitación'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
