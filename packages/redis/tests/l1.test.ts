import {
  clearMemoryCache,
  L1_MAX_ENTRIES,
  memoryGet,
  memoryRawSize,
  memorySet,
  memorySweep,
  readMemory,
  startL1Sweep,
  stopL1Sweep,
} from '../src/l1';
import { cacheCategoryFromKey, DEFAULT_L1_TTL_SECONDS, l1TtlForKey } from '../src/registry';

describe('L1 in-memory cache', () => {
  beforeEach(() => {
    clearMemoryCache();
  });

  describe('Finding 2: presence vs. truthiness', () => {
    it('distinguishes a cached falsy value from a miss', () => {
      for (const falsy of [0, false, '', null]) {
        const key = `arch:metrics:falsy:${String(falsy)}`;
        memorySet(key, falsy, 30);

        const read = readMemory(key);
        expect(read.hit).toBe(true);
        if (read.hit) expect(read.value).toBe(falsy);
      }
    });

    it('reports a miss only when the key is absent or expired', () => {
      expect(readMemory('absent').hit).toBe(false);

      memorySet('expiring', 'v', -1);
      expect(readMemory('expiring').hit).toBe(false);
    });
  });

  describe('Finding 5: true LRU eviction', () => {
    it('evicts the least recently used entry, not the oldest inserted', () => {
      // Fill to capacity.
      for (let i = 0; i < L1_MAX_ENTRIES; i++) {
        memorySet(`k${i}`, i, 30);
      }
      expect(memoryRawSize()).toBe(L1_MAX_ENTRIES);

      // Touch k0 so it becomes the most recently used.
      expect(memoryGet('k0')).toBe(0);

      // Insert one more -> k1 (now the LRU) must be the eviction victim.
      memorySet('overflow', 'x', 30);

      expect(memoryGet('k0')).toBe(0);
      expect(memoryGet('k1')).toBeNull();
      expect(memoryGet('overflow')).toBe('x');
    });

    it('never exceeds the configured bound', () => {
      for (let i = 0; i < L1_MAX_ENTRIES * 2; i++) {
        memorySet(`bulk${i}`, i, 30);
        expect(memoryRawSize()).toBeLessThanOrEqual(L1_MAX_ENTRIES);
      }
    });

    it('reclaims expired entries on sweep', () => {
      memorySet('stale', 'v', -1);
      memorySet('fresh', 'v', 60);

      expect(memorySweep()).toBe(1);
      expect(readMemory('fresh').hit).toBe(true);
    });

    it('periodically sweeps expired L1 entries via startL1Sweep and cleans up via stopL1Sweep', () => {
      jest.useFakeTimers();
      try {
        memorySet('expired-entry', 'v', -1);
        memorySet('live-entry', 'v', 120);
        const onSweep = jest.fn();

        startL1Sweep(1_000, onSweep);
        jest.advanceTimersByTime(1_050);

        expect(onSweep).toHaveBeenCalledWith(1);
        expect(memoryRawSize()).toBe(1);
      } finally {
        stopL1Sweep();
        jest.useRealTimers();
      }
    });
  });
});

describe('TTL registry', () => {
  it('recovers the category encoded in a built cache key', () => {
    expect(cacheCategoryFromKey('arch:dept:drilling:uuid')).toBe('dept');
    expect(cacheCategoryFromKey('arch:auth:employee:42')).toBe('auth');
  });

  it('returns undefined for keys outside the registry', () => {
    expect(cacheCategoryFromKey('dept:uuid:drilling')).toBeUndefined();
    expect(cacheCategoryFromKey('telemetry:last:x')).toBeUndefined();
    expect(cacheCategoryFromKey('arch:unknown:thing')).toBeUndefined();
  });

  it('honours the per-category l1Seconds that used to be dead config', () => {
    // DEPARTMENT l1Seconds is 60, AUTH is 60, METRICS is 15, AI_MEMORY is 10.
    expect(l1TtlForKey('arch:dept:drilling')).toBe(60);
    expect(l1TtlForKey('arch:metrics:telemetry')).toBe(15);
    expect(l1TtlForKey('arch:ai_memory:chat')).toBe(10);
  });

  it('falls back to the default for unregistered keys', () => {
    expect(l1TtlForKey('telemetry:last:x')).toBe(DEFAULT_L1_TTL_SECONDS);
  });

  it('never returns an L1 TTL longer than the L2 TTL it is shadowing', () => {
    expect(l1TtlForKey('arch:dept:drilling', 5)).toBe(5);
    expect(l1TtlForKey('arch:dept:drilling', 1)).toBe(1);
  });
});
