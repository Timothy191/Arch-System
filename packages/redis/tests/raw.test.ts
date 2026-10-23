import {
  asFieldMap,
  asNumber,
  asStringArray,
  asStringOrNull,
  currentTransport,
  isOkReply,
  parseStreamReply,
  RedisCommandError,
  send,
  sendSafe,
  supportsBlockingReads,
} from '../src/raw';

describe('Raw Redis Transport & Parser Primitives', () => {
  describe('asNumber', () => {
    test('converts numbers, bigints, and numeric strings correctly', () => {
      expect(asNumber(42)).toBe(42);
      expect(asNumber(BigInt(100))).toBe(100);
      expect(asNumber('123.45')).toBe(123.45);
      expect(asNumber('-5')).toBe(-5);
    });

    test('falls back on invalid inputs', () => {
      expect(asNumber('not-a-number', 99)).toBe(99);
      expect(asNumber(null, 7)).toBe(7);
      expect(asNumber(undefined, 0)).toBe(0);
      expect(asNumber(Number.NaN, 5)).toBe(5);
    });
  });

  describe('asStringOrNull', () => {
    test('returns strings or formatted primitives', () => {
      expect(asStringOrNull('hello')).toBe('hello');
      expect(asStringOrNull(123)).toBe('123');
      expect(asStringOrNull(BigInt(456))).toBe('456');
    });

    test('returns null for empty or non-primitive values', () => {
      expect(asStringOrNull(null)).toBeNull();
      expect(asStringOrNull(undefined)).toBeNull();
      expect(asStringOrNull({})).toBeNull();
    });
  });

  describe('asStringArray', () => {
    test('filters and normalizes string array entries', () => {
      expect(asStringArray(['a', 1, null, 'b', undefined])).toEqual(['a', '1', 'b']);
      expect(asStringArray('not-an-array')).toEqual([]);
    });
  });

  describe('asFieldMap', () => {
    test('converts flat key-value array pairs into an object', () => {
      const flat = ['field1', 'val1', 'field2', 'val2'];
      expect(asFieldMap(flat)).toEqual({
        field1: 'val1',
        field2: 'val2',
      });
    });

    test('normalizes object entries', () => {
      const obj = { k1: 'v1', k2: 42, k3: null };
      expect(asFieldMap(obj)).toEqual({
        k1: 'v1',
        k2: '42',
      });
    });

    test('handles non-array non-object gracefully', () => {
      expect(asFieldMap(null)).toEqual({});
      expect(asFieldMap('invalid')).toEqual({});
    });
  });

  describe('isOkReply', () => {
    test('identifies standard positive replies', () => {
      expect(isOkReply('OK')).toBe(true);
      expect(isOkReply(1)).toBe(true);
      expect(isOkReply(true)).toBe(true);
      expect(isOkReply('ERR')).toBe(false);
      expect(isOkReply(0)).toBe(false);
      expect(isOkReply(null)).toBe(false);
    });
  });

  describe('parseStreamReply', () => {
    test('parses RESP2 XRANGE flat entry lists', () => {
      const rawXRange = [
        ['1600000000000-0', ['sensor', 'temp', 'value', '25.4']],
        ['1600000000001-0', ['sensor', 'pressure', 'value', '101.3']],
      ];
      const parsed = parseStreamReply(rawXRange);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.entries).toHaveLength(2);
      expect(parsed[0]?.entries[0]).toEqual({
        id: '1600000000000-0',
        fields: { sensor: 'temp', value: '25.4' },
      });
    });

    test('parses nested stream payloads (XREAD)', () => {
      const rawXRead = [['telemetry:stream', [['1600000000000-0', ['status', 'active']]]]];
      const parsed = parseStreamReply(rawXRead);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.key).toBe('telemetry:stream');
      expect(parsed[0]?.entries[0]?.id).toBe('1600000000000-0');
      expect(parsed[0]?.entries[0]?.fields).toEqual({ status: 'active' });
    });
  });

  describe('send and sendSafe', () => {
    test('routes through sendCommand when available', async () => {
      const mockSendCommand = jest.fn().mockResolvedValue('PONG');
      const client = { sendCommand: mockSendCommand };

      const res = await send(client, ['PING']);
      expect(res).toBe('PONG');
      expect(mockSendCommand).toHaveBeenCalledWith(['PING']);
    });

    test('routes through command when sendCommand is missing', async () => {
      const mockCommand = jest.fn().mockResolvedValue('PONG');
      const client = { command: mockCommand };

      const res = await send(client, ['PING', 'extra']);
      expect(res).toBe('PONG');
      expect(mockCommand).toHaveBeenCalledWith('PING', ['extra']);
    });

    test('throws RedisCommandError on failure in send()', async () => {
      const client = {
        sendCommand: jest.fn().mockRejectedValue(new Error('Connection lost')),
      };
      await expect(send(client, ['GET', 'key'])).rejects.toThrow(RedisCommandError);
    });

    test('returns null gracefully on failure in sendSafe()', async () => {
      const client = {
        sendCommand: jest.fn().mockRejectedValue(new Error('Connection lost')),
      };
      const res = await sendSafe(client, ['GET', 'key']);
      expect(res).toBeNull();
    });
  });

  describe('Transport introspection', () => {
    test('inspects transport type', () => {
      const transport = currentTransport();
      expect(['tcp', 'serverless-rest']).toContain(transport);
      expect(typeof supportsBlockingReads()).toBe('boolean');
    });
  });
});
