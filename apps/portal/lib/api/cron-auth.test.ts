/**
 * @jest-environment node
 */

import { GET as getContractorExpiry } from '@/app/api/cron/contractor-expiry/route';
import { GET as getPreventativeMaintenance } from '@/app/api/cron/preventative-maintenance/route';
import { GET as getResearchBriefing } from '@/app/api/cron/research-briefing/route';
import { GET as getShiftHandoff } from '@/app/api/cron/shift-handoff/route';
import { authorizeCronRequest } from './cron-auth';

jest.mock('@/lib/jobs/workflow-runner', () => ({
  triggerTrackedWorkflow: jest.fn().mockResolvedValue({ jobId: 'job-123', status: 'pending' }),
}));

jest.mock('@repo/utils', () => ({
  AgentCursorTracker: {
    recordState: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('authorizeCronRequest & Scheduled Cron Route Authentication', () => {
  const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;
  const TEST_SECRET = 'cron-secret-test-value-2026-secure';

  beforeEach(() => {
    process.env.CRON_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    if (ORIGINAL_CRON_SECRET === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
    }
  });

  it('authorizes requests with a valid Bearer CRON_SECRET token', () => {
    const req = new Request('https://arch-system-kappap.vercel.app/api/cron/shift-handoff', {
      headers: {
        authorization: `Bearer ${TEST_SECRET}`,
      },
    });

    const result = authorizeCronRequest(req);
    expect(result).toBeNull();
  });

  it('fails closed when CRON_SECRET is unset even if caller sends "Bearer undefined"', async () => {
    delete process.env.CRON_SECRET;

    const req = new Request('https://arch-system-kappap.vercel.app/api/cron/shift-handoff', {
      headers: {
        authorization: 'Bearer undefined',
      },
    });

    const res = authorizeCronRequest(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
    const body = await res!.json();
    expect(body).toEqual({
      success: false,
      error: 'Cron authentication secret is not configured.',
    });
  });

  it('fails closed when CRON_SECRET is shorter than 16 characters', () => {
    process.env.CRON_SECRET = 'short-secret';
    const req = new Request('https://arch-system-kappap.vercel.app/api/cron/shift-handoff', {
      headers: {
        authorization: 'Bearer short-secret',
      },
    });

    const res = authorizeCronRequest(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it('rejects requests with missing or mismatched Bearer token without leaking secret', async () => {
    const req = new Request('https://arch-system-kappap.vercel.app/api/cron/shift-handoff', {
      headers: {
        authorization: 'Bearer wrong-token-value-123456',
      },
    });

    const res = authorizeCronRequest(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
    const text = await res!.text();
    expect(text).not.toContain(TEST_SECRET);
  });

  it.each([
    ['contractor-expiry', getContractorExpiry],
    ['preventative-maintenance', getPreventativeMaintenance],
    ['research-briefing', getResearchBriefing],
    ['shift-handoff', getShiftHandoff],
  ])(
    'scheduled route /api/cron/%s authenticates valid Bearer token and rejects invalid calls',
    async (name, handler) => {
      const unauthReq = new Request(`https://arch-system-kappap.vercel.app/api/cron/${name}`);
      const unauthRes = await handler(unauthReq);
      expect(unauthRes.status).toBe(401);

      const authReq = new Request(`https://arch-system-kappap.vercel.app/api/cron/${name}`, {
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
        },
      });
      const authRes = await handler(authReq);
      expect(authRes.status).toBe(200);
      const payload = await authRes.json();
      expect(payload.success).toBe(true);
      expect(JSON.stringify(payload)).not.toContain(TEST_SECRET);
    }
  );
});
