import { assertSameSlot, executeWithClusterRedirect, parseClusterRedirect } from '../src/cluster';

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

describe('parseClusterRedirect', () => {
  it('parses MOVED redirect from Error', () => {
    const redirect = parseClusterRedirect(new Error('MOVED 3999 127.0.0.1:6381'));
    expect(redirect).toEqual({
      kind: 'MOVED',
      slot: 3999,
      host: '127.0.0.1',
      port: 6381,
      address: '127.0.0.1:6381',
    });
  });

  it('parses ASK redirect from string message', () => {
    const redirect = parseClusterRedirect('ASK 1234 10.0.0.2:6379');
    expect(redirect).toEqual({
      kind: 'ASK',
      slot: 1234,
      host: '10.0.0.2',
      port: 6379,
      address: '10.0.0.2:6379',
    });
  });

  it('returns null for non-redirect error', () => {
    expect(parseClusterRedirect(new Error('ECONNREFUSED'))).toBeNull();
    expect(parseClusterRedirect(null)).toBeNull();
  });
});

describe('executeWithClusterRedirect', () => {
  it('returns result when command succeeds immediately', async () => {
    const executeNodeCommand = jest.fn(async () => 'OK');
    const result = await executeWithClusterRedirect({ executeNodeCommand });
    expect(result).toBe('OK');
    expect(executeNodeCommand).toHaveBeenCalledTimes(1);
    expect(executeNodeCommand).toHaveBeenCalledWith({
      redirect: undefined,
      requiresAsking: false,
      attempt: 0,
    });
  });

  it('follows MOVED redirect to completion', async () => {
    const executeNodeCommand = jest
      .fn()
      .mockRejectedValueOnce(new Error('MOVED 5000 127.0.0.1:7001'))
      .mockResolvedValueOnce('OK');

    const result = await executeWithClusterRedirect({ executeNodeCommand });
    expect(result).toBe('OK');
    expect(executeNodeCommand).toHaveBeenCalledTimes(2);
    expect(executeNodeCommand).toHaveBeenNthCalledWith(2, {
      redirect: {
        kind: 'MOVED',
        slot: 5000,
        host: '127.0.0.1',
        port: 7001,
        address: '127.0.0.1:7001',
      },
      requiresAsking: false,
      attempt: 1,
    });
  });

  it('follows ASK redirect with requiresAsking: true', async () => {
    const executeNodeCommand = jest
      .fn()
      .mockRejectedValueOnce(new Error('ASK 5000 127.0.0.1:7002'))
      .mockResolvedValueOnce('PONG');

    const result = await executeWithClusterRedirect({ executeNodeCommand });
    expect(result).toBe('PONG');
    expect(executeNodeCommand).toHaveBeenCalledTimes(2);
    expect(executeNodeCommand).toHaveBeenNthCalledWith(2, {
      redirect: {
        kind: 'ASK',
        slot: 5000,
        host: '127.0.0.1',
        port: 7002,
        address: '127.0.0.1:7002',
      },
      requiresAsking: true,
      attempt: 1,
    });
  });

  it('throws Cluster redirect limit exceeded when max redirects is exceeded', async () => {
    const executeNodeCommand = jest.fn().mockRejectedValue(new Error('MOVED 5000 127.0.0.1:7001'));

    await expect(
      executeWithClusterRedirect({ executeNodeCommand, maxRedirects: 2 })
    ).rejects.toThrow('Cluster redirect limit exceeded');
    expect(executeNodeCommand).toHaveBeenCalledTimes(3);
  });
});
