import { assertSameSlot } from '../src/cluster';

describe('cluster assertSameSlot', () => {
  it('returns true for empty', () => {
    expect(assertSameSlot([])).toBe(true);
  });
  it('returns true for same slot tag', () => {
    expect(assertSameSlot(['arch:{user}:a', 'arch:{user}:b'])).toBe(true);
  });
  it('throws for different slot tags', () => {
    expect(() => assertSameSlot(['arch:{a}:x', 'arch:{b}:y'])).toThrow();
  });
});
