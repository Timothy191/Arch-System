/**
 * @jest-environment node
 */

import { getAuthenticatedEmployee } from '@repo/supabase';
import { GET } from './route';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

const mockGetAuthenticatedEmployee = jest.mocked(getAuthenticatedEmployee);

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY_REQUESTS = 429;
const VALID_IMAGE_BYTE_LENGTH = 16_384;
const SMALL_BLANK_BYTE_LENGTH = 3_200;
const RATE_LIMIT_BURST_COUNT = 30;

function makePrincipal(actorId: string) {
  return {
    id: actorId,
    role: 'operator',
    departmentId: 'drilling',
    accessibleDepartments: ['drilling'],
    user: { id: actorId },
    employee: { id: actorId, role: 'operator' },
  } as unknown as Awaited<ReturnType<typeof getAuthenticatedEmployee>>;
}

describe('Given GET /api/hub/earth-imagery', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('When caller is unauthenticated, Then it returns 401 Unauthorized', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce(null);

    const response = await GET(new Request('http://localhost/api/hub/earth-imagery?layer=viirs'));
    const payload = await response.json();

    expect(response.status).toBe(HTTP_UNAUTHORIZED);
    expect(payload).toEqual({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  });

  it('When layer query parameter is invalid, Then it returns 400 Bad Request', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce(makePrincipal('emp-invalid-layer'));

    const response = await GET(new Request('http://localhost/api/hub/earth-imagery?layer=unknown'));
    const payload = await response.json();

    expect(response.status).toBe(HTTP_BAD_REQUEST);
    expect(payload).toEqual({ error: 'Invalid imagery layer parameter', code: 'INVALID_REQUEST' });
  });

  it('When NASA GIBS returns valid imagery without TIME param, Then it proxies cached image/jpeg and reuses memory cache', async () => {
    const validBytes = new Uint8Array(VALID_IMAGE_BYTE_LENGTH).fill(0xff);
    const mockFetch = jest.fn().mockResolvedValueOnce(
      new Response(validBytes, {
        status: HTTP_OK,
        headers: { 'content-type': 'image/jpeg' },
      })
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    mockGetAuthenticatedEmployee.mockResolvedValue(makePrincipal('emp-viirs-ok'));

    const firstResponse = await GET(
      new Request('http://localhost/api/hub/earth-imagery?layer=viirs')
    );
    expect(firstResponse.status).toBe(HTTP_OK);
    expect(firstResponse.headers.get('content-type')).toBe('image/jpeg');
    expect(firstResponse.headers.get('x-earth-imagery-source')).toBe('nasa-gibs');
    expect(firstResponse.headers.get('cache-control')).toContain('max-age=3600');
    const body = await firstResponse.arrayBuffer();
    expect(body.byteLength).toBe(VALID_IMAGE_BYTE_LENGTH);

    const requestedUrl = String(mockFetch.mock.calls[0]?.[0] ?? '');
    expect(requestedUrl).toContain('VIIRS_SNPP_CorrectedReflectance_TrueColor');
    expect(requestedUrl).not.toContain('TIME=');

    const secondResponse = await GET(
      new Request('http://localhost/api/hub/earth-imagery?layer=viirs')
    );
    expect(secondResponse.status).toBe(HTTP_OK);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('When NASA GIBS returns blank/undersized image or fails, Then it falls back to bundled earth-blue-marble.jpg', async () => {
    const blankBytes = new Uint8Array(SMALL_BLANK_BYTE_LENGTH).fill(0x00);
    const mockFetch = jest.fn().mockResolvedValueOnce(
      new Response(blankBytes, {
        status: HTTP_OK,
        headers: { 'content-type': 'image/jpeg' },
      })
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    mockGetAuthenticatedEmployee.mockResolvedValue(makePrincipal('emp-blue-marble-fallback'));

    const response = await GET(
      new Request('http://localhost/api/hub/earth-imagery?layer=blue-marble')
    );
    const body = await response.arrayBuffer();

    expect(response.status).toBe(HTTP_OK);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('x-earth-imagery-source')).toBe('fallback');
    expect(body.byteLength).toBeGreaterThan(VALID_IMAGE_BYTE_LENGTH);
  });

  it('When actor exceeds 30 requests per minute, Then it returns 429 Too Many Requests', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValue(makePrincipal('emp-rate-limit'));

    for (let i = 0; i < RATE_LIMIT_BURST_COUNT; i += 1) {
      const allowedResponse = await GET(
        new Request('http://localhost/api/hub/earth-imagery?layer=viirs')
      );
      expect(allowedResponse.status).toBe(HTTP_OK);
    }

    const blockedResponse = await GET(
      new Request('http://localhost/api/hub/earth-imagery?layer=viirs')
    );
    const blockedPayload = await blockedResponse.json();
    expect(blockedResponse.status).toBe(HTTP_TOO_MANY_REQUESTS);
    expect(blockedPayload).toEqual({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' });
  });
});
