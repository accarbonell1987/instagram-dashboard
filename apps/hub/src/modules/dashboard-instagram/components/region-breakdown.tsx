'use client'

import { useState } from 'react'

import { Button } from '@core/ui'
import { ChevronDown, ChevronUp } from 'lucide-react'

import type { DemographicItem } from '../types/instagram.types'

const COUNTRY_NAMES: Record<string, string> = {
  AR: 'Argentina', BR: 'Brasil', MX: 'México', CO: 'Colombia', CL: 'Chile',
  PE: 'Perú', VE: 'Venezuela', EC: 'Ecuador', US: 'Estados Unidos', ES: 'España',
  UY: 'Uruguay', PY: 'Paraguay', BO: 'Bolivia', CR: 'Costa Rica', PA: 'Panamá',
  GT: 'Guatemala', DO: 'Rep. Dominicana', HN: 'Honduras', NI: 'Nicaragua', SV: 'El Salvador',
  CU: 'Cuba', PR: 'Puerto Rico', DE: 'Alemania', FR: 'Francia', IT: 'Italia',
  GB: 'Reino Unido', CA: 'Canadá', AU: 'Australia', JP: 'Japón', CN: 'China',
}

function RegionBar({ item, maxValue }: { item: DemographicItem; maxValue: number }) {
  const barWidth = maxValue > 0 ? (item.value / maxValue) * 100 : 0

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{item.label}</span>
      <div className="relative flex-1">
        <div
          className="h-3 rounded-sm bg-primary/40"
          style={{ width: `${barWidth}%` }}
          aria-hidden="true"
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {item.percentage.toFixed(1)}%
      </span>
    </div>
  )
}

function RegionList({
  items,
  label,
  mapLabel,
}: {
  items: DemographicItem[]
  label: string
  mapLabel?: (l: string) => string
}) {
  const [expanded, setExpanded] = useState(false)
  const VISIBLE = 8
  const displayed = expanded ? items : items.slice(0, VISIBLE)
  const maxValue = items[0]?.value ?? 0

  const mapped = displayed.map((item) => ({
    ...item,
    label: mapLabel ? (mapLabel(item.label) ?? item.label) : item.label,
  }))

  if (items.length === 0) {
    return (
      <div>
        <h5 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-widest">
          {label}
        </h5>
        <p className="text-muted-foreground text-sm">No disponible</p>
      </div>
    )
  }

  return (
    <div>
      <h5 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-widest">
        {label}
      </h5>
      <div className="space-y-0.5" role="list" aria-label={label}>
        {mapped.map((item) => (
          <div key={item.label} role="listitem">
            <RegionBar item={item} maxValue={maxValue} />
          </div>
        ))}
      </div>
      {items.length > VISIBLE && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-primary"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Ver {items.length - VISIBLE} más
            </>
          )}
        </Button>
      )}
    </div>
  )
}

interface RegionBreakdownProps {
  countries: DemographicItem[]
  cities: DemographicItem[]
}

export function RegionBreakdown({ countries, cities }: RegionBreakdownProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <RegionList
        items={countries}
        label="Países"
        mapLabel={(code) => COUNTRY_NAMES[code] ?? code}
      />
      <RegionList items={cities} label="Ciudades" />
    </div>
  )
}
