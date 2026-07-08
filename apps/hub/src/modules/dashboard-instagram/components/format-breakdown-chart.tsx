'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FormatBreakdown } from '../types/instagram.types'

// ── Constants ─────────────────────────────────────────────────────────────────

const FORMAT_LABEL: Record<string, string> = {
  REEL: 'Reels',
  CAROUSEL_ALBUM: 'Carruseles',
  IMAGE: 'Imágenes',
}

const FORMAT_COLOR: Record<string, string> = {
  REEL: 'hsl(217 91% 60%)',
  CAROUSEL_ALBUM: 'hsl(269 77% 63%)',
  IMAGE: 'hsl(38 92% 50%)',
}

// Reference mix for 2026 (% of total posts)
const IDEAL_MIX: Record<string, { min: number; max: number; label: string }> = {
  REEL: { min: 60, max: 70, label: '60-70%' },
  CAROUSEL_ALBUM: { min: 20, max: 30, label: '20-30%' },
  IMAGE: { min: 0, max: 10, label: '<10%' },
}

const MIN_LIFT = 1.3
const CONSISTENT_MIN = 5
const TENTATIVE_MIN = 2

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLabel(format: string): string {
  return FORMAT_LABEL[format] ?? format
}

function formatColor(format: string): string {
  return FORMAT_COLOR[format] ?? 'hsl(215 20% 65%)'
}

function amplificationRate(f: FormatBreakdown): number | null {
  if (f.avgReach === 0) return null
  return ((f.avgSaves + f.avgShares) / f.avgReach) * 1000
}

function confidenceInfo(postCount: number): { label: string; isConsistent: boolean } {
  if (postCount >= CONSISTENT_MIN) return { label: 'Patrón consistente', isConsistent: true }
  return { label: 'Señal tentativa', isConsistent: false }
}

function formatAction(format: string): string {
  if (format === 'CAROUSEL_ALBUM') return 'Priorizá carruseles cuando querés que tu audiencia guarde o comparta.'
  if (format === 'REEL') return 'Priorizá Reels para maximizar el alcance a nuevas audiencias.'
  return 'Seguí apostando a este formato.'
}

function buildInsight(
  breakdown: FormatBreakdown[],
  totalPosts: number,
): { text: string; postCount: number } | null {
  // Performance signal: is one format clearly outperforming the rest?
  const rated = breakdown
    .map((f) => ({ f, rate: amplificationRate(f) }))
    .filter((x): x is { f: FormatBreakdown; rate: number } =>
      x.rate !== null && x.f.postCount >= TENTATIVE_MIN,
    )
    .sort((a, b) => b.rate - a.rate)

  if (rated.length >= 2) {
    const best = rated[0]!
    const second = rated[1]!
    const lift = best.rate / second.rate
    if (lift >= MIN_LIFT) {
      const bestLabel = formatLabel(best.f.format)
      const secondLabel = formatLabel(second.f.format)
      const action = formatAction(best.f.format)
      return {
        text: `Tus ${bestLabel} logran ${lift.toFixed(1)}× más saves+shares por 1000 personas alcanzadas que tus ${secondLabel}. ${action}`,
        postCount: best.f.postCount,
      }
    }
  }

  // Mix signal: Reels are significantly underrepresented
  const reelItem = breakdown.find((f) => f.format === 'REEL')
  const reelPct = reelItem ? Math.round((reelItem.postCount / totalPosts) * 100) : 0
  if (totalPosts >= 5 && reelPct < 50) {
    return {
      text: `Solo el ${reelPct}% de tus publicaciones son Reels. Los Reels tienen mayor alcance orgánico — probá llevarlos al 60% de tu mezcla esta semana.`,
      postCount: reelItem?.postCount ?? 0,
    }
  }

  return null
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface ChartEntry {
  format: string
  rawFormat: string
  rate: number
  hasReach: boolean
  reach: number
  postCount: number
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: ChartEntry }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="rounded-lg border border-border bg-popover p-3 shadow-md text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-foreground">{label}</p>
      {d.hasReach ? (
        <p className="text-muted-foreground">
          Amplificación:{' '}
          <span className="text-foreground font-medium">{d.rate.toFixed(1)} / 1000 alcanzados</span>
        </p>
      ) : (
        <p className="text-muted-foreground italic">Sin datos de alcance</p>
      )}
      <p className="text-muted-foreground">
        Alcance prom.:{' '}
        <span className="text-foreground font-medium">{d.reach.toLocaleString('es-AR')}</span>
      </p>
      <p className="text-muted-foreground">
        Posts: <span className="text-foreground font-medium">{d.postCount}</span>
      </p>
    </div>
  )
}

// ── Mix row ───────────────────────────────────────────────────────────────────

interface MixRowProps {
  label: string
  realPct: number
  ideal: { min: number; max: number; label: string } | undefined
  color: string
  postCount: number
}

function MixRow({ label, realPct, ideal, color, postCount }: MixRowProps) {
  const roundedPct = Math.round(realPct)
  const isInRange = ideal !== undefined ? realPct >= ideal.min && realPct <= ideal.max : null
  const isBelow = ideal !== undefined ? realPct < ideal.min : false

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums font-semibold" style={{ color }}>
            {roundedPct}%
          </span>
          {ideal !== undefined && (
            <span
              className={`text-[10px] ${
                isInRange === true
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isBelow
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              ideal {ideal.label}
            </span>
          )}
        </div>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${Math.min(roundedPct, 100)}%`, backgroundColor: color }}
        />
        {ideal !== undefined && ideal.min > 0 && (
          <div
            className="absolute top-0 h-full w-px bg-foreground/25"
            style={{ left: `${ideal.min}%` }}
          />
        )}
        {ideal !== undefined && ideal.max < 100 && (
          <div
            className="absolute top-0 h-full w-px bg-foreground/25"
            style={{ left: `${ideal.max}%` }}
          />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {postCount} {postCount === 1 ? 'post' : 'posts'}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface FormatBreakdownChartProps {
  breakdown: FormatBreakdown[]
}

export function FormatBreakdownChart({ breakdown }: FormatBreakdownChartProps) {
  if (!breakdown || breakdown.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-base font-semibold mb-2">Rendimiento por formato</h3>
        <p className="text-sm text-muted-foreground">
          Sincronizá datos para ver el desglose por formato.
        </p>
      </div>
    )
  }

  const totalPosts = breakdown.reduce((sum, f) => sum + f.postCount, 0)

  const chartData: ChartEntry[] = breakdown.map((f) => {
    const rate = amplificationRate(f)
    return {
      format: formatLabel(f.format),
      rawFormat: f.format,
      rate: rate ?? 0,
      hasReach: f.avgReach > 0,
      reach: Math.round(f.avgReach),
      postCount: f.postCount,
    }
  })

  const insight = buildInsight(breakdown, totalPosts)
  const insightConf = insight ? confidenceInfo(insight.postCount) : null

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <h3 className="text-base font-semibold">Rendimiento por formato</h3>

      {/* ── Performance + Mix ── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_200px]">

        {/* Amplification rate chart */}
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            Saves+shares por 1000 personas alcanzadas
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <XAxis
                dataKey="format"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 4 }}
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {chartData.map((entry) => (
                  <Cell key={entry.rawFormat} fill={formatColor(entry.rawFormat)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Mix comparison */}
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            Mezcla real vs. referencia 2026
          </p>
          <div className="space-y-4">
            {breakdown.map((f) => (
              <MixRow
                key={f.format}
                label={formatLabel(f.format)}
                realPct={(f.postCount / totalPosts) * 100}
                ideal={IDEAL_MIX[f.format]}
                color={formatColor(f.format)}
                postCount={f.postCount}
              />
            ))}
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground/60 leading-snug">
            Ref.: ~65% Reels · ~25% carruseles · &lt;10% estáticos
          </p>
        </div>
      </div>

      {/* ── Prescriptive insight ── */}
      {insight && insightConf && (
        <div className="border-t border-border/60 pt-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-1.5 text-primary">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18 15 12 9 6" />
              </svg>
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <p className="text-sm text-foreground leading-relaxed">{insight.text}</p>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                  insightConf.isConsistent
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-500/30'
                    : 'bg-amber-50 text-amber-700 ring-amber-500/20 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-500/30'
                }`}
              >
                {insightConf.label} · {insight.postCount} posts
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
