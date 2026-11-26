/**
 * @jest-environment node
 */
import { POST } from './route';

jest.mock('@/lib/api/rate-limit-middleware', () => ({
  withRateLimit: jest.fn((_req: unknown, handler: () => Promise<Response>) => handler()),
  getClientIp: jest.fn(() => '198.51.100.25'),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

const mockVerifyTurnstileToken = jest.fn();

jest.mock('@/lib/cloudflare/cloudflare-client', () => ({
  getCloudflareClient: jest.fn(() => ({
    verifyTurnstileToken: (...args: unknown[]) => mockVerifyTurnstileToken(...args),
  })),
}));

const { withRateLimit } = jest.requireMock('@/lib/api/rate-limit-middleware') as {
  withRateLimit: jest.Mock;
};
const { getAuthenticatedEmployee } = jest.requireMock('@repo/supabase') as {
  getAuthenticatedEmployee: jest.Mock;
};

describe('POST /api/cloudflare/turnstile/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthenticatedEmployee.mockResolvedValue(null);
  });

  it('allows pre-auth (unauthenticated) callers and passes client IP to verification', async () => {
    mockVerifyTurnstileToken.mockResolvedValue({
      success: true,
      verified: true,
      errorCode: null,
      detail: 'Turnstile verification succeeded',
    });

    const req = new Request('http://localhost/api/cloudflare/turnstile/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'cf-turnstile-token-abc' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(withRateLimit).toHaveBeenCalledTimes(1);
    expect(mockVerifyTurnstileToken).toHaveBeenCalledWith({
      token: 'cf-turnstile-token-abc',
      remoteIp: '198.51.100.25',
    });

    const json = await res.json();
    expect(json).toEqual({
      success: true,
      verified: true,
      errorCode: null,
      detail: 'Turnstile verification succeeded',
    });
  });

  it('fails closed when Cloudflare verification throws or secret is unconfigured', async () => {
    mockVerifyTurnstileToken.mockRejectedValue(new Error('network unreachable'));

    const req = new Request('http://localhost/api/cloudflare/turnstile/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'cf-turnstile-token-xyz' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.verified).toBe(false);
    expect(json.errorCode).toBe('VERIFICATION_UNAVAILABLE');
  });

  it('rejects malformed JSON and oversized bodies', async () => {
    const badJsonReq = new Request('http://localhost/api/cloudflare/turnstile/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad',
    });
    const badRes = await POST(badJsonReq);
    expect(badRes.status).toBe(400);

    const hugeReq = new Request('http://localhost/api/cloudflare/turnstile/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '50000' },
      body: JSON.stringify({ token: 'x' }),
    });
    const hugeRes = await POST(hugeReq);
    expect(hugeRes.status).toBe(413);
  });
});
