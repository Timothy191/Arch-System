const mockCreateReadReplicaClient = jest.fn();

jest.mock('@repo/supabase/read-replica', () => ({
  createReadReplicaClient: (...args: unknown[]) => mockCreateReadReplicaClient(...args),
}));

jest.mock('@/lib/cache-utils', () => ({
  withCache: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/server-cache', () => ({
  cacheLife: jest.fn(),
  cacheTag: jest.fn(),
  tagDepartment: jest.fn((dept: string, suffix?: string) =>
    suffix ? `dept:${dept}:${suffix}` : `dept:${dept}`
  ),
}));

import { getCachedPresentationSnapshot, loadPresentationSnapshot } from './presentation-data';

function createCountClient(overrides: Partial<Record<string, number>> = {}) {
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: jest.fn(() => chain),
        eq: jest.fn((_col: string, val: unknown) => {
          if (table === 'machines' && val === true) {
            return Promise.resolve({ count: overrides.machines_active ?? 20, error: null });
          }
          if (table === 'tires' && val === 'installed') {
            return Promise.resolve({ count: overrides.tires_installed ?? 40, error: null });
          }
          return chain;
        }),
        is: jest.fn(() =>
          Promise.resolve({ count: overrides.breakdowns_active ?? 1, error: null })
        ),
        gte: jest.fn(() => {
          if (table === 'breakdowns') {
            return Promise.resolve({ count: overrides.breakdowns_resolved ?? 5, error: null });
          }
          return Promise.resolve({ count: overrides[table] ?? 120, error: null });
        }),
        then: (resolve: (val: unknown) => void) =>
          Promise.resolve({ count: overrides[table] ?? 24, error: null }).then(resolve),
      };
      return chain;
    },
  };
}

describe('presentation-data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates live read-replica head counts and computes availability percentage', async () => {
    mockCreateReadReplicaClient.mockResolvedValue(
      createCountClient({
        departments: 15,
        machines: 25,
        machines_active: 20,
        breakdowns_active: 2,
        breakdowns_resolved: 6,
        tires: 60,
        tires_installed: 48,
        daily_logs: 90,
        access_logs: 410,
      })
    );

    const snapshot = await getCachedPresentationSnapshot();
    expect(snapshot.isLiveTelemetry).toBe(true);
    expect(snapshot.totalDepartments).toBe(15);
    expect(snapshot.totalMachines).toBe(25);
    expect(snapshot.activeMachines).toBe(20);
    expect(snapshot.activeBreakdowns).toBe(2);
    expect(snapshot.resolvedBreakdowns24h).toBe(6);
    expect(snapshot.fleetAvailabilityPct).toBe(90);
    expect(snapshot.totalTires).toBe(60);
    expect(snapshot.installedTires).toBe(48);
    expect(snapshot.dailyLogsLast30d).toBe(90);
    expect(snapshot.accessEventsLast30d).toBe(410);
  });

  it('returns safe baseline metrics when createReadReplicaClient throws or fails', async () => {
    mockCreateReadReplicaClient.mockRejectedValue(new Error('Replica unavailable'));

    const snapshot = await loadPresentationSnapshot();
    expect(snapshot.isLiveTelemetry).toBe(false);
    expect(snapshot.totalDepartments).toBe(15);
    expect(snapshot.fleetAvailabilityPct).toBe(94.6);
    expect(snapshot.rlsCoveragePct).toBe(100);
    expect(snapshot.verificationGatesCount).toBe(28);
  });
});
