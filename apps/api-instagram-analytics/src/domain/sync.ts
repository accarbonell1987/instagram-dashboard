export interface SyncStatus {
  status: 'idle' | 'syncing' | 'paused' | 'error';
  lastSyncAt: string | null;
  mediaCount: number;
  nextSyncAvailableAt: string | null;
}

export interface SyncTriggerResult {
  syncId: string;
  status: 'started' | 'already_running' | 'rate_limited';
}
