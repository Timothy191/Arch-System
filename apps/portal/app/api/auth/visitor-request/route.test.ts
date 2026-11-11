/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from './route';

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue({}),
  getUserSafely: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/api/rate-limit-middleware', () => ({
  withRateLimit: jest.fn((_req: NextRequest, handler: () => Promise<Response>) => handler()),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}));

const { createServiceRoleClient } = jest.requireMock('@repo/supabase/service-role') as {
  createServiceRoleClient: jest.Mock;
};

interface MockVisitorRow {
  readonly id: string;
  readonly first_name: string;
  readonly surname: string;
  readonly company: string;
  readonly visiting: string;
  readonly status: string;
}

interface MockBadgeRow {
  readonly id: string;
  readonly qr_code: string;
  readonly expires_at: string;
  readonly is_active: boolean;
}

interface BuildSupabaseMockOptions {
  readonly existingVisitor?: MockVisitorRow | null;
  readonly existingBadge?: MockBadgeRow | null;
  readonly insertVisitorError?: { readonly message: string; readonly code?: string } | null;
  readonly insertBadgeError?: { readonly message: string } | null;
}

function buildSupabaseMock(options: BuildSupabaseMockOptions = {}) {
  const insertedVisitors: Array<Record<string, unknown>> = [];
  const updatedVisitors: Array<Record<string, unknown>> = [];
  const insertedBadges: Array<Record<string, unknown>> = [];

  const fromMock = jest.fn((tableName: string) => {
    if (tableName === 'departments') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: '0147345f-9b85-4459-adeb-afcb8b662780' },
              error: null,
            }),
          })),
        })),
      };
    }

    if (tableName === 'visitors') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: options.existingVisitor ?? null,
              error: null,
            }),
          })),
        })),
        insert: jest.fn((rowPayload: Record<string, unknown>) => {
          insertedVisitors.push(rowPayload);
          return {
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue(
                options.insertVisitorError
                  ? { data: null, error: options.insertVisitorError }
                  : {
                      data: {
                        id: 'vis-uuid-001',
                        first_name: rowPayload.first_name,
                        surname: rowPayload.surname,
                        company: rowPayload.company,
                        visiting: rowPayload.visiting,
                        status: rowPayload.status,
                      },
                      error: null,
                    }
              ),
            })),
          };
        }),
        update: jest.fn((rowPayload: Record<string, unknown>) => {
          updatedVisitors.push(rowPayload);
          return {
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: options.existingVisitor?.id ?? 'vis-existing-001',
                    first_name: rowPayload.first_name,
                    surname: rowPayload.surname,
                    company: rowPayload.company,
                    visiting: rowPayload.visiting,
                    status:
                      rowPayload.status ?? options.existingVisitor?.status ?? 'Pre-Registered',
                  },
                  error: null,
                }),
              })),
            })),
          };
        }),
      };
    }

    if (tableName === 'badges') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              gt: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: options.existingBadge ?? null,
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          })),
        })),
        insert: jest.fn((badgePayload: Record<string, unknown>) => {
          insertedBadges.push(badgePayload);
          return {
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue(
                options.insertBadgeError
                  ? { data: null, error: options.insertBadgeError }
                  : {
                      data: {
                        id: 'badge-uuid-001',
                        qr_code: badgePayload.qr_code,
                        expires_at: badgePayload.expires_at,
                      },
                      error: null,
                    }
              ),
            })),
          };
        }),
      };
    }

    throw new Error(`Unexpected table lookup: ${tableName}`);
  });

  return {
    client: { from: fromMock },
    insertedVisitors,
    updatedVisitors,
    insertedBadges,
  };
}

function makeJsonRequest(
  requestBody: unknown,
  headerOverrides: Record<string, string> = {}
): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/visitor-request', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headerOverrides,
    },
    body: JSON.stringify(requestBody),
  });
}

describe('Given POST /api/auth/visitor-request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('When a valid visitor request is submitted, Then it stores a Pre-Registered visitor and returns a VIS-* QR pass', async () => {
    const supabaseMock = buildSupabaseMock();
    createServiceRoleClient.mockReturnValue(supabaseMock.client);

    const request = makeJsonRequest({
      first_name: 'Thabo',
      surname: 'Mokoena',
      company: 'Sandvik Mining',
      visiting: 'Engineering Workshop',
      reason_for_entry: 'Scheduled drill rig hydraulic inspection',
      id_number: '',
    });

    const response = await POST(request);
    const responseBody = (await response.json()) as {
      success: boolean;
      pass: {
        qrCode: string;
        visitorId: string;
        fullName: string;
        company: string;
        visiting: string;
        status: string;
        expiresAt: string;
      };
    };

    expect(response.status).toBe(201);
    expect(responseBody.success).toBe(true);
    expect(responseBody.pass.qrCode).toMatch(/^VIS-[A-Z0-9]{6}$/);
    expect(responseBody.pass.status).toBe('Pre-Registered');
    expect(responseBody.pass.fullName).toBe('Thabo Mokoena');
    expect(supabaseMock.insertedVisitors[0]).toEqual(
      expect.objectContaining({
        name: 'Thabo Mokoena',
        first_name: 'Thabo',
        surname: 'Mokoena',
        company: 'Sandvik Mining',
        visiting: 'Engineering Workshop',
        reason_for_entry: 'Scheduled drill rig hydraulic inspection',
        id_number: null,
        status: 'Pre-Registered',
      })
    );
    expect(supabaseMock.insertedBadges[0]).toEqual(
      expect.objectContaining({
        entity_type: 'visitor',
        visitor_id: 'vis-uuid-001',
        is_active: true,
      })
    );
  });

  it('When Content-Type is not application/json, Then it returns 415 Unsupported Media Type', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/visitor-request', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'invalid',
    });

    const response = await POST(request);
    expect(response.status).toBe(415);
  });

  it('When required fields are missing, Then it returns 400 with validation error', async () => {
    const request = makeJsonRequest({
      first_name: 'Thabo',
      surname: '',
      company: 'Sandvik Mining',
    });

    const response = await POST(request);
    const responseBody = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error).toBeTruthy();
  });

  it('When a repeat visitor submits an existing id_number with an active unexpired VIS badge, Then it reuses the badge idempotently', async () => {
    const futureExpiry = new Date(Date.now() + 3_600_000).toISOString();
    const supabaseMock = buildSupabaseMock({
      existingVisitor: {
        id: 'vis-existing-99',
        first_name: 'Thabo',
        surname: 'Mokoena',
        company: 'Sandvik Mining',
        visiting: 'Plant Control',
        status: 'Pre-Registered',
      },
      existingBadge: {
        id: 'badge-existing-99',
        qr_code: 'VIS-REPEAT',
        expires_at: futureExpiry,
        is_active: true,
      },
    });
    createServiceRoleClient.mockReturnValue(supabaseMock.client);

    const request = makeJsonRequest({
      first_name: 'Thabo',
      surname: 'Mokoena',
      company: 'Sandvik Mining',
      visiting: 'Plant Control',
      reason_for_entry: 'Follow-up calibration',
      id_number: '8901015009087',
    });

    const response = await POST(request);
    const responseBody = (await response.json()) as {
      success: boolean;
      pass: { qrCode: string; visitorId: string };
    };

    expect(response.status).toBe(200);
    expect(responseBody.success).toBe(true);
    expect(responseBody.pass.qrCode).toBe('VIS-REPEAT');
    expect(supabaseMock.insertedBadges).toHaveLength(0);
    expect(supabaseMock.updatedVisitors).toHaveLength(1);
    expect(supabaseMock.updatedVisitors[0]).toEqual(
      expect.objectContaining({
        name: 'Thabo Mokoena',
        purpose: 'Follow-up calibration',
        status: 'Pre-Registered',
        check_in_time: null,
        check_out_time: null,
      })
    );
  });

  it('When an id_number belongs to an already Checked In on-site visitor, Then it returns 409 Conflict without mutating muster records or issuing a badge', async () => {
    const supabaseMock = buildSupabaseMock({
      existingVisitor: {
        id: 'vis-onsite-01',
        first_name: 'Lerato',
        surname: 'Khumalo',
        company: 'Eskom Grid Ops',
        visiting: 'Main Substation',
        status: 'Checked In',
      },
      existingBadge: {
        id: 'badge-onsite-01',
        qr_code: 'VIS-ONSITE',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        is_active: true,
      },
    });
    createServiceRoleClient.mockReturnValue(supabaseMock.client);

    const request = makeJsonRequest({
      first_name: 'Spoofed',
      surname: 'Caller',
      company: 'Untrusted Co',
      visiting: 'Control Room',
      reason_for_entry: 'Attempted impersonation',
      id_number: '9002025009081',
    });

    const response = await POST(request);
    const responseBody = (await response.json()) as {
      success: boolean;
      error: string;
      pass?: unknown;
    };

    expect(response.status).toBe(409);
    expect(responseBody.success).toBe(false);
    expect(responseBody.pass).toBeUndefined();
    expect(supabaseMock.updatedVisitors).toHaveLength(0);
    expect(supabaseMock.insertedVisitors).toHaveLength(0);
    expect(supabaseMock.insertedBadges).toHaveLength(0);
  });

  it('When required fields contain only whitespace, Then it rejects with 400 Bad Request', async () => {
    const supabaseMock = buildSupabaseMock();
    createServiceRoleClient.mockReturnValue(supabaseMock.client);

    const request = makeJsonRequest({
      first_name: '   ',
      surname: 'Mokoena',
      company: '   ',
      visiting: 'Plant Control',
      reason_for_entry: '   ',
    });

    const response = await POST(request);
    const responseBody = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(responseBody.success).toBe(false);
    expect(supabaseMock.insertedVisitors).toHaveLength(0);
  });

  it('When database visitor insertion fails, Then it returns a controlled 500 error without leaking internals', async () => {
    const supabaseMock = buildSupabaseMock({
      insertVisitorError: { message: 'connection refused to pg pool' },
    });
    createServiceRoleClient.mockReturnValue(supabaseMock.client);

    const request = makeJsonRequest({
      first_name: 'Sarah',
      surname: 'Williams',
      company: 'Eskom Grid Ops',
      visiting: 'Substation B',
      reason_for_entry: 'Relay inspection',
    });

    const response = await POST(request);
    const responseBody = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(500);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error).not.toContain('pg pool');
  });
});
