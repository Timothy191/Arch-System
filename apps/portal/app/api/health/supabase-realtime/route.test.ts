/**
 * @jest-environment node
 */
import { GET } from './route';

const originalWebSocket = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
const originalEnvironment = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  serverSupabaseUrl: process.env.SUPABASE_URL,
  serverAnonKey: process.env.SUPABASE_ANON_KEY,
  serverPublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
};

class MockWebSocket extends EventTarget {
  static autoOpen = true;
  static lastUrl: URL | null = null;
  static lastInstance: MockWebSocket | null = null;

  constructor(url: string | URL) {
    super();
    MockWebSocket.lastUrl = new URL(url);
    MockWebSocket.lastInstance = this;
    if (MockWebSocket.autoOpen) {
      queueMicrotask(() => this.dispatchEvent(new Event('open')));
    }
  }

  close() {
    this.dispatchEvent(new Event('close'));
  }
}

function installWebSocketMock() {
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: MockWebSocket,
  });
}

function restoreWebSocket() {
  if (originalWebSocket) {
    Object.defineProperty(globalThis, 'WebSocket', originalWebSocket);
  } else {
    Reflect.deleteProperty(globalThis, 'WebSocket');
  }
}

describe('GET /api/health/supabase-realtime', () => {
  beforeEach(() => {
    jest.useRealTimers();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.example.test';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    MockWebSocket.autoOpen = true;
    MockWebSocket.lastUrl = null;
    MockWebSocket.lastInstance = null;
    installWebSocketMock();
  });

  afterEach(() => {
    restoreWebSocket();
    if (originalEnvironment.supabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnvironment.supabaseUrl;
    }
    if (originalEnvironment.supabaseAnonKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnvironment.supabaseAnonKey;
    }
    if (originalEnvironment.supabasePublishableKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalEnvironment.supabasePublishableKey;
    }
    if (originalEnvironment.serverSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalEnvironment.serverSupabaseUrl;
    }
    if (originalEnvironment.serverAnonKey === undefined) {
      delete process.env.SUPABASE_ANON_KEY;
    } else {
      process.env.SUPABASE_ANON_KEY = originalEnvironment.serverAnonKey;
    }
    if (originalEnvironment.serverPublishableKey === undefined) {
      delete process.env.SUPABASE_PUBLISHABLE_KEY;
    } else {
      process.env.SUPABASE_PUBLISHABLE_KEY = originalEnvironment.serverPublishableKey;
    }
    jest.useRealTimers();
  });

  it('returns healthy only after the Realtime WebSocket handshake opens', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toMatchObject({
      status: 'healthy',
      realtime_healthy: true,
      reason: null,
    });
    expect(typeof body.latencyMs).toBe('number');
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
    expect(MockWebSocket.lastUrl?.protocol).toBe('wss:');
    expect(MockWebSocket.lastUrl?.pathname).toBe('/realtime/v1/websocket');
    expect(MockWebSocket.lastUrl?.searchParams.get('apikey')).toBe('public-test-key');
    expect(MockWebSocket.lastUrl?.searchParams.get('vsn')).toBe('1.0.0');
  });

  it('returns degraded when the Realtime WebSocket fails before opening', async () => {
    MockWebSocket.autoOpen = false;
    const responsePromise = GET();
    MockWebSocket.lastInstance?.dispatchEvent(new Event('error'));
    const response = await responsePromise;
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: 'degraded',
      realtime_healthy: false,
      reason: 'realtime_connection_failed',
    });
  });

  it('returns degraded when the WebSocket handshake times out', async () => {
    MockWebSocket.autoOpen = false;
    jest.useFakeTimers();
    const responsePromise = GET();
    await jest.advanceTimersByTimeAsync(3000);

    const response = await responsePromise;
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.reason).toBe('realtime_timeout');
  });

  it('reports missing configuration without attempting a socket connection', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.reason).toBe('realtime_configuration_missing');
    expect(MockWebSocket.lastUrl).toBeNull();
  });

  it('does not include public key data in failure responses', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url';

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain('public-test-key');
    expect(body.reason).toBe('realtime_configuration_invalid');
  });
});
