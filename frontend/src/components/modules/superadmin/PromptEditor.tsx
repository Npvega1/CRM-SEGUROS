'use client';

// =====================================================
// COMPONENT: Prompt Editor
// Editor completo para prompts de IA con test integrado
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Brain,
  Loader2,
  Save,
  TestTube,
  History,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  Code,
  FileText,
  Trash2,
} from 'lucide-react';
import {
  CLAUDE_MODELS,
  PROMPT_VARIABLES,
} from '@/lib/validations/superadmin';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

interface PromptVersion {
  id: string;
  prompt_id: string;
  prompt_system: string;
  prompt_recommendation: string;
  model_id: string;
  version: number;
  created_at: string;
}

interface PromptEditorProps {
  prompt: AiPrompt | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PromptEditor({ prompt, isOpen, onClose, onSuccess }: PromptEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [activeTab, setActiveTab] = useState('editor');
  const [testInput, setTestInput] = useState('');
  
  // Estado para ramos desde la base de datos
  const [insuranceGroups, setInsuranceGroups] = useState<Array<{
    id: string;
    name: string;
    slug: string;
    line_name?: string;
  }>>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  
  // Estado para ejemplos de estructura
  const [examples, setExamples] = useState<Array<{
    id: string;
    name: string;
    content: string;
  }>>([]);
  const [newExampleName, setNewExampleName] = useState('');
  const [newExampleContent, setNewExampleContent] = useState('');
  const [showAddExample, setShowAddExample] = useState(false);
  
  const supabase = getUntypedClient();
  const isEditing = !!prompt;

  // Cargar ramos desde la base de datos
  useEffect(() => {
    async function loadInsuranceGroups() {
      if (!isOpen) return;
      setLoadingGroups(true);
      
      try {
        const { data, error } = await supabase
          .from('insurance_groups')
          .select(`
            id, name, slug,
            line:insurance_lines(name)
          `)
          .eq('is_active', true)
          .order('display_order');
        
        if (error) {
          console.error('Error loading groups:', error);
        } else if (data) {
          const groupsWithLine = data.map((g: any) => ({
            id: g.id,
            name: g.name,
            slug: g.slug,
            line_name: g.line?.name || 'Sin grupo'
          }));
          setInsuranceGroups(groupsWithLine);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoadingGroups(false);
      }
    }
    
    loadInsuranceGroups();
  }, [isOpen, supabase]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      line: null as string | null,
      prompt_system: '',
      prompt_recommendation: '',
      model_id: 'claude-sonnet-4-5-20250929',
      status: 'draft' as 'active' | 'draft' | 'deprecated',
    },
  });

  const fetchVersions = useCallback(async (promptId: string) => {
    const { data } = await supabase
      .from('ai_prompt_versions')
      .select('*')
      .eq('prompt_id', promptId)
      .order('version', { ascending: false });
    
    setVersions((data as PromptVersion[]) || []);
  }, [supabase]);

  // Load prompt data when editing
  useEffect(() => {
    if (prompt) {
      reset({
        name: prompt.name,
        line: prompt.line,
        prompt_system: prompt.prompt_system,
        prompt_recommendation: prompt.prompt_recommendation,
        model_id: prompt.model_id,
        status: prompt.status,
      });
      fetchVersions(prompt.id);
    } else {
      reset({
        name: '',
        line: null,
        prompt_system: '',
        prompt_recommendation: '',
        model_id: 'claude-sonnet-4-5-20250929',
        status: 'draft',
      });
      setVersions([]);
    }
    setTestResult(null);
    setTestError(null);
    setTestInput('');
  }, [prompt, reset, fetchVersions]);

  interface PromptFormData {
    name: string;
    line: string | null;
    prompt_system: string;
    prompt_recommendation: string;
    model_id: string;
    status: 'active' | 'draft' | 'deprecated';
  }

  const onSubmit = async (data: PromptFormData) => {
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (isEditing && prompt) {
        // Guardar versión anterior
        await supabase.from('ai_prompt_versions').insert({
          prompt_id: prompt.id,
          prompt_system: prompt.prompt_system,
          prompt_recommendation: prompt.prompt_recommendation,
          model_id: prompt.model_id,
          version: prompt.version,
          created_by: session?.user?.id,
        });

        // Actualizar prompt
        const { error } = await supabase
          .from('ai_prompts')
          .update({
            name: data.name,
            line: data.line,
            prompt_system: data.prompt_system,
            prompt_recommendation: data.prompt_recommendation,
            model_id: data.model_id,
            version: prompt.version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', prompt.id);

        if (error) throw error;

        // Log audit
        await supabase.from('audit_logs').insert({
          action: 'prompt.updated',
          entity_type: 'ai_prompt',
          entity_id: prompt.id,
          new_values: { name: data.name, version: prompt.version + 1 },
          user_id: session?.user?.id,
        });
      } else {
        // Crear nuevo prompt
        const { data: newPrompt, error } = await supabase
          .from('ai_prompts')
          .insert({
            name: data.name,
            line: data.line,
            prompt_system: data.prompt_system,
            prompt_recommendation: data.prompt_recommendation,
            model_id: data.model_id,
            status: 'draft',
            version: 1,
            created_by: session?.user?.id,
          })
          .select()
          .single();

        if (error) throw error;

        // Log audit
        await supabase.from('audit_logs').insert({
          action: 'prompt.created',
          entity_type: 'ai_prompt',
          entity_id: newPrompt.id,
          new_values: { name: data.name },
          user_id: session?.user?.id,
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving prompt:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!testInput.trim()) {
      setTestError('Por favor ingresa texto de prueba');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const systemPrompt = watch('prompt_system');
      const recommendationPrompt = watch('prompt_recommendation');
      
      // Llamar a la API Route de Next.js
      const response = await fetch('/api/ai/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          recommendation_prompt: recommendationPrompt,
          model_id: watch('model_id'),
          test_input: testInput,
          examples: examples.map(e => ({ name: e.name, content: e.content })),
        }),
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al probar el prompt');
      }

      setTestResult(data.result);
    } catch (error) {
      console.error('Error testing prompt:', error);
      setTestError(error instanceof Error ? error.message : 'Error al probar el prompt');
    } finally {
      setIsTesting(false);
    }
  };

  const addExample = () => {
    if (!newExampleName.trim() || !newExampleContent.trim()) return;
    
    setExamples(prev => [...prev, {
      id: Date.now().toString(),
      name: newExampleName,
      content: newExampleContent,
    }]);
    setNewExampleName('');
    setNewExampleContent('');
    setShowAddExample(false);
  };

  const removeExample = (id: string) => {
    setExamples(prev => prev.filter(e => e.id !== id));
  };

  const handleRollback = async (version: PromptVersion) => {
    if (!prompt) return;
    
    if (!confirm(`¿Restaurar a la versión ${version.version}?`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Guardar versión actual
      await supabase.from('ai_prompt_versions').insert({
        prompt_id: prompt.id,
        prompt_system: prompt.prompt_system,
        prompt_recommendation: prompt.prompt_recommendation,
        model_id: prompt.model_id,
        version: prompt.version,
        created_by: session?.user?.id,
      });

      // Restaurar versión seleccionada
      const { error } = await supabase
        .from('ai_prompts')
        .update({
          prompt_system: version.prompt_system,
          prompt_recommendation: version.prompt_recommendation,
          model_id: version.model_id,
          version: prompt.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', prompt.id);

      if (error) throw error;

      // Log audit
      await supabase.from('audit_logs').insert({
        action: 'prompt.rollback',
        entity_type: 'ai_prompt',
        entity_id: prompt.id,
        new_values: { restored_from_version: version.version },
        user_id: session?.user?.id,
      });

      onSuccess();
    } catch (error) {
      console.error('Error rolling back:', error);
    }
  };

  const insertVariable = (variable: string, field: 'prompt_system' | 'prompt_recommendation') => {
    const currentValue = watch(field);
    setValue(field, currentValue + variable);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-red-500" />
            {isEditing ? 'Editar Prompt' : 'Nuevo Prompt'}
            {prompt && (
              <Badge variant="outline" className="ml-2 border-zinc-600 text-zinc-400">
                v{prompt.version}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="bg-zinc-800 border-zinc-700">
            <TabsTrigger value="editor" className="data-[state=active]:bg-zinc-700">
              <Code className="h-4 w-4 mr-2" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="test" className="data-[state=active]:bg-zinc-700">
              <TestTube className="h-4 w-4 mr-2" />
              Probar
            </TabsTrigger>
            {isEditing && (
              <TabsTrigger value="history" className="data-[state=active]:bg-zinc-700">
                <History className="h-4 w-4 mr-2" />
                Historial
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="editor" className="mt-4 space-y-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-zinc-300">Nombre del prompt</Label>
                  <Input
                    {...register('name')}
                    placeholder="Comparativo Auto Premium"
                    className="mt-1.5 bg-zinc-800 border-zinc-700 text-white"
                    data-testid="prompt-name-input"
                  />
                  {errors.name && (
                    <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-300">Ramo</Label>
                    {loadingGroups ? (
                      <div className="mt-1.5 flex items-center gap-2 p-2 bg-zinc-800 border border-zinc-700 rounded-md">
                        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                        <span className="text-sm text-zinc-400">Cargando...</span>
                      </div>
                    ) : (
                      <Select
                        value={watch('line') || 'null'}
                        onValueChange={(v) => setValue('line', v === 'null' ? null : v)}
                      >
                        <SelectTrigger className="mt-1.5 bg-zinc-800 border-zinc-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700 max-h-[300px]">
                          <SelectItem value="null" className="text-white">
                            Todos los ramos
                          </SelectItem>
                          {insuranceGroups.map((group) => (
                            <SelectItem 
                              key={group.slug} 
                              value={group.slug} 
                              className="text-white"
                            >
                              {group.name} ({group.line_name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div>
                    <Label className="text-zinc-300">Modelo</Label>
                    <Select
                      value={watch('model_id')}
                      onValueChange={(v) => setValue('model_id', v)}
                    >
                      <SelectTrigger className="mt-1.5 bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        {CLAUDE_MODELS.map((model) => (
                          <SelectItem key={model.id} value={model.id} className="text-white">
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Variables Reference */}
              <Card className="bg-zinc-800/50 border-zinc-700">
                <CardHeader className="py-3">
                  <CardTitle className="text-xs text-zinc-400">Variables disponibles (click para insertar)</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="flex flex-wrap gap-2">
                    {PROMPT_VARIABLES.map((v) => (
                      <Badge
                        key={v.key}
                        variant="outline"
                        className="cursor-pointer border-zinc-600 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                        onClick={() => insertVariable(v.key, 'prompt_system')}
                        title={v.description}
                      >
                        {v.key}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Prompt System */}
              <div>
                <Label className="text-zinc-300">Prompt de Sistema</Label>
                <Textarea
                  {...register('prompt_system')}
                  placeholder="Eres un experto en seguros que analiza y compara cotizaciones..."
                  className="mt-1.5 bg-zinc-800 border-zinc-700 text-white min-h-[150px] font-mono text-sm"
                  data-testid="prompt-system-input"
                />
                {errors.prompt_system && (
                  <p className="text-red-400 text-xs mt-1">{errors.prompt_system.message}</p>
                )}
              </div>

              {/* Prompt Recommendation */}
              <div>
                <Label className="text-zinc-300">Prompt de Recomendación</Label>
                <Textarea
                  {...register('prompt_recommendation')}
                  placeholder="Basándote en las cotizaciones proporcionadas, genera una recomendación..."
                  className="mt-1.5 bg-zinc-800 border-zinc-700 text-white min-h-[150px] font-mono text-sm"
                  data-testid="prompt-recommendation-input"
                />
                {errors.prompt_recommendation && (
                  <p className="text-red-400 text-xs mt-1">{errors.prompt_recommendation.message}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-red-500 hover:bg-red-600 text-white"
                  data-testid="save-prompt-btn"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="test" className="mt-4 space-y-4">
            {/* Sección de Ejemplos de Estructura */}
            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Ejemplos de estructura ({examples.length})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddExample(!showAddExample)}
                    className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                  >
                    {showAddExample ? 'Cancelar' : '+ Agregar ejemplo'}
                  </Button>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Agrega ejemplos de cotizaciones para que la IA aprenda la estructura esperada
                </p>
              </CardHeader>
              <CardContent>
                {showAddExample && (
                  <div className="mb-4 p-3 bg-zinc-900 rounded-lg space-y-3">
                    <Input
                      value={newExampleName}
                      onChange={(e) => setNewExampleName(e.target.value)}
                      placeholder="Nombre del ejemplo (ej: Cotización SURA Hogar)"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                    <Textarea
                      value={newExampleContent}
                      onChange={(e) => setNewExampleContent(e.target.value)}
                      placeholder="Pega aquí el contenido de la cotización de ejemplo..."
                      className="bg-zinc-800 border-zinc-700 text-white min-h-[100px]"
                    />
                    <Button
                      onClick={addExample}
                      disabled={!newExampleName.trim() || !newExampleContent.trim()}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Agregar ejemplo
                    </Button>
                  </div>
                )}
                
                {examples.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">
                    No hay ejemplos agregados. Los ejemplos ayudan a la IA a entender la estructura.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {examples.map((example) => (
                      <div 
                        key={example.id}
                        className="flex items-center justify-between p-2 bg-zinc-900 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-400" />
                          <span className="text-sm text-white">{example.name}</span>
                          <span className="text-xs text-zinc-500">
                            ({example.content.length} caracteres)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExample(example.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Texto de prueba */}
            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
                  <TestTube className="h-4 w-4" />
                  Texto de prueba
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Pega aquí el contenido de ejemplo (datos de cotización, PDF extraído, etc.)"
                  className="bg-zinc-900 border-zinc-700 text-white min-h-[150px]"
                />
                <Button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="mt-4 bg-purple-500 hover:bg-purple-600 text-white"
                  data-testid="test-prompt-btn"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Probando con Claude...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Probar Prompt
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Test Results */}
            {testError && (
              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>{testError}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {testResult && (
              <Card className="bg-green-500/10 border-green-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-400 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Resultado de prueba
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-900 p-4 rounded-lg">
                    {testResult}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {isEditing && (
            <TabsContent value="history" className="mt-4">
              <Card className="bg-zinc-800/50 border-zinc-700">
                <CardHeader>
                  <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Historial de versiones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {versions.length === 0 ? (
                    <p className="text-zinc-500 text-sm">No hay versiones anteriores</p>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg"
                        >
                          <div>
                            <p className="text-white font-medium">Versión {version.version}</p>
                            <p className="text-xs text-zinc-500">
                              {format(new Date(version.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRollback(version)}
                            className="border-zinc-600 text-zinc-400 hover:text-white hover:bg-zinc-700"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restaurar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
