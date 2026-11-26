/**
 * @jest-environment node
 */
import { revalidatePath } from 'next/cache';
import { updateTags } from '@/lib/server-cache';
import {
  adminAddMachine,
  adminArchiveMachine,
  adminGenerateStartingSmr,
  adminUpdateMachine,
} from './fleet';

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
  readonly insertError?: { readonly message: string } | null;
  readonly updateError?: { readonly message: string } | null;
  readonly machineRowsError?: { readonly message: string } | null;
  readonly machineRows?: readonly Record<string, unknown>[];
  readonly deptRows?: readonly Record<string, unknown>[];
  readonly opRows?: readonly Record<string, unknown>[];
}

function buildFleetSupabaseMock(config: FleetMockConfig = {}) {
  const user = config.user === undefined ? { id: 'fleet-admin-1' } : config.user;
  const employee = { id: 'emp-admin', role: config.role ?? 'admin' };
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
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: config.opRows ?? [], error: null }),
            }),
          }),
        };
      }

      if (table === 'departments') {
        return {
          select: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({ data: config.deptRows ?? [], error: null }),
          }),
        };
      }

      return {
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockResolvedValue({
            data: config.machineRows ?? [],
            error: config.machineRowsError ?? null,
          }),
        }),
        insert: jest.fn((payload: Record<string, unknown>) => {
          insertedPayloads.push(payload);
          return {
            select: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: config.insertError ? null : { id: 'machine-created-1' },
                error: config.insertError ?? null,
              }),
            }),
          };
        }),
        update: jest.fn((payload: Record<string, unknown>) => {
          updatedPayloads.push(payload);
          return {
            eq: jest.fn().mockResolvedValue({ error: config.updateError ?? null }),
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

    it('validates required fields via Zod before database insert', async () => {
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
    });

    it('creates machine with null image_url when left blank, seeds machine_operations, and surfaces real errors', async () => {
      const mock = buildFleetSupabaseMock();

      const res = await adminAddMachine({
        name: 'DT-205',
        serial_number: 'Volvo A45G',
        machine_type: 'Articulated Dumper',
        manufacturer: 'Volvo',
        image_url: null,
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
          image_url: null,
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

      buildFleetSupabaseMock({ insertError: { message: 'duplicate key value' } });
      await expect(
        adminAddMachine({
          name: 'DT-205',
          serial_number: 'Volvo A45G',
          machine_type: 'Articulated Dumper',
          manufacturer: 'Volvo',
          starting_smr: 11250,
          department_id: 'dept-prod',
        })
      ).resolves.toEqual({ error: 'duplicate key value' });
    });
  });

  describe('adminUpdateMachine & adminArchiveMachine', () => {
    it('updates and archives machines cleanly with Zod validation', async () => {
      const mock = buildFleetSupabaseMock();
      const ok = await adminUpdateMachine('m-1', {
        name: 'BD-22',
        serial_number: 'Caterpillar D9R',
        manufacturer: 'Caterpillar',
        bin_factor_coal: 20,
      });
      expect(ok).toEqual({ success: true });
      expect(mock._updatedPayloads[0]).toEqual(
        expect.objectContaining({
          name: 'BD-22',
          bin_factor: 20,
        })
      );

      const archived = await adminArchiveMachine('m-1');
      expect(archived).toEqual({ success: true });
      expect(mock._updatedPayloads[1]).toEqual(
        expect.objectContaining({
          active: false,
          deleted_at: expect.any(String),
        })
      );
    });
  });

  describe('adminGenerateStartingSmr', () => {
    it('derives SMR strictly from machine_operations history and reports machines without operations', async () => {
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
            manufacturer: 'Caterpillar',
            starting_smr: null,
            department_id: 'dept-prod',
          },
        ],
      });

      const res = await adminGenerateStartingSmr();
      expect(res).toEqual({
        success: true,
        updatedCount: 1,
        skippedNoOpsCount: 1,
        missingOpsMachines: ['BD-22'],
      });
      expect(mock._updatedPayloads).toHaveLength(1);
      expect(mock._updatedPayloads[0]).toEqual(
        expect.objectContaining({
          starting_smr: 8421.3,
          manufacturer: 'Volvo',
          department_id: 'dept-prod',
        })
      );
    });
  });
});
