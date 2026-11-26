/**
 * @jest-environment node
 */
import { cacheInvalidateTags } from '@repo/redis';
import { revalidatePath } from 'next/cache';
import { assertAccessControlRoleFor } from '../actions/shared';
import {
  createBadgeCredential,
  getBadgesInventory,
  getEntityOptions,
  revokeBadgeCredential,
} from './actions';

jest.mock('../actions/shared', () => ({
  assertAccessControlRoleFor: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn(async () => undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const mockAssertRole = jest.mocked(assertAccessControlRoleFor);

function createFluentQuery(result: { data: unknown; error: unknown }) {
  const promise = Promise.resolve(result);
  const chain: Record<string, jest.Mock> & {
    then: typeof promise.then;
    catch: typeof promise.catch;
  } = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn(async () => result),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
  return chain;
}

describe('access-control/qr-codes/actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getBadgesInventory sanitizes PostgREST .or() search input and maps entities', async () => {
    const badgeRows = [
      {
        id: 'b-1',
        qr_code: 'QR-EMP-001',
        rfid_code: 'RF-1',
        entity_type: 'personnel',
        is_active: true,
        issued_at: '2026-11-19T08:00:00Z',
        expires_at: null,
        personnel: {
          id: 'p-1',
          first_name: 'Thabo',
          surname: 'Mokoena',
          emp_code: 'EMP-10',
          status: 'Active',
          job_title: 'Operator',
        },
        visitor: null,
        fleet: null,
        equipment: null,
      },
      {
        id: 'b-2',
        qr_code: 'TRK-COAL-12',
        rfid_code: null,
        entity_type: 'vehicle',
        is_active: true,
        issued_at: '2026-11-19T08:00:00Z',
        expires_at: null,
        personnel: null,
        visitor: null,
        fleet: {
          id: 'f-1',
          fleet_code: 'CT-12',
          vehicle_type: 'Coal Truck',
          registration_number: 'CY 99 GP',
          make: 'Scania',
          model: 'R500',
          status: 'Active',
        },
        equipment: null,
      },
    ];
    const queryChain = createFluentQuery({ data: badgeRows, error: null });

    mockAssertRole.mockResolvedValue({
      supabase: { from: jest.fn(() => queryChain) },
      employee: { id: 'emp-1', role: 'access_control', department_id: 'dept-ac' },
    } as never);

    const results = await getBadgesInventory('coal_truck', 'TRK-1,(2)%*');

    expect(queryChain.in).toHaveBeenCalledWith('entity_type', ['vehicle', 'fleet']);
    expect(queryChain.or).toHaveBeenCalledWith('qr_code.ilike.%TRK-12%,rfid_code.ilike.%TRK-12%');
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('b-2');
    expect(results[0]?.entity_subtitle).toContain('Coal Truck');
  });

  it('getBadgesInventory falls back gracefully when primary schema query errors', async () => {
    const primaryChain = createFluentQuery({ data: null, error: { message: 'col missing' } });
    const fallbackChain = createFluentQuery({
      data: [
        {
          id: 'b-v',
          qr_code: 'VIS-101',
          entity_type: 'visitor',
          is_active: true,
          issued_at: '2026-11-19T08:00:00Z',
          personnel: null,
          visitor: { id: 'v-1', name: 'John Doe', company: 'MiningCo', status: 'Checked In' },
        },
      ],
      error: null,
    });
    const fromMock = jest.fn().mockReturnValueOnce(primaryChain).mockReturnValueOnce(fallbackChain);

    mockAssertRole.mockResolvedValue({
      supabase: { from: fromMock },
      employee: { id: 'emp-1', role: 'admin', department_id: 'dept-ac' },
    } as never);

    const results = await getBadgesInventory('visitor', 'VIS(99)');
    expect(fallbackChain.ilike).toHaveBeenCalledWith('qr_code', '%VIS99%');
    expect(results[0]?.entity_name).toBe('John Doe');
    expect(results[0]?.entity_subtitle).toContain('MiningCo');
  });

  it('getEntityOptions loads personnel, fleet, visitors, and equipment options', async () => {
    const tables: Record<string, ReturnType<typeof createFluentQuery>> = {
      personnel: createFluentQuery({
        data: [
          {
            id: 'p-1',
            first_name: 'S.',
            surname: 'Dlamini',
            emp_code: 'E01',
            job_title: 'Driller',
          },
        ],
        error: null,
      }),
      fleet: createFluentQuery({
        data: [
          {
            id: 'f-1',
            fleet_code: 'CT-01',
            vehicle_type: 'Coal Truck',
            registration_number: 'ABC123',
            make: 'Volvo',
            model: 'FH16',
          },
          {
            id: 'f-2',
            fleet_code: 'LV-02',
            vehicle_type: 'Pickup',
            registration_number: 'XYZ789',
            make: 'Toyota',
            model: 'Hilux',
          },
        ],
        error: null,
      }),
      visitors: createFluentQuery({
        data: [{ id: 'v-1', first_name: 'Jane', surname: 'Roe', company: 'Auditors' }],
        error: null,
      }),
      equipment: createFluentQuery({
        data: [{ id: 'e-1', equip_code: 'EQ-09', equipment_type: 'Generator' }],
        error: null,
      }),
    };

    mockAssertRole.mockResolvedValue({
      supabase: { from: jest.fn((t: string) => tables[t]) },
      employee: { id: 'emp-1', role: 'admin', department_id: 'dept-ac' },
    } as never);

    const options = await getEntityOptions();
    expect(options.personnel).toHaveLength(1);
    expect(options.coalTrucks).toHaveLength(1);
    expect(options.vehicles).toHaveLength(1);
    expect(options.visitors).toHaveLength(1);
    expect(options.equipment).toHaveLength(1);
  });

  it('createBadgeCredential and revokeBadgeCredential persist records and invalidate caches', async () => {
    const badgeInsertChain = createFluentQuery({
      data: { id: 'badge-new', qr_code: 'TRK-CUSTOM-1' },
      error: null,
    });
    const badgeUpdateChain = createFluentQuery({ data: [{ id: 'badge-new' }], error: null });

    const fromMock = jest
      .fn()
      .mockReturnValueOnce(badgeInsertChain)
      .mockReturnValueOnce(badgeUpdateChain);

    mockAssertRole.mockResolvedValue({
      supabase: { from: fromMock },
      employee: { id: 'emp-1', role: 'access_control', department_id: 'dept-ac' },
    } as never);

    const created = await createBadgeCredential({
      entityType: 'coal_truck',
      code: 'TRK-CUSTOM-1',
      targetEntityId: 'fleet-new',
      expiresInDays: 30,
    });
    expect(created.success).toBe(true);
    expect(created.badge).toEqual({ id: 'badge-new', qr_code: 'TRK-CUSTOM-1' });
    expect(fromMock).not.toHaveBeenCalledWith('fleet');

    const revoked = await revokeBadgeCredential('badge-new');
    expect(revoked.success).toBe(true);
    expect(cacheInvalidateTags).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/access-control/qr-codes');
  });
});
