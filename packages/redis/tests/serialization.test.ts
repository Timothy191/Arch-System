import {
  deserializeEnvelope,
  isEnvelopeVersionSupported,
  serializeEnvelope,
} from '../src/serialization';

describe('serialization', () => {
  it('round-trips envelope', () => {
    const raw = serializeEnvelope({ a: 1 });
    const out = deserializeEnvelope<{ a: number }>(raw);
    expect(out.version).toBe(1);
    expect(out.value).toEqual({ a: 1 });
  });

  it('reads legacy v0 payload', () => {
    const out = deserializeEnvelope<{ a: number }>(JSON.stringify({ a: 2 }));
    expect(out.version).toBe(0);
    expect(out.value).toEqual({ a: 2 });
  });

  it('checks version support', () => {
    expect(isEnvelopeVersionSupported(1)).toBe(true);
    expect(isEnvelopeVersionSupported(0)).toBe(true);
    expect(isEnvelopeVersionSupported(99)).toBe(false);
  });
});
