'use client';

import type { HeatmapCell } from '../types/instagram.types';

interface PostingHeatmapProps {
  cells: HeatmapCell[];
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

const SLOTS = [
  { label: 'Madrugada', detail: '00–06', slotIndex: 0 },
  { label: 'Mañana',    detail: '06–12', slotIndex: 1 },
  { label: 'Tarde',     detail: '12–18', slotIndex: 2 },
  { label: 'Noche',     detail: '18–24', slotIndex: 3 },
] as const;

// Below this per-cell post count → low-confidence visual treatment
const MIN_POSTS_RELIABLE = 3;
// Below this total post count → show insufficient-data state instead of grid
const MIN_POSTS_TOTAL = 8;

function getCellStyle(value: number, max: number): string {
  if (value === 0) return 'bg-muted/20';
  const r = value / max;
  if (r > 0.75) return 'bg-amber-500/75';
  if (r > 0.5)  return 'bg-amber-400/65';
  if (r > 0.25) return 'bg-amber-300/55';
  return 'bg-amber-200/50';
}

// ── Insufficient data state ───────────────────────────────────────────────────

function InsufficientDataState({ totalPosts }: { totalPosts: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-3">
      <h3 className="text-sm font-semibold">Mejores Horarios para Publicar</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Necesitás más publicaciones para detectar tu mejor ventana.
        Por ahora, priorizá publicar de forma consistente.
      </p>
      <p className="text-xs text-muted-foreground/60">
        {totalPosts > 0
          ? `${totalPosts} post${totalPosts !== 1 ? 's' : ''} registrado${totalPosts !== 1 ? 's' : ''}. Se necesitan al menos ${MIN_POSTS_TOTAL} para un análisis útil.`
          : 'Sin datos aún.'}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PostingHeatmap({ cells }: PostingHeatmapProps) {
  const totalPosts = cells.reduce((s, c) => s + c.postCount, 0);

  if (totalPosts < MIN_POSTS_TOTAL) {
    return <InsufficientDataState totalPosts={totalPosts} />;
  }

  const maxValue = Math.max(...cells.map((c) => c.totalSavesShares), 1);

  const grid = Array.from({ length: 7 }, (_, day) =>
    SLOTS.map(({ slotIndex }) =>
      cells.find((c) => c.dayIndex === day && c.slotIndex === slotIndex) ?? null,
    ),
  );

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">

      {/* Title + secondary-lever framing */}
      <div>
        <h3 className="text-sm font-semibold">Mejores Horarios para Publicar</h3>
        <p className="text-xs text-muted-foreground mt-1">
          El horario es un multiplicador del contenido, no la base.
          La consistencia le gana al minuto exacto.
        </p>
      </div>

      {/* Reels note */}
      <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        <span className="font-medium">Reels:</span>{' '}
        el algoritmo distribuye el contenido a lo largo del tiempo, por lo que el horario
        de publicación pesa poco. Este análisis es más útil para carruseles e imágenes de feed.
      </div>

      {/* Heatmap grid */}
      <div>
        {/* Column headers */}
        <div className="grid grid-cols-[52px_repeat(4,1fr)] gap-1 mb-2">
          <div />
          {SLOTS.map(({ label, detail }) => (
            <div key={label} className="text-center">
              <div className="text-[11px] font-medium text-foreground/70">{label}</div>
              <div className="text-[10px] text-muted-foreground/60">{detail}</div>
            </div>
          ))}
        </div>

        {/* Rows */}
        {grid.map((row, dayIdx) => (
          <div key={dayIdx} className="grid grid-cols-[52px_repeat(4,1fr)] gap-1 mt-1">
            <div className="text-xs text-muted-foreground flex items-center">
              {DAY_LABELS[dayIdx]}
            </div>
            {row.map((cell, slotIdx) => {
              const value = cell?.totalSavesShares ?? 0;
              const count = cell?.postCount ?? 0;
              const isLowConfidence = count > 0 && count < MIN_POSTS_RELIABLE;
              const slot = SLOTS[slotIdx];

              return (
                <div
                  key={slotIdx}
                  className={[
                    getCellStyle(value, maxValue),
                    'rounded p-1.5 min-h-[40px] flex flex-col items-center justify-center gap-0.5 transition-opacity',
                    isLowConfidence ? 'opacity-50' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  title={
                    count > 0
                      ? `${DAY_LABELS[dayIdx]} ${slot?.label}: ${count} post${count !== 1 ? 's' : ''}${isLowConfidence ? ' · pocos datos' : ''}`
                      : `${DAY_LABELS[dayIdx]} ${slot?.label}: sin datos`
                  }
                >
                  {count > 0 && (
                    <span
                      className={`text-[10px] leading-none ${isLowConfidence ? 'text-muted-foreground/50' : 'text-foreground/60'}`}
                    >
                      {count}
                    </span>
                  )}
                  {isLowConfidence && (
                    <span className="text-[9px] text-muted-foreground/40 leading-none">~</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Menos</span>
          <div className="flex gap-0.5">
            {[
              'bg-muted/20',
              'bg-amber-200/50',
              'bg-amber-300/55',
              'bg-amber-400/65',
              'bg-amber-500/75',
            ].map((c, i) => (
              <div key={i} className={`h-3 w-4 rounded-sm ${c}`} />
            ))}
          </div>
          <span>Más saves + shares</span>
        </div>
        <p className="text-muted-foreground/50">
          Número = posts publicados en esa ventana · ~ = menos de {MIN_POSTS_RELIABLE} posts (dato poco confiable)
        </p>
      </div>
    </div>
  );
}
