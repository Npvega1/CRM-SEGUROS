'use client';

// =====================================================
// PÁGINA: Mensajes del Portal (Panel Admin)
// Módulo 07: Portal del Cliente
// Vista de conversaciones con clientes del portal
// =====================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useTenant } from '@/lib/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import {
  MessageSquare,
  Send,
  User,
  Search,
  CheckCheck,
  Check,
  RefreshCw
} from 'lucide-react';

// Tipos de mensaje
interface MessageRow {
  id: string;
  tenant_id: string;
  client_id: string;
  agent_id: string | null;
  sender_role: 'client' | 'agent';
  body: string;
  is_read: boolean;
  read_at: string | null;
  sent_at: string;
}

interface ClientRow {
  id: string;
  full_name: string;
  email: string;
}

interface ClientConversation {
  client_id: string;
  client_name: string;
  client_email: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

// Helper para crear cliente sin tipado estricto
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(supabaseUrl, supabaseKey);
}

export default function MensajesPage() {
  const { tenantId, userId } = useTenant();
  
  const [conversations, setConversations] = useState<ClientConversation[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientConversation | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll al final de mensajes
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Cargar conversaciones
  const loadConversations = useCallback(async () => {
    if (!tenantId) return;

    try {
      const supabase = getSupabaseClient();
      
      // Obtener mensajes agrupados por cliente
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('id, client_id, body, sender_role, is_read, sent_at')
        .eq('tenant_id', tenantId)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      const typedMessages = (messagesData || []) as Pick<MessageRow, 'id' | 'client_id' | 'body' | 'sender_role' | 'is_read' | 'sent_at'>[];

      // Obtener IDs únicos de clientes
      const clientIds = Array.from(new Set(typedMessages.map(m => m.client_id)));
      
      if (clientIds.length === 0) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, full_name, email')
        .in('id', clientIds);

      const typedClients = (clientsData || []) as ClientRow[];

      const clientsMap = new Map(
        typedClients.map(c => [c.id, { name: c.full_name, email: c.email }])
      );

      // Agrupar por cliente
      const conversationsMap = new Map<string, ClientConversation>();
      
      typedMessages.forEach(msg => {
        const existing = conversationsMap.get(msg.client_id);
        const clientInfo = clientsMap.get(msg.client_id);
        
        if (!existing) {
          conversationsMap.set(msg.client_id, {
            client_id: msg.client_id,
            client_name: clientInfo?.name || 'Cliente',
            client_email: clientInfo?.email || '',
            last_message: msg.body,
            last_message_at: msg.sent_at,
            unread_count: msg.sender_role === 'client' && !msg.is_read ? 1 : 0
          });
        } else if (msg.sender_role === 'client' && !msg.is_read) {
          existing.unread_count++;
        }
      });

      // Ordenar por último mensaje
      const sortedConversations = Array.from(conversationsMap.values())
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

      setConversations(sortedConversations);
    } catch (e) {
      console.error('Error loading conversations:', e);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  // Cargar mensajes de un cliente
  const loadMessages = useCallback(async (clientId: string) => {
    if (!tenantId) return;

    setIsLoadingMessages(true);

    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      
      const typedData = (data || []) as MessageRow[];
      setMessages(typedData);

      // Marcar como leídos los mensajes del cliente
      const unreadIds = typedData
        .filter(m => m.sender_role === 'client' && !m.is_read)
        .map(m => m.id);

      if (unreadIds.length > 0) {
        await supabase
          .from('messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in('id', unreadIds);

        // Actualizar contador en la lista
        setConversations(prev => prev.map(c => 
          c.client_id === clientId ? { ...c, unread_count: 0 } : c
        ));
      }
    } catch (e) {
      console.error('Error loading messages:', e);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [tenantId]);

  // Enviar mensaje
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedClient || !tenantId || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('messages')
        .insert({
          tenant_id: tenantId,
          client_id: selectedClient.client_id,
          agent_id: userId || null,
          sender_role: 'agent',
          body: messageText
        });

      if (error) throw error;

      // Recargar mensajes
      await loadMessages(selectedClient.client_id);
      inputRef.current?.focus();
    } catch (e) {
      console.error('Error sending message:', e);
      setNewMessage(messageText);
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

  // Cargar conversaciones al montar
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Polling cada 10 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      if (selectedClient) {
        loadMessages(selectedClient.client_id);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [loadConversations, loadMessages, selectedClient]);

  // Scroll cuando cambian los mensajes
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Cargar mensajes cuando se selecciona un cliente
  useEffect(() => {
    if (selectedClient) {
      loadMessages(selectedClient.client_id);
    }
  }, [selectedClient, loadMessages]);

  // Filtrar conversaciones
  const filteredConversations = conversations.filter(c =>
    c.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.client_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Total de mensajes no leídos
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  // Formatear tiempo
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ayer';
    } else if (days < 7) {
      return date.toLocaleDateString('es-CO', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px] col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-4rem)]" data-testid="mensajes-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-gray-900">Mensajes del Portal</h1>
          {totalUnread > 0 && (
            <Badge className="bg-red-500 text-white">
              {totalUnread} sin leer
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadConversations();
            if (selectedClient) loadMessages(selectedClient.client_id);
          }}
          data-testid="refresh-messages"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-4rem)]">
        {/* Lista de conversaciones */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Conversaciones</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="search-conversations"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No hay conversaciones</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredConversations.map(conv => (
                  <button
                    key={conv.client_id}
                    onClick={() => setSelectedClient(conv)}
                    className={cn(
                      'w-full p-3 rounded-lg text-left transition-colors',
                      selectedClient?.client_id === conv.client_id
                        ? 'bg-primary/10'
                        : 'hover:bg-slate-100'
                    )}
                    data-testid={`conversation-${conv.client_id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">
                            {conv.client_name}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.client_email}
                        </p>
                        <p className="text-sm text-gray-600 truncate mt-1">
                          {conv.last_message}
                        </p>
                      </div>
                      {conv.unread_count > 0 && (
                        <Badge className="bg-red-500 text-white text-xs">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedClient ? (
            <>
              {/* Header del chat */}
              <CardHeader className="border-b py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{selectedClient.client_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{selectedClient.client_email}</p>
                  </div>
                </div>
              </CardHeader>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {isLoadingMessages ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay mensajes en esta conversación</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isAgent = msg.sender_role === 'agent';
                    return (
                      <div
                        key={msg.id}
                        className={cn('flex', isAgent ? 'justify-end' : 'justify-start')}
                        data-testid={`message-${msg.id}`}
                      >
                        <div
                          className={cn(
                            'max-w-[70%] rounded-2xl px-4 py-2 shadow-sm',
                            isAgent
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-white text-gray-900 rounded-bl-md border'
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          <div className={cn(
                            'flex items-center gap-1 mt-1',
                            isAgent ? 'justify-end' : 'justify-start'
                          )}>
                            <span className={cn(
                              'text-[10px]',
                              isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            )}>
                              {new Date(msg.sent_at).toLocaleTimeString('es-CO', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {isAgent && (
                              msg.is_read
                                ? <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
                                : <Check className="h-3 w-3 text-primary-foreground/70" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
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
                    data-testid="message-input"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || isSending}
                    size="icon"
                    data-testid="send-message"
                  >
                    {isSending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Selecciona una conversación</p>
                <p className="text-sm">para ver los mensajes</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
