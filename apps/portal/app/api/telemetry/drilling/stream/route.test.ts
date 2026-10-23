/**
 * @jest-environment node
 */
import { GET } from './route';

const mockReadNew = jest.fn();
/** Reads to drain before giving up: one chunk per SSE event plus slack. */
const MAX_SSE_READS = 5;

jest.mock('@repo/redis', () => ({
  createRedisSubscriber: jest.fn(),
  supportsBlockingReads: jest.fn(() => true),
  readNew: (...args: unknown[]) => mockReadNew(...args),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

jest.mock('@/lib/api/rate-limit-middleware', () => ({
  withRateLimit: jest.fn(async (_req: Request, handler: () => Promise<Response>) => handler()),
}));

const { createRedisSubscriber, supportsBlockingReads } = jest.requireMock('@repo/redis');

function makeSubscriberClient() {
  return {
    isOpen: true,
    disconnect: jest.fn(async () => {}),
    quit: jest.fn(async () => 'OK'),
  };
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  needle: string
): Promise<string> {
  let buffer = '';
  for (let i = 0; i < MAX_SSE_READS; i++) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += new TextDecoder().decode(value);
    if (buffer.includes(needle)) return buffer;
  }
  return buffer;
}

describe('GET /api/telemetry/drilling/stream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supportsBlockingReads.mockReturnValue(true);
    mockReadNew.mockResolvedValue([]);
  });

  it('streams entries with SSE ids and resumes from Last-Event-ID', async () => {
    const client = makeSubscriberClient();
    createRedisSubscriber.mockResolvedValue(client);

    mockReadNew.mockResolvedValueOnce([
      {
        key: 'drilling:telemetry:stream',
        entries: [{ id: '1700000000000-0', fields: { data: '{"machine_id":"m1"}' } }],
      },
    ]);

    const res = await GET(
      new Request('http://localhost/api/telemetry/drilling/stream', {
        headers: { 'last-event-id': '1699999999999-0' },
      })
    );

    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const reader = res.body!.getReader();
    const payload = await readUntil(reader, '1700000000000-0');

    expect(payload).toContain('id: 1700000000000-0');
    expect(payload).toContain('data: {"machine_id":"m1"}');
    expect(mockReadNew).toHaveBeenCalledWith('drilling:telemetry:stream', {
      from: '1699999999999-0',
      count: 100,
      client,
      blockMs: 15000,
    });

    await reader.cancel();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('ignores malformed Last-Event-ID values and defaults to $', async () => {
    const client = makeSubscriberClient();
    createRedisSubscriber.mockResolvedValue(client);

    const res = await GET(
      new Request('http://localhost/api/telemetry/drilling/stream', {
        headers: { 'last-event-id': 'not-a-stream-id' },
      })
    );

    const reader = res.body!.getReader();
    await readUntil(reader, 'connected');

    expect(mockReadNew).toHaveBeenCalledWith(
      'drilling:telemetry:stream',
      expect.objectContaining({
        from: '$',
        count: 100,
        client,
      })
    );

    await reader.cancel();
  });

  it('omits blockMs when supportsBlockingReads returns false (serverless REST)', async () => {
    supportsBlockingReads.mockReturnValue(false);
    const client = makeSubscriberClient();
    createRedisSubscriber.mockResolvedValue(client);

    const res = await GET(new Request('http://localhost/api/telemetry/drilling/stream'));

    const reader = res.body!.getReader();
    await readUntil(reader, 'connected');

    expect(mockReadNew).toHaveBeenCalledWith('drilling:telemetry:stream', {
      from: '$',
      count: 100,
      client,
    });

    await reader.cancel();
  });

  it('rejects connections without the stream secret when one is configured', async () => {
    const originalSecret = process.env.TELEMETRY_STREAM_SECRET;
    process.env.TELEMETRY_STREAM_SECRET = 'stream-secret';

    try {
      const res = await GET(new Request('http://localhost/api/telemetry/drilling/stream'));

      expect(res.status).toBe(401);
      expect(createRedisSubscriber).not.toHaveBeenCalled();
    } finally {
      if (originalSecret === undefined) {
        delete process.env.TELEMETRY_STREAM_SECRET;
      } else {
        process.env.TELEMETRY_STREAM_SECRET = originalSecret;
      }
    }
  });

  it('accepts the stream secret through the telemetry header', async () => {
    const originalSecret = process.env.TELEMETRY_STREAM_SECRET;
    process.env.TELEMETRY_STREAM_SECRET = 'stream-secret';

    const client = makeSubscriberClient();
    createRedisSubscriber.mockResolvedValue(client);

    try {
      const res = await GET(
        new Request('http://localhost/api/telemetry/drilling/stream', {
          headers: { 'x-telemetry-secret': 'stream-secret' },
        })
      );

      expect(res.headers.get('Content-Type')).toBe('text/event-stream');

      const reader = res.body!.getReader();
      await readUntil(reader, 'connected');

      expect(createRedisSubscriber).toHaveBeenCalled();
      await reader.cancel();
    } finally {
      if (originalSecret === undefined) {
        delete process.env.TELEMETRY_STREAM_SECRET;
      } else {
        process.env.TELEMETRY_STREAM_SECRET = originalSecret;
      }
    }
  });
});
