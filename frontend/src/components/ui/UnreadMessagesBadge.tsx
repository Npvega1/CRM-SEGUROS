'use client';

// =====================================================
// COMPONENTE: Badge de Mensajes No Leídos
// Muestra el contador de mensajes sin leer en el sidebar
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useTenant } from '@/lib/context/TenantContext';
import { Badge } from '@/components/ui/badge';

interface UnreadMessagesBadgeProps {
  className?: string;
}

export function UnreadMessagesBadge({ className }: UnreadMessagesBadgeProps) {
  const { tenantId } = useTenant();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!tenantId) return;

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Contar mensajes no leídos de clientes
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('sender_role', 'client')
        .eq('is_read', false);

      if (error) {
        console.error('Error fetching unread count:', error);
        return;
      }

      setUnreadCount(count || 0);
    } catch (e) {
      console.error('Error fetching unread count:', e);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchUnreadCount();

    // Polling cada 30 segundos
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  if (unreadCount === 0) {
    return null;
  }

  return (
    <Badge 
      className={`bg-red-500 text-white text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center ${className || ''}`}
      data-testid="unread-messages-badge"
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  );
}
