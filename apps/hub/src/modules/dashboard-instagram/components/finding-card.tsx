'use client'

import type { JSX } from 'react'
import type { ContentFinding } from '../types/instagram.types'

// ── Icons (inline SVG) ────────────────────────────────────────────────────────

function FormatIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="16" y2="12" />
      <line x1="4" y1="17" x2="12" y2="17" />
    </svg>
  )
}

const ICONS: Record<ContentFinding['type'], () => JSX.Element> = {
  format: FormatIcon,
  posting_time: ClockIcon,
  top_commonality: TrophyIcon,
  caption_length: TextIcon,
}

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence, postCount }: { confidence: ContentFinding['confidence']; postCount: number }) {
  if (confidence === 'consistent') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-500/30 whitespace-nowrap">
        Patrón consistente · {postCount} posts
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-500/30 whitespace-nowrap">
      Señal tentativa · {postCount} posts
    </span>
  )
}

// ── FindingCard ───────────────────────────────────────────────────────────────

interface FindingCardProps {
  finding: ContentFinding
}

export function FindingCard({ finding }: FindingCardProps) {
  const Icon = ICONS[finding.type]

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow">
      {/* Top row: icon + badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="rounded-lg bg-primary/8 p-2 text-primary">
          <Icon />
        </div>
        <ConfidenceBadge confidence={finding.confidence} postCount={finding.postCount} />
      </div>

      {/* Key metric + pattern */}
      <div className="space-y-1">
        <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground leading-none">
          {finding.keyNumber}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {finding.pattern}
        </p>
      </div>

      {/* Action */}
      <div className="border-t border-border/60 pt-3">
        <p className="text-sm text-foreground font-medium leading-snug">
          <span className="text-muted-foreground mr-1">→</span>
          {finding.action}
        </p>
      </div>
    </div>
  )
}
