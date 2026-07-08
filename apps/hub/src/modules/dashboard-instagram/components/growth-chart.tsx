'use client';

import { Button } from '@core/ui';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { GrowthDataPoint, GrowthMetric, GrowthPeriod } from '../types/instagram.types';

// ── Formatters ──

function formatChartValue(value: number, metric: GrowthMetric): string {
  if (metric === 'engagement') return `${value.toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function buildTickFormatter(rangeMs: number) {
  return (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    if (rangeMs > 365 * 86_400_000) {
      // > 1 year: "Ene 24"
      return date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
    }
    if (rangeMs > 90 * 86_400_000) {
      // 90d–1y: "15 Ene"
      return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    }
    // < 90d: "15/01"
    return `${day}/${month}`;
  };
}

function buildTickInterval(pointCount: number, rangeMs: number): number {
  if (rangeMs > 365 * 86_400_000) return Math.max(1, Math.floor(pointCount / 12));
  if (rangeMs > 90 * 86_400_000) return Math.max(1, Math.floor(pointCount / 8));
  if (pointCount > 30) return Math.max(1, Math.floor(pointCount / 10));
  return 0;
}

// ── Zoom selector ──

const ZOOM_OPTIONS: { key: GrowthPeriod; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: '1y', label: '1 año' },
  { key: '90d', label: '90d' },
  { key: '30d', label: '30d' },
  { key: '7d', label: '7d' },
];

function ZoomSelector({
  current,
  onChange,
}: {
  current: GrowthPeriod;
  onChange: (p: GrowthPeriod) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Zoom del gráfico">
      {ZOOM_OPTIONS.map(({ key, label }) => (
        <Button
          key={key}
          variant={current === key ? 'default' : 'secondary'}
          size="sm"
          onClick={() => onChange(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

// ── Main component ──

const METRIC_LABELS: Record<GrowthMetric, string> = {
  followers: 'Seguidores',
  engagement: 'Engagement',
  reach: 'Alcance',
  impressions: 'Impresiones',
  profileViews: 'Visitas al perfil',
};

const METRIC_COLOR: Record<GrowthMetric, string> = {
  followers: '#6366f1',
  engagement: '#8b5cf6',
  reach: '#f59e0b',
  impressions: '#06b6d4',
  profileViews: '#10b981',
};

interface GrowthChartProps {
  data: GrowthDataPoint[];
  metric: GrowthMetric;
  period: GrowthPeriod;
  onPeriodChange: (p: GrowthPeriod) => void;
  isLoading?: boolean;
}

export function GrowthChart({ data, metric, period, onPeriodChange, isLoading }: GrowthChartProps) {
  if (isLoading) {
    return (
      <div className="bg-card border-border rounded-xl border p-5">
        <div className="animate-pulse">
          <div className="bg-muted mb-4 h-5 w-40 rounded" />
          <div className="bg-muted h-[280px] w-full rounded" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-card border-border rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{METRIC_LABELS[metric]}</h3>
          <ZoomSelector current={period} onChange={onPeriodChange} />
        </div>
        <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center">
          <p className="text-muted-foreground text-sm">Sin datos históricos aún</p>
          <p className="text-muted-foreground/70 text-xs max-w-xs">
            Instagram tarda 24-48 horas en procesar las métricas diarias para cuentas recién conectadas.
          </p>
        </div>
      </div>
    );
  }

  const first = new Date(data[0]!.date).getTime();
  const last = new Date(data[data.length - 1]!.date).getTime();
  const rangeMs = last - first;

  const tickFormatter = buildTickFormatter(rangeMs);
  const tickInterval = buildTickInterval(data.length, rangeMs);
  const color = METRIC_COLOR[metric] ?? '#f59e0b';
  const gradientId = `gradient-${metric}`;

  const chartData = data.map((d) => ({ ...d, label: tickFormatter(d.date) }));

  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{METRIC_LABELS[metric]}</h3>
          {(period === 'all' || period === '1y') && data.length > 0 && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              Desde{' '}
              {new Date(data[0]!.date).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        <ZoomSelector current={period} onChange={onPeriodChange} />
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 4, bottom: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={tickFormatter}
            interval={tickInterval}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => formatChartValue(v, metric)}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            labelFormatter={(label: string) =>
              new Date(label).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            }
            formatter={(value: number) => [
              formatChartValue(value, metric),
              METRIC_LABELS[metric],
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
