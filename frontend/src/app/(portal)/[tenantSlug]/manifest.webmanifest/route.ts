import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// =====================================================
// MANIFEST PWA DINÁMICO
// Módulo 07: Portal del Cliente
// Genera manifest.webmanifest con branding del tenant
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantSlug: string } }
) {
  const tenantSlug = params.tenantSlug;

  // Valores por defecto
  let name = 'Portal de Seguros';
  let shortName = 'Seguros';
  let themeColor = '#3b82f6';
  let backgroundColor = '#ffffff';

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
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

      // Obtener datos del tenant y settings
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('slug', tenantSlug)
        .eq('is_active', true)
        .maybeSingle();

      if (tenant) {
        name = tenant.name;
        shortName = tenant.name.substring(0, 12);

        // Obtener settings del tenant
        const { data: settings } = await supabase
          .from('tenant_settings')
          .select('primary_color')
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (settings?.primary_color) {
          themeColor = settings.primary_color;
        }
      }
    }
  } catch (e) {
    console.error('Error loading tenant for manifest:', e);
  }

  const manifest = {
    name: `${name} - Portal del Cliente`,
    short_name: shortName,
    description: 'Accede a tus pólizas, siniestros y comunícate con tu agente',
    start_url: `/${tenantSlug}/dashboard`,
    scope: `/${tenantSlug}/`,
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: themeColor,
    background_color: backgroundColor,
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ],
    categories: ['business', 'finance', 'productivity'],
    lang: 'es',
    dir: 'ltr'
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
