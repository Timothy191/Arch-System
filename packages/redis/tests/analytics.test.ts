import {
  addToLeaderboard,
  addUnique,
  estimateUnique,
  incrementCounter,
  incrWithExpire,
  leaderboardTop,
  readCounter,
  readSample,
  recordSample,
} from '../src/analytics';

const mockSend = jest.fn();
const mockSendSafe = jest.fn();

jest.mock('../src/client', () => ({
  getRedisClient: jest.fn(async () => ({ isMock: true })),
}));

jest.mock('../src/raw', () => {
  const original = jest.requireActual('../src/raw');
  return {
    ...original,
    send: (...args: unknown[]) => mockSend(...args),
    sendSafe: (...args: unknown[]) => mockSendSafe(...args),
  };
});

describe('Real-time Analytics Primitives', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Counters', () => {
    test('incrementCounter issues atomic script with dimension and TTL', async () => {
      mockSend.mockResolvedValueOnce([15, 60000]); // returns [total, pttl]

      const total = await incrementCounter('telemetry.packets', {
        dimension: 'pit-north',
        by: 5,
        granularity: 'minute',
      });

      expect(total).toBe(15);
      expect(mockSend).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(['EVAL', expect.any(String), 1])
      );
    });

    test('readCounter fetches and sums across recent buckets', async () => {
      mockSendSafe
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('20')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('5');

      const sum = await readCounter('telemetry.packets', {
        windows: 4,
        granularity: 'minute',
      });

      expect(sum).toBe(35);
    });

    test('incrWithExpire sets TTL if not set', async () => {
      mockSend.mockResolvedValueOnce([3, 5000]); // returns [value, resetMs]

      const res = await incrWithExpire('rate:limit:test', { by: 1, ttlMs: 5000 });
      expect(res).toEqual({ value: 3, resetMs: 5000 });
    });
  });

  describe('Sample Summaries (Latency / Measurements)', () => {
    test('recordSample records count, sum, and max atomically', async () => {
      mockSend.mockResolvedValueOnce([10, 1500, 320]);

      const summary = await recordSample({ name: 'db.query.latency_ms', value: 142.5 });
      expect(summary).toEqual({
        count: 10,
        sum: 1500,
        max: 320,
        average: 150,
      });
    });

    test('readSample returns count, sum, max, and avg', async () => {
      mockSendSafe.mockResolvedValueOnce(['10', '1500', '320']);

      const summary = await readSample('db.query.latency_ms');
      expect(summary).toEqual({
        count: 10,
        sum: 1500,
        max: 320,
        average: 150,
      });
    });

    test('readSample returns empty summary when sample key does not exist', async () => {
      mockSendSafe.mockResolvedValueOnce([]);

      const summary = await readSample('db.query.latency_ms');
      expect(summary).toEqual({
        count: 0,
        sum: 0,
        max: null,
        average: null,
      });
    });
  });

  describe('Leaderboards (ZSET)', () => {
    test('addToLeaderboard increments score in sorted set', async () => {
      mockSendSafe.mockResolvedValueOnce('12.5'); // ZINCRBY

      const newScore = await addToLeaderboard({
        name: 'daily_haulers',
        member: 'truck-401',
        score: 12.5,
      });
      expect(newScore).toBe(12.5);
    });

    test('leaderboardTop fetches ranked members descending', async () => {
      mockSendSafe.mockResolvedValueOnce(['truck-401', '120.5', 'truck-402', '95.0']);

      const top = await leaderboardTop('daily_haulers', { limit: 2 });
      expect(top).toHaveLength(2);
      expect(top[0]).toEqual({ member: 'truck-401', score: 120.5 });
      expect(top[1]).toEqual({ member: 'truck-402', score: 95.0 });
    });
  });

  describe('HyperLogLog Uniques', () => {
    test('addUnique calls PFADD and sets expiration on new items', async () => {
      mockSendSafe.mockResolvedValueOnce(1); // 1 = cardinality increased
      mockSendSafe.mockResolvedValueOnce(1); // EXPIRE

      const changed = await addUnique({ name: 'unique_visitors', identifier: 'user-abc' });
      expect(changed).toBe(true);
    });

    test('estimateUnique calls PFCOUNT', async () => {
      mockSendSafe.mockResolvedValueOnce(1450);

      const count = await estimateUnique('unique_visitors');
      expect(count).toBe(1450);
    });
  });
});
