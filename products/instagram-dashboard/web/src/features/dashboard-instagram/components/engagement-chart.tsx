import type { EngagementDataPoint } from '../types/instagram.types'

function barHeight(value: number, max: number): string {
  const pct = max > 0 ? (value / max) * 100 : 0
  return `${String(Math.max(pct, 2))}%`
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })
}

export function EngagementChart({ data }: { data: EngagementDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-card border-border rounded-lg border p-6">
        <h3 className="mb-4 text-sm font-semibold">Engagement</h3>
        <p className="text-muted-foreground text-center text-sm">
          Sin datos de engagement para este período.
        </p>
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.likes + d.comments + d.shares + d.saves))

  return (
    <div className="bg-card border-border rounded-lg border p-6">
      <h3 className="mb-4 text-sm font-semibold">Engagement</h3>
      <div className="flex items-end gap-1" style={{ height: 160 }}>
        {data.map((point) => {
          const total = point.likes + point.comments + point.shares + point.saves
          return (
            <div
              key={point.date}
              className="flex flex-1 flex-col items-center justify-end"
              title={`${formatShortDate(point.date)}: ${String(total)} interacciones`}
            >
              <div
                className="bg-primary w-full rounded-t-sm transition-all hover:opacity-80"
                style={{ height: barHeight(total, maxValue) }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-muted-foreground text-xs">
        <span>{formatShortDate(data[0]?.date ?? '')}</span>
        <span>{formatShortDate(data[data.length - 1]?.date ?? '')}</span>
      </div>
      <div className="text-muted-foreground mt-3 flex items-center justify-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> Likes
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/60" /> Comments
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/30" /> Shares
        </span>
      </div>
    </div>
  )
}
