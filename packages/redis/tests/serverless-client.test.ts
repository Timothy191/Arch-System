import { ServerlessRedisClient } from '../src/serverless-client';

const BASE_URL = 'https://example.upstash.io';

/**
 * Minimal in-memory Redis emulator covering the commands these tests exercise,
 * spoken over the Upstash REST protocol (POST ["CMD", ...args], POST /pipeline).
 */
function createFakeRedis() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  const exec = (row: string[]): unknown => {
    const [cmd, ...a] = row as [string, ...string[]];
    switch (cmd) {
      case 'get': {
        const v = store.get(a[0] as string);
        return v === undefined ? null : v;
      }
      case 'set': {
        store.set(a[0] as string, a[1] as string);
        return 'OK';
      }
      case 'setex': {
        store.set(a[0] as string, a[2] as string);
        return 'OK';
      }
      case 'del':
      case 'unlink': {
        let n = 0;
        for (const k of a) if (store.delete(k)) n++;
        return n;
      }
      case 'incrby': {
        const next = Number.parseInt(store.get(a[0] as string) ?? '0', 10) + Number(a[2]);
        store.set(a[0] as string, String(next));
        return next;
      }
      case 'scan': {
        const match = a.includes('MATCH') ? (a[a.indexOf('MATCH') + 1] as string) : '*';
        const re = new RegExp(`^${match.replace(/\*/g, '.*')}$`);
        return { cursor: 0, keys: [...store.keys()].filter((k) => re.test(k)) };
      }
      default:
        return null;
    }
  };

  return {
    store,
    sets,
    exec,
    reset() {
      store.clear();
      sets.clear();
    },
  };
}

const fake = createFakeRedis();
let fetchCalls: { url: string; body: string }[] = [];

function jsonResponse(result: unknown) {
  return new Response(JSON.stringify({ result }), { status: 200 });
}

beforeEach(() => {
  fake.reset();
  fetchCalls = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    const body = String(init?.body ?? '');
    fetchCalls.push({ url, body });

    if (url.endsWith('/pipeline')) {
      const rows = JSON.parse(body) as string[][];
      // Upstash answers /pipeline with a BARE array of per-command envelopes.
      return new Response(JSON.stringify(rows.map((row) => ({ result: fake.exec(row) }))), {
        status: 200,
      });
    }
    // Single-command body is ["CMD", ...args] — not wrapped in an array.
    const parsed = JSON.parse(body) as string[][];
    const row = Array.isArray(parsed[0]) ? (parsed[0] as string[]) : (parsed as string[]);
    return jsonResponse(fake.exec(row));
  }) as unknown as typeof fetch;
});

const makeClient = () => new ServerlessRedisClient({ baseUrl: BASE_URL, token: 'test-token' });

describe('ServerlessRedisClient', () => {
  describe('Finding 1: single parse boundary', () => {
    it('GET returns the RAW stored string, matching node-redis semantics', async () => {
      const client = makeClient();
      await client.set('arch:dept:drilling', '{"id":1,"name":"Drilling"}');

      const raw = await client.get('arch:dept:drilling');

      // The double-decode defect: this used to return an object here, which the
      // cache layer then JSON.parsed again and threw on.
      expect(typeof raw).toBe('string');
      expect(JSON.parse(raw as string)).toEqual({ id: 1, name: 'Drilling' });
    });

    it('returns null for a missing key', async () => {
      const client = makeClient();
      expect(await client.get('does:not:exist')).toBeNull();
    });

    it('round-trips a JSON-serialised object without corrupting it', async () => {
      const client = makeClient();
      const payload = { id: 7, nested: { list: [1, 2, 3] } };
      await client.set('k', JSON.stringify(payload));
      expect(JSON.parse((await client.get('k')) as string)).toEqual(payload);
    });
  });

  describe('Finding 4: auto-pipelining', () => {
    it('coalesces commands issued in the same tick into one round-trip', async () => {
      const client = makeClient();
      await Promise.all([client.get('a'), client.get('b'), client.get('c')]);

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]?.url).toBe(`${BASE_URL}/pipeline`);
      expect(JSON.parse(fetchCalls[0]?.body as string)).toEqual([
        ['get', 'a'],
        ['get', 'b'],
        ['get', 'c'],
      ]);
    });

    it('still uses a single direct request for one command', async () => {
      const client = makeClient();
      await client.get('solo');

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]?.url).toBe(BASE_URL);
    });

    it('keeps results aligned with their originating command', async () => {
      const client = makeClient();
      await client.set('x', 'one');
      await client.set('y', 'two');

      const [x, y] = await Promise.all([client.get('x'), client.get('y')]);

      expect(x).toBe('one');
      expect(y).toBe('two');
    });

    it('rejects only the failing command, not its batch siblings', async () => {
      const client = makeClient();
      global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : String(input);
        const body = String(init?.body ?? '');
        if (url.endsWith('/pipeline')) {
          // Bare-array envelope, matching Upstash.
          return new Response(
            JSON.stringify([{ result: 'ok' }, { error: 'WRONGTYPE operation against a key' }]),
            { status: 200 }
          );
        }
        return jsonResponse(null);
      }) as unknown as typeof fetch;

      const good = client.get('good');
      const bad = client.get('bad');

      await expect(good).resolves.toBe('ok');
      await expect(bad).rejects.toThrow(/WRONGTYPE/);
    });
  });

  describe('Finding 3: TTL and command coverage', () => {
    it('set with ttl emits EX so the key actually expires', async () => {
      const client = makeClient();
      await client.set('temp', 'value', 90);

      const body = JSON.parse(fetchCalls[0]?.body as string) as string[];
      expect(body).toEqual(['set', 'temp', 'value', 'EX', '90']);
    });

    it('scan returns a normalised cursor + keys page', async () => {
      const client = makeClient();
      await client.set('telemetry:last:a', '1');
      await client.set('telemetry:last:b', '2');
      await client.set('other', '3');

      const page = await client.scan(0, { MATCH: 'telemetry:last:*', COUNT: 100 });

      expect(page.cursor).toBe(0);
      expect(page.keys.sort()).toEqual(['telemetry:last:a', 'telemetry:last:b']);
    });
  });

  describe('Retry policy', () => {
    it('retries a transient 503 and then succeeds', async () => {
      const client = new ServerlessRedisClient({
        baseUrl: BASE_URL,
        token: 'test-token',
        maxAttempts: 3,
      });
      let attempts = 0;
      global.fetch = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          return new Response(JSON.stringify({ error: 'overloaded' }), { status: 503 });
        }
        return jsonResponse('PONG');
      }) as unknown as typeof fetch;

      await expect(client.ping()).resolves.toBe('PONG');
      expect(attempts).toBe(3);
    });

    it('surfaces the failure once the attempt budget is exhausted', async () => {
      const client = makeClient(); // default maxAttempts: 2
      let attempts = 0;
      global.fetch = jest.fn(async () => {
        attempts++;
        return new Response(JSON.stringify({ error: 'overloaded' }), { status: 503 });
      }) as unknown as typeof fetch;

      await expect(client.ping()).rejects.toThrow(/503|overloaded/);
      expect(attempts).toBe(2);
    });

    it('does not retry a Redis-level error', async () => {
      const client = makeClient();
      let attempts = 0;
      global.fetch = jest.fn(async () => {
        attempts++;
        return new Response(JSON.stringify({ error: 'WRONGTYPE bad key' }), { status: 200 });
      }) as unknown as typeof fetch;

      await expect(client.ping()).rejects.toThrow(/WRONGTYPE/);
      expect(attempts).toBe(1);
    });
  });
});
