/**
 * @jest-environment node
 */

import {
  claimRemoteSupportSession,
  createRemoteSupportSession,
  endRemoteSupportSession,
  initiateTier2ConsentSession,
  respondToRemoteSupportConsent,
  updateCobrowseConsent,
  upsertRemoteSupportDevice,
} from './actions';

const mockCreateServerSupabaseClient = jest.fn();
const mockGetAuthenticatedEmployee = jest.fn();
const mockUpdateTags = jest.fn().mockResolvedValue(undefined);

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: () => mockCreateServerSupabaseClient(),
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: (...args: unknown[]) => mockGetAuthenticatedEmployee(...args),
}));

jest.mock('@repo/logger/server', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/server-cache', () => ({
  CACHE_TAGS: {
    REMOTE_SUPPORT: 'remote-support',
    TABLE_REMOTE_SUPPORT_SESSIONS: 'table:remote_support_sessions',
    TABLE_REMOTE_SUPPORT_DEVICES: 'table:remote_support_devices',
  },
  updateTags: (...args: unknown[]) => mockUpdateTags(...args),
}));

function buildSupabaseStub(options: {
  sessionRow?: Record<string, unknown> | null;
  insertedSession?: Record<string, unknown>;
  updatedSession?: Record<string, unknown>;
  deviceRow?: Record<string, unknown> | null;
  savedDevice?: Record<string, unknown>;
  codeExists?: boolean;
}) {
  const auditInsert = jest.fn().mockResolvedValue({ error: null });

  return {
    auditInsert,
    from: jest.fn((table: string) => {
      if (table === 'remote_support_audit_events') {
        return { insert: auditInsert };
      }

      if (table === 'remote_support_devices') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: options.deviceRow ?? null,
                  error: null,
                }),
              }),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: options.savedDevice ?? {
                  id: '11111111-1111-4111-8111-111111111111',
                  hostname: 'CR-OP-01',
                },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: options.savedDevice ?? {
                    id: '11111111-1111-4111-8111-111111111111',
                    hostname: 'CR-OP-01',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: options.codeExists ? { id: 'existing' } : (options.sessionRow ?? null),
              error: null,
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: options.insertedSession ?? {
                id: '22222222-2222-4222-8222-222222222222',
                session_code: '654321',
                tier: 'tier1_browser',
                status: 'pending',
                department_slug: 'control-room',
                issue_summary: 'Cannot load shift report',
                expires_at: new Date(Date.now() + 600_000).toISOString(),
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: options.updatedSession ?? {
                  id: '22222222-2222-4222-8222-222222222222',
                  session_code: '654321',
                  tier: 'tier1_browser',
                  status: 'consent_requested',
                  cobrowse_enabled: false,
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    }),
  };
}

describe('remote-support Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated callers', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue({});
    mockGetAuthenticatedEmployee.mockResolvedValue(null);

    await expect(
      createRemoteSupportSession({ issueSummary: 'Help with SCADA screen' })
    ).rejects.toThrow(/Unauthorized/i);
  });

  it('creates a Tier 1 session, writes an audit event, and invalidates caches', async () => {
    const stub = buildSupabaseStub({});
    mockCreateServerSupabaseClient.mockResolvedValue(stub);
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'auth-op' },
      employee: { id: 'emp-op', role: 'operator' },
    });

    const result = await createRemoteSupportSession({
      issueSummary: 'Cannot export shift closeout PDF',
      departmentSlug: 'control-room',
    });

    expect(result.success).toBe(true);
    expect(result.session.session_code).toBe('654321');
    expect(stub.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'session_created' })
    );
    expect(mockUpdateTags).toHaveBeenCalled();
  });

  it('forbids operators from claiming support sessions and allows supervisors', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildSupabaseStub({}));
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'auth-op' },
      employee: { id: 'emp-op', role: 'operator' },
    });

    await expect(claimRemoteSupportSession({ sessionCode: '654321' })).rejects.toThrow(
      /Only admins or supervisors/i
    );

    const supStub = buildSupabaseStub({
      sessionRow: {
        id: '22222222-2222-4222-8222-222222222222',
        session_code: '654321',
        tier: 'tier1_browser',
        status: 'pending',
        requester_employee_id: 'emp-op',
        agent_employee_id: null,
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      },
    });
    mockCreateServerSupabaseClient.mockResolvedValue(supStub);
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'auth-sup' },
      employee: { id: 'emp-sup', role: 'supervisor' },
    });

    const claimed = await claimRemoteSupportSession({ sessionCode: '654321' });
    expect(claimed.success).toBe(true);
    expect(supStub.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'consent_requested' })
    );
  });

  it('enforces requester-only consent and co-browse controls', async () => {
    const stub = buildSupabaseStub({
      sessionRow: {
        id: '22222222-2222-4222-8222-222222222222',
        requester_employee_id: 'emp-op',
        agent_employee_id: 'emp-sup',
        status: 'active',
      },
      updatedSession: {
        id: '22222222-2222-4222-8222-222222222222',
        status: 'active',
        cobrowse_enabled: true,
      },
    });
    mockCreateServerSupabaseClient.mockResolvedValue(stub);
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'auth-sup' },
      employee: { id: 'emp-sup', role: 'supervisor' },
    });

    await expect(
      respondToRemoteSupportConsent({
        sessionId: '22222222-2222-4222-8222-222222222222',
        approved: true,
      })
    ).rejects.toThrow(/Only the session requester/i);

    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'auth-op' },
      employee: { id: 'emp-op', role: 'operator' },
    });

    const consentRes = await respondToRemoteSupportConsent({
      sessionId: '22222222-2222-4222-8222-222222222222',
      approved: true,
    });
    expect(consentRes.success).toBe(true);

    const cobrowseRes = await updateCobrowseConsent({
      sessionId: '22222222-2222-4222-8222-222222222222',
      enabled: true,
    });
    expect(cobrowseRes.success).toBe(true);

    const endRes = await endRemoteSupportSession({
      sessionId: '22222222-2222-4222-8222-222222222222',
      isRevoked: true,
    });
    expect(endRes.success).toBe(true);
  });

  it('restricts managed workstation CRUD to admin and supports Tier 2 consent initiation', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(buildSupabaseStub({}));
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'auth-sup' },
      employee: { id: 'emp-sup', role: 'supervisor' },
    });

    await expect(
      upsertRemoteSupportDevice({
        hostname: 'CR-OP-01',
        displayName: 'Control Room 1',
        deviceClass: 'workstation',
        protocol: 'rdp',
        networkHost: '10.20.4.18',
        networkPort: 3389,
        requireUserConsent: true,
        isActive: true,
      })
    ).rejects.toThrow(/Only admins/i);

    const adminStub = buildSupabaseStub({
      deviceRow: {
        id: '11111111-1111-4111-8111-111111111111',
        hostname: 'CR-OP-01',
        assigned_employee_id: 'emp-op',
        require_user_consent: true,
      },
      insertedSession: {
        id: '33333333-3333-4333-8333-333333333333',
        session_code: '777888',
        tier: 'tier2_os_desktop',
        status: 'consent_requested',
      },
    });
    mockCreateServerSupabaseClient.mockResolvedValue(adminStub);
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'auth-adm' },
      employee: { id: 'emp-adm', role: 'admin' },
    });

    const saved = await upsertRemoteSupportDevice({
      hostname: 'CR-OP-01',
      displayName: 'Control Room 1',
      deviceClass: 'workstation',
      protocol: 'rdp',
      networkHost: '10.20.4.18',
      networkPort: 3389,
      requireUserConsent: true,
      isActive: true,
    });
    expect(saved.success).toBe(true);

    const t2 = await initiateTier2ConsentSession({
      deviceId: '11111111-1111-4111-8111-111111111111',
      issueSummary: 'Need OS printer service restart',
    });
    expect(t2.session.tier).toBe('tier2_os_desktop');
  });
});
