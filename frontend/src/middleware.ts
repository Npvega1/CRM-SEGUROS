// =====================================================
// MIDDLEWARE: Optimizado para evitar full reloads
// Solo modifica cookies cuando es necesario
// =====================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

interface CookieOptions {
  name: string;
  value: string;
  maxAge?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
}

// =====================================================
// RUTAS CONFIGURACIÓN
// =====================================================

const PUBLIC_ROUTES = [
  '/login',
  '/registro',
  '/registro-api',
  '/forgot-password',
  '/reset-password',
  '/sin-organizacion'
];

const API_ROUTES = [
  '/api/'
];

const WEBHOOK_ROUTES = [
  '/api/webhooks/'
];

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(route => {
    if (route.endsWith('/')) {
      return pathname.startsWith(route);
    }
    return pathname === route || pathname.startsWith(route + '/');
  });
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

  // Página principal: redirect a dashboard o login
  if (pathname === '/') {
    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      // Durante build, redirigir a login
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Verificar si hay sesión sin modificar cookies
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // No setear cookies en esta verificación
          },
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
    // Durante build, permitir continuar
    return NextResponse.next();
  }

  // Rutas protegidas: verificar autenticación
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Crear cliente Supabase con manejo de cookies optimizado
  let cookiesModified = false;
  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];

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
          // Acumular cookies para setear después
          cookies.forEach((cookie: { name: string; value: string; options: CookieOptions }) => {
            // Verificar si la cookie realmente cambió
            const existingCookie = request.cookies.get(cookie.name);
            if (!existingCookie || existingCookie.value !== cookie.value) {
              cookiesModified = true;
              cookiesToSet.push(cookie);
            }
          });
        },
      },
    }
  );

  // Obtener sesión
  const { data: { session }, error } = await supabase.auth.getSession();

  // Solo crear nueva response si las cookies cambiaron
  if (cookiesModified && cookiesToSet.length > 0) {
    response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
    
    cookiesToSet.forEach(({ name, value, options }) => {
      request.cookies.set(name, value);
      response.cookies.set(name, value, options);
    });
  }

  // Sin sesión: redirect a login
  if (error || !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verificar tenant_id en el JWT
  const tenantId = session.user?.app_metadata?.tenant_id;
  
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
