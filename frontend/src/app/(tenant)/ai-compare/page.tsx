'use client';

// =====================================================
// PÁGINA: Comparativos con IA
// /ai-compare
// Módulo 09 del CRM Multi-tenant
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  UsageStats,
  ComparisonTable 
} from '@/lib/validations/comparisons';
import type { PolicyLine } from '@/lib/validations/policies';
import { Plus, RefreshCw, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function AIComparePage() {
  const { tenantId, userId, isLoading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const router = useRouter();

  // Estados
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [comparisons, setComparisons] = useState<ComparisonWithRelations[]>([]);
  const [selectedComparison, setSelectedComparison] = useState<ComparisonWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Wizard states
  const [showWizard, setShowWizard] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Cargar datos
  const loadData = useCallback(async () => {
    if (!tenantId) return;

    try {
      setIsLoading(true);
      
      const [usage, compList] = await Promise.all([
        getMonthlyUsage(tenantId),
        getComparisons(tenantId)
      ]);
      
      setUsageStats(usage);
      setComparisons(compList);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => {
    if (!tenantLoading && tenantId) {
      loadData();
    }
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

  const handleCreateComparison = async (data: {
    clientId?: string;
    prospectName?: string;
    line: PolicyLine;
    files: Array<{ name: string; type: string; size: number; base64: string }>;
  }) => {
    if (!tenantId || !userId) return;

    setIsProcessing(true);
    setProcessingProgress(10);

    try {
      // Crear el comparativo en la base de datos
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

      setProcessingProgress(30);

      // Obtener los criterios para este ramo
      const criteria = await getComparisonCriteria(tenantId, data.line);
      const criteriaNames = criteria.map(c => c.criteria_name);

      setProcessingProgress(40);

      // Llamar al API de IA para procesar
      const filesForAI = data.files.map(f => ({
        name: f.name,
        file_type: f.name.split('.').pop()?.toLowerCase() || 'pdf',
        base64_content: f.base64
      }));

      // Usar la URL del backend (REACT_APP_BACKEND_URL apunta al mismo dominio con proxy a puerto 8001)
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || window.location.origin;

      // Crear AbortController para timeout de 3 minutos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      try {
        const aiResponse = await fetch(`${backendUrl}/api/ai/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comparisonId: result.comparisonId,
            tenantId,
            line: data.line,
            files: filesForAI,
            criteria: criteriaNames
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        setProcessingProgress(80);

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          throw new Error(`Error del servidor: ${aiResponse.status} - ${errorText}`);
        }

        const aiResult = await aiResponse.json();

        if (!aiResult.success) {
          throw new Error(aiResult.error || 'Error al procesar con IA');
        }

        // Actualizar el comparativo con los resultados
        const supabase = getBrowserClient();
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('comparisons')
          .update({
            comparison_table: aiResult.comparison_table,
            ai_recommendation: aiResult.ai_recommendation,
            status: 'ready'
          })
          .eq('id', result.comparisonId);

      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('La solicitud tardó demasiado. Intenta con archivos más pequeños.');
        }
        throw fetchError;
      }

      setProcessingProgress(100);

      // Recargar datos y mostrar el comparativo
      await loadData();
      
      const newComparison = await getComparisonById(result.comparisonId);
      if (newComparison) {
        setSelectedComparison(newComparison);
      }

      setShowWizard(false);
      toast({
        title: 'Comparativo creado',
        description: 'El análisis de cotizaciones está listo'
      });

    } catch (error) {
      console.error('Error creating comparison:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al crear comparativo',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  const handleViewComparison = async (comparison: ComparisonWithRelations) => {
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
        title: 'Comparativo eliminado',
        description: 'El comparativo ha sido eliminado correctamente'
      });
      await loadData();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'No se pudo eliminar el comparativo',
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
      // Actualizar localmente
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
    
    // Navegar a crear póliza con datos pre-completados
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
        />
      </div>
    );
  }

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

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">¿Cómo funciona?</p>
              <p className="mt-1">
                1. Sube las cotizaciones de diferentes aseguradoras (PDF o DOCX)
                <br />
                2. La IA analiza y extrae automáticamente la información
                <br />
                3. Obtén un cuadro comparativo editable con recomendaciones
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparisons List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Comparativos anteriores</h2>
        <ComparisonsList
          comparisons={comparisons}
          isLoading={isLoading}
          onView={handleViewComparison}
          onDelete={handleDeleteComparison}
        />
      </div>

      {/* New Comparison Wizard */}
      <NewComparisonWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onSubmit={handleCreateComparison}
        isProcessing={isProcessing}
        processingProgress={processingProgress}
      />
    </div>
  );
}
