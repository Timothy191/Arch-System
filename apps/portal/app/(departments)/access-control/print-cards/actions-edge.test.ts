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
  getNeo300PrinterStatus,
  sendNeo300PrintJob,
  upsertEmployeeForCardPrinting,
} from './actions';

function makeChain(result: unknown) {
  const chain: Record<string, jest.Mock> = {};
  for (const methodName of [
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
  ]) {
    chain[methodName] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn(async () => result);
  chain.single = jest.fn(async () => result);
  chain.then = jest.fn((resolve: (value: unknown) => void) =>
    Promise.resolve(result).then(resolve)
  );
  return chain;
}

describe('print-cards actions edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects upsert when Coy Number or required identity fields are missing', async () => {
    await expect(
      upsertEmployeeForCardPrinting({
        emp_code: '',
        first_name: 'Alice',
        surname: 'ADT',
        id_number: '9001015009081',
        job_title: 'Operator',
        department_id: 'd1',
      })
    ).rejects.toThrow('Coy Number, First Name, Surname, and ID Number are required');
  });

  it('auto-registers a default Neo 300 printer when none exists and dispatches print job', async () => {
    let printerSelectCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'card_printers') {
        const printerChain = makeChain({
          data: {
            id: 'pr-new',
            name: 'Neo 300',
            model: 'Magicard Neo 300',
            cups_name: 'Magicard_Neo300',
            connection_type: 'usb',
            status: 'online',
            status_message: 'Ready',
            last_online_at: '2026-11-20T08:00:00Z',
          },
          error: null,
        });
        printerSelectCount += 1;
        if (printerSelectCount === 1) {
          printerChain.maybeSingle = jest.fn(async () => ({ data: null, error: null }));
        }
        return printerChain;
      }
      if (table === 'personnel') {
        return makeChain({
          data: {
            id: 'p1',
            first_name: 'Alice',
            surname: 'ADT',
            job_title: 'ADT Operator',
            emp_code: 'Brak 0043',
            induction_expiry: '2028-01-01',
          },
          error: null,
        });
      }
      if (table === 'badges') {
        const badgeChain = makeChain({
          data: { id: 'b-new', qr_code: 'EMP-BRAK-0043', rfid_code: null },
          error: null,
        });
        badgeChain.maybeSingle = jest.fn(async () => ({ data: null, error: null }));
        return badgeChain;
      }
      if (table === 'print_jobs') {
        return makeChain({
          data: {
            id: 'job-99',
            personnel_id: 'p1',
            employee_name: 'Alice ADT',
            role_title: 'ADT Operator',
            qr_code_data: 'EMP-BRAK-0043',
            status: 'queued',
            queued_at: '2026-11-20T08:00:00Z',
            printer_id: 'pr-new',
          },
          error: null,
        });
      }
      return makeChain({ data: [], error: null });
    });

    const printer = await getNeo300PrinterStatus();
    expect(printer.id).toBe('pr-new');

    const result = await sendNeo300PrintJob('p1');
    expect(result.success).toBe(true);
    expect(result.job.id).toBe('job-99');
  });
});
