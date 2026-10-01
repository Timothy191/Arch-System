/**
 * @jest-environment node
 */
import { POST } from './route';

jest.mock('@/lib/jobs/workflow-runner', () => ({
  triggerTrackedWorkflow: jest.fn().mockResolvedValue(true),
}));

describe('POST /api/weather', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers a Red Code Muster for lightning within 5km', async () => {
    const req = new Request('http://localhost/api/weather', {
      method: 'POST',
      body: JSON.stringify({
        alert_type: 'lightning',
        distance_km: 4.5,
        severity: 'critical',
        timestamp: new Date().toISOString(),
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe('Red Code Muster Initiated');
    expect(json.jobId).toBeDefined();
  });

  it('ignores lightning further than 5km', async () => {
    const req = new Request('http://localhost/api/weather', {
      method: 'POST',
      body: JSON.stringify({
        alert_type: 'lightning',
        distance_km: 10,
        severity: 'high',
        timestamp: new Date().toISOString(),
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe('Alert logged, no action required');
  });

  it('returns 400 for invalid payloads', async () => {
    const req = new Request('http://localhost/api/weather', {
      method: 'POST',
      body: JSON.stringify({
        alert_type: 'tornado', // Invalid enum
        distance_km: 5,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
