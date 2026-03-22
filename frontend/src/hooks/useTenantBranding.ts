'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';

interface BrandingSettings {
  primaryColor: string;
  secondaryColor: string;
}

const DEFAULT_BRANDING: BrandingSettings = {
  primaryColor: '#1E3A5F',
  secondaryColor: '#2E86AB',
};

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

  useEffect(() => {
    if (typeof window !== 'undefined' && branding.primaryColor) {
      document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
      document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor);
    }
  }, [branding]);

  return { branding, loading };
}
