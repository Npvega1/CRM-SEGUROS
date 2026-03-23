'use client';

// =====================================================
// PÁGINA: Chat del Portal
// Módulo 07: Portal del Cliente
// Chat en tiempo real con el agente
// =====================================================

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { usePortal } from '@/lib/context/PortalContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMessageTime, type Message } from '@/lib/validations/portal';
import { cn } from '@/lib/utils/cn';
import {
  Send,
  MessageCircle,
  User,
  CheckCheck,
  Check,
  Circle
} from 'lucide-react';

export default function PortalChatPage() {
  const params = useParams();
  const tenantSlug = params?.tenantSlug as string;
  const { client } = usePortal();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isAgentOnline, setIsAgentOnline] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Scroll al final cuando hay nuevos mensajes
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Cargar mensajes iniciales
  useEffect(() => {
    async function loadMessages() {
      if (!client.client_id || !client.tenant_id) return;

      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('tenant_id', client.tenant_id)
          .eq('client_id', client.client_id)
          .order('sent_at', { ascending: true })
          .limit(100);

        if (error) throw error;
        setMessages((data || []) as Message[]);

        // Marcar mensajes del agente como leídos
        const unreadIds = (data || [])
          .filter((m: Message) => m.sender_role === 'agent' && !m.is_read)
          .map((m: Message) => m.id);

        if (unreadIds.length > 0) {
          await supabase
            .from('messages')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .in('id', unreadIds);
        }
      } catch (e) {
        console.error('Error loading messages:', e);
      } finally {
        setIsLoading(false);
      }
    }

    loadMessages();
  }, [supabase, client.client_id, client.tenant_id]);

  // Verificar si el agente está en línea
  useEffect(() => {
    async function checkAgentOnline() {
      if (!client.tenant_id || !client.agent_id) return;

      try {
        const { data } = await supabase
          .rpc('is_agent_online', {
            p_tenant_id: client.tenant_id,
            p_agent_id: client.agent_id
          });

        setIsAgentOnline(data || false);
      } catch (e) {
        console.error('Error checking agent status:', e);
      }
    }

    checkAgentOnline();
    const interval = setInterval(checkAgentOnline, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  }, [supabase, client.tenant_id, client.agent_id]);

  // Suscripción a mensajes en tiempo real
  useEffect(() => {
    if (!client.client_id || !client.tenant_id) return;

    const channel = supabase
      .channel('portal-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${client.client_id}`
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => [...prev, newMsg]);

          // Marcar como leído si es del agente
          if (newMsg.sender_role === 'agent') {
            await supabase
              .from('messages')
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq('id', newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, client.client_id, client.tenant_id]);

  // Scroll al cargar y nuevos mensajes
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Enviar mensaje
  const handleSend = async () => {
    if (!newMessage.trim() || !client.client_id || !client.tenant_id || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          tenant_id: client.tenant_id,
          client_id: client.client_id,
          agent_id: client.agent_id,
          sender_role: 'client',
          body: messageText
        });

      if (error) throw error;

      inputRef.current?.focus();
    } catch (e) {
      console.error('Error sending message:', e);
      setNewMessage(messageText); // Restaurar mensaje si falla
      alert('Error al enviar el mensaje. Intenta de nuevo.');
    } finally {
      setIsSending(false);
    }
  };

  // Enviar con Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)]" data-testid="portal-chat-loading">
        <Card className="h-full flex flex-col">
          <CardHeader className="border-b">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="flex-1 p-4">
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-2/3" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)]" data-testid="portal-chat">
      <Card className="h-full flex flex-col shadow-lg">
        {/* Header del chat */}
        <CardHeader className="border-b py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                  isAgentOnline ? "bg-green-500" : "bg-gray-400"
                )} />
              </div>
              <div>
                <CardTitle className="text-base">
                  {client.agent_name || 'Tu Agente'}
                </CardTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Circle className={cn(
                    "h-2 w-2 fill-current",
                    isAgentOnline ? "text-green-500" : "text-gray-400"
                  )} />
                  {isAgentOnline ? 'En línea' : 'Desconectado'}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Área de mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-medium text-gray-900">Inicia una conversación</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Escribe un mensaje para contactar a tu agente
              </p>
            </div>
          )}

          {messages.map((message, index) => {
            const isClient = message.sender_role === 'client';
            const showTimestamp = index === 0 || 
              new Date(message.sent_at).getTime() - new Date(messages[index - 1].sent_at).getTime() > 300000;

            return (
              <div key={message.id}>
                {showTimestamp && (
                  <div className="flex justify-center my-4">
                    <span className="text-xs text-muted-foreground bg-white px-3 py-1 rounded-full shadow-sm">
                      {formatMessageTime(message.sent_at)}
                    </span>
                  </div>
                )}
                <div 
                  className={cn(
                    "flex",
                    isClient ? "justify-end" : "justify-start"
                  )}
                  data-testid={`message-${message.id}`}
                >
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2 shadow-sm",
                    isClient 
                      ? "bg-primary text-primary-foreground rounded-br-md" 
                      : "bg-white text-gray-900 rounded-bl-md"
                  )}>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.body}
                    </p>
                    <div className={cn(
                      "flex items-center gap-1 mt-1",
                      isClient ? "justify-end" : "justify-start"
                    )}>
                      <span className={cn(
                        "text-[10px]",
                        isClient ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {new Date(message.sent_at).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {isClient && (
                        message.is_read 
                          ? <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
                          : <Check className="h-3 w-3 text-primary-foreground/70" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input de mensaje */}
        <div className="border-t p-4 bg-white">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              className="flex-1"
              disabled={isSending}
              data-testid="portal-chat-input"
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || isSending}
              size="icon"
              data-testid="portal-chat-send"
            >
              {isSending ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Presiona Enter para enviar
          </p>
        </div>
      </Card>
    </div>
  );
}
