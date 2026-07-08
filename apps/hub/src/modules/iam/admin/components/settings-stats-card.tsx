import { Card, CardContent } from '@core/ui';
import type { JSX } from 'react';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SettingsStatsCardProps {
  label: string;
  value: string | number;
  isLoading?: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SettingsStatsCard({
  label,
  value,
  isLoading = false,
}: SettingsStatsCardProps): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
        {isLoading ? (
          <div className="bg-muted h-8 w-16 animate-pulse rounded" aria-hidden="true" />
        ) : (
          <span className="text-foreground text-2xl font-bold">{value}</span>
        )}
      </CardContent>
    </Card>
  );
}
