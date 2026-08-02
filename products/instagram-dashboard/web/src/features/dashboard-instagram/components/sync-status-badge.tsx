'use client';

import { Button } from '@core/ui';
import { RefreshCw } from 'lucide-react';

import type { SyncState } from '../types/instagram.types';

interface SyncStatusBadgeProps {
  syncState: SyncState | null;
  onTriggerSync: () => Promise<void>;
  isTriggering: boolean;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'idle':
      return 'Actualizado';
    case 'syncing':
      return 'Sincronizando...';
    case 'paused':
      return 'En pausa';
    case 'error':
      return 'Error de sincronización';
    default:
      return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'idle':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'syncing':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'paused':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'error':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function SyncStatusBadge({
  syncState,
  onTriggerSync,
  isTriggering,
}: SyncStatusBadgeProps) {
  if (!syncState) return null;

  const isSyncing = syncState.status === 'syncing';
  const tooltipText = syncState.lastSyncAt
    ? `Última sincronización: ${new Date(syncState.lastSyncAt).toLocaleString()}`
    : 'Sin datos de sincronización';

  return (
    <div className="flex items-center gap-2">
      {/* Status badge with native tooltip showing last sync date */}
      <span
        title={tooltipText}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-default ${getStatusColor(syncState.status)}`}
      >
        {isSyncing && (
          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {getStatusLabel(syncState.status)}
      </span>

      {/* Sync button — icon only with native tooltip */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onTriggerSync}
        disabled={isSyncing || isTriggering}
        title={isTriggering ? 'Iniciando...' : 'Sincronizar ahora'}
        className="text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
        aria-label="Sincronizar ahora"
      >
        <RefreshCw className={`h-4 w-4 ${isTriggering ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
