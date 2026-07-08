import { Card, CardContent, Badge } from '@core/ui';
import type { KpiCardProps } from '@/lib/types';

export function KpiCard({ data, className = '' }: KpiCardProps) {
  const { label, value, delta, deltaUp, highlight } = data;

  return (
    <Card
      className={[
        'bg-surface border border-border-default rounded-card-sm p-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CardContent className="p-0 space-y-0.5">
        <div className="text-text-mute text-xs font-display uppercase tracking-wide">
          {label}
        </div>
        <div
          className={[
            'font-display text-lg font-bold',
            highlight ? 'text-accent' : 'text-text-default',
          ].join(' ')}
        >
          {value}
        </div>
        {delta && (
          <Badge
            variant="outline"
            className={[
              'rounded-md border-0 px-0 py-0 text-xs font-normal',
              deltaUp ? 'text-success' : 'text-danger',
            ].join(' ')}
          >
            {delta}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
