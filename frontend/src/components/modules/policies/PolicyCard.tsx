'use client';

// =====================================================
// COMPONENTE: PolicyCard
// Tarjeta de póliza con información resumida
// =====================================================

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  type Policy,
  POLICY_STATUS_LABELS,
  POLICY_STATUS_COLORS,
  POLICY_LINE_LABELS,
  formatPremium,
  formatDate,
  type PolicyStatus,
  type PolicyLine
} from '@/lib/validations/policies';
import {
  Building,
  Calendar,
  Eye,
  FileText,
  Heart,
  Car,
  Stethoscope,
  Home,
  Shield
} from 'lucide-react';

interface PolicyCardProps {
  policy: Policy & { client_name?: string };
  showClient?: boolean;
}

const LINE_ICONS: Record<PolicyLine, React.ElementType> = {
  vida: Heart,
  auto: Car,
  salud: Stethoscope,
  hogar: Home,
  soat: Shield,
  otro: FileText
};

export function PolicyCard({ policy, showClient = true }: PolicyCardProps) {
  const LineIcon = LINE_ICONS[policy.line as PolicyLine] || FileText;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <LineIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">#{policy.policy_number}</span>
                <Badge className={POLICY_STATUS_COLORS[policy.status as PolicyStatus]}>
                  {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {POLICY_LINE_LABELS[policy.line as PolicyLine]}
              </p>
              {showClient && policy.client_name && (
                <p className="text-sm font-medium mt-1">{policy.client_name}</p>
              )}
            </div>
          </div>
          <Link href={`/polizas/${policy.id}`}>
            <Button variant="ghost" size="icon">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Aseguradora</p>
            <p className="font-medium flex items-center gap-1">
              <Building className="w-3 h-3" />
              {policy.insurer}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Prima</p>
            <p className="font-semibold">{formatPremium(Number(policy.premium), policy.currency)}</p>
          </div>
        </div>

        {(policy.start_date || policy.end_date) && (
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              {policy.start_date ? formatDate(policy.start_date) : '---'}
              {' → '}
              {policy.end_date ? formatDate(policy.end_date) : '---'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================
// COMPONENTE: PolicyList
// Lista de tarjetas de pólizas
// =====================================================

interface PolicyListProps {
  policies: Array<Policy & { client_name?: string }>;
  showClient?: boolean;
  emptyMessage?: string;
}

export function PolicyList({ policies, showClient = true, emptyMessage = 'No hay pólizas' }: PolicyListProps) {
  if (policies.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {policies.map((policy) => (
        <PolicyCard key={policy.id} policy={policy} showClient={showClient} />
      ))}
    </div>
  );
}
