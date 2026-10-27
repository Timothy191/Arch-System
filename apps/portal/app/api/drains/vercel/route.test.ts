/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { computeVercelSignature } from '@/lib/api/vercel-signature';
import { clearRecentVercelDrainBatchesForTest, GET, POST } from './route';

const TEST_DRAIN_SECRET = 'vercel-drain-secret-key-2026-hmac';
const TEST_VERIFY_TOKEN = 'vc-drain-verify-token-998877';
const TEST_CRON_SECRET = 'vercel-cron-secret-key-2026-bearer';

describe('/api/drains/vercel', () => {
  const originalDrainSecret = process.env.VERCEL_DRAIN_SECRET;
  const originalDrainVerify = process.env.VERCEL_DRAIN_VERIFY;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.VERCEL_DRAIN_SECRET = TEST_DRAIN_SECRET;
    process.env.VERCEL_DRAIN_VERIFY = TEST_VERIFY_TOKEN;
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    clearRecentVercelDrainBatchesForTest();
  });

  afterAll(() => {
    if (originalDrainSecret === undefined) {
      delete process.env.VERCEL_DRAIN_SECRET;
    } else {
      process.env.VERCEL_DRAIN_SECRET = originalDrainSecret;
    }
    if (originalDrainVerify === undefined) {
      delete process.env.VERCEL_DRAIN_VERIFY;
    } else {
      process.env.VERCEL_DRAIN_VERIFY = originalDrainVerify;
    }
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it('rejects unsigned drain requests with 401 while still echoing x-vercel-verify header', async () => {
    const req = new NextRequest('http://localhost/api/drains/vercel', {
      method: 'POST',
      body: JSON.stringify([{ source: 'lambda', message: 'unverified log' }]),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(res.headers.get('x-vercel-verify')).toBe(TEST_VERIFY_TOKEN);
  });

  it('ingests signed JSON array batches across logs, traces, speed_insights, and web_analytics', async () => {
    const drainRecords = [
      {
        source: 'lambda',
        level: 'error',
        statusCode: 502,
        message: 'SCADA upstream timeout',
      },
      {
        source: 'edge',
        level: 'info',
        statusCode: 200,
        message: 'Edge middleware pass',
      },
      {
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        name: 'GET /plant-processing/hourly-sheet',
      },
      {
        schema: 'vercel.speed_insights.v1',
        metric: 'LCP',
        rating: 'good',
      },
      {
        eventType: 'pageview',
        path: '/hub',
      },
    ];
    const rawBody = JSON.stringify(drainRecords);
    const signature = computeVercelSignature(rawBody, TEST_DRAIN_SECRET);

    const req = new NextRequest('http://localhost/api/drains/vercel', {
      method: 'POST',
      body: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-vercel-signature': signature,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-vercel-verify')).toBe(TEST_VERIFY_TOKEN);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.summary.totalRecords).toBe(5);
    expect(body.summary.breakdown).toEqual({
      logs: 2,
      traces: 1,
      speed_insights: 1,
      web_analytics: 1,
    });
    expect(body.summary.errorLogCount).toBe(1);
  });

  it('ingests signed application/x-ndjson (newline-delimited JSON) drain payloads', async () => {
    const ndjsonLines = [
      JSON.stringify({ source: 'firewall', level: 'error', message: 'WAF rule triggered' }),
      JSON.stringify({ source: 'build', level: 'info', message: 'Turbopack build completed' }),
      JSON.stringify({ metricType: 'INP', schema: 'vercel.speed_insights.v1' }),
    ].join('\n');

    const signature = computeVercelSignature(ndjsonLines, TEST_DRAIN_SECRET);
    const req = new NextRequest('http://localhost/api/drains/vercel', {
      method: 'POST',
      body: ndjsonLines,
      headers: {
        'content-type': 'application/x-ndjson',
        'x-vercel-signature': signature,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.summary.totalRecords).toBe(3);
    expect(body.summary.breakdown).toEqual({
      logs: 2,
      traces: 0,
      speed_insights: 1,
      web_analytics: 0,
    });
    expect(body.summary.errorLogCount).toBe(1);

    const getReq = new NextRequest('http://localhost/api/drains/vercel', {
      method: 'GET',
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('x-vercel-verify')).toBe(TEST_VERIFY_TOKEN);
    const getBody = await getRes.json();
    expect(getBody.recentBatchesCount).toBe(1);
  });
});
