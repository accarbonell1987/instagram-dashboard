export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): boolean
  increment(key: string, windowMs: number): void
  remaining(key: string, limit: number, windowMs: number): number
}
