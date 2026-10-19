export interface XFetchWrapper<T> {
  value: T;
  ttl: number;
  delta: number;
  computedAt: number;
  __isXFetchWrapper: boolean;
}

/**
 * XFetch probabilistic early expiration (Vattani, Chierichetti & Lowenstein,
 * VLDB 2015 — "Optimal Probabilistic Cache Stampede Prevention").
 *
 * The reference decision is:
 *     now − Δ·β·log(rand()) ≥ expiry
 *
 * `rand()` must be uniform on (0, 1] for `−log(rand())` to be exponentially
 * distributed with mean 1. `Math.random()` can return exactly 0, which makes
 * `log(0) = -Infinity` and forces a refresh on *every* read; clamping to
 * `Number.MIN_VALUE` keeps the sample strictly positive.
 *
 * Both `ttl` and `delta` are milliseconds, so the comparison is unit-consistent.
 */
export function shouldEarlyExpire(wrapper: XFetchWrapper<unknown>, beta?: number): boolean {
  const ttlRemaining = wrapper.computedAt + wrapper.ttl * 1000 - Date.now();
  if (ttlRemaining <= 0) return true; // already expired

  const b = beta ?? 1.0;
  const u = Math.max(Math.random(), Number.MIN_VALUE);
  return -b * wrapper.delta * Math.log(u) > ttlRemaining;
}
