'use client';

// =====================================================
// COMPONENTE: NotificationBell
// Campana de notificaciones con Supabase Realtime
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Bell,
  CheckCheck,
  FileText,
  AlertTriangle,
  TrendingUp,
  Users,
  Clock
} from 'lucide-react';
import { formatDateTime } from '@/lib/validations/automations';
import { cn } from '@/lib/utils/cn';

// Tipos locales
interface NotificationItem {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

// Iconos según tipo de entidad
const ENTITY_ICONS: Record<string, React.ReactNode> = {
  'policy': <FileText className="h-4 w-4" />,
  'claim': <AlertTriangle className="h-4 w-4" />,
  'opportunity': <TrendingUp className="h-4 w-4" />,
  'client': <Users className="h-4 w-4" />,
  'invoice': <FileText className="h-4 w-4" />,
  'default': <Bell className="h-4 w-4" />
};

export function NotificationBell() {
  const { userId, tenantId } = useTenant();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<ReturnType<typeof getBrowserClient>['channel']> | null>(null);

  // Cargar notificaciones
  const loadNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      const supabase = getBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const notifs = (data || []) as NotificationItem[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Cargar al montar y cuando cambia el usuario
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Suscripción a Supabase Realtime
  useEffect(() => {
    if (!userId || !tenantId) return;

    const supabase = getBrowserClient();

    // Limpiar canal previo si existe
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Usar nombre de canal único para evitar colisiones
    const channelName = `notifications-${userId}-${Date.now()}`;

    try {
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            const newNotification = payload.new as NotificationItem;
            setNotifications(prev => [newNotification, ...prev].slice(0, 20));
            setUnreadCount(prev => prev + 1);
          }
        )
        .subscribe();

      channelRef.current = channel;
    } catch (err) {
      console.error('Error subscribing to notifications:', err);
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, tenantId]);

  // Marcar como leída
  const markAsRead = async (notificationId: string) => {
    try {
      const supabase = getBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    if (!userId) return;

    try {
      const supabase = getBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const getEntityIcon = (entityType: string | null | undefined) => {
    if (!entityType) return ENTITY_ICONS.default;
    return ENTITY_ICONS[entityType] || ENTITY_ICONS.default;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="notification-bell">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500" data-testid="notification-count">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notificaciones</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs" data-testid="mark-all-read">
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>

        {/* Lista de notificaciones */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No tienes notificaciones</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-3 hover:bg-muted/50 cursor-pointer transition-colors',
                    !notification.is_read && 'bg-blue-50/50'
                  )}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id);
                    }
                  }}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">
                      {getEntityIcon(notification.entity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{notification.title}</p>
                        {!notification.is_read && (
                          <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                      </div>
                      {notification.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.body}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t text-center">
            <p className="text-xs text-muted-foreground">
              Mostrando las últimas {notifications.length} notificaciones
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
