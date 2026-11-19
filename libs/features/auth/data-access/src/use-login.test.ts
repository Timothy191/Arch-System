import * as Sentry from '@sentry/nextjs';
import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { type LoginResult, useLogin } from './index';

jest.mock('@sentry/nextjs', () => ({
  addBreadcrumb: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;
const MOCK_NOW_MS = 1_700_000_000_000;
const RATE_LIMIT_WINDOW_SECONDS = 45;

interface MockFetchResponseOptions {
  readonly ok: boolean;
  readonly status: number;
  readonly body: Record<string, unknown>;
  readonly headers?: Record<string, string>;
}

function createMockFetchResponse(options: MockFetchResponseOptions) {
  const headerMap = new Map<string, string>(
    Object.entries(options.headers ?? {}).map(([key, headerText]) => [
      key.toLowerCase(),
      headerText,
    ])
  );

  return {
    ok: options.ok,
    status: options.status,
    headers: {
      get: (headerName: string) => headerMap.get(headerName.toLowerCase()) ?? null,
    },
    json: jest.fn().mockResolvedValue(options.body),
  };
}

describe('useLogin', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with loading false, null rateLimitCountdown, and allow manual countdown updates', () => {
    const { result } = renderHook(() => useLogin());

    expect(result.current.loading).toBe(false);
    expect(result.current.rateLimitCountdown).toBeNull();

    act(() => {
      result.current.setRateLimitCountdown(RATE_LIMIT_WINDOW_SECONDS);
    });

    expect(result.current.rateLimitCountdown).toBe(RATE_LIMIT_WINDOW_SECONDS);
  });

  it('should post credentials to /api/auth/login, record Sentry breadcrumb, push telemetry, and return success', async () => {
    mockFetch
      .mockResolvedValueOnce(
        createMockFetchResponse({
          ok: true,
          status: HTTP_OK,
          body: { user: { id: 'emp-101' } },
        })
      )
      .mockResolvedValueOnce(
        createMockFetchResponse({
          ok: true,
          status: HTTP_OK,
          body: { ok: true },
        })
      );

    const { result } = renderHook(() => useLogin());

    let loginOutcome: LoginResult | undefined;
    await act(async () => {
      loginOutcome = await result.current.login('operator@arch-systems.io', 'ValidPass#2026');
    });

    expect(loginOutcome).toEqual({ success: true });
    expect(result.current.loading).toBe(false);
    expect(result.current.rateLimitCountdown).toBeNull();

    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'operator@arch-systems.io',
        password: 'ValidPass#2026',
      }),
    });

    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/telemetry/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'auth.success', value: 1 }),
    });

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: 'Auth succeeded',
      category: 'auth',
      level: 'info',
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('should handle 401 authentication failure, emit error toast, record Sentry error breadcrumb, and push failure telemetry', async () => {
    mockFetch
      .mockResolvedValueOnce(
        createMockFetchResponse({
          ok: false,
          status: HTTP_UNAUTHORIZED,
          body: { error: 'Invalid employee credentials' },
        })
      )
      .mockResolvedValueOnce(
        createMockFetchResponse({
          ok: true,
          status: HTTP_OK,
          body: {},
        })
      );

    const { result } = renderHook(() => useLogin());

    let loginOutcome: LoginResult | undefined;
    await act(async () => {
      loginOutcome = await result.current.login('PC-12345', 'WrongPassword123');
    });

    expect(loginOutcome).toEqual({
      success: false,
      error: 'Invalid employee credentials',
    });
    expect(result.current.loading).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Invalid employee credentials');
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: 'Auth failed',
      category: 'auth',
      level: 'error',
      data: { reason: 'Invalid employee credentials' },
    });
    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/telemetry/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'auth.failure', value: 1 }),
    });
  });

  it('should fall back to default error message when non-429 error response omits error text', async () => {
    mockFetch
      .mockResolvedValueOnce(
        createMockFetchResponse({
          ok: false,
          status: HTTP_SERVICE_UNAVAILABLE,
          body: {},
        })
      )
      .mockResolvedValueOnce(
        createMockFetchResponse({
          ok: true,
          status: HTTP_OK,
          body: {},
        })
      );

    const { result } = renderHook(() => useLogin());

    let loginOutcome: LoginResult | undefined;
    await act(async () => {
      loginOutcome = await result.current.login('PC-12345', 'Password12345');
    });

    expect(loginOutcome).toEqual({
      success: false,
      error: undefined,
    });
    expect(toast.error).toHaveBeenCalledWith('Sign in failed.');
  });

  it('should compute rateLimitCountdown from X-RateLimit-Reset header on 429 response', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_NOW_MS);
    const resetEpochSeconds = Math.floor(MOCK_NOW_MS / 1000) + RATE_LIMIT_WINDOW_SECONDS;

    mockFetch
      .mockResolvedValueOnce(
        createMockFetchResponse({
          ok: false,
          status: HTTP_TOO_MANY_REQUESTS,
          body: { error: 'Rate limit exceeded for this account.' },
          headers: { 'X-RateLimit-Reset': String(resetEpochSeconds) },
        })
      )
      .mockResolvedValueOnce(
        createMockFetchResponse({
          ok: true,
          status: HTTP_OK,
          body: {},
        })
      );

    const { result } = renderHook(() => useLogin());

    let loginOutcome: LoginResult | undefined;
    await act(async () => {
      loginOutcome = await result.current.login('PC-12345', 'Password12345');
    });

    expect(loginOutcome).toEqual({
      success: false,
      error: 'Rate limit exceeded for this account.',
    });
    expect(result.current.rateLimitCountdown).toBe(RATE_LIMIT_WINDOW_SECONDS);
    expect(toast.error).toHaveBeenCalledWith('Rate limit exceeded for this account.');
  });

  it('should clamp rateLimitCountdown to 0 when X-RateLimit-Reset is in the past and use default 429 toast when error is omitted', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_NOW_MS);
    const pastEpochSeconds = Math.floor(MOCK_NOW_MS / 1000) - 10;

    mockFetch
      .mockResolvedValueOnce(
        createMockFetchResponse({
          ok: false,
          status: HTTP_TOO_MANY_REQUESTS,
          body: {},
          headers: { 'X-RateLimit-Reset': String(pastEpochSeconds) },
        })
      )
      .mockResolvedValueOnce(
        createMockFetchResponse({
          ok: true,
          status: HTTP_OK,
          body: {},
        })
      );

    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login('PC-12345', 'Password12345');
    });

    expect(result.current.rateLimitCountdown).toBe(0);
    expect(toast.error).toHaveBeenCalledWith('Too many attempts.');
  });

  it('should handle network failure gracefully and return client-side network error message', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const { result } = renderHook(() => useLogin());

    let loginOutcome: LoginResult | undefined;
    await act(async () => {
      loginOutcome = await result.current.login('PC-12345', 'Password12345');
    });

    expect(loginOutcome).toEqual({
      success: false,
      error: 'Network error. Please try again.',
    });
    expect(result.current.loading).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Network error. Please try again.');
  });

  it('should swallow telemetry push failures without affecting a successful login response', async () => {
    mockFetch
      .mockResolvedValueOnce(
        createMockFetchResponse({
          ok: true,
          status: HTTP_OK,
          body: {},
        })
      )
      .mockRejectedValueOnce(new Error('Telemetry endpoint offline'));

    const { result } = renderHook(() => useLogin());

    let loginOutcome: LoginResult | undefined;
    await act(async () => {
      loginOutcome = await result.current.login('PC-12345', 'Password12345');
    });

    expect(loginOutcome).toEqual({ success: true });
    expect(result.current.loading).toBe(false);
  });
});
