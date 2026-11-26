/**
 * @jest-environment node
 */

jest.mock('./shared', () => ({
  assertAccessControlRole: jest.fn(),
}));

jest.mock('@repo/logger/server', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn(async () => undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

jest.mock('@/lib/jobs/workflow-runner', () => ({
  triggerTrackedWorkflow: jest.fn(async () => undefined),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(async () => undefined),
}));

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}));

import { logger } from '@repo/logger/server';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import {
  executeEasyScan,
  getAccessLogsForDepartment,
  getAccessLogsWithFilters,
  getAllEmployeesAttendanceRegister,
  getBadgesForDepartment,
  getEmployeeAttendanceSummary,
  getPersonnelListForFilter,
  getVisitorsForDepartment,
  registerVisitor,
} from './badges';
import { classifyAccessLogCategory } from './badges-category';
import { assertAccessControlRole } from './shared';

const mockAssertRole = jest.mocked(assertAccessControlRole);
const mockServiceClient = jest.mocked(createServiceRoleClient);
const mockLoggerWarn = jest.mocked(logger.warn);

interface ChainResponse {
  readonly data: unknown;
  readonly count?: number | null;
  readonly error: { readonly message: string; readonly code?: string } | null;
}

function buildSupabaseChain(
  resolver: (state: {
    readonly selectCols: string;
    readonly rangeFrom?: number;
    readonly rangeTo?: number;
    readonly filters: Record<string, unknown>;
  }) => ChainResponse
) {
  const state: {
    selectCols: string;
    rangeFrom?: number;
    rangeTo?: number;
    filters: Record<string, unknown>;
  } = {
    selectCols: '',
    filters: {},
  };

  const chain: Record<string, unknown> = {
    select: jest.fn((cols: string) => {
      state.selectCols = cols;
      return chain;
    }),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    eq: jest.fn((col: string, val: unknown) => {
      state.filters[col] = val;
      return chain;
    }),
    in: jest.fn((col: string, vals: unknown) => {
      state.filters[col] = vals;
      return chain;
    }),
    not: jest.fn(() => chain),
    gte: jest.fn((col: string, val: unknown) => {
      state.filters[`gte:${col}`] = val;
      return chain;
    }),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    range: jest.fn((from: number, to: number) => {
      state.rangeFrom = from;
      state.rangeTo = to;
      return chain;
    }),
    single: jest.fn(async () => resolver(state)),
    maybeSingle: jest.fn(async () => resolver(state)),
    then: (
      onFulfilled: (value: ChainResponse) => unknown,
      onRejected?: (err: unknown) => unknown
    ) => Promise.resolve(resolver(state)).then(onFulfilled, onRejected),
  };

  return chain;
}

describe('access-control badges & attendance server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAccessLogsWithFilters', () => {
    it('loads access logs cleanly with fleet enrichment and visitor name fallback', async () => {
      const sampleLogs = [
        {
          id: 'log-1',
          scanned_at: '2026-10-27T06:15:00Z',
          gate_location: 'Main Gate North Turnstile',
          access_granted: true,
          denial_reason: null,
          access_type: 'QR Scan',
          direction: 'IN',
          alcohol_tested: 'Approved',
          operator: 'Gate Officer',
          device_id: 'C66-01',
          badge_id: 'badge-1',
          badge: {
            id: 'badge-1',
            qr_code: 'BADGE-EMP-001',
            rfid_code: 'RFID-001',
            entity_type: 'personnel',
            fleet_id: null,
            personnel: {
              id: 'person-1',
              first_name: 'John',
              surname: 'Doe',
              emp_code: 'Brak 0043',
              id_number: '9001015009081',
              job_title: 'Mining Engineer',
            },
            visitor: null,
          },
        },
        {
          id: 'log-2',
          scanned_at: '2026-10-27T07:00:00Z',
          gate_location: 'Weighbridge Inbound',
          access_granted: false,
          denial_reason: 'DENIED - Alcohol Screening Failed',
          access_type: 'RFID',
          direction: 'IN',
          alcohol_tested: 'Failed',
          operator: 'C66',
          device_id: 'C66-02',
          badge_id: 'badge-2',
          badge: {
            id: 'badge-2',
            qr_code: 'BADGE-FLEET-01',
            rfid_code: null,
            entity_type: 'fleet',
            fleet_id: 'fleet-1',
            personnel: null,
            visitor: {
              id: 'vis-1',
              name: 'Alex Contractor',
              first_name: null,
              surname: null,
              id_number: '8502025009082',
              company: 'Safety Corp',
            },
          },
        },
      ];

      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn((table: string) => {
            if (table === 'access_logs') {
              return buildSupabaseChain(() => ({
                data: sampleLogs,
                count: 2,
                error: null,
              }));
            }
            if (table === 'fleet') {
              return buildSupabaseChain(() => ({
                data: [{ id: 'fleet-1', fleet_code: 'ADT-14', registration_number: 'ND-7741' }],
                error: null,
              }));
            }
            return buildSupabaseChain(() => ({ data: [], error: null }));
          }),
        },
      } as never);

      const res = await getAccessLogsWithFilters({
        dateRange: 'QUARTER',
        direction: 'ALL',
        statusFilter: 'ALL',
      });

      expect(res.queryWarning).toBeNull();
      expect(res.totalCount).toBe(2);
      expect(res.logs).toHaveLength(2);
      expect(res.logs[0]?.badge?.personnel?.id_number).toBe('9001015009081');
      expect(res.logs[1]?.badge?.fleet?.fleet_code).toBe('ADT-14');
      expect(res.logs[1]?.badge?.visitor?.first_name).toBe('Alex');
      expect(res.logs[1]?.badge?.visitor?.surname).toBe('Contractor');
    });

    it('falls back progressively from primary -> reduced -> core without throwing in RSC render', async () => {
      let attempt = 0;
      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn(() =>
            buildSupabaseChain(({ selectCols }) => {
              attempt += 1;
              if (selectCols.includes('alcohol_tested') || selectCols.includes('badge:badges')) {
                return {
                  data: null,
                  error: { message: 'column alcohol_tested does not exist', code: '42703' },
                };
              }
              return {
                data: [
                  {
                    id: 'log-core-1',
                    scanned_at: '2026-10-27T08:00:00Z',
                    gate_location: 'East Pit',
                    access_granted: true,
                    denial_reason: null,
                    access_type: 'QR',
                    direction: 'IN',
                    badge_id: null,
                  },
                ],
                count: 1,
                error: null,
              };
            })
          ),
        },
      } as never);

      const res = await getAccessLogsForDepartment('dept-1', 1, 25);

      expect(attempt).toBe(3);
      expect(res.logs).toHaveLength(1);
      expect(res.queryWarning).toContain('core access logs');
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it('recovers with empty logs and queryWarning when all tiers fail or throw', async () => {
      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn(() =>
            buildSupabaseChain(() => ({
              data: null,
              error: { message: 'PostgREST offline', code: 'PGRST000' },
            }))
          ),
        },
      } as never);

      const res = await getAccessLogsWithFilters({ dateRange: 'YEAR' });
      expect(res.logs).toEqual([]);
      expect(res.totalCount).toBe(0);
      expect(res.queryWarning).toContain('fallback');
    });

    it('filters by searchQuery across id_number, emp_code, and denial_reason, plus employeeId badge lookup', async () => {
      const sampleLogs = [
        {
          id: 'log-a',
          scanned_at: '2026-10-27T06:00:00Z',
          gate_location: 'North Gate',
          access_granted: false,
          denial_reason: 'Failed Breathalyzer',
          access_type: 'QR',
          direction: 'IN',
          alcohol_tested: 'Failed',
          badge: {
            id: 'b-1',
            qr_code: 'QR-01',
            rfid_code: 'RF-01',
            entity_type: 'personnel',
            personnel: {
              id: 'p-1',
              first_name: 'Alice',
              surname: 'ADT',
              emp_code: 'Brak 0043',
              id_number: '9204040001088',
              job_title: 'Operator',
            },
            visitor: null,
          },
        },
        {
          id: 'log-b',
          scanned_at: '2026-10-27T07:00:00Z',
          gate_location: 'South Gate',
          access_granted: true,
          denial_reason: null,
          access_type: 'QR',
          direction: 'OUT',
          alcohol_tested: 'Approved',
          badge: {
            id: 'b-2',
            qr_code: 'QR-02',
            rfid_code: 'RF-02',
            entity_type: 'personnel',
            personnel: {
              id: 'p-2',
              first_name: 'Bob',
              surname: 'Builder',
              emp_code: 'EMP-999',
              id_number: '8001010001081',
              job_title: 'Driver',
            },
            visitor: null,
          },
        },
      ];

      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn((table: string) => {
            if (table === 'badges') {
              return buildSupabaseChain(() => ({
                data: [{ id: 'b-1' }],
                error: null,
              }));
            }
            return buildSupabaseChain(() => ({
              data: sampleLogs,
              count: 2,
              error: null,
            }));
          }),
        },
      } as never);

      const byIdSearch = await getAccessLogsWithFilters({
        employeeId: 'p-1',
        searchQuery: '9204040001088',
        dateRange: 'TODAY',
        direction: 'IN',
        statusFilter: 'DENIED',
      });
      expect(byIdSearch.totalCount).toBe(1);
      expect(byIdSearch.logs[0]?.id).toBe('log-a');

      const byReasonSearch = await getAccessLogsWithFilters({
        searchQuery: 'Breathalyzer',
        dateRange: 'WEEK',
      });
      expect(byReasonSearch.totalCount).toBe(1);
      expect(byReasonSearch.logs[0]?.id).toBe('log-a');
    });
  });

  describe('getPersonnelListForFilter', () => {
    it('returns idNumber and falls back cleanly if extended personnel columns fail', async () => {
      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn(() =>
            buildSupabaseChain(({ selectCols }) => {
              if (selectCols.includes('id_number')) {
                return { data: null, error: { message: 'missing id_number' } };
              }
              return {
                data: [{ id: 'p-1', first_name: 'John', surname: 'Doe', emp_code: 'EMP-1' }],
                error: null,
              };
            })
          ),
        },
      } as never);

      const list = await getPersonnelListForFilter();
      expect(list).toEqual([
        {
          id: 'p-1',
          name: 'John Doe',
          empCode: 'EMP-1',
          idNumber: 'N/A',
          jobTitle: 'Employee',
        },
      ]);
    });
  });

  describe('getEmployeeAttendanceSummary & getAllEmployeesAttendanceRegister', () => {
    it('aggregates multi-month daily attendance, alcohol pass/fail, and denial reasons across >1000-row pages', async () => {
      const pageOneRows = Array.from({ length: 1000 }, (_, idx) => ({
        id: `log-p1-${idx}`,
        badge_id: 'b-1',
        scanned_at: '2026-09-15T06:00:00Z',
        direction: 'IN',
        access_granted: true,
        denial_reason: null,
        alcohol_tested: 'Approved',
        gate_location: 'Main Gate',
      }));

      const pageTwoRows = [
        {
          id: 'log-p2-1',
          badge_id: 'b-1',
          scanned_at: '2026-09-15T14:30:00Z',
          direction: 'OUT',
          access_granted: true,
          denial_reason: null,
          alcohol_tested: 'Approved',
          gate_location: 'Main Gate',
        },
        {
          id: 'log-p2-2',
          badge_id: 'b-1',
          scanned_at: '2026-10-10T06:05:00Z',
          direction: 'IN',
          access_granted: false,
          denial_reason: 'DENIED - Alcohol Screening Failed',
          alcohol_tested: 'Failed',
          gate_location: 'East Pit',
        },
      ];

      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn((table: string) => {
            if (table === 'personnel') {
              return buildSupabaseChain(() => ({
                data: {
                  id: 'p-1',
                  first_name: 'Alice',
                  surname: 'ADT',
                  emp_code: 'Brak 0043',
                  id_number: '9001015009081',
                  job_title: 'ADT Operator',
                },
                error: null,
              }));
            }
            if (table === 'badges') {
              return buildSupabaseChain(() => ({
                data: [{ id: 'b-1', personnel_id: 'p-1' }],
                error: null,
              }));
            }
            return buildSupabaseChain(({ rangeFrom }) => ({
              data: rangeFrom === 0 ? pageOneRows : pageTwoRows,
              error: null,
            }));
          }),
        },
      } as never);

      const summary = await getEmployeeAttendanceSummary('p-1', 'QUARTER');
      expect(summary).not.toBeNull();
      expect(summary?.totalScans).toBe(1002);
      expect(summary?.grantedCount).toBe(1001);
      expect(summary?.deniedCount).toBe(1);
      expect(summary?.alcoholPassCount).toBe(1001);
      expect(summary?.alcoholFailCount).toBe(1);
      expect(summary?.alcoholTestedCount).toBe(1002);
      expect(summary?.daysPresent).toBe(1);
      expect(summary?.denialReasons).toEqual(['DENIED - Alcohol Screening Failed']);
      expect(summary?.dailyRecords).toHaveLength(2);
      expect(summary?.dailyRecords[0]).toMatchObject({
        date: '2026-10-10',
        status: 'Denied',
        alcoholTested: 'Failed',
        denialReason: 'DENIED - Alcohol Screening Failed',
      });
      expect(summary?.dailyRecords[1]).toMatchObject({
        date: '2026-09-15',
        direction: 'IN / OUT',
        status: 'Granted',
        scanCount: 1001,
      });
    });

    it('builds all-employees attendance register with search filtering and core-select fallback', async () => {
      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn((table: string) => {
            if (table === 'personnel') {
              return buildSupabaseChain(() => ({
                data: [
                  {
                    id: 'p-1',
                    first_name: 'Alice',
                    surname: 'ADT',
                    emp_code: 'Brak 0043',
                    id_number: '9001015009081',
                    job_title: 'ADT Operator',
                  },
                  {
                    id: 'p-2',
                    first_name: 'Bob',
                    surname: 'Dozer',
                    emp_code: 'EMP-009',
                    id_number: '8805055009083',
                    job_title: 'Dozer Operator',
                  },
                ],
                error: null,
              }));
            }
            if (table === 'badges') {
              return buildSupabaseChain(() => ({
                data: [
                  { id: 'b-1', personnel_id: 'p-1' },
                  { id: 'b-2', personnel_id: 'p-2' },
                ],
                error: null,
              }));
            }
            return buildSupabaseChain(({ selectCols }) => {
              if (selectCols.includes('alcohol_tested')) {
                return { data: null, error: { message: 'missing alcohol_tested' } };
              }
              return {
                data: [
                  {
                    id: 'l-1',
                    badge_id: 'b-1',
                    scanned_at: '2026-10-20T06:00:00Z',
                    direction: 'IN',
                    access_granted: true,
                    denial_reason: null,
                    gate_location: 'Main Gate',
                  },
                ],
                error: null,
              };
            });
          }),
        },
      } as never);

      const register = await getAllEmployeesAttendanceRegister({
        dateRange: 'YEAR',
        search: '9001015009081',
      });

      expect(register.totalEmployees).toBe(1);
      expect(register.records[0]).toMatchObject({
        employeeId: 'p-1',
        name: 'Alice ADT',
        coyNumber: 'Brak 0043',
        idNumber: '9001015009081',
        daysPresent: 1,
        grantedCount: 1,
        deniedCount: 0,
      });
      expect(register.queryWarning).toContain('Alcohol telemetry column unavailable');
    });
  });

  describe('legacy exports & easy scan coverage', () => {
    it('supports getBadgesForDepartment and getVisitorsForDepartment fallback mapping', async () => {
      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn((table: string) =>
            buildSupabaseChain(({ selectCols }) => {
              if (table === 'badges' && selectCols.includes('fleet:fleet_id')) {
                return { data: null, error: { message: 'no fleet relation' } };
              }
              if (table === 'badges') {
                return {
                  data: [
                    {
                      id: 'b-1',
                      qr_code: 'QR-1',
                      entity_type: 'visitor',
                      is_active: true,
                      issued_at: '2026-10-01T00:00:00Z',
                      personnel: null,
                      visitor: { name: 'Jane Guest' },
                    },
                  ],
                  count: 1,
                  error: null,
                };
              }
              if (table === 'visitors' && selectCols.includes('reason_for_entry')) {
                return { data: null, error: { message: 'legacy visitors' } };
              }
              return {
                data: [
                  {
                    id: 'v-1',
                    name: 'Jane Guest',
                    company: 'Acme',
                    purpose: 'Audit',
                    check_in_time: '2026-10-01T08:00:00Z',
                    check_out_time: null,
                    status: 'Checked In',
                  },
                ],
                count: 1,
                error: null,
              };
            })
          ),
        },
      } as never);

      const badgesRes = await getBadgesForDepartment('dept-1');
      expect(badgesRes.badges[0]?.visitor).toEqual({ first_name: 'Jane', surname: 'Guest' });

      const visitorsRes = await getVisitorsForDepartment('dept-1');
      expect(visitorsRes.visitors[0]?.reason_for_entry).toBe('Audit');
    });

    it('registers a visitor and executes easy scan outcomes cleanly', async () => {
      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn((table: string) => {
            if (table === 'visitors') {
              return buildSupabaseChain(() => ({
                data: { id: 'v-new' },
                error: null,
              }));
            }
            return buildSupabaseChain(() => ({ data: null, error: null }));
          }),
        },
        employee: { department_id: 'dept-1' },
      } as never);

      const formData = new FormData();
      formData.set('first_name', 'Sam');
      formData.set('surname', 'Tester');
      formData.set('company', 'Lab');
      formData.set('reason', 'Inspection');
      formData.set('visiting', 'Control Room');

      const regRes = await registerVisitor(formData);
      expect(regRes.success).toBe(true);
      expect(regRes.qrCode).toMatch(/^TEMP-/);

      mockServiceClient.mockReturnValue({
        from: jest.fn((table: string) => {
          if (table === 'badges') {
            return buildSupabaseChain(() => ({
              data: {
                id: 'b-1',
                is_active: true,
                entity_type: 'personnel',
                personnel_id: 'p-1',
                visitor_id: null,
                fleet_id: null,
                expires_at: null,
                department_id: 'dept-1',
              },
              error: null,
            }));
          }
          if (table === 'personnel') {
            return buildSupabaseChain(() => ({
              data: {
                first_name: 'Alice',
                surname: 'ADT',
                emp_code: 'Brak 0043',
                job_title: 'Operator',
                status: 'Active',
                induction_expiry: null,
                medical_expiry: null,
              },
              error: null,
            }));
          }
          return buildSupabaseChain(() => ({ data: null, error: null }));
        }),
      } as never);

      const scanRes = await executeEasyScan({
        code: 'BADGE-EMP-001',
        direction: 'IN',
        gateLocation: 'Main Gate',
      });
      expect(scanRes.accessGranted).toBe(true);
      expect(scanRes.name).toBe('Alice ADT');
    });

    it('classifies and filters access logs across employees, contractors, and all 4 fleet categories', async () => {
      const makeLog = (id: string, badge: Record<string, unknown>) => ({
        id,
        scanned_at: '2026-10-27T08:00:00Z',
        gate_location: 'Main Gate',
        access_granted: true,
        denial_reason: null,
        access_type: 'QR',
        direction: 'IN',
        badge_id: id,
        badge,
      });

      const logsByCategory = [
        makeLog('emp', {
          id: 'b-emp',
          qr_code: 'EMP-1',
          entity_type: 'personnel',
          personnel: {
            id: 'p-1',
            first_name: 'John',
            surname: 'Doe',
            emp_code: 'E1',
            job_title: 'Operator',
          },
        }),
        makeLog('con', {
          id: 'b-con',
          qr_code: 'CON-1',
          entity_type: 'visitor',
          visitor: { id: 'v-1', name: 'Contractor Sam', company: 'BuildCo' },
        }),
        makeLog('mach', {
          id: 'b-mach',
          qr_code: 'FL-EX',
          entity_type: 'fleet',
          fleet_id: 'fl-ex',
        }),
        makeLog('ldv', {
          id: 'b-ldv',
          qr_code: 'FL-LDV',
          entity_type: 'fleet',
          fleet_id: 'fl-ldv',
        }),
        makeLog('pers', {
          id: 'b-pers',
          qr_code: 'FL-PERS',
          entity_type: 'fleet',
          fleet_id: 'fl-pers',
        }),
        makeLog('coal', {
          id: 'b-coal',
          qr_code: 'FL-COAL',
          entity_type: 'fleet',
          fleet_id: 'fl-coal',
        }),
      ];

      expect(
        classifyAccessLogCategory({
          ...(logsByCategory[0] as never),
        })
      ).toBe('employees');
      expect(
        classifyAccessLogCategory({
          ...(logsByCategory[1] as never),
        })
      ).toBe('contractors');

      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn((table: string) => {
            if (table === 'access_logs') {
              return buildSupabaseChain(() => ({
                data: logsByCategory,
                count: logsByCategory.length,
                error: null,
              }));
            }
            if (table === 'fleet') {
              return buildSupabaseChain(() => ({
                data: [
                  {
                    id: 'fl-ex',
                    fleet_code: 'EX-01',
                    registration_number: 'NA',
                    vehicle_type: 'Excavator',
                  },
                  {
                    id: 'fl-ldv',
                    fleet_code: 'LDV-04',
                    registration_number: 'ND-111',
                    vehicle_type: 'Company LDV',
                  },
                  {
                    id: 'fl-pers',
                    fleet_code: 'PV-09',
                    registration_number: 'ND-222',
                    vehicle_type: 'Personal Sedan',
                  },
                  {
                    id: 'fl-coal',
                    fleet_code: 'CT-14',
                    registration_number: 'ND-333',
                    vehicle_type: 'Coal Haul Truck',
                  },
                ],
                error: null,
              }));
            }
            return buildSupabaseChain(() => ({ data: [], error: null }));
          }),
        },
      } as never);

      const coalResult = await getAccessLogsWithFilters({ category: 'fleet-coal-trucks' });
      expect(coalResult.totalCount).toBe(1);
      expect(coalResult.logs[0]?.id).toBe('coal');

      const machinesResult = await getAccessLogsWithFilters({ category: 'fleet-machines' });
      expect(machinesResult.totalCount).toBe(1);
      expect(machinesResult.logs[0]?.id).toBe('mach');

      const ldvResult = await getAccessLogsWithFilters({ category: 'fleet-ldv' });
      expect(ldvResult.totalCount).toBe(1);
      expect(ldvResult.logs[0]?.id).toBe('ldv');

      const personalResult = await getAccessLogsWithFilters({ category: 'fleet-personal' });
      expect(personalResult.totalCount).toBe(1);
      expect(personalResult.logs[0]?.id).toBe('pers');
    });
  });
});
