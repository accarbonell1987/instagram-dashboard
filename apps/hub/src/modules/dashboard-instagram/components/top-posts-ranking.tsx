'use client';

import { useState } from 'react';
import type { TopPost } from '../types/instagram.types';

interface TopPostsRankingProps {
  ranking: TopPost[];
  onPostClick?: (igMediaId: string) => void;
}

type SortMode = 'absolute' | 'efficiency' | 'score';

const SORT_MODES: { key: SortMode; label: string; sublabel: string }[] = [
  { key: 'absolute',   label: 'Absoluto',   sublabel: 'saves + shares' },
  { key: 'efficiency', label: 'Por reach',  sublabel: 'saves+shares / reach' },
  { key: 'score',      label: 'Score',      sublabel: '×3 saves, ×3 shares, ×2 cmts, ×1 likes' },
];

function formatMediaType(type: string): string {
  if (type === 'CAROUSEL_ALBUM') return 'Carrusel';
  if (type === 'VIDEO') return 'Reel';
  return 'Imagen';
}

function computeValue(post: TopPost, mode: SortMode): number {
  switch (mode) {
    case 'absolute':   return post.totalEngagement;
    case 'efficiency': return post.reach > 0 ? (post.totalEngagement / post.reach) * 100 : 0;
    case 'score':      return post.saves * 3 + post.shares * 3 + post.comments * 2 + post.likes;
  }
}

function formatValue(post: TopPost, mode: SortMode): string {
  switch (mode) {
    case 'absolute':
      return post.totalEngagement.toLocaleString();
    case 'efficiency': {
      if (post.reach === 0) return '—';
      return `${((post.totalEngagement / post.reach) * 100).toFixed(1)}%`;
    }
    case 'score':
      return (post.saves * 3 + post.shares * 3 + post.comments * 2 + post.likes).toLocaleString();
  }
}

function computeCommonality(top3: TopPost[]): string | null {
  if (top3.length < 2) return null;

  const typeCounts = top3.reduce<Record<string, number>>((acc, p) => {
    const t = formatMediaType(p.mediaType);
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const [dominantType, dominantCount] = sorted[0] ?? ['', 0];

  if (dominantCount === top3.length) {
    return `Tus ${top3.length} mejores son ${dominantType.toLowerCase()} → repetí ese formato para maximizar guardados y compartidos.`;
  }
  if (dominantCount >= 2) {
    return `La mayoría de tus mejores posts son ${dominantType.toLowerCase()} → apostá a ese formato.`;
  }
  return 'Tus mejores posts están distribuidos entre formatos — cualquier formato puede funcionar bien.';
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

function Thumbnail({ url, mediaType }: { url: string | null; mediaType: string }) {
  const initial = formatMediaType(mediaType).charAt(0).toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-10 w-10 rounded-md object-cover flex-shrink-0 bg-muted"
        loading="lazy"
      />
    );
  }

  return (
    <div className="h-10 w-10 rounded-md flex-shrink-0 bg-muted/50 flex items-center justify-center text-xs font-semibold text-muted-foreground">
      {initial}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-sm font-semibold mb-2">Top Publicaciones</h3>
      <p className="text-sm text-muted-foreground">
        Conectá tu cuenta y sincronizá para ver tu ranking.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TopPostsRanking({ ranking, onPostClick }: TopPostsRankingProps) {
  const [mode, setMode] = useState<SortMode>('absolute');

  if (!ranking || ranking.length === 0) return <EmptyState />;

  const sorted = [...ranking].sort((a, b) => computeValue(b, mode) - computeValue(a, mode));
  const maxValue = Math.max(...sorted.map((p) => computeValue(p, mode)), 1);
  const top3 = sorted.slice(0, 3);
  const commonality = computeCommonality(top3);
  const currentMode = SORT_MODES.find((m) => m.key === mode)!;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold">
          Top {sorted.length} — Saves + Shares
        </h3>
        <span className="text-xs text-muted-foreground/60">
          {sorted.length} {sorted.length === 1 ? 'publicación' : 'publicaciones'}
        </span>
      </div>

      {/* Sort toggle */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Modo de ordenamiento">
        {SORT_MODES.map(({ key, label, sublabel }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            title={sublabel}
            aria-pressed={mode === key}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              mode === key
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted/80',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Ranking list */}
      <ol className="space-y-2" aria-label={`Ranking por ${currentMode.label}`}>
        {sorted.map((post, index) => {
          const value = computeValue(post, mode);
          const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const displayValue = formatValue(post, mode);
          const label = post.caption?.trim().slice(0, 55) ?? formatMediaType(post.mediaType);

          const itemContent = (
            <>
              {/* Rank */}
              <span
                className="w-5 text-center text-xs font-medium tabular-nums text-muted-foreground/50 flex-shrink-0"
                aria-hidden="true"
              >
                {index + 1}
              </span>

              {/* Thumbnail */}
              <Thumbnail url={post.thumbnailUrl} mediaType={post.mediaType} />

              {/* Label + bar */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-foreground/80 truncate leading-tight">
                    {label}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400 flex-shrink-0">
                    {displayValue}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400/70 transition-[width] duration-300"
                    style={{ width: `${barWidth}%` }}
                    aria-hidden="true"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/50 leading-none">
                  {formatMediaType(post.mediaType)}
                  {mode === 'absolute' && ` · ${post.saves} saves · ${post.shares} shares`}
                  {mode === 'efficiency' && post.reach > 0 && ` · ${post.reach.toLocaleString()} reach`}
                </p>
              </div>
            </>
          );

          const interactiveClass =
            'flex items-center gap-3 rounded-lg p-1.5 -mx-1.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer w-full text-left';

          return (
            <li key={post.igMediaId}>
              {onPostClick ? (
                <button
                  type="button"
                  onClick={() => onPostClick(post.id)}
                  className={interactiveClass}
                  aria-label={`Post ${index + 1}: ${label} (${displayValue})`}
                >
                  {itemContent}
                </button>
              ) : post.permalink ? (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={interactiveClass}
                  aria-label={`Post ${index + 1}: ${label} (${displayValue})`}
                >
                  {itemContent}
                </a>
              ) : (
                <div className="flex items-center gap-3 rounded-lg p-1.5 -mx-1.5">
                  {itemContent}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Commonality finding */}
      {commonality && (
        <div className="rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/30 px-4 py-3">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-0.5">
            Qué comparten los mejores
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
            {commonality}
          </p>
        </div>
      )}

      {/* Metric note */}
      <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
        {currentMode.sublabel}
        {mode === 'efficiency' && ' · Celdas sin reach suficiente muestran —'}
      </p>
    </div>
  );
}
