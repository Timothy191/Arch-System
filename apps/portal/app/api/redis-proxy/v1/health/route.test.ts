/**
 * @jest-environment node
 */
/* cspell:words dbsize */

import { NextRequest } from 'next/server';
import { GET } from './route';

const HTTP_OK_STATUS = 200;
const HTTP_UNAUTHORIZED_STATUS = 401;
const EXPECTED_ACTIVE_KEYS_COUNT = 42;
const HEALTH_ENDPOINT_URL = 'http://localhost:3000/api/redis-proxy/v1/health';
const TEST_REDIS_SECRET = 'correct-redis-proxy-secret-2026';
const TEST_N8N_SECRET = 'correct-n8n-api-secret-2026';
const WRONG_SECRET = 'wrong-redis-proxy-secret-2026';

const mockExecuteCommand = jest.fn((command: string, _args: readonly string[] = []) => {
  if (command === 'PING') return 'PONG';
  return [];
});
const mockDbSize = jest.fn(() => EXPECTED_ACTIVE_KEYS_COUNT);

jest.mock('@/lib/redis-engine', () => ({
  redisEngine: {
    executeCommand: (command: string, args: string[]) => mockExecuteCommand(command, args),
    dbsize: () => mockDbSize(),
  },
}));

function createHealthRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(HEALTH_ENDPOINT_URL, { headers });
}

describe('Given GET /api/redis-proxy/v1/health', () => {
  const originalRedisSecret = process.env.REDIS_AUTH_SECRET;
  const originalN8nKey = process.env.N8N_API_KEY;

  beforeEach(() => {
    delete process.env.REDIS_AUTH_SECRET;
    delete process.env.N8N_API_KEY;
    mockExecuteCommand.mockClear();
    mockDbSize.mockClear();
  });

  afterAll(() => {
    if (originalRedisSecret === undefined) {
      delete process.env.REDIS_AUTH_SECRET;
    } else {
      process.env.REDIS_AUTH_SECRET = originalRedisSecret;
    }
    if (originalN8nKey === undefined) {
      delete process.env.N8N_API_KEY;
    } else {
      process.env.N8N_API_KEY = originalN8nKey;
    }
  });

  it('When neither REDIS_AUTH_SECRET nor N8N_API_KEY is configured, Then it fails closed with 401', async () => {
    const responses = await Promise.all([
      GET(createHealthRequest()),
      GET(createHealthRequest({ authorization: `Bearer ${TEST_REDIS_SECRET}` })),
      GET(createHealthRequest({ 'x-n8n-api-key': TEST_N8N_SECRET })),
      GET(createHealthRequest({ 'x-redis-token': TEST_REDIS_SECRET })),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(HTTP_UNAUTHORIZED_STATUS);
    }
    expect(mockExecuteCommand).not.toHaveBeenCalled();
    expect(mockDbSize).not.toHaveBeenCalled();
  });

  it('When a secret is configured and no credentials are provided, Then it rejects with 401', async () => {
    process.env.REDIS_AUTH_SECRET = TEST_REDIS_SECRET;

    const response = await GET(createHealthRequest());

    expect(response.status).toBe(HTTP_UNAUTHORIZED_STATUS);
    expect(mockExecuteCommand).not.toHaveBeenCalled();
    expect(mockDbSize).not.toHaveBeenCalled();
  });

  it('When Bearer or header tokens do not match the configured secret, Then it rejects with 401', async () => {
    process.env.REDIS_AUTH_SECRET = TEST_REDIS_SECRET;

    const responses = await Promise.all([
      GET(createHealthRequest({ authorization: `Bearer ${WRONG_SECRET}` })),
      GET(createHealthRequest({ authorization: WRONG_SECRET })),
      GET(createHealthRequest({ 'x-n8n-api-key': WRONG_SECRET })),
      GET(createHealthRequest({ 'x-redis-token': WRONG_SECRET })),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(HTTP_UNAUTHORIZED_STATUS);
    }
    expect(mockExecuteCommand).not.toHaveBeenCalled();
    expect(mockDbSize).not.toHaveBeenCalled();
  });

  it('When a valid Authorization Bearer token is provided, Then it returns 200 using dbsize without invoking KEYS', async () => {
    process.env.REDIS_AUTH_SECRET = TEST_REDIS_SECRET;

    const response = await GET(
      createHealthRequest({ authorization: `Bearer ${TEST_REDIS_SECRET}` })
    );
    const payload = await response.json();

    expect(response.status).toBe(HTTP_OK_STATUS);
    expect(payload).toEqual({
      status: 'healthy',
      mode: 'serverless-http-redis',
      ping: 'PONG',
      activeKeysCount: EXPECTED_ACTIVE_KEYS_COUNT,
      timestamp: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
    expect(mockDbSize).toHaveBeenCalledTimes(1);
    expect(mockExecuteCommand).toHaveBeenCalledWith('PING', []);
    expect(mockExecuteCommand).not.toHaveBeenCalledWith('KEYS', expect.anything());
  });

  it('When a valid x-n8n-api-key header is provided, Then it returns 200 using dbsize without invoking KEYS', async () => {
    process.env.N8N_API_KEY = TEST_N8N_SECRET;

    const response = await GET(createHealthRequest({ 'x-n8n-api-key': TEST_N8N_SECRET }));
    const payload = await response.json();

    expect(response.status).toBe(HTTP_OK_STATUS);
    expect(payload.status).toBe('healthy');
    expect(payload.mode).toBe('serverless-http-redis');
    expect(payload.ping).toBe('PONG');
    expect(payload.activeKeysCount).toBe(EXPECTED_ACTIVE_KEYS_COUNT);
    expect(mockDbSize).toHaveBeenCalledTimes(1);
    expect(mockExecuteCommand).toHaveBeenCalledWith('PING', []);
    expect(mockExecuteCommand).not.toHaveBeenCalledWith('KEYS', expect.anything());
  });

  it('When a valid x-redis-token header is provided, Then it returns 200 using dbsize without invoking KEYS', async () => {
    process.env.REDIS_AUTH_SECRET = TEST_REDIS_SECRET;

    const response = await GET(createHealthRequest({ 'x-redis-token': TEST_REDIS_SECRET }));
    const payload = await response.json();

    expect(response.status).toBe(HTTP_OK_STATUS);
    expect(payload.status).toBe('healthy');
    expect(payload.mode).toBe('serverless-http-redis');
    expect(payload.ping).toBe('PONG');
    expect(payload.activeKeysCount).toBe(EXPECTED_ACTIVE_KEYS_COUNT);
    expect(mockDbSize).toHaveBeenCalledTimes(1);
    expect(mockExecuteCommand).toHaveBeenCalledWith('PING', []);
    expect(mockExecuteCommand).not.toHaveBeenCalledWith('KEYS', expect.anything());
  });

  it('When both REDIS_AUTH_SECRET and N8N_API_KEY are set to distinct values, Then either valid credential is accepted', async () => {
    process.env.REDIS_AUTH_SECRET = TEST_REDIS_SECRET;
    process.env.N8N_API_KEY = TEST_N8N_SECRET;

    const [bearerRes, n8nRes, wrongRes] = await Promise.all([
      GET(createHealthRequest({ authorization: `Bearer ${TEST_REDIS_SECRET}` })),
      GET(createHealthRequest({ 'x-n8n-api-key': TEST_N8N_SECRET })),
      GET(createHealthRequest({ 'x-n8n-api-key': WRONG_SECRET })),
    ]);

    expect(bearerRes.status).toBe(HTTP_OK_STATUS);
    expect(n8nRes.status).toBe(HTTP_OK_STATUS);
    expect(wrongRes.status).toBe(HTTP_UNAUTHORIZED_STATUS);
    expect(mockDbSize).toHaveBeenCalledTimes(2);
  });
});
