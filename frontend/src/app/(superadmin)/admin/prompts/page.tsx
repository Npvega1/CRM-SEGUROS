'use client';

// =====================================================
// PAGE: Super Admin - Prompts IA Management
// Gestión de prompts para el módulo de comparativos
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingScreen } from '@/components/ui/spinner';
import { PromptEditor } from '@/components/modules/superadmin/PromptEditor';
import {
  Brain,
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Archive,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { INSURANCE_LINES, CLAUDE_MODELS } from '@/lib/validations/superadmin';

interface AiPrompt {
  id: string;
  name: string;
  line: string | null;
  prompt_system: string;
  prompt_recommendation: string;
  model_id: string;
  status: 'active' | 'draft' | 'deprecated';
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'deprecated'>('all');
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<AiPrompt | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const supabase = getUntypedClient();

  const fetchPrompts = useCallback(async () => {
    try {
      setIsRefreshing(true);
      
      const { data, error } = await supabase
        .from('ai_prompts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrompts((data as AiPrompt[]) || []);
    } catch (error) {
      console.error('Error fetching prompts:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handlePublish = async (promptId: string) => {
    try {
      const prompt = prompts.find(p => p.id === promptId);
      if (!prompt) return;

      // Deprecar el prompt activo actual del mismo ramo
      if (prompt.line) {
        await supabase
          .from('ai_prompts')
          .update({ status: 'deprecated' })
          .eq('line', prompt.line)
          .eq('status', 'active');
      } else {
        // Si es para todos los ramos, deprecar todos los activos sin ramo específico
        await supabase
          .from('ai_prompts')
          .update({ status: 'deprecated' })
          .is('line', null)
          .eq('status', 'active');
      }

      // Publicar el prompt seleccionado
      const { error } = await supabase
        .from('ai_prompts')
        .update({ status: 'active' })
        .eq('id', promptId);

      if (error) throw error;
      fetchPrompts();
    } catch (error) {
      console.error('Error publishing prompt:', error);
    }
  };

  const handleDeprecate = async (promptId: string) => {
    try {
      const { error } = await supabase
        .from('ai_prompts')
        .update({ status: 'deprecated' })
        .eq('id', promptId);

      if (error) throw error;
      fetchPrompts();
    } catch (error) {
      console.error('Error deprecating prompt:', error);
    }
  };

  const handleDelete = async (promptId: string) => {
    if (!confirm('¿Estás seguro de eliminar este prompt? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ai_prompts')
        .delete()
        .eq('id', promptId);

      if (error) throw error;
      fetchPrompts();
    } catch (error) {
      console.error('Error deleting prompt:', error);
    }
  };

  const filteredPrompts = prompts.filter((prompt) => {
    const matchesSearch = prompt.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || prompt.status === statusFilter;
    const matchesLine = lineFilter === 'all' || 
      (lineFilter === 'null' && prompt.line === null) ||
      prompt.line === lineFilter;

    return matchesSearch && matchesStatus && matchesLine;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400">Activo</Badge>;
      case 'draft':
        return <Badge className="bg-amber-500/20 text-amber-400">Borrador</Badge>;
      case 'deprecated':
        return <Badge className="bg-zinc-500/20 text-zinc-400">Deprecado</Badge>;
      default:
        return null;
    }
  };

  const getModelName = (modelId: string) => {
    const model = CLAUDE_MODELS.find(m => m.id === modelId);
    return model?.name || modelId;
  };

  const getLineName = (line: string | null) => {
    if (!line) return 'Todos';
    const lineObj = INSURANCE_LINES.find(l => l.value === line);
    return lineObj?.label || line;
  };

  // Stats
  const activePrompts = prompts.filter(p => p.status === 'active').length;
  const draftPrompts = prompts.filter(p => p.status === 'draft').length;

  if (isLoading) {
    return <LoadingScreen message="Cargando prompts..." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Prompts de IA</h1>
          <p className="text-zinc-400 mt-1">Configura los prompts para comparativos de seguros</p>
        </div>
        <Button
          onClick={() => {
            setSelectedPrompt(null);
            setIsEditorOpen(true);
          }}
          className="bg-red-500 hover:bg-red-600 text-white"
          data-testid="create-prompt-btn"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Prompt
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-white">{prompts.length}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Prompts Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-white">{activePrompts}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Borradores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold text-white">{draftPrompts}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
            data-testid="search-prompts"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[150px] bg-zinc-900 border-zinc-800 text-white">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all" className="text-white">Todos</SelectItem>
            <SelectItem value="active" className="text-white">Activos</SelectItem>
            <SelectItem value="draft" className="text-white">Borradores</SelectItem>
            <SelectItem value="deprecated" className="text-white">Deprecados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={lineFilter} onValueChange={setLineFilter}>
          <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-800 text-white">
            <SelectValue placeholder="Ramo" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all" className="text-white">Todos los ramos</SelectItem>
            <SelectItem value="null" className="text-white">Sin ramo específico</SelectItem>
            {INSURANCE_LINES.filter(l => l.value !== null).map((line) => (
              <SelectItem key={line.value} value={line.value!} className="text-white">
                {line.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => fetchPrompts()}
          disabled={isRefreshing}
          className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Prompts Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Nombre</TableHead>
                <TableHead className="text-zinc-400">Ramo</TableHead>
                <TableHead className="text-zinc-400">Modelo</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-zinc-400 text-center">Versión</TableHead>
                <TableHead className="text-zinc-400">Actualizado</TableHead>
                <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrompts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                    No se encontraron prompts
                  </TableCell>
                </TableRow>
              ) : (
                filteredPrompts.map((prompt) => (
                  <TableRow key={prompt.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="font-medium text-white">{prompt.name}</TableCell>
                    <TableCell className="text-zinc-400">{getLineName(prompt.line)}</TableCell>
                    <TableCell className="text-zinc-400 text-sm">{getModelName(prompt.model_id)}</TableCell>
                    <TableCell>{getStatusBadge(prompt.status)}</TableCell>
                    <TableCell className="text-center text-zinc-300">v{prompt.version}</TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {format(new Date(prompt.updated_at), "d MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPrompt(prompt);
                            setIsEditorOpen(true);
                          }}
                          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                          data-testid={`edit-prompt-${prompt.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {prompt.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePublish(prompt.id)}
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            data-testid={`publish-prompt-${prompt.id}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {prompt.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeprecate(prompt.id)}
                            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                            data-testid={`deprecate-prompt-${prompt.id}`}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                        {prompt.status !== 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(prompt.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            data-testid={`delete-prompt-${prompt.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Prompt Editor Modal */}
      <PromptEditor
        prompt={selectedPrompt}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedPrompt(null);
        }}
        onSuccess={() => {
          setIsEditorOpen(false);
          setSelectedPrompt(null);
          fetchPrompts();
        }}
      />
    </div>
  );
}
