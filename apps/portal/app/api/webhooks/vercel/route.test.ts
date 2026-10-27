/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { computeVercelSignature } from '@/lib/api/vercel-signature';
import {
  clearRecentVercelWebhookEventsForTest,
  GET,
  POST,
  VERCEL_WEBHOOK_EVENT_TYPES,
} from './route';

const TEST_WEBHOOK_SECRET = 'vercel-webhook-secret-key-2026-hmac';
const TEST_CRON_SECRET = 'vercel-cron-secret-key-2026-bearer';

function createSignedWebhookRequest(
  payload: Record<string, unknown>,
  secret: string = TEST_WEBHOOK_SECRET
): NextRequest {
  const rawBody = JSON.stringify(payload);
  const signature = computeVercelSignature(rawBody, secret);
  return new NextRequest('http://localhost/api/webhooks/vercel', {
    method: 'POST',
    body: rawBody,
    headers: {
      'content-type': 'application/json',
      'x-vercel-signature': signature,
    },
  });
}

describe('/api/webhooks/vercel', () => {
  const originalWebhookSecret = process.env.VERCEL_WEBHOOK_SECRET;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.VERCEL_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    clearRecentVercelWebhookEventsForTest();
  });

  afterAll(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.VERCEL_WEBHOOK_SECRET;
    } else {
      process.env.VERCEL_WEBHOOK_SECRET = originalWebhookSecret;
    }
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it('rejects requests without x-vercel-signature header with 401', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/vercel', {
      method: 'POST',
      body: JSON.stringify({
        id: 'uev_missing_sig',
        type: 'deployment.created',
        createdAt: 1730000000000,
        payload: {},
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects requests signed with an invalid secret with 401', async () => {
    const req = createSignedWebhookRequest(
      {
        id: 'uev_wrong_sig',
        type: 'deployment.succeeded',
        createdAt: 1730000000000,
        payload: {},
      },
      'wrong-secret-value-here'
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when signed body is invalid JSON', async () => {
    const rawBody = '{invalid-json';
    const signature = computeVercelSignature(rawBody, TEST_WEBHOOK_SECRET);
    const req = new NextRequest('http://localhost/api/webhooks/vercel', {
      method: 'POST',
      body: rawBody,
      headers: { 'x-vercel-signature': signature },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('processes Deployment, Project, Feature Flag, and Firewall webhook categories with valid HMAC-SHA1 signature', async () => {
    const sampleEvents = [
      {
        id: 'uev_dep_01',
        type: 'deployment.succeeded',
        createdAt: 1730000001000,
        region: 'iad1',
        payload: {
          deployment: {
            id: 'dpl_arch_01',
            name: 'arch-system-portal',
            url: 'arch-system-kappa.vercel.app',
          },
        },
        expectedCategory: 'deployment',
      },
      {
        id: 'uev_prj_01',
        type: 'project.env-variable.updated',
        createdAt: 1730000002000,
        region: 'iad1',
        payload: {
          project: { id: 'prj_arch', name: 'arch-system-portal' },
        },
        expectedCategory: 'project',
      },
      {
        id: 'uev_flg_01',
        type: 'flags.flag.updated',
        createdAt: 1730000003000,
        payload: {
          name: 'enable-dense-media-telemetry',
        },
        expectedCategory: 'flags',
      },
      {
        id: 'uev_fw_01',
        type: 'firewall.attack',
        createdAt: 1730000004000,
        region: 'cpt1',
        payload: {
          name: 'ddos-mitigation-rule',
        },
        expectedCategory: 'firewall',
      },
    ] as const;

    for (const sample of sampleEvents) {
      const req = createSignedWebhookRequest({
        id: sample.id,
        type: sample.type,
        createdAt: sample.createdAt,
        region: 'region' in sample ? sample.region : undefined,
        payload: sample.payload,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.event.id).toBe(sample.id);
      expect(body.event.type).toBe(sample.type);
      expect(body.event.category).toBe(sample.expectedCategory);
    }

    const getReq = new NextRequest('http://localhost/api/webhooks/vercel', {
      method: 'GET',
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.ok).toBe(true);
    expect(getBody.supportedEvents).toEqual(VERCEL_WEBHOOK_EVENT_TYPES);
    expect(getBody.recentEventsCount).toBe(4);
  });
});
