export interface XFetchWrapper<T> {
  value: T;
  ttl: number;
  delta: number;
  computedAt: number;
  __isXFetchWrapper: boolean;
}

export function shouldEarlyExpire(wrapper: XFetchWrapper<any>, beta?: number): boolean {
  const ttlRemaining = wrapper.computedAt + wrapper.ttl * 1000 - Date.now();
  if (ttlRemaining <= 0) return true; // already expired

  const b = beta ?? 1.0;
  return -b * wrapper.delta * Math.log(Math.random()) > ttlRemaining;
}
