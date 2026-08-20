'use client';

import type { JSX } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { UsageByOperation, UsageByUser, UsageDay } from '@/features/agent/services/usage.service';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Explicit HSL, matching the charts already in this dashboard. Recharts paints
 * into SVG attributes, which cannot read a Tailwind class — so these are the one
 * place literal colour is the right answer rather than a shortcut.
 */
const SERIES = {
  tokens: 'hsl(217 91% 60%)',
  messages: 'hsl(269 77% 63%)',
  images: 'hsl(38 92% 50%)',
} as const;

const OPERATION_LABEL: Record<string, string> = {
  chat: 'Chat',
  suggestion: 'Sugerencias',
  script: 'Guiones',
  image_gen: 'Imágenes',
};

const OPERATION_COLOR: Record<string, string> = {
  chat: SERIES.messages,
  suggestion: 'hsl(160 84% 39%)',
  script: SERIES.tokens,
  image_gen: SERIES.images,
};

const AXIS = 'hsl(215 20% 65%)';

// ── Helpers ───────────────────────────────────────────────────────────────────

const compact = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k` : String(value);

/** Day and month only: a 90-day axis has no room for the year. */
const shortDate = (iso: string): string => iso.slice(8, 10) + '/' + iso.slice(5, 7);

const tooltipStyle = {
  contentStyle: {
    background: 'hsl(224 71% 4%)',
    border: '1px solid hsl(215 28% 17%)',
    borderRadius: 8,
    fontSize: 12,
    color: 'hsl(210 20% 98%)',
  },
} as const;

function ChartFrame({ title, hint, children }: {
  title: string;
  hint?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint !== undefined && <p className="text-muted-foreground mb-2 text-xs">{hint}</p>}
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────

/**
 * Consumption over the window.
 *
 * Tokens only. Messages and images are counted in single and double digits
 * against tokens in the thousands, and on one axis they would be a flat line
 * along the bottom — present, and saying nothing.
 */
export function UsageOverTimeChart({ daily }: { daily: UsageDay[] }): JSX.Element {
  return (
    <ChartFrame title="Consumo en el tiempo" hint="Tokens por día">
      <AreaChart data={daily} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="usage-tokens" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.tokens} stopOpacity={0.45} />
            <stop offset="100%" stopColor={SERIES.tokens} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fontSize: 11, fill: AXIS }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={compact}
          tick={{ fontSize: 11, fill: AXIS }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(value: string) => shortDate(value)}
          formatter={(value: number) => [value.toLocaleString('es-PY'), 'Tokens']}
        />
        <Area
          type="monotone"
          dataKey="tokens"
          stroke={SERIES.tokens}
          strokeWidth={2}
          fill="url(#usage-tokens)"
        />
      </AreaChart>
    </ChartFrame>
  );
}

/**
 * Per member, horizontal.
 *
 * Horizontal because the labels are names and emails: rotated under a vertical
 * axis they are unreadable, and truncated they are ambiguous exactly where the
 * chart is meant to name someone.
 */
export function UsageByUserChart({
  data,
  metric,
  title,
  hint,
  nameFor,
}: {
  data: UsageByUser[];
  metric: 'tokens' | 'messages';
  title: string;
  hint?: string;
  nameFor: (userId: string | null) => string;
}): JSX.Element {
  // Top eight: past that the bars are too thin to compare and the answer to
  // "who is spending" is already in the first few.
  const rows = [...data]
    .sort((a, b) => b[metric] - a[metric])
    .filter((row) => row[metric] > 0)
    .slice(0, 8)
    .map((row) => ({ name: nameFor(row.userId), value: row[metric] }));

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-2 text-xs">Nada registrado en este período.</p>
      </div>
    );
  }

  return (
    <ChartFrame title={title} {...(hint !== undefined && { hint })}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
        <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: AXIS }}
          tickLine={false}
          axisLine={false}
          width={128}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number) => [value.toLocaleString('es-PY'), title]}
          cursor={{ fill: 'hsl(215 28% 17% / 0.4)' }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={SERIES[metric]} />
      </BarChart>
    </ChartFrame>
  );
}

/** What the spend goes on — the actionable half of a bill. */
export function UsageByOperationChart({ data }: { data: UsageByOperation[] }): JSX.Element {
  const rows = data
    .filter((row) => row.tokens > 0 || row.images > 0)
    .map((row) => ({
      name: OPERATION_LABEL[row.operation] ?? row.operation,
      value: row.tokens,
      color: OPERATION_COLOR[row.operation] ?? AXIS,
    }));

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold">En qué se gasta</h3>
        <p className="text-muted-foreground mt-2 text-xs">Nada registrado en este período.</p>
      </div>
    );
  }

  return (
    <ChartFrame title="En qué se gasta" hint="Tokens por tipo de operación">
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {rows.map((row) => (
            <Cell key={row.name} fill={row.color} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Tooltip {...tooltipStyle} formatter={(value: number) => value.toLocaleString('es-PY')} />
      </PieChart>
    </ChartFrame>
  );
}
