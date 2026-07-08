import { v4 as uuidv4 } from 'uuid';

const STORAGE_PREFIX = 'idempotency:';

export function generateIdempotencyKey(): string {
  return uuidv4();
}

export function getIdempotencyKey(scope: string): string {
  const storageKey = STORAGE_PREFIX + scope;
  const existing = localStorage.getItem(storageKey);
  if (existing !== null) {
    return existing;
  }
  const key = generateIdempotencyKey();
  localStorage.setItem(storageKey, key);
  return key;
}

export function resetIdempotencyKey(scope: string): void {
  const storageKey = STORAGE_PREFIX + scope;
  localStorage.removeItem(storageKey);
}
