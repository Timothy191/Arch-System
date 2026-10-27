/**
 * @jest-environment node
 */
import { GET } from './route';

interface MockRedisClient {
  isOpen: boolean;
  ping?: () => Promise<string>;
}

const mockedGetRedisClient = jest.fn<Promise<MockRedisClient | null>, []>();

jest.mock('@repo/redis', () => ({
  getRedisClient: () => mockedGetRedisClient(),
}));
const originalFetch = global.fetch;
const originalFuxaUrl = process.env.FUXA_URL;
const originalPublicFuxaUrl = process.env.NEXT_PUBLIC_FUXA_URL;

function createMockFetchResponse(options: {
  ok: boolean;
  status: number;
  headers?: Record<string, string>;
}): Response {
  const headers = new Headers(options.headers);
  return {
    ok: options.ok,
    status: options.status,
    headers,
  } as Response;
}

describe('GET /api/health/fuxa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FUXA_URL;
    delete process.env.NEXT_PUBLIC_FUXA_URL;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalFuxaUrl === undefined) {
      delete process.env.FUXA_URL;
    } else {
      process.env.FUXA_URL = originalFuxaUrl;
    }
    if (originalPublicFuxaUrl === undefined) {
      delete process.env.NEXT_PUBLIC_FUXA_URL;
    } else {
      process.env.NEXT_PUBLIC_FUXA_URL = originalPublicFuxaUrl;
    }
  });

  it('returns 200 healthy when FUXA responds OK with CORS and allows iframe embedding', async () => {
    process.env.FUXA_URL = 'http://fuxa.internal:1881';
    const fetchMock = jest.fn().mockResolvedValue(
      createMockFetchResponse({
        ok: true,
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'x-frame-options': 'SAMEORIGIN',
        },
      })
    );
    global.fetch = fetchMock;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://fuxa.internal:1881',
      expect.objectContaining({ method: 'HEAD' })
    );
    expect(body).toMatchObject({
      status: 'healthy',
      fuxa_healthy: true,
      iframeLoadable: true,
      corsAllowed: true,
    });
    expect(typeof body.latencyMs).toBe('number');
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it('returns 200 degraded when FUXA responds OK but blocks iframe via X-Frame-Options: DENY', async () => {
    process.env.NEXT_PUBLIC_FUXA_URL = 'http://fuxa.public:1881';
    global.fetch = jest.fn().mockResolvedValue(
      createMockFetchResponse({
        ok: true,
        status: 200,
        headers: {
          'x-frame-options': 'DENY',
        },
      })
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'degraded',
      fuxa_healthy: false,
      iframeLoadable: false,
      corsAllowed: false,
    });
  });

  it('returns 200 degraded fallback when FUXA fetch throws but Redis is open', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:1881'));
    mockedGetRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toMatchObject({
      status: 'degraded',
      fuxa_healthy: false,
      iframeLoadable: false,
      corsAllowed: false,
    });
  });

  it('returns 200 degraded fallback when FUXA returns non-OK HTTP status and Redis is open', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createMockFetchResponse({
        ok: false,
        status: 502,
      })
    );
    mockedGetRedisClient.mockResolvedValue({
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'degraded',
      fuxa_healthy: false,
      iframeLoadable: false,
      corsAllowed: false,
    });
  });

  it('returns 503 unhealthy when both FUXA fetch and Redis fallback fail', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('FUXA unreachable'));
    mockedGetRedisClient.mockRejectedValue(new Error('Redis connection refused'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toMatchObject({
      status: 'unhealthy',
      fuxa_healthy: false,
      iframeLoadable: false,
      corsAllowed: false,
    });
  });

  it('returns 503 unhealthy when FUXA fetch fails and Redis client is not open', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('FUXA timeout'));
    mockedGetRedisClient.mockResolvedValue({
      isOpen: false,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unhealthy');
  });
});
