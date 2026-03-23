'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';

interface BrandingSettings {
  primaryColor: string;
  secondaryColor: string;
}

const DEFAULT_BRANDING: BrandingSettings = {
  primaryColor: '#3b82f6',
  secondaryColor: '#1e40af',
};

// Convertir HEX a HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  // Remover # si existe
  hex = hex.replace(/^#/, '');
  
  if (hex.length !== 6) return null;
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Determinar si el color es claro u oscuro
function isLightColor(hex: string): boolean {
  const hsl = hexToHSL(hex);
  if (!hsl) return false;
  return hsl.l > 50;
}

export function useTenantBranding() {
  const { tenantId } = useTenant();
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadBranding() {
      if (!tenantId) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await (supabase
          .from('tenant_settings') as any)
          .select('primary_color, secondary_color')
          .eq('tenant_id', tenantId)
          .single();

        if (data) {
          setBranding({
            primaryColor: data.primary_color || DEFAULT_BRANDING.primaryColor,
            secondaryColor: data.secondary_color || DEFAULT_BRANDING.secondaryColor,
          });
        }
      } catch (error) {
        console.log('Using default branding');
      } finally {
        setLoading(false);
      }
    }

    loadBranding();
  }, [tenantId, supabase]);

  // Aplicar colores a las variables CSS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const root = document.documentElement;
    
    // Convertir colores a HSL
    const primaryHSL = hexToHSL(branding.primaryColor);
    const secondaryHSL = hexToHSL(branding.secondaryColor);
    
    if (primaryHSL) {
      // Variable principal de Tailwind/Shadcn (formato: "H S% L%" sin comas)
      const primaryValue = `${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%`;
      root.style.setProperty('--primary', primaryValue);
      
      // Color del texto sobre el color primario
      const primaryForeground = isLightColor(branding.primaryColor) 
        ? '222 47% 11%'  // Texto oscuro
        : '210 40% 98%'; // Texto claro
      root.style.setProperty('--primary-foreground', primaryForeground);
      
      // Ring color (para focus states)
      root.style.setProperty('--ring', primaryValue);
    }
    
    if (secondaryHSL) {
      // Sidebar y acentos
      const secondaryValue = `${secondaryHSL.h} ${secondaryHSL.s}% ${secondaryHSL.l}%`;
      root.style.setProperty('--sidebar-primary', secondaryValue);
      root.style.setProperty('--sidebar-accent', `${secondaryHSL.h} ${secondaryHSL.s}% ${Math.min(secondaryHSL.l + 10, 95)}%`);
    }
    
    // Variables adicionales para compatibilidad
    root.style.setProperty('--brand-primary', branding.primaryColor);
    root.style.setProperty('--brand-secondary', branding.secondaryColor);
    
  }, [branding]);

  return { branding, loading };
}
