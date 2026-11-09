import type { QueuedRequest } from '@repo/shared/hooks';
import { initOfflineQueueListeners, useOfflineQueue } from '@repo/shared/hooks';

const mockToastInfo = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    info: (...args: unknown[]) => mockToastInfo(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

function makeRequest(overrides: Partial<QueuedRequest> = {}): QueuedRequest {
  return {
    id: 'req-1',
    url: '/api/sync',
    method: 'POST',
    body: '{}',
    timestamp: 1,
    description: 'sync test',
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;

function mockFetch(impl: () => Promise<{ ok: boolean }>) {
  globalThis.fetch = impl as unknown as typeof fetch;
}

describe('useOfflineQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    useOfflineQueue.setState({
      queue: [],
      deadLetterQueue: [],
      isOnline: true,
      isSyncing: false,
    });
    mockToastInfo.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('enqueues a request with an id, timestamp, and toast', () => {
    useOfflineQueue.getState().enqueue({ url: '/api/sync', method: 'POST', description: 'x' });
    const { queue } = useOfflineQueue.getState();
    expect(queue).toHaveLength(1);
    expect(queue[0]!.url).toBe('/api/sync');
    expect(queue[0]!.id).toEqual(expect.any(String));
    expect(mockToastInfo).toHaveBeenCalledWith(expect.stringContaining('x'));
  });

  it('dequeues a request by id', () => {
    useOfflineQueue.setState({ queue: [makeRequest(), makeRequest({ id: 'req-2' })] });
    useOfflineQueue.getState().dequeue('req-1');
    expect(useOfflineQueue.getState().queue.map((r) => r.id)).toEqual(['req-2']);
  });

  it('clearQueue empties the queue', () => {
    useOfflineQueue.setState({ queue: [makeRequest()] });
    useOfflineQueue.getState().clearQueue();
    expect(useOfflineQueue.getState().queue).toHaveLength(0);
  });

  it('setOnlineStatus updates the status', () => {
    useOfflineQueue.getState().setOnlineStatus(false);
    expect(useOfflineQueue.getState().isOnline).toBe(false);
  });

  it('sync is a no-op when offline', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    mockFetch(fetchMock);
    useOfflineQueue.setState({ isOnline: false, queue: [makeRequest()] });
    await useOfflineQueue.getState().sync();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sync dequeues successful requests and toasts', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    mockFetch(fetchMock);
    useOfflineQueue.setState({ queue: [makeRequest()] });

    await useOfflineQueue.getState().sync();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sync',
      expect.objectContaining({ method: 'POST' })
    );
    expect(useOfflineQueue.getState().queue).toHaveLength(0);
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('1'));
    expect(useOfflineQueue.getState().isSyncing).toBe(false);
  });

  it('sync keeps failed requests and toasts an error', async () => {
    mockFetch(() => Promise.resolve({ ok: false }));
    useOfflineQueue.setState({ queue: [makeRequest()] });

    await useOfflineQueue.getState().sync();

    expect(useOfflineQueue.getState().queue).toHaveLength(1);
    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('1'));
  });

  it('sync catches thrown network errors', async () => {
    mockFetch(() => Promise.reject(new Error('offline')));
    useOfflineQueue.setState({ queue: [makeRequest()] });

    await useOfflineQueue.getState().sync();

    expect(useOfflineQueue.getState().queue).toHaveLength(1);
    expect(mockToastError).toHaveBeenCalled();
  });

  it('initOfflineQueueListeners registers window listeners and returns a cleanup', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const cleanup = initOfflineQueueListeners();
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    cleanup?.();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('moves non-retryable 4xx poison-pill requests directly to deadLetterQueue', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 422 }) as unknown as typeof fetch;
    useOfflineQueue.setState({ queue: [makeRequest({ id: 'poison-1' })], deadLetterQueue: [] });

    await useOfflineQueue.getState().sync();

    expect(useOfflineQueue.getState().queue).toHaveLength(0);
    expect(useOfflineQueue.getState().deadLetterQueue).toHaveLength(1);
    expect(useOfflineQueue.getState().deadLetterQueue[0]!.id).toBe('poison-1');
    expect(useOfflineQueue.getState().deadLetterQueue[0]!.lastError).toBe('HTTP 422');
  });

  it('moves repeatedly failing requests to deadLetterQueue after reaching max retries', async () => {
    mockFetch(() => Promise.resolve({ ok: false }));
    useOfflineQueue.setState({
      queue: [makeRequest({ id: 'retry-max', retryCount: 2 })],
      deadLetterQueue: [],
    });

    await useOfflineQueue.getState().sync();

    expect(useOfflineQueue.getState().queue).toHaveLength(0);
    expect(useOfflineQueue.getState().deadLetterQueue).toHaveLength(1);
    expect(useOfflineQueue.getState().deadLetterQueue[0]!.retryCount).toBe(3);
  });
});
