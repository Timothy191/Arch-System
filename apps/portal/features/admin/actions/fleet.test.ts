/**
 * @jest-environment node
 */
import { revalidatePath } from 'next/cache';
import { updateTags } from '@/lib/server-cache';
import { adminAddMachine, adminGenerateStartingSmr, adminUpdateMachine } from './fleet';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/server-cache', () => ({
  updateTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server') as {
  createServerSupabaseClient: jest.Mock;
};

interface FleetMockConfig {
  readonly user?: { readonly id: string } | null;
  readonly role?: string;
  readonly insertErrors?: readonly (unknown | null)[];
  readonly updateErrors?: readonly (unknown | null)[];
  readonly machineRowsError?: unknown | null;
  readonly machineRows?: readonly Record<string, unknown>[];
  readonly deptRows?: readonly Record<string, unknown>[];
  readonly opRows?: readonly Record<string, unknown>[];
}

function buildFleetSupabaseMock(config: FleetMockConfig = {}) {
  const user = config.user === undefined ? { id: 'fleet-admin-1' } : config.user;
  const employee = { id: 'emp-admin', role: config.role ?? 'admin' };
  const insertQueue = [...(config.insertErrors ?? [null])];
  const updateQueue = [...(config.updateErrors ?? [null])];
  const insertedPayloads: Record<string, unknown>[] = [];
  const updatedPayloads: Record<string, unknown>[] = [];
  const operationsInserts: Record<string, unknown>[] = [];

  const mock = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
    from: jest.fn((table: string) => {
      if (table === 'employees') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: employee, error: null }),
            }),
          }),
        };
      }

      if (table === 'machine_operations') {
        return {
          insert: jest.fn((payload: Record<string, unknown>) => {
            operationsInserts.push(payload);
            return Promise.resolve({ error: null });
          }),
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: config.opRows ?? [], error: null }),
          }),
        };
      }

      if (table === 'departments') {
        return {
          select: jest.fn().mockResolvedValue({ data: config.deptRows ?? [], error: null }),
        };
      }

      // 'machines'
      return {
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockResolvedValue({
            data: config.machineRows ?? [],
            error: config.machineRowsError ?? null,
          }),
        }),
        insert: jest.fn((payload: Record<string, unknown>) => {
          insertedPayloads.push(payload);
          const nextError = insertQueue.shift() ?? null;
          return {
            select: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: nextError ? null : { id: 'machine-created-1' },
                error: nextError,
              }),
            }),
          };
        }),
        update: jest.fn((payload: Record<string, unknown>) => {
          updatedPayloads.push(payload);
          const nextError = updateQueue.shift() ?? null;
          return {
            eq: jest.fn().mockResolvedValue({ error: nextError }),
          };
        }),
      };
    }),
    _insertedPayloads: insertedPayloads,
    _updatedPayloads: updatedPayloads,
    _operationsInserts: operationsInserts,
  };

  createServerSupabaseClient.mockResolvedValue(mock);
  return mock;
}

describe('Admin Fleet server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('adminAddMachine', () => {
    it('rejects non-admin or unauthenticated callers', async () => {
      buildFleetSupabaseMock({ user: null });
      await expect(
        adminAddMachine({
          name: 'DT-101',
          machine_type: 'Articulated Dumper',
          manufacturer: 'Volvo',
          serial_number: 'Volvo A45G',
          starting_smr: 1000,
          department_id: 'dept-prod',
        })
      ).resolves.toEqual({ error: 'Unauthorized' });

      buildFleetSupabaseMock({ role: 'operator' });
      await expect(
        adminAddMachine({
          name: 'DT-101',
          machine_type: 'Articulated Dumper',
          manufacturer: 'Volvo',
          serial_number: 'Volvo A45G',
          starting_smr: 1000,
          department_id: 'dept-prod',
        })
      ).resolves.toEqual({ error: 'Forbidden: admin role required' });
    });

    it('validates required fields before database insert', async () => {
      buildFleetSupabaseMock();
      await expect(
        adminAddMachine({
          name: 'DT-101',
          machine_type: '   ',
          manufacturer: 'Volvo',
          starting_smr: 1000,
          department_id: 'dept-prod',
        })
      ).resolves.toEqual({ error: 'Machine Type is required.' });

      await expect(
        adminAddMachine({
          name: 'DT-101',
          machine_type: 'Dozer',
          manufacturer: '',
          starting_smr: 1000,
          department_id: 'dept-prod',
        })
      ).resolves.toEqual({ error: 'Machine Manufacturer is required.' });

      await expect(
        adminAddMachine({
          name: '',
          serial_number: '',
          machine_type: 'Dozer',
          manufacturer: 'Caterpillar',
          starting_smr: 1000,
          department_id: 'dept-prod',
        })
      ).resolves.toEqual({ error: 'Machine Id is required.' });

      await expect(
        adminAddMachine({
          name: 'BD-22',
          machine_type: 'Dozer',
          manufacturer: 'Caterpillar',
          starting_smr: null,
          department_id: 'dept-prod',
        })
      ).resolves.toEqual({ error: 'Starting SMR on Site is required.' });

      await expect(
        adminAddMachine({
          name: 'BD-22',
          machine_type: 'Dozer',
          manufacturer: 'Caterpillar',
          starting_smr: 1000,
          department_id: '',
        })
      ).resolves.toEqual({ error: 'Department is required.' });
    });

    it('creates machine, seeds machine_operations starting SMR, and invalidates caches', async () => {
      const mock = buildFleetSupabaseMock();

      const res = await adminAddMachine({
        name: 'DT-205',
        serial_number: 'Volvo A45G',
        machine_type: 'Articulated Dumper',
        manufacturer: 'Volvo',
        starting_smr: 11250,
        bin_factor_waste: 18,
        bin_factor_coal: 22,
        department_id: 'dept-prod',
        site_id: 'site-1',
      });

      expect(res).toEqual({ success: true });
      expect(mock._insertedPayloads[0]).toEqual(
        expect.objectContaining({
          name: 'DT-205',
          serial_number: 'Volvo A45G',
          manufacturer: 'Volvo',
          image_url: '/images/fleet/volvo-adt.webp',
          starting_smr: 11250,
          bin_factor: 18,
        })
      );
      expect(mock._operationsInserts[0]).toEqual(
        expect.objectContaining({
          machine_id: 'machine-created-1',
          start_smu: 11250,
          end_smu: 11250,
        })
      );
      expect(updateTags).toHaveBeenCalledWith(['table:fleet', 'table:equipment', 'table:machines']);
      expect(revalidatePath).toHaveBeenCalledWith('/admin');
    });

    it('falls back when primary insert errors and surfaces failure if fallback also fails', async () => {
      buildFleetSupabaseMock({ insertErrors: [new Error('column image_url missing'), null] });
      const recovered = await adminAddMachine({
        name: 'BD-22',
        serial_number: 'Caterpillar D9R',
        machine_type: 'Dozer',
        manufacturer: 'Caterpillar',
        starting_smr: 14500,
        department_id: 'dept-prod',
      });
      expect(recovered).toEqual({ success: true });

      buildFleetSupabaseMock({
        insertErrors: [new Error('primary err'), new Error('fallback err')],
      });
      const failed = await adminAddMachine({
        name: 'BD-22',
        serial_number: 'Caterpillar D9R',
        machine_type: 'Dozer',
        manufacturer: 'Caterpillar',
        starting_smr: 14500,
        department_id: 'dept-prod',
      });
      expect(failed).toEqual({ error: 'Failed to add machine' });
    });
  });

  describe('adminUpdateMachine', () => {
    it('validates authorization and non-empty ID/type updates', async () => {
      buildFleetSupabaseMock({ role: 'operator' });
      await expect(adminUpdateMachine('m-1', { active: false })).resolves.toEqual({
        error: 'Forbidden: admin role required',
      });

      buildFleetSupabaseMock();
      await expect(adminUpdateMachine('m-1', { name: '  ' })).resolves.toEqual({
        error: 'Machine ID cannot be empty.',
      });
      await expect(adminUpdateMachine('m-1', { machine_type: '  ' })).resolves.toEqual({
        error: 'Machine type cannot be empty.',
      });
    });

    it('updates machine cleanly and supports legacy fallback on schema error', async () => {
      const mock = buildFleetSupabaseMock();
      const ok = await adminUpdateMachine('m-1', {
        name: 'BD-22',
        serial_number: 'Caterpillar D9R',
        manufacturer: 'Caterpillar',
        image_url: '/images/fleet/caterpillar-dozer.webp',
        bin_factor_coal: 20,
      });
      expect(ok).toEqual({ success: true });
      expect(mock._updatedPayloads[0]).toEqual(
        expect.objectContaining({
          name: 'BD-22',
          serial_number: 'Caterpillar D9R',
          bin_factor: 20,
        })
      );

      buildFleetSupabaseMock({ updateErrors: [new Error('schema err'), null] });
      const recovered = await adminUpdateMachine('m-2', { manufacturer: 'Komatsu', name: 'KD-04' });
      expect(recovered).toEqual({ success: true });

      buildFleetSupabaseMock({ updateErrors: [new Error('err1'), new Error('err2')] });
      const failed = await adminUpdateMachine('m-3', { active: false });
      expect(failed).toEqual({ error: 'Failed to update machine' });
    });
  });

  describe('adminGenerateStartingSmr', () => {
    it('returns auth/db errors when caller is unauthorized or query fails', async () => {
      buildFleetSupabaseMock({ role: 'supervisor' });
      await expect(adminGenerateStartingSmr()).resolves.toEqual({
        error: 'Forbidden: admin role required',
      });

      buildFleetSupabaseMock({ machineRowsError: new Error('db timeout') });
      await expect(adminGenerateStartingSmr()).resolves.toEqual({
        error: 'Failed to inspect fleet machines for SMR generation.',
      });
    });

    it('backfills SMR from historical ops or deterministic baseline, moves Admin machines to Production, and skips complete rows', async () => {
      const mock = buildFleetSupabaseMock({
        deptRows: [
          { id: 'dept-admin', name: 'admin' },
          { id: 'dept-prod', name: 'production' },
        ],
        opRows: [{ machine_id: 'm-1', start_smu: 8421.34, end_smu: 8430 }],
        machineRows: [
          {
            id: 'm-1',
            name: 'DT-102',
            serial_number: 'Dump Truck 102',
            machine_type: 'Articulated Dumper',
            manufacturer: null,
            starting_smr: 0,
            department_id: 'dept-admin',
          },
          {
            id: 'm-2',
            name: 'BD-22',
            serial_number: 'Caterpillar D9R',
            machine_type: 'Dozer',
            manufacturer: '',
            starting_smr: null,
            department_id: null,
          },
          {
            id: 'm-3',
            name: 'EX-14',
            serial_number: 'Hitachi EX870',
            machine_type: 'Excavator',
            manufacturer: 'Hitachi',
            starting_smr: 13200,
            department_id: 'dept-prod',
          },
        ],
      });

      const res = await adminGenerateStartingSmr();
      expect(res).toEqual({ success: true, updatedCount: 2 });
      expect(mock._updatedPayloads).toHaveLength(2);
      expect(mock._updatedPayloads[0]).toEqual({
        starting_smr: 8421.3,
        manufacturer: 'Volvo',
        image_url: '/images/fleet/volvo-adt.webp',
        department_id: 'dept-prod',
      });
      expect(mock._updatedPayloads[1]).toEqual(
        expect.objectContaining({
          manufacturer: 'Caterpillar',
          image_url: '/images/fleet/caterpillar-dozer.webp',
          department_id: 'dept-prod',
        })
      );
      expect(updateTags).toHaveBeenCalledWith(['table:fleet', 'table:equipment', 'table:machines']);
      expect(revalidatePath).toHaveBeenCalledWith('/admin');
    });
  });
});
