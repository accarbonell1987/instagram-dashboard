'use client'

import type { ReactNode } from 'react'

type BadgeVariant = 'leader' | 'lagging'

function IndicatorBadge({ variant }: { variant: BadgeVariant }) {
  if (variant === 'leader') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/30">
        indicador líder
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600/30">
      resultado
    </span>
  )
}

interface SectionHeaderProps {
  title: string
  description?: string
  badge?: BadgeVariant
  action?: ReactNode
}

export function SectionHeader({ title, description, badge, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {badge !== undefined && <IndicatorBadge variant={badge} />}
        </div>
        {description !== undefined && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      {action !== undefined && <div className="shrink-0">{action}</div>}
    </div>
  )
}
