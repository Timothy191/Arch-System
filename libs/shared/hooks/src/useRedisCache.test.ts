import {
  clearClientCache,
  clientCache,
  getClientCacheEntry,
  MAX_CACHE_ENTRIES,
  setClientCacheEntry,
} from './useRedisCache';

describe('useRedisCache bounded L1 clientCache', () => {
  beforeEach(() => {
    clearClientCache();
  });

  describe('Given an empty clientCache', () => {
    it('When setting and retrieving a valid entry before expiration, Then it returns the entry and refreshes LRU order', () => {
      const now = 1_000_000;
      setClientCacheEntry('key-1', { data: { value: 42 }, expiresAt: now + 5000 }, now);
      setClientCacheEntry('key-2', { data: { value: 99 }, expiresAt: now + 5000 }, now);

      // Access key-1 to promote it to most-recently-used
      const retrieved = getClientCacheEntry('key-1', now + 1000);
      expect(retrieved).toBeDefined();
      expect(retrieved?.data).toEqual({ value: 42 });

      // Verify key-2 is now the oldest key in Map iteration order
      const keys = Array.from(clientCache.keys());
      expect(keys).toEqual(['key-2', 'key-1']);
    });

    it('When retrieving an expired entry, Then it deletes the entry and returns undefined', () => {
      const now = 1_000_000;
      setClientCacheEntry('expired-key', { data: 'stale', expiresAt: now + 1000 }, now);

      expect(clientCache.has('expired-key')).toBe(true);

      const retrieved = getClientCacheEntry('expired-key', now + 1000);
      expect(retrieved).toBeUndefined();
      expect(clientCache.has('expired-key')).toBe(false);
    });
  });

  describe('Given a clientCache at MAX_CACHE_ENTRIES capacity', () => {
    it('When inserting new entries beyond MAX_CACHE_ENTRIES, Then it evicts the least-recently-used entries and never exceeds MAX_CACHE_ENTRIES', () => {
      const now = 2_000_000;

      for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
        setClientCacheEntry(`key-${i}`, { data: i, expiresAt: now + 60_000 }, now);
      }

      expect(clientCache.size).toBe(MAX_CACHE_ENTRIES);

      // Touch key-0 so it becomes the most recently used
      expect(getClientCacheEntry('key-0', now + 10)?.data).toBe(0);

      // Insert one more entry; key-1 should be evicted since key-0 was refreshed
      setClientCacheEntry('key-overflow', { data: 'overflow', expiresAt: now + 60_000 }, now + 20);

      expect(clientCache.size).toBe(MAX_CACHE_ENTRIES);
      expect(clientCache.has('key-0')).toBe(true);
      expect(clientCache.has('key-1')).toBe(false);
      expect(clientCache.get('key-overflow')?.data).toBe('overflow');
    });

    it('When inserting a new entry when expired entries exist at capacity, Then it purges expired entries first without evicting valid LRU entries', () => {
      const now = 3_000_000;

      // Insert 10 short-lived entries and 90 long-lived entries
      for (let i = 0; i < 10; i++) {
        setClientCacheEntry(`short-${i}`, { data: i, expiresAt: now + 500 }, now);
      }
      for (let i = 10; i < MAX_CACHE_ENTRIES; i++) {
        setClientCacheEntry(`long-${i}`, { data: i, expiresAt: now + 60_000 }, now);
      }

      expect(clientCache.size).toBe(MAX_CACHE_ENTRIES);

      // Advance time past short-lived TTL and insert a new entry
      const later = now + 1000;
      setClientCacheEntry('fresh-entry', { data: 'fresh', expiresAt: later + 60_000 }, later);

      // All 10 expired entries should be purged, leaving 90 long + 1 fresh = 91
      expect(clientCache.size).toBe(MAX_CACHE_ENTRIES - 10 + 1);
      expect(clientCache.has('short-0')).toBe(false);
      expect(clientCache.has('long-10')).toBe(true);
      expect(clientCache.has('fresh-entry')).toBe(true);
    });
  });
});
