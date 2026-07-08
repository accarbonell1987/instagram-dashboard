'use client'

import type { DemographicItem } from '../types/instagram.types'

const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']

function sortByAge(items: DemographicItem[]): DemographicItem[] {
  return [...items].sort((a, b) => {
    const ai = AGE_ORDER.indexOf(a.label)
    const bi = AGE_ORDER.indexOf(b.label)
    if (ai !== -1 && bi !== -1) return ai - bi
    return b.value - a.value
  })
}

export function AgeBreakdownChart({ data }: { data: DemographicItem[] }) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        Datos de edad no disponibles.
      </p>
    )
  }

  const sorted = sortByAge(data)
  const maxValue = Math.max(...sorted.map((d) => d.value))
  const dominant = sorted.reduce((a, b) => (a.value > b.value ? a : b))

  return (
    <div className="space-y-2" role="list" aria-label="Distribución por edad">
      {sorted.map((item) => {
        const barWidth = maxValue > 0 ? (item.value / maxValue) * 100 : 0
        const isDominant = item.label === dominant.label

        return (
          <div
            key={item.label}
            className="flex items-center gap-3"
            role="listitem"
            aria-label={`${item.label}: ${item.percentage}%`}
          >
            <span
              className={`w-12 shrink-0 text-right font-mono text-xs tabular-nums ${
                isDominant ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </span>
            <div className="relative flex-1">
              <div
                className={`h-5 rounded-sm transition-all ${
                  isDominant ? 'bg-primary' : 'bg-primary/30'
                }`}
                style={{ width: `${barWidth}%` }}
                aria-hidden="true"
              />
              {isDominant && (
                <span className="absolute inset-y-0 left-full ml-1.5 flex items-center">
                  <span className="text-[10px] font-medium text-primary">★</span>
                </span>
              )}
            </div>
            <span
              className={`w-12 shrink-0 font-mono text-xs tabular-nums ${
                isDominant ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
            >
              {item.percentage.toFixed(1)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
