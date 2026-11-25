jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn(async () => undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const mockFrom = jest.fn();
jest.mock('../actions/shared', () => ({
  ACCESS_CONTROL_WRITE_ROLES: ['admin', 'access_control', 'supervisor'],
  assertAccessControlRoleFor: jest.fn(async () => ({
    supabase: { from: (...args: unknown[]) => mockFrom(...args) },
    user: { id: 'user-1' },
    employee: { id: 'emp-admin', department_id: 'dept-1', role: 'admin' },
  })),
}));

import {
  cancelNeo300Job,
  getDepartmentsForCardStudio,
  getEmployeeCardProfiles,
  getFleetAndVehicleBadgeProfiles,
  getNeo300PrinterStatus,
  getRecentNeo300Jobs,
  sendNeo300PrintJob,
  upsertEmployeeForCardPrinting,
} from './actions';

function makeChain(result: unknown) {
  const chain: Record<string, jest.Mock> = {};
  let hasInFilter = false;
  const methods = [
    'select',
    'insert',
    'update',
    'upsert',
    'eq',
    'in',
    'ilike',
    'is',
    'or',
    'order',
    'limit',
  ];
  for (const m of methods) {
    chain[m] = jest.fn(() => {
      if (m === 'in') {
        hasInFilter = true;
      }
      return chain;
    });
  }
  chain.maybeSingle = jest.fn(async () => result);
  chain.single = jest.fn(async () => result);
  chain.then = jest.fn((resolve: (v: unknown) => void) => {
    const resObj = result as { data?: unknown; error?: unknown } | null;
    if (hasInFilter && resObj?.data && !Array.isArray(resObj.data)) {
      const wrapped = {
        ...resObj,
        data: [{ personnel_id: 'p1', ...(resObj.data as Record<string, unknown>) }],
      };
      return Promise.resolve(wrapped).then(resolve);
    }
    return Promise.resolve(result).then(resolve);
  });
  return chain;
}

describe('print-cards actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads departments, personnel profiles with coy_number, and recent print jobs', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'departments') {
        return makeChain({
          data: [{ id: 'd1', name: 'production', display_name: 'Production' }],
          error: null,
        });
      }
      if (table === 'personnel') {
        return makeChain({
          data: [
            {
              id: 'p1',
              emp_code: 'Brak 0043',
              first_name: 'Alice',
              surname: 'ADT',
              id_number: '9001015009081',
              job_title: 'ADT Operator',
              area: 'Main Complex',
              department_id: 'd1',
              induction_expiry: '2028-01-01',
              medical_expiry: '2028-02-01',
              status: 'Active',
              photo_url: null,
              departments: { display_name: 'Production' },
            },
          ],
          error: null,
        });
      }
      if (table === 'badges') {
        return makeChain({
          data: [{ personnel_id: 'p1', qr_code: 'EMP-BRAK-0043', rfid_code: 'RFID-1' }],
          error: null,
        });
      }
      if (table === 'card_printers') {
        return makeChain({
          data: {
            id: 'pr-1',
            name: 'Neo 300',
            model: 'Neo Magic 300',
            cups_name: 'Magicard_Neo300',
            connection_type: 'usb',
            status: 'online',
            status_message: 'Ready',
            last_online_at: '2026-11-20T08:00:00Z',
          },
          error: null,
        });
      }
      if (table === 'print_jobs') {
        return makeChain({
          data: [
            {
              id: 'j1',
              personnel_id: 'p1',
              employee_name: 'Alice ADT',
              role_title: 'ADT Operator',
              qr_code_data: 'EMP-BRAK-0043',
              status: 'queued',
              queued_at: '2026-11-20T08:00:00Z',
              printer_id: 'pr-1',
            },
          ],
          error: null,
        });
      }
      return makeChain({ data: [], error: null });
    });

    const depts = await getDepartmentsForCardStudio();
    expect(depts[0]?.display_name).toBe('Production');

    const profiles = await getEmployeeCardProfiles('Brak');
    expect(profiles[0]?.coy_number).toBe('Brak 0043');
    expect(profiles[0]?.medical_expiry).toBe('2028-02-01');

    const printer = await getNeo300PrinterStatus();
    expect(printer.id).toBe('pr-1');

    const jobs = await getRecentNeo300Jobs(5);
    expect(jobs).toHaveLength(1);
  });

  it('preserves mixed-case Coy Number (Brak 0043) when upserting an employee card and dispatches/cancels print jobs', async () => {
    const mockUpsertOperators = jest.fn(async () => ({ error: null }));
    mockFrom.mockImplementation((table: string) => {
      if (table === 'personnel') {
        const chain = makeChain({
          data: {
            id: 'p1',
            emp_code: 'Brak 0043',
            first_name: 'Alice',
            surname: 'ADT',
            id_number: '9001015009081',
            job_title: 'ADT Operator',
            area: 'Main Complex',
            department_id: 'd1',
            induction_expiry: '2028-01-01',
            medical_expiry: '2028-02-01',
            status: 'Active',
            photo_url: null,
            departments: { display_name: 'Production' },
          },
          error: null,
        });
        chain.then = jest.fn((resolve: (v: unknown) => void) =>
          Promise.resolve({
            data: [
              {
                id: 'p1',
                emp_code: 'Brak 0043',
                first_name: 'Alice',
                surname: 'ADT',
                id_number: '9001015009081',
                job_title: 'ADT Operator',
                area: 'Main Complex',
                department_id: 'd1',
                induction_expiry: '2028-01-01',
                medical_expiry: '2028-02-01',
                status: 'Active',
                photo_url: null,
                departments: { display_name: 'Production' },
              },
            ],
            error: null,
          }).then(resolve)
        );
        return chain;
      }
      if (table === 'badges') {
        return makeChain({
          data: { id: 'b1', qr_code: 'EMP-BRAK-0043', rfid_code: null },
          error: null,
        });
      }
      if (table === 'operators') {
        return { upsert: mockUpsertOperators };
      }
      if (table === 'card_printers') {
        return makeChain({
          data: {
            id: 'pr-1',
            name: 'Neo 300',
            model: 'Neo Magic 300',
            cups_name: 'Magicard_Neo300',
            connection_type: 'usb',
            status: 'online',
            status_message: 'Ready',
            last_online_at: '2026-11-20T08:00:00Z',
          },
          error: null,
        });
      }
      if (table === 'print_jobs') {
        return makeChain({
          data: { id: 'job-12345678', status: 'queued' },
          error: null,
        });
      }
      return makeChain({ data: null, error: null });
    });

    const saved = await upsertEmployeeForCardPrinting({
      id: 'p1',
      emp_code: 'Brak 0043',
      coy_number: 'Brak 0043',
      first_name: 'Alice',
      surname: 'ADT',
      id_number: '9001015009081',
      job_title: 'ADT Operator',
      department_id: 'd1',
      medical_expiry: '2028-02-01',
      induction_expiry: '2028-01-01',
    });

    expect(saved.emp_code).toBe('Brak 0043');
    expect(saved.coy_number).toBe('Brak 0043');
    expect(mockUpsertOperators).toHaveBeenCalledWith(
      expect.objectContaining({ employee_code: 'Brak 0043' }),
      { onConflict: 'employee_code' }
    );

    const printRes = await sendNeo300PrintJob('p1');
    expect(printRes.success).toBe(true);

    await cancelNeo300Job('job-12345678');
  });

  it('classifies fleet and coal haul trucks with active QR/RFID badges cleanly', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fleet') {
        return makeChain({
          data: [
            {
              id: 'flt-coal',
              fleet_code: 'DT-77',
              vehicle_type: 'Coal Haul Truck',
              make: 'CAT',
              model: '777G',
              registration_number: 'NA-777',
              status: 'active',
            },
            {
              id: 'flt-company',
              fleet_code: 'SVC-02',
              vehicle_type: 'Service Bowser',
              make: 'Hino',
              model: '500',
              registration_number: 'NA-500',
              status: 'active',
            },
          ],
          error: null,
        });
      }
      if (table === 'badges') {
        return makeChain({
          data: [{ fleet_id: 'flt-coal', qr_code: 'FLT-DT-77', rfid_code: 'RFID-77' }],
          error: null,
        });
      }
      return makeChain({ data: [], error: null });
    });

    const fleetProfiles = await getFleetAndVehicleBadgeProfiles();
    expect(fleetProfiles).toHaveLength(2);
    expect(fleetProfiles.find((f) => f.id === 'flt-coal')).toMatchObject({
      category: 'coal-trucks',
      qr_code: 'FLT-DT-77',
      has_card: true,
    });
    expect(fleetProfiles.find((f) => f.id === 'flt-company')).toMatchObject({
      category: 'company-fleet',
      has_card: false,
    });
  });
});
