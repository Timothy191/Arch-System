// packages/redis/src/serialization.ts
export const ENVELOPE_VERSION = 1 as const;

export interface Envelope<T> {
  v: number;
  d: T;
}

export function serializeEnvelope<T>(payload: T): string {
  return JSON.stringify({ v: ENVELOPE_VERSION, d: payload });
}

export function deserializeEnvelope<T>(raw: string): { version: number; value: T } {
  try {
    const parsed = JSON.parse(raw) as { v?: number; d?: unknown };
    if (typeof parsed?.v === 'number' && 'd' in (parsed ?? {})) {
      return { version: parsed.v, value: parsed.d as T };
    }
    return { version: 0, value: JSON.parse(raw) as T };
  } catch {
    return { version: 0, value: raw as unknown as T };
  }
}

export function isEnvelopeVersionSupported(version: number, known = ENVELOPE_VERSION): boolean {
  return version === 0 || version === known;
}
