'use client';

// =====================================================
// PAGE: Super Admin - Catálogos
// Gestión de compañías, ramos y grupos de seguros
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/ui/spinner';
import {
  Building,
  Layers,
  FolderTree,
  ChevronRight,
  Percent,
  BadgePercent,
} from 'lucide-react';

interface CatalogStats {
  companies: number;
  lines: number;
  groups: number;
  commissions: number;
}

export default function CatalogosPage() {
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = getUntypedClient();

  const fetchStats = useCallback(async () => {
    try {
      const [companiesRes, linesRes, groupsRes, commissionsRes] = await Promise.all([
        supabase.from('insurance_companies').select('id', { count: 'exact', head: true }),
        supabase.from('insurance_lines').select('id', { count: 'exact', head: true }),
        supabase.from('insurance_groups').select('id', { count: 'exact', head: true }),
        supabase.from('company_group_commissions').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        companies: companiesRes.count || 0,
        lines: linesRes.count || 0,
        groups: groupsRes.count || 0,
        commissions: commissionsRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching catalog stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading) {
    return <LoadingScreen message="Cargando catálogos..." />;
  }

  const catalogItems = [
    {
      title: 'Compañías de Seguros',
      description: 'Gestiona las aseguradoras disponibles en la plataforma',
      icon: Building,
      href: '/admin/catalogos/companias',
      count: stats?.companies || 0,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Grupos',
      description: 'Configura los grupos de seguro (Automóviles, Vida, etc.)',
      icon: Layers,
      href: '/admin/catalogos/ramos',
      count: stats?.lines || 0,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Ramos',
      description: 'Define los ramos/productos dentro de cada grupo',
      icon: FolderTree,
      href: '/admin/catalogos/grupos',
      count: stats?.groups || 0,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Comisiones',
      description: 'Configura el % de comisión por Compañía y Ramo',
      icon: BadgePercent,
      href: '/admin/catalogos/comisiones',
      count: stats?.commissions || 0,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      badge: 'Nuevo',
    },
    {
      title: 'Tasas Cotizador',
      description: 'Configura tasas y factores para el cotizador determinista',
      icon: Percent,
      href: '/admin/catalogos/tasas',
      count: 0,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Catálogos</h1>
        <p className="text-zinc-400 mt-1">
          Gestiona los catálogos globales de compañías, ramos y grupos de seguros
        </p>
      </div>

      {/* Catalog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {catalogItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg ${item.bgColor}`}>
                    <item.icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    {'badge' in item && item.badge && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="h-5 w-5 text-zinc-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-white text-lg mb-2">{item.title}</CardTitle>
                <p className="text-zinc-500 text-sm mb-4">{item.description}</p>
                {item.count > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-white">{item.count}</span>
                    <span className="text-xs text-zinc-500">registros</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Info */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">¿Cómo funciona?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-400">
          <p>
            <strong className="text-white">1. Compañías:</strong> Son las aseguradoras (Sura, Bolívar, etc.). 
            Cada compañía puede tener múltiples grupos.
          </p>
          <p>
            <strong className="text-white">2. Grupos:</strong> Son las líneas de negocio (Automóviles, Vida, Fianzas). 
            Cada grupo pertenece a una unidad (Generales o Vida).
          </p>
          <p>
            <strong className="text-white">3. Ramos:</strong> Son los productos específicos dentro de cada grupo 
            (Auto individual, Hogar, Vida Grupo, etc.).
          </p>
          <p>
            <strong className="text-orange-400">4. Comisiones:</strong> Define el porcentaje de comisión específico 
            para cada combinación de Compañía + Ramo. Ej: Automóviles de SURA = 12%, Automóviles de Bolívar = 15%.
          </p>
          <p>
            <strong className="text-white">5. Tasas:</strong> Configura las tasas del cotizador determinista 
            para PYME, Hogar, Copropiedad y TRE. Incluye factores de ajuste por zona, antigüedad, etc.
          </p>
          <p className="pt-2 border-t border-zinc-800">
            <strong className="text-amber-400">Importante:</strong> Solo los grupos con prompts IA activos 
            aparecerán en Cotizaciones IA (Fianzas). Los demás productos usan el cotizador con tasas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
