import { Badge } from '@core/ui';
import type { JSX } from 'react';

// ─── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active: { label: 'Activo', variant: 'default' },
  suspended: { label: 'Suspendido', variant: 'destructive' },
  pending_first_login: { label: 'Pendiente', variant: 'secondary' },
} as const;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MemberStatusBadgeProps {
  status: 'active' | 'suspended' | 'pending_first_login';
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MemberStatusBadge({ status }: MemberStatusBadgeProps): JSX.Element {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
