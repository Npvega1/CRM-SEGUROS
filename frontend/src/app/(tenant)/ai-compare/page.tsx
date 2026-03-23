'use client';

// =====================================================
// PÁGINA: Comparativos con IA
// /ai-compare
// Módulo 09 - Con procesamiento en segundo plano
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  UsageProgress,
  ComparisonsList,
  NewComparisonWizard,
  ComparisonViewer
} from '@/components/modules/ai-compare';
import {
  getMonthlyUsage,
  getComparisons,
  getComparisonById,
  createComparison,
  canCreateComparison,
  updateComparisonCell,
  updateRecommendation,
  deleteComparison,
  getComparisonCriteria
} from '@/lib/services/comparison-service';
import type { 
  ComparisonWithRelations, 
  UsageStats
} from '@/lib/validations/comparisons';
import type { PolicyLine } from '@/lib/validations/policies';
import { Plus, RefreshCw, ArrowLeft, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function AIComparePage() {
  const { tenantId, userId, tenantName, isLoading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const router = useRouter();

  // Estados
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [comparisons, setComparisons] = useState<ComparisonWithRelations[]>([]);
  const [selectedComparison, setSelectedComparison] = useState<ComparisonWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  
  // Ref para el polling
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar datos
  const loadData = useCallback(async () => {
    if (!tenantId) return;

    try {
      const [usage, compList] = await Promise.all([
        getMonthlyUsage(tenantId),
        getComparisons(tenantId)
      ]);
      
      setUsageStats(usage);
      setComparisons(compList);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  // Polling para actualizar comparativos en proceso
  useEffect(() => {
    if (!tenantLoading && tenantId) {
      loadData();
      
      // Iniciar polling cada 5 segundos para actualizar estados
      pollingRef.current = setInterval(() => {
        loadData();
      }, 5000);
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [tenantLoading, tenantId, loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleNewComparison = async () => {
    if (!tenantId) return;

    const canCreate = await canCreateComparison(tenantId);
    if (!canCreate.allowed) {
      toast({
        title: 'Límite alcanzado',
        description: canCreate.message,
        variant: 'destructive'
      });
      return;
    }

    setShowWizard(true);
  };

  // Procesar comparativo en segundo plano
  const processComparisonInBackground = async (
    comparisonId: string,
    tenantId: string,
    line: PolicyLine,
    files: Array<{ name: string; type: string; size: number; base64: string }>
  ) => {
    console.log('🚀 Starting background processing for:', comparisonId);
    
    try {
      // Obtener criterios
      const criteria = await getComparisonCriteria(tenantId, line);
      const criteriaNames = criteria.map(c => c.criteria_name);
      console.log('📋 Criteria:', criteriaNames);

      // Preparar archivos para la IA
      const filesForAI = files.map(f => ({
        name: f.name,
        file_type: f.name.split('.').pop()?.toLowerCase() || 'pdf',
        base64_content: f.base64
      }));
      console.log('📁 Files to send:', filesForAI.map(f => f.name));

      // Usar URL relativa para pasar por el proxy de Next.js
      const apiUrl = '/api/ai/compare';
      console.log('🌐 API URL:', apiUrl);

      // Intentar primero con el proxy de Vercel, si falla por timeout, ir directo al backend
      let aiResult: { success: boolean; comparison_table?: unknown; ai_recommendation?: string; error?: string };
      
      try {
        const aiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comparisonId,
            tenantId,
            line,
            files: filesForAI,
            criteria: criteriaNames
          })
        });
        
        console.log('📡 Response status:', aiResponse.status);
        
        // Si es timeout (504) o el proxy falló, reintentar directo
        if (aiResponse.status === 504 || aiResponse.status === 502) {
          throw new Error('Proxy timeout');
        }
        
        aiResult = await aiResponse.json();
        
        // Si el resultado indica timeout, reintentar directo
        if (!aiResult.success && aiResult.error?.includes('tardó demasiado')) {
          throw new Error('Processing timeout');
        }
        
      } catch (proxyError) {
        // Si el proxy falla (timeout de Vercel), intentar directo al backend
        console.log('⚠️ Proxy failed, trying direct backend call...', proxyError);
        const backendUrl = process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL || 'https://quote-ai-2.preview.emergentagent.com';
        
        const directResponse = await fetch(`${backendUrl}/api/ai/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comparisonId,
            tenantId,
            line,
            files: filesForAI,
            criteria: criteriaNames
          })
        });
        
        console.log('📡 Direct response status:', directResponse.status);
        aiResult = await directResponse.json();
      }
      
      console.log('📦 AI Result:', aiResult.success ? 'SUCCESS' : 'FAILED', aiResult.error || '');

      const supabase = getBrowserClient();

      if (aiResult.success) {
        // Actualizar con resultados exitosos
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('comparisons')
          .update({
            comparison_table: aiResult.comparison_table,
            ai_recommendation: aiResult.ai_recommendation,
            status: 'ready'
          })
          .eq('id', comparisonId);

        toast({
          title: 'Comparativo listo',
          description: 'El análisis de cotizaciones está completo'
        });
      } else {
        // Marcar como error
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('comparisons')
          .update({
            status: 'error',
            error_message: aiResult.error || 'Error al procesar'
          })
          .eq('id', comparisonId);

        toast({
          title: 'Error en comparativo',
          description: aiResult.error || 'No se pudo procesar',
          variant: 'destructive'
        });
      }

      // Recargar lista
      loadData();

    } catch (error) {
      console.error('❌ Background processing error:', error);
      
      // Marcar como error en la base de datos
      const supabase = getBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('comparisons')
        .update({
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Error desconocido'
        })
        .eq('id', comparisonId);

      toast({
        title: 'Error',
        description: 'Error al procesar el comparativo',
        variant: 'destructive'
      });

      loadData();
    }
  };

  const handleCreateComparison = async (data: {
    clientId?: string;
    prospectName?: string;
    line: PolicyLine;
    files: Array<{ name: string; type: string; size: number; base64: string }>;
  }) => {
    if (!tenantId || !userId) return;

    try {
      // 1. Crear el registro en la base de datos (estado: processing)
      const result = await createComparison({
        tenantId,
        clientId: data.clientId,
        prospectName: data.prospectName,
        agentId: userId,
        line: data.line,
        files: data.files
      });

      if (!result.success || !result.comparisonId) {
        throw new Error(result.error || 'Error al crear comparativo');
      }

      // 2. Cerrar el wizard inmediatamente
      setShowWizard(false);

      // 3. Mostrar notificación
      toast({
        title: 'Comparativo en proceso',
        description: 'Se está generando en segundo plano. Puedes seguir trabajando.'
      });

      // 4. Recargar lista para mostrar el nuevo comparativo con status "processing"
      await loadData();

      // 5. Procesar en segundo plano (no bloquea la UI)
      console.log('🎯 Calling processComparisonInBackground...');
      processComparisonInBackground(
        result.comparisonId,
        tenantId,
        data.line,
        data.files
      );

    } catch (error) {
      console.error('Error creating comparison:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al crear comparativo',
        variant: 'destructive'
      });
    }
  };

  const handleViewComparison = async (comparison: ComparisonWithRelations) => {
    if (comparison.status === 'processing') {
      toast({
        title: 'En proceso',
        description: 'Este comparativo aún se está generando. Espera unos segundos.'
      });
      return;
    }
    
    if (comparison.status === 'error') {
      toast({
        title: 'Error en comparativo',
        description: (comparison as unknown as { error_message?: string }).error_message || 'Hubo un error al generar este comparativo',
        variant: 'destructive'
      });
      return;
    }

    const fullComparison = await getComparisonById(comparison.id);
    if (fullComparison) {
      setSelectedComparison(fullComparison);
    }
  };

  const handleDeleteComparison = async (comparisonId: string) => {
    if (!confirm('¿Estás seguro de eliminar este comparativo?')) return;

    const result = await deleteComparison(comparisonId);
    if (result.success) {
      toast({
        title: 'Comparativo eliminado'
      });
      await loadData();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'No se pudo eliminar',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateCell = async (insurerKey: string, criteriaKey: string, newValue: string) => {
    if (!selectedComparison) return;

    const result = await updateComparisonCell(
      selectedComparison.id,
      insurerKey,
      criteriaKey,
      newValue
    );

    if (result.success) {
      const updated = await getComparisonById(selectedComparison.id);
      if (updated) {
        setSelectedComparison(updated);
      }
    } else {
      toast({
        title: 'Error',
        description: result.error || 'No se pudo actualizar',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateRecommendation = async (recommendation: string) => {
    if (!selectedComparison) return;

    const result = await updateRecommendation(selectedComparison.id, recommendation);

    if (result.success) {
      setSelectedComparison(prev => prev ? { ...prev, ai_recommendation: recommendation } : null);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'No se pudo actualizar',
        variant: 'destructive'
      });
    }
  };

  const handleCreatePolicy = (insurerName: string) => {
    if (!selectedComparison) return;
    
    const params = new URLSearchParams({
      client_id: selectedComparison.client_id,
      insurer: insurerName,
      line: selectedComparison.line
    });
    
    router.push(`/polizas/nueva?${params.toString()}`);
  };

  const handleBackToList = () => {
    setSelectedComparison(null);
  };

  if (tenantLoading || isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-20 bg-slate-200 rounded animate-pulse" />
        <div className="h-64 bg-slate-200 rounded animate-pulse" />
      </div>
    );
  }

  // Vista de detalle
  if (selectedComparison) {
    return (
      <div className="p-6 space-y-6" data-testid="ai-compare-detail">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
            data-testid="back-to-list-btn"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        </div>

        <ComparisonViewer
          comparison={selectedComparison}
          onUpdateCell={handleUpdateCell}
          onUpdateRecommendation={handleUpdateRecommendation}
          onCreatePolicy={handleCreatePolicy}
          branding={{
            agencyName: tenantName || 'Agencia de Seguros'
          }}
        />
      </div>
    );
  }

  // Contar comparativos en proceso
  const processingCount = comparisons.filter(c => c.status === 'processing').length;

  // Vista de lista
  return (
    <div className="p-6 space-y-6" data-testid="ai-compare-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Comparativos con IA
          </h1>
          <p className="text-muted-foreground text-sm">
            Genera cuadros comparativos de cotizaciones automáticamente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="refresh-btn"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            onClick={handleNewComparison}
            disabled={usageStats?.remaining === 0}
            data-testid="new-comparison-btn"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Comparativo
          </Button>
        </div>
      </div>

      {/* Usage Progress */}
      {usageStats && (
        <UsageProgress stats={usageStats} isLoading={isLoading} />
      )}

      {/* Processing indicator */}
      {processingCount > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">
                {processingCount} comparativo{processingCount > 1 ? 's' : ''} en proceso...
              </span>
              <span className="text-xs text-blue-600">
                (se actualiza automáticamente)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-slate-600 mt-0.5" />
            <div className="text-sm text-slate-700">
              <p className="font-medium">¿Cómo funciona?</p>
              <p className="mt-1">
                1. Sube las cotizaciones (PDF o DOCX) → 
                2. La IA analiza en segundo plano → 
                3. Obtén el cuadro comparativo cuando esté listo
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparisons List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Historial de comparativos</h2>
        <ComparisonsList
          comparisons={comparisons}
          isLoading={isLoading}
          onView={handleViewComparison}
          onDelete={handleDeleteComparison}
        />
      </div>

      {/* New Comparison Wizard - Sin estado de procesamiento */}
      <NewComparisonWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onSubmit={handleCreateComparison}
        isProcessing={false}
        processingProgress={0}
      />
    </div>
  );
}
