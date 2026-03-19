'use client';

// Redirección de /polizas/nuevo a /polizas/nueva
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectToNueva() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/polizas/nueva');
  }, [router]);
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Redirigiendo...</p>
    </div>
  );
}
