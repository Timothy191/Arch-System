/**
 * @jest-environment node
 */

import { invalidateShiftSheetCache } from './shift-sheet-cache';

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

const DEPT_ID = '0f160914-d92e-45d9-9547-d3d1a11ef6a1';

function mockUser(user: { id: string } | null) {
  createServerSupabaseClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  });
}

describe('invalidateShiftSheetCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no-ops when departmentId is not a valid UUID', async () => {
    await invalidateShiftSheetCache({ departmentId: 'not-a-uuid' });

    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(cacheInvalidateTags).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('no-ops when the user is unauthenticated', async () => {
    mockUser(null);

    await invalidateShiftSheetCache({ departmentId: DEPT_ID });

    expect(cacheInvalidateTags).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('invalidates machine_operations and department tags by default', async () => {
    mockUser({ id: 'user-1' });

    await invalidateShiftSheetCache({ departmentId: DEPT_ID });

    expect(cacheInvalidateTags).toHaveBeenCalledWith([
      'table:machine_operations',
      `dept:${DEPT_ID}`,
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('includes dozer_rolls and delay_entries tags when requested', async () => {
    mockUser({ id: 'user-1' });

    await invalidateShiftSheetCache({
      departmentId: DEPT_ID,
      wroteDozerRolls: true,
      wroteDelayEntries: true,
    });

    expect(cacheInvalidateTags).toHaveBeenCalledWith([
      'table:machine_operations',
      `dept:${DEPT_ID}`,
      'table:dozer_rolls',
      'table:delay_entries',
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });
});
