/**
 * @jest-environment node
 */

import { adminSaveMineralRegistry, getMineralRegistry } from './minerals';
import { adminAddMineBlock, adminDeleteMineBlock, adminUpdateMineBlock } from './sites';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/server-cache', () => ({
  updateTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server');
const TEST_BLOCK_UUID = 'a64d455c-c1a8-4091-b256-b4df25df196b';

function buildSupabaseMock(
  overrides: {
    authenticated?: boolean;
    isAdmin?: boolean;
    insertError?: unknown;
    updateError?: unknown;
    deleteError?: { code?: string; message?: string } | null;
    selectData?: unknown;
  } = {}
) {
  const authenticated = overrides.authenticated !== false;
  const isAdmin = overrides.isAdmin !== undefined ? overrides.isAdmin : true;
  const user = authenticated ? { id: 'admin-user-id' } : null;
  const employee = isAdmin ? { id: 'emp-1', role: 'admin' } : { id: 'emp-2', role: 'operator' };

  const eqChain = {
    single: jest.fn().mockResolvedValue({ data: employee, error: null }),
    is: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: employee, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({
        data: overrides.selectData ?? null,
        error: null,
      }),
    }),
    maybeSingle: jest.fn().mockResolvedValue({
      data: overrides.selectData ?? null,
      error: null,
    }),
  };

  const mock = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue(eqChain),
      }),
      insert: jest.fn().mockResolvedValue({ error: overrides.insertError ?? null }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: overrides.updateError ?? null }),
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: overrides.deleteError ?? null }),
      }),
    })),
  };

  createServerSupabaseClient.mockResolvedValue(mock);
  return mock;
}

describe('Admin Sites & Mine Blocks server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects adding mine block if not admin and validates UUID on delete', async () => {
    buildSupabaseMock({ isAdmin: false });
    const res = await adminAddMineBlock({ name: 'Bench 1' });
    expect(res).toEqual({ error: 'Forbidden: admin role required' });

    buildSupabaseMock({ isAdmin: true });
    const badUuid = await adminDeleteMineBlock('not-a-uuid');
    expect(badUuid).toEqual({ error: 'Invalid mine block ID format' });
  });

  it('adds mine block with generated code when code is omitted', async () => {
    const mock = buildSupabaseMock({ isAdmin: true });
    const res = await adminAddMineBlock({ name: 'North Pit Bench A' });
    expect(res).toEqual({ success: true });
    expect(mock.from).toHaveBeenCalledWith('mine_blocks');
  });

  it('falls back to deactivation ONLY on FK violation 23503 and surfaces other errors', async () => {
    buildSupabaseMock({ isAdmin: true, deleteError: { code: '23503', message: 'fk violation' } });
    const fkRes = await adminDeleteMineBlock(TEST_BLOCK_UUID);
    expect(fkRes).toEqual({ success: true, resolution: 'deactivated' });

    buildSupabaseMock({
      isAdmin: true,
      deleteError: { code: '42501', message: 'permission denied' },
    });
    const errRes = await adminDeleteMineBlock(TEST_BLOCK_UUID);
    expect(errRes).toEqual({ error: 'permission denied' });
  });

  it('updates mine block successfully', async () => {
    const mock = buildSupabaseMock({ isAdmin: true });
    const res = await adminUpdateMineBlock(TEST_BLOCK_UUID, {
      active: false,
    });
    expect(res).toEqual({ success: true });
    expect(mock.from).toHaveBeenCalledWith('mine_blocks');
  });
});

describe('Admin Minerals Register server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enforces authentication on getMineralRegistry and returns defaults when no config is saved', async () => {
    buildSupabaseMock({ authenticated: false });
    await expect(getMineralRegistry()).rejects.toThrow('Unauthorized');

    buildSupabaseMock({ selectData: null });
    const reg = await getMineralRegistry();
    expect(reg.waste).toContain('Overburden');
    expect(reg.coal).toContain('2#Lower');
  });

  it('rejects saving mineral registry if not admin and saves when admin', async () => {
    buildSupabaseMock({ isAdmin: false });
    const res = await adminSaveMineralRegistry({
      waste: ['Dyke', 'Topsoil'],
      coal: ['2#Lower'],
    });
    expect(res).toEqual({ error: 'Forbidden: admin role required' });

    const mock = buildSupabaseMock({ isAdmin: true, selectData: null });
    const ok = await adminSaveMineralRegistry({
      waste: ['Dyke', 'Overburden', 'Topsoil'],
      coal: ['2#Lower', '4#Upper'],
    });
    expect(ok).toEqual({ success: true });
    expect(mock.from).toHaveBeenCalledWith('report_templates');
  });
});
