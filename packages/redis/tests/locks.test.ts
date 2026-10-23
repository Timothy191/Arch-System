import {
  abandonIdempotency,
  acquireLock,
  acquireRefreshLease,
  claimIdempotency,
  completeIdempotency,
  LockUnavailableError,
  readIdempotencyResult,
  releaseLock,
  releaseRefreshLease,
  renewLock,
  tryWithLock,
  withLock,
} from '../src/locks';

const mockSend = jest.fn();
const mockSendSafe = jest.fn();
const mockIncrementCounter = jest.fn();

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

jest.mock('../src/analytics', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
}));

describe('Distributed Locks & Idempotency Primitives', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('acquireLock and releaseLock', () => {
    test('acquires a distributed lock successfully on first try', async () => {
      mockSend.mockResolvedValueOnce('OK'); // SET NX PX

      const handle = await acquireLock('shift:closeout:123', { ttlMs: 5000 });
      expect(handle).not.toBeNull();
      expect(handle?.name).toBe('shift:closeout:123');
      expect(handle?.key).toBe('arch:lock:shift:closeout:123');
      expect(typeof handle?.token).toBe('string');
      expect(handle?.fencingToken).toBeNull();
    });

    test('acquires a distributed lock with fencing token', async () => {
      mockSend.mockResolvedValueOnce(42); // EVAL fence script returns 42

      const handle = await acquireLock('shift:closeout:123', { fencing: true });
      expect(handle?.fencingToken).toBe(42);
    });

    test('returns null when lock is already held and no retries requested', async () => {
      mockSend.mockResolvedValueOnce(null); // SET NX returns null (key exists)

      const handle = await acquireLock('shift:closeout:123', { retries: 0 });
      expect(handle).toBeNull();
      expect(mockIncrementCounter).toHaveBeenCalledWith('lock.contended', expect.anything());
    });

    test('releases lock only when token matches via Lua', async () => {
      mockSend.mockResolvedValueOnce(1); // Lua returns 1 (deleted)

      const fakeHandle = {
        name: 'shift:closeout:123',
        key: 'arch:lock:shift:closeout:123',
        token: 'token-abc',
        fencingToken: null,
        acquiredAt: Date.now(),
        ttlMs: 5000,
      };

      const released = await releaseLock(fakeHandle);
      expect(released).toBe(true);
    });

    test('renewLock extends TTL if token still owns lock', async () => {
      mockSend.mockResolvedValueOnce(1); // Lua returns 1 (extended)

      const fakeHandle = {
        name: 'shift:closeout:123',
        key: 'arch:lock:shift:closeout:123',
        token: 'token-abc',
        fencingToken: null,
        acquiredAt: Date.now(),
        ttlMs: 5000,
      };

      const renewed = await renewLock(fakeHandle, 10_000);
      expect(renewed).toBe(true);
    });
  });

  describe('withLock and tryWithLock', () => {
    test('withLock executes callback and automatically releases lock', async () => {
      mockSend.mockResolvedValueOnce('OK'); // acquireLock
      mockSend.mockResolvedValueOnce(1); // releaseLock

      const fn = jest.fn().mockResolvedValue('success');
      const result = await withLock({ name: 'job-run', ttlMs: 5_000 }, fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('withLock throws LockUnavailableError when lock cannot be acquired', async () => {
      mockSend.mockResolvedValueOnce(null); // acquireLock failed

      const fn = jest.fn();
      await expect(withLock({ name: 'job-run' }, fn)).rejects.toThrow(LockUnavailableError);
      expect(fn).not.toHaveBeenCalled();
    });

    test('tryWithLock returns null without throwing on contention', async () => {
      mockSend.mockResolvedValueOnce(null); // acquireLock failed

      const fn = jest.fn();
      const result = await tryWithLock({ name: 'job-run' }, fn);

      expect(result).toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('Idempotency Lifecycle', () => {
    test('claimIdempotency acquires fresh claim', async () => {
      mockSend.mockResolvedValueOnce('OK'); // SET NX EX returns OK

      const claim = await claimIdempotency('mutation:uuid-1');
      expect(claim).toBe('new');
    });

    test('claimIdempotency detects already completed duplicate operation', async () => {
      mockSend.mockResolvedValueOnce(null); // SET NX failed
      mockSendSafe.mockResolvedValueOnce('{"status":"done"}'); // GET value is completed JSON

      const claim = await claimIdempotency('mutation:uuid-1');
      expect(claim).toBe('duplicate');
    });

    test('claimIdempotency reports in-flight when lock is currently being processed', async () => {
      mockSend.mockResolvedValueOnce(null); // SET NX failed
      mockSendSafe.mockResolvedValueOnce('__in_flight__'); // GET value

      const claim = await claimIdempotency('mutation:uuid-1');
      expect(claim).toBe('in-flight');
    });

    test('completeIdempotency stores JSON result', async () => {
      mockSendSafe.mockResolvedValueOnce('OK');

      await completeIdempotency({
        key: 'mutation:uuid-1',
        result: { ok: true },
        ttlSeconds: 3600,
      });
      expect(mockSendSafe).toHaveBeenCalledWith(expect.anything(), [
        'SET',
        'arch:idem:mutation:uuid-1',
        '{"ok":true}',
        'EX',
        3600,
      ]);
    });

    test('abandonIdempotency deletes key so caller can retry', async () => {
      mockSendSafe.mockResolvedValueOnce(1);

      await abandonIdempotency('mutation:uuid-1');
      expect(mockSendSafe).toHaveBeenCalledWith(expect.anything(), [
        'DEL',
        'arch:idem:mutation:uuid-1',
      ]);
    });

    test('readIdempotencyResult parses stored JSON', async () => {
      mockSendSafe.mockResolvedValueOnce('{"status":"success"}');
      const res = await readIdempotencyResult<{ status: string }>('mutation:uuid-1');
      expect(res).toEqual({ status: 'success' });
    });
  });

  describe('Refresh Leases', () => {
    test('acquireRefreshLease and releaseRefreshLease operate smoothly', async () => {
      mockSend.mockResolvedValueOnce('OK'); // acquire
      const acquired = await acquireRefreshLease('dashboards:production');
      expect(acquired).toBe(true);

      mockSendSafe.mockResolvedValueOnce(1); // release
      await releaseRefreshLease('dashboards:production');
      expect(mockSendSafe).toHaveBeenCalledWith(expect.anything(), [
        'DEL',
        'arch:lease:refresh:dashboards:production',
      ]);
    });
  });
});
