// =====================================================
// MIDDLEWARE: Optimizado para evitar full reloads
// Solo modifica cookies cuando es necesario
// Incluye soporte para Portal del Cliente (M07) y Aliados (M12)
// =====================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// =====================================================
// RUTAS CONFIGURACIÓN
// =====================================================

const PUBLIC_ROUTES = [
  '/login',
  '/registro',
  '/registro-api',
  '/forgot-password',
  '/reset-password',
  '/sin-organizacion',
  '/invitacion'
];

// Rutas de Super Admin - requieren role='superadmin'
const SUPERADMIN_ROUTES = [
  '/admin'
];

const API_ROUTES = [
  '/api/'
];

const WEBHOOK_ROUTES = [
  '/api/webhooks/'
];

// Regex para detectar rutas del portal de CLIENTES: /[tenantSlug]/...
const PORTAL_ROUTE_REGEX = /^\/([a-z0-9-]+)\/(login|dashboard|policies|claims|account|chat|auth)(\/.*)?$/;

// Regex para detectar rutas del portal de ALIADOS: /[tenantSlug]/aliado/...
const ALLIED_PORTAL_REGEX = /^\/([a-z0-9-]+)\/aliado(\/.*)?$/;
const ALLIED_PUBLIC_ROUTES_REGEX = /^\/([a-z0-9-]+)\/aliado\/(login|setup|auth)(\/.*)?$/;

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(route => {
    if (route.endsWith('/')) {
      return pathname.startsWith(route);
    }
    return pathname === route || pathname.startsWith(route + '/');
  });
}

function isPortalRoute(pathname: string): boolean {
  return PORTAL_ROUTE_REGEX.test(pathname);
}

function isAlliedPortalRoute(pathname: string): boolean {
  return ALLIED_PORTAL_REGEX.test(pathname);
}

function isAlliedPublicRoute(pathname: string): boolean {
  return ALLIED_PUBLIC_ROUTES_REGEX.test(pathname);
}

// =====================================================
// MIDDLEWARE
// =====================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Webhooks: acceso libre sin modificar nada
  if (matchesRoute(pathname, WEBHOOK_ROUTES)) {
    return NextResponse.next();
  }

  // API routes: dejar pasar sin modificar
  if (matchesRoute(pathname, API_ROUTES)) {
    return NextResponse.next();
  }

  // Rutas públicas: dejar pasar
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  // =====================================================
  // PORTAL DE ALIADOS (M12)
  // /[tenantSlug]/aliado/...
  // =====================================================
  if (isAlliedPortalRoute(pathname)) {
    // Rutas públicas del portal de aliados: login y setup
    if (isAlliedPublicRoute(pathname)) {
      return NextResponse.next();
    }

    // Otras rutas del portal de aliados: verificar sesión
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.next();
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    // Sin sesión: redirigir al login del portal de aliados
    if (!session) {
      const tenantSlug = pathname.split('/')[1];
      return NextResponse.redirect(new URL(`/${tenantSlug}/aliado/login`, request.url));
    }

    // Con sesión: permitir acceso
    return NextResponse.next();
  }

  // =====================================================
  // PORTAL DEL CLIENTE (M07)
  // Usa sessionStorage para autenticación (no Supabase Auth)
  // La verificación se hace en PortalContext, no en middleware
  // =====================================================
  if (isPortalRoute(pathname)) {
    // Todas las rutas del portal pasan sin verificación de auth
    // El PortalContext se encarga de verificar sessionStorage
    return NextResponse.next();
  }

  // =====================================================
  // RUTAS DE SUPER ADMIN
  // Requieren autenticación Y role='superadmin'
  // =====================================================
  if (matchesRoute(pathname, SUPERADMIN_ROUTES)) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    // Sin sesión: redirigir al login
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verificar rol superadmin en app_metadata
    const role = session.user?.app_metadata?.role;
    if (role !== 'superadmin') {
      // No es superadmin: redirigir al dashboard normal
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Es superadmin: permitir acceso
    return NextResponse.next();
  }

  // Página principal: redirect a dashboard o login
  if (pathname === '/') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verificar variables de entorno para rutas protegidas
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  // Rutas protegidas: verificar autenticación
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll(cookies: any[]) {
          cookies.forEach((cookie) => {
            request.cookies.set(cookie.name, cookie.value);
            response.cookies.set(cookie.name, cookie.value, cookie.options);
          });
        },
      },
    }
  );

  // Obtener sesión
  const { data: { session }, error } = await supabase.auth.getSession();

  // Sin sesión: redirect a login
  if (error || !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verificar tenant_id en el JWT
  const tenantId = session.user?.app_metadata?.tenant_id || session.user?.user_metadata?.tenant_id;
  
  if (!tenantId && pathname !== '/sin-organizacion') {
    return NextResponse.redirect(new URL('/sin-organizacion', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
