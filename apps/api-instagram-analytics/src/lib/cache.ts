interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is the caller-facing cache value type
export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is the caller-facing cache value type
export function setCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

// For debugging/testing
export function clearAllCache(): void {
  store.clear();
}
