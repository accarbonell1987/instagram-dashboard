'use client';

import type { InsightResult } from '../types/instagram.types';

interface InsightCardProps {
  insight?: InsightResult;
}

export function InsightCard({ insight }: InsightCardProps) {
  if (!insight || !insight.insight) {
    return (
      <div className="bg-card border rounded-xl p-6">
        <p className="text-sm text-muted-foreground">
          Sincronizá más publicaciones para recibir insights personalizados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
      <p className="text-sm leading-relaxed">{insight.insight}</p>
      <p className="text-xs text-muted-foreground mt-2">
        Generado: {new Date(insight.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
