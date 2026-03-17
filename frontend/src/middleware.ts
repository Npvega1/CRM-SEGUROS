// =====================================================
// MIDDLEWARE GLOBAL - Next.js 14
// Protección de rutas y verificación de autenticación
// =====================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Role } from '@/lib/types';

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = [
  '/login',
  '/registro',
  '/recuperar-password',
  '/invitacion'
];

// Rutas de webhooks (acceso libre)
const WEBHOOK_ROUTES = ['/api/webhooks'];

// Rutas del portal del cliente (validación diferente - magic link)
const PORTAL_ROUTES = ['/portal'];

// Rutas de superadmin
const SUPERADMIN_ROUTES = ['/superadmin'];

/**
 * Verifica si una ruta coincide con algún patrón
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(route => pathname.startsWith(route));
}

/**
 * Stub para verificar límites del plan
 * Se implementará en el Módulo 10 - Planes y Pagos
 */
function checkPlanLimit(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tenantId: string, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _feature: string
): { allowed: boolean; reason?: string } {
  // TODO: Implementar verificación real de límites del plan
  return { allowed: true };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // ===== WEBHOOKS: Acceso libre =====
  if (matchesRoute(pathname, WEBHOOK_ROUTES)) {
    return response;
  }

  // ===== Crear cliente de Supabase con cookies =====
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Obtener sesión actual
  const { data: { user } } = await supabase.auth.getUser();

  // ===== RUTAS PÚBLICAS =====
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    // Si ya está autenticado, redirigir al dashboard
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // ===== PORTAL DEL CLIENTE: Validación diferente =====
  if (matchesRoute(pathname, PORTAL_ROUTES)) {
    // El portal usa magic links, validación separada
    // Se implementará en Módulo 07
    return response;
  }

  // ===== RUTAS PROTEGIDAS: Requieren autenticación =====
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Obtener claims del usuario
  const appMetadata = user.app_metadata || {};
  const tenantId = appMetadata.tenant_id as string | undefined;
  const role = (appMetadata.role as Role) || 'readonly';

  // ===== RUTAS DE SUPERADMIN =====
  if (matchesRoute(pathname, SUPERADMIN_ROUTES)) {
    if (role !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // ===== VERIFICACIÓN DE TENANT =====
  // Usuarios normales deben tener un tenant asignado
  if (!tenantId && role !== 'superadmin') {
    // Usuario sin tenant - redirigir a página de onboarding o error
    return NextResponse.redirect(new URL('/sin-organizacion', request.url));
  }

  // ===== VERIFICACIÓN DE LÍMITES DEL PLAN =====
  if (tenantId) {
    // Mapear rutas a features del plan
    const featureMap: Record<string, string> = {
      '/siniestros': 'claims',
      '/reportes': 'reports',
      '/facturacion': 'billing',
      '/automatizaciones': 'automations',
      '/comparativos': 'ai_comparisons'
    };

    for (const [route, feature] of Object.entries(featureMap)) {
      if (pathname.startsWith(route)) {
        const { allowed, reason } = checkPlanLimit(tenantId, feature);
        if (!allowed) {
          const upgradeUrl = new URL('/configuracion/plan', request.url);
          if (reason) {
            upgradeUrl.searchParams.set('reason', reason);
          }
          return NextResponse.redirect(upgradeUrl);
        }
        break;
      }
    }
  }

  // Agregar headers con información del usuario para Server Components
  response.headers.set('x-user-id', user.id);
  if (tenantId) {
    response.headers.set('x-tenant-id', tenantId);
  }
  response.headers.set('x-user-role', role);

  return response;
}

// =====================================================
// CONFIGURACIÓN DEL MATCHER
// =====================================================

export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (favicon)
     * - Archivos públicos con extensión
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
