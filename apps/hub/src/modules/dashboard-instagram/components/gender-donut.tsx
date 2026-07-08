'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

import type { DemographicItem } from '../types/instagram.types'

const GENDER_LABELS: Record<string, string> = {
  M: 'Hombres',
  F: 'Mujeres',
  U: 'No especificado',
}

const GENDER_COLORS: Record<string, string> = {
  M: 'hsl(217, 91%, 60%)',
  F: 'hsl(330, 80%, 60%)',
  U: 'hsl(220, 13%, 65%)',
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { label: string; percentage: number } }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null
  const item = payload[0]
  return (
    <div className="bg-background border border-border rounded-md px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{GENDER_LABELS[item.payload.label] ?? item.payload.label}</p>
      <p className="text-muted-foreground font-mono tabular-nums">
        {item.payload.percentage.toFixed(1)}%
      </p>
    </div>
  )
}

export function GenderDonut({ data }: { data: DemographicItem[] }) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        Datos de género no disponibles.
      </p>
    )
  }

  const chartData = data.map((item) => ({
    label: item.label,
    name: GENDER_LABELS[item.label] ?? item.label,
    value: item.value,
    percentage: item.percentage,
  }))

  return (
    <div className="flex items-center gap-6">
      <div className="h-36 w-36 shrink-0" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={GENDER_COLORS[entry.label] ?? 'hsl(220, 13%, 65%)'}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2" role="list" aria-label="Distribución por género">
        {chartData.map((item) => (
          <div key={item.label} className="flex items-center gap-2" role="listitem">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: GENDER_COLORS[item.label] ?? 'hsl(220, 13%, 65%)' }}
              aria-hidden="true"
            />
            <span className="text-sm text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-mono text-sm tabular-nums font-medium">
              {item.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
