/**
 * @jest-environment node
 */

import { saveDelayEntriesBatch } from './actions';

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const { cacheInvalidateTags } = jest.requireMock('@repo/redis');
const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server');
const { revalidatePath } = jest.requireMock('next/cache');

const OP_ID = '0f160914-d92e-45d9-9547-d3d1a11ef6a1';
const CAT_ID = '1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d';
const ENTRY_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';

describe('saveDelayEntriesBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid payloads with ValidationError before hitting Supabase', async () => {
    await expect(
      saveDelayEntriesBatch({
        machineOperationId: 'bad-id',
        entries: [],
      })
    ).rejects.toThrow('Invalid delay entry payload');

    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests with AuthError', async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    await expect(
      saveDelayEntriesBatch({
        machineOperationId: OP_ID,
        entries: [],
      })
    ).rejects.toThrow('Unauthorized');
  });

  it('enforces the 12-hour combined shift delay cap with Engineering breakdowns', async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'machine_operations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: OP_ID,
                machine_id: 'm-1',
                shift_date: '2026-06-15',
                machine: { serial_number: 'SN-1', name: 'DT-101' },
              },
              error: null,
            }),
          };
        }
        if (table === 'breakdowns') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            or: jest.fn().mockResolvedValue({
              data: [
                { fleet_id: 'SN-1', reason: 'Engine fault', delay_hours: 9, status: 'active' },
              ],
              error: null,
            }),
          };
        }
        return {};
      }),
    });

    await expect(
      saveDelayEntriesBatch({
        machineOperationId: OP_ID,
        entries: [
          {
            delay_category_id: CAT_ID,
            delay_start_time: '2026-06-15T06:00:00Z',
            delay_end_time: '2026-06-15T10:00:00Z',
            is_manual_override: true,
            manual_duration_hours: 4,
            description: 'Exceeds remaining 3h cap',
            status: 'draft',
          },
        ],
      })
    ).rejects.toThrow('Combined shift delay (13.0h) exceeds 12.0h shift limit');
  });

  it('updates existing entries scoped by machine_operation_id and inserts new draft entries', async () => {
    const updateEqOp = jest.fn().mockResolvedValue({ error: null });
    const updateEqId = jest.fn().mockReturnValue({ eq: updateEqOp });
    const updateMock = jest.fn().mockReturnValue({ eq: updateEqId });
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'machine_operations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'delay_entries') {
          return {
            update: updateMock,
            insert: insertMock,
          };
        }
        return {};
      }),
    });

    const result = await saveDelayEntriesBatch({
      machineOperationId: OP_ID,
      entries: [
        {
          id: ENTRY_ID,
          delay_category_id: CAT_ID,
          delay_start_time: '2026-06-15T06:00:00+00:00',
          delay_end_time: '2026-06-15T07:00:00+00:00',
          is_manual_override: false,
          manual_duration_hours: null,
          description: 'Updated entry',
        },
        {
          delay_category_id: CAT_ID,
          delay_start_time: '2026-06-15T08:00:00+00:00',
          delay_end_time: '2026-06-15T09:30:00+00:00',
          is_manual_override: false,
          manual_duration_hours: null,
          description: 'New entry',
        },
      ],
    });

    expect(result).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith({
      delay_category_id: CAT_ID,
      delay_start_time: '2026-06-15T06:00:00+00:00',
      delay_end_time: '2026-06-15T07:00:00+00:00',
      is_manual_override: false,
      manual_duration_hours: null,
      description: 'Updated entry',
    });
    expect(updateEqId).toHaveBeenCalledWith('id', ENTRY_ID);
    expect(updateEqOp).toHaveBeenCalledWith('machine_operation_id', OP_ID);

    expect(insertMock).toHaveBeenCalledWith({
      machine_operation_id: OP_ID,
      delay_category_id: CAT_ID,
      delay_start_time: '2026-06-15T08:00:00+00:00',
      delay_end_time: '2026-06-15T09:30:00+00:00',
      is_manual_override: false,
      manual_duration_hours: null,
      description: 'New entry',
      status: 'draft',
    });
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['table:delay_entries']);
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });
});
