/**
 * @jest-environment node
 */
import { getAccessReportsData } from './reports';
import { assertAccessControlRole } from './shared';

jest.mock('./shared', () => ({
  assertAccessControlRole: jest.fn(),
}));

const mockAssertRole = jest.mocked(assertAccessControlRole);

function buildTableMock(rows: unknown[], err: unknown = null) {
  const promise = Promise.resolve({ data: rows, error: err });
  const chain: Record<string, unknown> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
  return chain;
}

describe('getAccessReportsData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates access logs, denial taxonomy, gate traffic, and active credentials', async () => {
    const logRows = [
      {
        id: 'log-1',
        scanned_at: '2026-11-19T08:00:00Z',
        gate_location: 'Main North Gate',
        access_granted: true,
        denial_reason: null,
        access_type: 'QR',
        direction: 'IN',
      },
      {
        id: 'log-2',
        scanned_at: '2026-11-19T09:00:00Z',
        gate_location: 'Main North Gate',
        access_granted: false,
        denial_reason: 'Expired Medical',
        access_type: null,
        direction: 'OUT',
      },
    ];
    const badgeRows = [{ id: 'b-1', is_active: true, entity_type: 'personnel' }];

    mockAssertRole.mockResolvedValue({
      supabase: {
        from: jest.fn((table: string) =>
          table === 'access_logs' ? buildTableMock(logRows) : buildTableMock(badgeRows)
        ),
      },
    } as never);

    const report = await getAccessReportsData('dept-1', '2026-11-01', '2026-11-19');
    expect(report.summary).toEqual({
      totalEvents: 2,
      grantedCount: 1,
      deniedCount: 1,
      complianceRate: 50,
      activeCredentials: 1,
      contractorHoursLogged: 0,
    });
    expect(report.denialTaxonomy[0]).toEqual({
      reason: 'Expired Medical',
      count: 1,
      percentage: 50,
    });
    expect(report.gateTraffic[0]).toMatchObject({
      gateName: 'Main North Gate',
      inbound: 1,
      outbound: 1,
    });
    expect(report.recentAudits).toHaveLength(2);
    expect(report.recentAudits[0]?.timestamp).toBeTruthy();
  });

  it('returns safe defaults when access logs and badges are empty', async () => {
    mockAssertRole.mockResolvedValue({
      supabase: {
        from: jest.fn(() => buildTableMock([])),
      },
    } as never);

    const report = await getAccessReportsData('dept-1');
    expect(report.summary.totalEvents).toBe(0);
    expect(report.denialTaxonomy).toEqual([
      { reason: 'No denials recorded', count: 0, percentage: 0 },
    ]);
    expect(report.gateTraffic).toEqual([
      { gateName: 'No traffic recorded', inbound: 0, outbound: 0, peakHour: '—' },
    ]);
  });
});
