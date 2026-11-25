import {
  DATABASE_MIGRATION_SUMMARY,
  DETAILED_LIVE_COUNT_TABLES,
  evaluateDepartmentReadiness,
  fetchDatabaseTableCounts,
  fetchMasterReferenceSnapshot,
  getTableConsumerDepartments,
} from './department-database-catalog';

const mockCreateReadReplicaClient = jest.fn();

jest.mock('@repo/supabase/read-replica', () => ({
  createReadReplicaClient: () => mockCreateReadReplicaClient(),
}));

describe('department-database-catalog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defines migration summary matching latest migration #229 and resolves consuming departments', () => {
    expect(DATABASE_MIGRATION_SUMMARY.latestMigrationNumber).toBe(229);
    expect(DATABASE_MIGRATION_SUMMARY.totalMigrationFiles).toBe(179);
    expect(DATABASE_MIGRATION_SUMMARY.recentMigrations[0]?.id).toBe('229');

    const machineConsumers = getTableConsumerDepartments('machines');
    expect(machineConsumers).toContain('Control Room');
    expect(machineConsumers).toContain('Engineering');
    expect(machineConsumers).toContain('Drilling');
    expect(machineConsumers).toContain('Plant Inventory');
    expect(getTableConsumerDepartments('nonexistent_table')).toEqual([]);
  });

  it('evaluates ready, attention, and standby states cleanly', () => {
    const allPopulated: Record<string, number> = {};
    for (const tableName of DETAILED_LIVE_COUNT_TABLES) {
      allPopulated[tableName] = 10;
    }

    const readyResult = evaluateDepartmentReadiness({
      rowCounts: allPopulated,
      isLiveConnected: true,
    });
    expect(readyResult.readyDepartmentsCount).toBe(10);
    expect(readyResult.attentionDepartmentsCount).toBe(0);
    expect(readyResult.populatedTablesCount).toBe(DETAILED_LIVE_COUNT_TABLES.length);

    const missingSitesAndTargets = {
      ...allPopulated,
      sites: 0,
      production_monthly_targets: 0,
    };
    const attentionResult = evaluateDepartmentReadiness({
      rowCounts: missingSitesAndTargets,
      isLiveConnected: true,
    });
    expect(attentionResult.attentionDepartmentsCount).toBeGreaterThan(0);
    const productionReport = attentionResult.reports.find(
      (r) => r.requirement.departmentSlug === 'production'
    );
    expect(productionReport?.status).toBe('attention');
    expect(productionReport?.emptyMasterTables).toContain('production_monthly_targets');

    const standbyResult = evaluateDepartmentReadiness({
      rowCounts: {},
      isLiveConnected: false,
    });
    expect(standbyResult.readyDepartmentsCount).toBe(0);
    expect(standbyResult.reports.every((r) => r.status === 'standby')).toBe(true);
  });

  it('fetches live table counts when connected and falls back cleanly on error', async () => {
    mockCreateReadReplicaClient.mockResolvedValueOnce({
      from: (tableName: string) => ({
        select: jest.fn(async () => ({
          count: tableName === 'machines' ? 42 : 5,
          error: null,
        })),
      }),
    });

    const liveCounts = await fetchDatabaseTableCounts();
    expect(liveCounts.isLiveConnected).toBe(true);
    expect(liveCounts.rowCounts.machines).toBe(42);
    expect(liveCounts.totalLiveRows).toBe(42 + (DETAILED_LIVE_COUNT_TABLES.length - 1) * 5);

    mockCreateReadReplicaClient.mockRejectedValueOnce(new Error('DB offline'));
    const fallbackCounts = await fetchDatabaseTableCounts();
    expect(fallbackCounts.isLiveConnected).toBe(false);
    expect(fallbackCounts.totalLiveRows).toBe(0);
  });

  it('fetches master reference snapshot and degrades gracefully when client fails', async () => {
    const queryChain = (payload: { data?: unknown[]; count?: number; error?: unknown }) => ({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn(async () => payload),
        })),
        limit: jest.fn(async () => payload),
        then: (resolve: (val: unknown) => unknown) => resolve(payload),
      })),
    });

    mockCreateReadReplicaClient.mockResolvedValueOnce({
      from: (tableName: string) => {
        if (tableName === 'sites') {
          return queryChain({ data: [{ name: 'Brakfontein Pit', site_code: 'BRAK-PIT' }] });
        }
        if (tableName === 'mine_blocks') {
          return queryChain({ data: [{ name: 'Block A' }], count: 3 });
        }
        if (tableName === 'machines') {
          return queryChain({
            data: [
              { machine_type: 'Excavator', active: true },
              { machine_type: 'Dump Truck', active: false },
            ],
          });
        }
        if (tableName === 'delay_categories') {
          return queryChain({ data: [{ name: 'Mechanical' }, { name: 'Weather' }] });
        }
        if (tableName === 'material_density') {
          return queryChain({ data: [{ material_type: 'Coal', density_factor: 1.45 }] });
        }
        if (tableName === 'production_monthly_targets') {
          return queryChain({ data: [{ target_month: '2026-11' }], count: 2 });
        }
        return queryChain({ count: 9 });
      },
    });

    const snapshot = await fetchMasterReferenceSnapshot();
    expect(snapshot.isLiveConnected).toBe(true);
    expect(snapshot.activeSites).toEqual([{ name: 'Brakfontein Pit', siteCode: 'BRAK-PIT' }]);
    expect(snapshot.mineBlocksCount).toBe(3);
    expect(snapshot.totalMachines).toBe(2);
    expect(snapshot.activeMachines).toBe(1);
    expect(snapshot.latestTargetMonth).toBe('2026-11');
    expect(snapshot.materialDensities).toEqual([{ materialType: 'Coal', densityFactor: 1.45 }]);

    mockCreateReadReplicaClient.mockRejectedValueOnce(new Error('Standby'));
    const offlineSnapshot = await fetchMasterReferenceSnapshot();
    expect(offlineSnapshot.isLiveConnected).toBe(false);
    expect(offlineSnapshot.activeSites).toEqual([]);
  });
});
