'use client';

// =====================================================
// COMPONENTE: ClientSearchSelect
// Selector de cliente con búsqueda
// =====================================================

import { useState, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, Loader2, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Client {
  id: string;
  full_name: string;
  email: string | null;
  doc_number: string;
}

interface ClientSearchSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function ClientSearchSelect({
  value,
  onValueChange,
  placeholder = 'Seleccionar cliente...'
}: ClientSearchSelectProps) {
  const { tenantId } = useTenant();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Cargar cliente seleccionado
  useEffect(() => {
    async function loadSelectedClient() {
      if (!value || !tenantId) {
        setSelectedClient(null);
        return;
      }

      const supabase = getBrowserClient();
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, email, doc_number')
        .eq('id', value)
        .single();

      if (data) {
        setSelectedClient(data as Client);
      }
    }

    loadSelectedClient();
  }, [value, tenantId]);

  // Buscar clientes
  useEffect(() => {
    async function searchClients() {
      if (!tenantId) return;
      
      setIsLoading(true);
      const supabase = getBrowserClient();
      
      let query = supabase
        .from('clients')
        .select('id, full_name, email, doc_number')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('full_name')
        .limit(20);

      if (search.trim()) {
        query = query.or(`full_name.ilike.%${search}%,doc_number.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data } = await query;
      setClients((data || []) as Client[]);
      setIsLoading(false);
    }

    const debounce = setTimeout(searchClients, 300);
    return () => clearTimeout(debounce);
  }, [search, tenantId]);

  const handleSelect = (client: Client) => {
    onValueChange(client.id);
    setSelectedClient(client);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid="client-search-select"
        >
          {selectedClient ? (
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {selectedClient.full_name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Buscar por nombre, documento o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="client-search-input"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {search ? 'No se encontraron clientes' : 'Escribe para buscar...'}
            </div>
          ) : (
            <div className="p-1">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleSelect(client)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    'hover:bg-slate-100 focus:bg-slate-100 focus:outline-none',
                    value === client.id && 'bg-slate-100'
                  )}
                  data-testid={`client-option-${client.id}`}
                >
                  <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <span className="text-xs font-medium text-slate-600">
                      {client.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{client.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {client.doc_number}
                      {client.email && ` • ${client.email}`}
                    </p>
                  </div>
                  {value === client.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
