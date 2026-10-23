import {
  acknowledge,
  appendToStream,
  claimIdle,
  consumeStream,
  ensureConsumerGroup,
  moveToDeadLetter,
  readFromGroup,
  readNew,
  readPending,
  readStream,
  streamLength,
} from '../src/streams';

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

describe('Redis Streams & Consumer Group Primitives', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('appendToStream and streamLength', () => {
    test('appends an entry and returns generated id', async () => {
      mockSendSafe.mockResolvedValueOnce('1700000000000-0');

      const id = await appendToStream({
        key: 'telemetry:stream',
        fields: { sensor: 'temp', val: '45' },
      });
      expect(id).toBe('1700000000000-0');
      expect(mockSendSafe).toHaveBeenCalledWith(expect.anything(), [
        'XADD',
        'telemetry:stream',
        '*',
        'sensor',
        'temp',
        'val',
        '45',
      ]);
    });

    test('appends with MAXLEN capping option', async () => {
      mockSendSafe.mockResolvedValueOnce('1700000000000-1');

      await appendToStream({
        key: 'telemetry:stream',
        fields: { status: 'ok' },
        maxLen: 1000,
        approx: true,
      });

      expect(mockSendSafe).toHaveBeenCalledWith(expect.anything(), [
        'XADD',
        'telemetry:stream',
        'MAXLEN',
        '~',
        1000,
        '*',
        'status',
        'ok',
      ]);
    });

    test('returns null and records counter when append fails', async () => {
      mockSendSafe.mockResolvedValueOnce(null);

      const id = await appendToStream({ key: 'telemetry:stream', fields: { status: 'ok' } });
      expect(id).toBeNull();
      expect(mockIncrementCounter).toHaveBeenCalledWith('stream.append.failed', {
        dimension: 'telemetry:stream',
      });
    });

    test('streamLength returns total entries in stream', async () => {
      mockSendSafe.mockResolvedValueOnce(42);

      const len = await streamLength('telemetry:stream');
      expect(len).toBe(42);
    });
  });

  describe('readStream and readNew', () => {
    test('readStream parses range entries', async () => {
      mockSendSafe.mockResolvedValueOnce([['1700000000000-0', ['key', 'val']]]);

      const entries = await readStream('telemetry:stream');
      expect(entries).toHaveLength(1);
      expect(entries[0]?.id).toBe('1700000000000-0');
      expect(entries[0]?.fields).toEqual({ key: 'val' });
    });

    test('readNew reads entries after given cursor', async () => {
      mockSendSafe.mockResolvedValueOnce([
        ['telemetry:stream', [['1700000000001-0', ['key', 'val2']]]],
      ]);

      const payloads = await readNew('telemetry:stream', { from: '1700000000000-0' });
      expect(payloads).toHaveLength(1);
      expect(payloads[0]?.entries[0]?.id).toBe('1700000000001-0');
    });
  });

  describe('Consumer Groups & Acknowledgment', () => {
    test('ensureConsumerGroup creates group idempotently', async () => {
      mockSend.mockResolvedValueOnce('OK');

      const created = await ensureConsumerGroup({ key: 'events:stream', group: 'worker-group' });
      expect(created).toBe(true);
    });

    test('ensureConsumerGroup ignores BUSYGROUP errors and returns false', async () => {
      mockSend.mockRejectedValueOnce(new Error('BUSYGROUP Consumer Group name already exists'));

      const created = await ensureConsumerGroup({ key: 'events:stream', group: 'worker-group' });
      expect(created).toBe(false);
    });

    test('readFromGroup fetches messages assigned to consumer', async () => {
      mockSendSafe.mockResolvedValueOnce([['events:stream', [['msg-1', ['action', 'dispatch']]]]]);

      const entries = await readFromGroup({
        key: 'events:stream',
        group: 'worker-group',
        consumer: 'worker-1',
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]?.id).toBe('msg-1');
      expect(entries[0]?.fields).toEqual({ action: 'dispatch' });
    });

    test('acknowledge sends XACK for processed IDs', async () => {
      mockSendSafe.mockResolvedValueOnce(2);

      const count = await acknowledge({
        key: 'events:stream',
        group: 'worker-group',
        ids: ['msg-1', 'msg-2'],
      });
      expect(count).toBe(2);
      expect(mockSendSafe).toHaveBeenCalledWith(expect.anything(), [
        'XACK',
        'events:stream',
        'worker-group',
        'msg-1',
        'msg-2',
      ]);
    });

    test('readPending lists unacknowledged rows', async () => {
      mockSendSafe.mockResolvedValueOnce([['msg-1', 'worker-1', 5000, 2]]);

      const pending = await readPending({ key: 'events:stream', group: 'worker-group' });
      expect(pending).toHaveLength(1);
      expect(pending[0]?.id).toBe('msg-1');
      expect(pending[0]?.consumer).toBe('worker-1');
      expect(pending[0]?.deliveries).toBe(2);
    });

    test('claimIdle claims abandoned messages from dead workers', async () => {
      mockSendSafe.mockResolvedValueOnce(['0-0', [['msg-stale', ['action', 'retry']]], []]);

      const claimed = await claimIdle({
        key: 'events:stream',
        group: 'worker-group',
        consumer: 'worker-2',
        idleMs: 60_000,
      });
      expect(claimed.entries).toHaveLength(1);
      expect(claimed.entries[0]?.id).toBe('msg-stale');
    });

    test('moveToDeadLetter appends to DLQ and acknowledges source stream', async () => {
      mockSendSafe.mockResolvedValueOnce('dlq-1'); // appendToStream DLQ
      mockSendSafe.mockResolvedValueOnce(1); // XACK original

      const dlqId = await moveToDeadLetter({
        key: 'events:stream',
        group: 'worker-group',
        entry: { id: 'bad-msg-1', fields: { payload: 'corrupt' } },
        reason: 'JSON parse error',
      });

      expect(dlqId).toBe('dlq-1');
    });
  });

  describe('consumeStream loop', () => {
    const group = { key: 'events:stream', group: 'worker-group', consumer: 'worker-1' };

    test('acknowledges entries the handler accepts', async () => {
      mockSend.mockResolvedValueOnce('OK'); // XGROUP CREATE
      mockSendSafe.mockResolvedValueOnce([]); // XPENDING
      mockSendSafe.mockResolvedValueOnce(['0-0', [], []]); // XAUTOCLAIM
      mockSendSafe.mockResolvedValueOnce([['events:stream', [['msg-1', ['action', 'dispatch']]]]]); // XREADGROUP
      mockSendSafe.mockResolvedValueOnce(1); // XACK

      const seen: string[] = [];
      const result = await consumeStream({ ...group, pollMs: 0 }, async (entry) => {
        seen.push(entry.id);
      });

      expect(seen).toEqual(['msg-1']);
      expect(result).toEqual({ processed: 1, failed: 0, dead: 0 });
      expect(mockSendSafe).toHaveBeenCalledWith(expect.anything(), [
        'XACK',
        'events:stream',
        'worker-group',
        'msg-1',
      ]);
    });

    test('leaves a throwing handler entry unacknowledged', async () => {
      mockSend.mockResolvedValueOnce('OK');
      mockSendSafe.mockResolvedValueOnce([]);
      mockSendSafe.mockResolvedValueOnce(['0-0', [], []]);
      mockSendSafe.mockResolvedValueOnce([['events:stream', [['msg-2', ['action', 'boom']]]]]);

      const result = await consumeStream({ ...group, pollMs: 0 }, async () => {
        throw new Error('handler failed');
      });

      expect(result).toEqual({ processed: 0, failed: 1, dead: 0 });
      expect(mockSendSafe).not.toHaveBeenCalledWith(expect.anything(), [
        'XACK',
        expect.anything(),
        expect.anything(),
        'msg-2',
      ]);
      expect(mockIncrementCounter).toHaveBeenCalledWith('stream.handler.failed', {
        dimension: 'events:stream',
      });
    });

    test('dead-letters an entry that already exceeded maxDeliveries', async () => {
      mockSend.mockResolvedValueOnce('OK');
      mockSendSafe.mockResolvedValueOnce([['msg-3', 'worker-1', 9000, 4]]); // XPENDING
      mockSendSafe.mockResolvedValueOnce(['0-0', [], []]); // XAUTOCLAIM
      mockSendSafe.mockResolvedValueOnce([['events:stream', [['msg-3', ['action', 'poison']]]]]);
      mockSendSafe.mockResolvedValueOnce('dlq-3'); // XADD dead letter
      mockSendSafe.mockResolvedValueOnce(1); // XACK original

      const handler = jest.fn();
      const result = await consumeStream({ ...group, maxDeliveries: 3, pollMs: 0 }, handler);

      expect(result).toEqual({ processed: 0, failed: 0, dead: 1 });
      expect(handler).not.toHaveBeenCalled();
      expect(mockSendSafe).toHaveBeenNthCalledWith(4, expect.anything(), [
        'XADD',
        'events:stream:dead',
        'MAXLEN',
        '~',
        1000,
        '*',
        'action',
        'poison',
        '_source',
        'events:stream',
        '_sourceId',
        'msg-3',
        '_reason',
        'exceeded 3 deliveries',
      ]);
    });
  });
});
