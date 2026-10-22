/**
 * @jest-environment node
 */

import { adminSaveMineralRegistry, getMineralRegistry } from './minerals';
import { adminAddMineBlock, adminDeleteMineBlock, adminUpdateMineBlock } from './sites';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn().mockResolvedValue(undefined),
  cacheGetOrSet: jest.fn((_key, fn) => fn()),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server');

function buildSupabaseMock(
  overrides: {
    isAdmin?: boolean;
    insertError?: unknown;
    updateError?: unknown;
    deleteError?: unknown;
    selectData?: unknown;
  } = {}
) {
  const isAdmin = overrides.isAdmin !== undefined ? overrides.isAdmin : true;
  const user = { id: 'admin-user-id' };
  const employee = isAdmin ? { id: 'emp-1', role: 'admin' } : { id: 'emp-2', role: 'operator' };

  const mock = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
    from: jest.fn().mockImplementation((table: string) => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: employee }),
          maybeSingle: jest.fn().mockResolvedValue({ data: overrides.selectData ?? null }),
        }),
        order: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: overrides.selectData ?? [] }),
        }),
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

  it('rejects adding mine block if not admin', async () => {
    buildSupabaseMock({ isAdmin: false });
    const res = await adminAddMineBlock({ name: 'Bench 1' });
    expect(res).toEqual({ error: 'Forbidden: admin role required' });
  });

  it('adds mine block with generated code when code is omitted', async () => {
    const mock = buildSupabaseMock({ isAdmin: true });
    const res = await adminAddMineBlock({ name: 'North Pit Bench A' });
    expect(res).toEqual({ success: true });
    expect(mock.from).toHaveBeenCalledWith('mine_blocks');
  });

  it('deletes mine block successfully', async () => {
    const mock = buildSupabaseMock({ isAdmin: true });
    const res = await adminDeleteMineBlock('test-block-id');
    expect(res).toEqual({ success: true });
    expect(mock.from).toHaveBeenCalledWith('mine_blocks');
  });

  it('updates mine block successfully', async () => {
    const mock = buildSupabaseMock({ isAdmin: true });
    const res = await adminUpdateMineBlock('a64d455c-c1a8-4091-b256-b4df25df196b', {
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

  it('returns default minerals when no config is saved', async () => {
    buildSupabaseMock({ selectData: null });
    const reg = await getMineralRegistry();
    expect(reg.waste).toContain('Overburden');
    expect(reg.coal).toContain('2#Lower');
  });

  it('rejects saving mineral registry if not admin', async () => {
    buildSupabaseMock({ isAdmin: false });
    const res = await adminSaveMineralRegistry({
      waste: ['Dyke', 'Topsoil'],
      coal: ['2#Lower'],
    });
    expect(res).toEqual({ error: 'Forbidden: admin role required' });
  });

  it('saves mineral registry successfully when admin', async () => {
    const mock = buildSupabaseMock({ isAdmin: true, selectData: null });
    const res = await adminSaveMineralRegistry({
      waste: ['Dyke', 'Overburden', 'Topsoil'],
      coal: ['2#Lower', '4#Upper'],
    });
    expect(res).toEqual({ success: true });
    expect(mock.from).toHaveBeenCalledWith('report_templates');
  });
});
