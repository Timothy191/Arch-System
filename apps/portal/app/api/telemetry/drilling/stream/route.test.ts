/**
 * @jest-environment node
 */
import { GET } from './route';

jest.mock('@repo/redis', () => ({
  createRedisSubscriber: jest.fn(),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

const { createRedisSubscriber } = jest.requireMock('@repo/redis');

function makeStreamClient(firstReply: unknown) {
  let rejectPending: ((err: Error) => void) | null = null;

  return {
    isOpen: true,
    xRead: jest
      .fn()
      .mockResolvedValueOnce(firstReply)
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectPending = reject;
          })
      ),
    disconnect: jest.fn(async () => {
      rejectPending?.(new Error('disconnected'));
    }),
    unsubscribe: jest.fn(async () => {}),
    quit: jest.fn(async () => 'OK'),
    subscribe: jest.fn(),
  };
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  needle: string,
  maxReads = 5
): Promise<string> {
  let buffer = '';
  for (let i = 0; i < maxReads; i++) {
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
  });

  it('streams entries with SSE ids and resumes from Last-Event-ID', async () => {
    const client = makeStreamClient([
      {
        name: 'drilling:telemetry:stream',
        messages: [{ id: '1700000000000-0', message: { data: '{"machine_id":"m1"}' } }],
      },
    ]);
    createRedisSubscriber.mockResolvedValue(client);

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
    expect(client.xRead).toHaveBeenNthCalledWith(
      1,
      [{ key: 'drilling:telemetry:stream', id: '1699999999999-0' }],
      { BLOCK: 15000, COUNT: 100 }
    );

    await reader.cancel();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('ignores malformed Last-Event-ID values', async () => {
    const client = makeStreamClient(null);
    createRedisSubscriber.mockResolvedValue(client);

    const res = await GET(
      new Request('http://localhost/api/telemetry/drilling/stream', {
        headers: { 'last-event-id': 'not-a-stream-id' },
      })
    );

    const reader = res.body!.getReader();
    await readUntil(reader, 'connected');

    expect(client.xRead).toHaveBeenNthCalledWith(
      1,
      [{ key: 'drilling:telemetry:stream', id: '$' }],
      { BLOCK: 15000, COUNT: 100 }
    );

    await reader.cancel();
  });

  it('falls back to pub/sub when XREAD is unavailable', async () => {
    const client = {
      isOpen: true,
      subscribe: jest.fn(async (_channel: string, callback: (message: string) => void) => {
        callback('{"machine_id":"m2"}');
      }),
      unsubscribe: jest.fn(async () => {}),
      quit: jest.fn(async () => 'OK'),
      disconnect: jest.fn(async () => {}),
    };
    createRedisSubscriber.mockResolvedValue(client);

    const res = await GET(new Request('http://localhost/api/telemetry/drilling/stream'));

    const reader = res.body!.getReader();
    const payload = await readUntil(reader, 'machine_id');

    expect(payload).toContain('data: {"machine_id":"m2"}');
    expect(client.subscribe).toHaveBeenCalledWith(
      'drilling:telemetry:stream',
      expect.any(Function)
    );

    await reader.cancel();
    expect(client.unsubscribe).toHaveBeenCalledWith('drilling:telemetry:stream');
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

    const client = makeStreamClient(null);
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
