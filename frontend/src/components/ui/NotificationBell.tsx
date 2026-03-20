'use client';

// =====================================================
// COMPONENTE: NotificationBell
// Campana de notificaciones con Supabase Realtime
// =====================================================

import { useState, useEffect, useCallback } from 'react';
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
  'policy': <FileText className="h-4 w-4 text-blue-500" />,
  'claim': <AlertTriangle className="h-4 w-4 text-orange-500" />,
  'opportunity': <TrendingUp className="h-4 w-4 text-green-500" />,
  'client': <Users className="h-4 w-4 text-purple-500" />,
  'invoice': <FileText className="h-4 w-4 text-yellow-500" />,
  'default': <Bell className="h-4 w-4 text-gray-500" />
};

export function NotificationBell() {
  const { userId, tenantId } = useTenant();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = getBrowserClient();

  // Cargar notificaciones
  const loadNotifications = useCallback(async () => {
    if (!userId) return;

    try {
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
  }, [userId, supabase]);

  // Cargar al montar y cuando cambia el usuario
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Suscripción a Supabase Realtime
  useEffect(() => {
    if (!userId || !tenantId) return;

    const channel = supabase
      .channel('notifications-realtime')
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, tenantId, supabase]);

  // Marcar como leída
  const markAsRead = async (notificationId: string) => {
    try {
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
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="notification-bell"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white"
              data-testid="notification-count"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        data-testid="notification-dropdown"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">Notificaciones</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto py-1"
              onClick={markAllAsRead}
              data-testid="mark-all-read-btn"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>

        {/* Lista de notificaciones */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="h-5 w-5 animate-pulse text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No tienes notificaciones
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'px-4 py-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors',
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
                    <div className="flex-shrink-0 mt-0.5">
                      {getEntityIcon(notification.entity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn(
                          'text-sm truncate',
                          !notification.is_read && 'font-medium'
                        )}>
                          {notification.title}
                        </p>
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
          <div className="px-4 py-2 border-t bg-muted/30">
            <p className="text-xs text-center text-muted-foreground">
              Mostrando las últimas {notifications.length} notificaciones
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
