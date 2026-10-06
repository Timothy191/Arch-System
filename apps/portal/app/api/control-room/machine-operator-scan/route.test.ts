/** @jest-environment node */

import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { GET, POST } from './route';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

const departmentId = 'd290f1ee-6c54-4b01-90e6-d701748f0851';
const otherDepartmentId = 'd290f1ee-6c54-4b01-90e6-d701748f0857';
const machineId = 'd290f1ee-6c54-4b01-90e6-d701748f0852';
const operatorId = 'd290f1ee-6c54-4b01-90e6-d701748f0853';
const operationId = 'd290f1ee-6c54-4b01-90e6-d701748f0854';
const personnelId = 'd290f1ee-6c54-4b01-90e6-d701748f0856';

function createQueryBuilder({
  maybeSingleData = null,
  insertedData = { id: operationId },
}: {
  maybeSingleData?: unknown;
  insertedData?: unknown;
} = {}) {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    is: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    order: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue({ data: maybeSingleData, error: null }),
    single: jest.fn().mockResolvedValue({ data: insertedData, error: null }),
    then: jest.fn((resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: maybeSingleData ? [maybeSingleData] : [],
        error: null,
      }).then(resolve)
    ),
  };
  return builder;
}

const machine = {
  id: machineId,
  name: 'Truck 101',
  machine_type: 'Dump Truck',
  site_id: departmentId,
  bin_factor: 24,
  active: true,
};

function createSupabaseMock({
  machineRow = machine,
  currentOperation = null,
  siteRow = { id: departmentId },
}: {
  machineRow?: unknown;
  currentOperation?: unknown;
  siteRow?: unknown;
} = {}) {
  const machineQuery = createQueryBuilder({ maybeSingleData: machineRow });
  const operatorQuery = createQueryBuilder({
    maybeSingleData: {
      id: operatorId,
      full_name: 'Operator One',
      employee_code: 'EMP-101',
    },
  });
  const siteQuery = createQueryBuilder({ maybeSingleData: siteRow });
  const currentOperationQuery = createQueryBuilder({ maybeSingleData: currentOperation });
  const insertQuery = createQueryBuilder({ insertedData: { id: operationId } });
  const supabase = {
    from: jest.fn((table: string) => {
      if (table === 'machines') return machineQuery;
      if (table === 'operators') return operatorQuery;
      if (table === 'sites') return siteQuery;
      if (table === 'machine_operations') {
        return {
          ...currentOperationQuery,
          insert: insertQuery.insert,
          select: jest.fn((columns: string) =>
            columns === 'id' ? insertQuery : currentOperationQuery
          ),
          single: insertQuery.single,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
  return { supabase, machineQuery, operatorQuery, insertQuery };
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/control-room/machine-operator-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setPersonnelDirectory({
  medicalExpiry = '2099-12-31',
  inductionExpiry = '2099-12-31',
  badgeActive = true,
}: {
  medicalExpiry?: string | null;
  inductionExpiry?: string | null;
  badgeActive?: boolean;
} = {}) {
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const data = url.includes('/badges?')
      ? [
          {
            is_active: badgeActive,
            entity_type: 'personnel',
            personnel_id: personnelId,
            expires_at: '2099-12-31T23:59:59.000Z',
          },
        ]
      : [
          {
            emp_code: 'EMP-101',
            first_name: 'Operator',
            surname: 'One',
            job_title: 'Dump Truck Operator',
            status: 'Active',
            medical_expiry: medicalExpiry,
            induction_expiry: inductionExpiry,
          },
        ];
    return new Response(JSON.stringify(data), { status: 200 });
  });
}

describe('POST /api/control-room/machine-operator-scan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAuthenticatedEmployee).mockResolvedValue({
      user: { id: 'user-1' },
      employee: {
        id: 'employee-1',
        role: 'operator',
        department_id: departmentId,
        accessible_departments: [],
      },
    } as never);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires an authenticated Control Room employee before processing scans', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce(null);
    const { supabase } = createSupabaseMock();
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);
    const fetchSpy = jest.spyOn(global, 'fetch');

    const response = await POST(makeRequest({ departmentId, machineCode: 'TRK-101' }));

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns only cleared operators whose job title matches the selected machine type', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            emp_code: 'EMP-101',
            first_name: 'Operator',
            surname: 'One',
            job_title: 'Dump Truck Operator',
            status: 'Active',
            medical_expiry: '2099-12-31',
            induction_expiry: '2099-12-31',
          },
          {
            emp_code: 'EMP-202',
            first_name: 'Excavator',
            surname: 'Operator',
            job_title: 'Excavator Operator',
            status: 'Active',
            medical_expiry: '2099-12-31',
            induction_expiry: '2099-12-31',
          },
          {
            emp_code: 'EMP-303',
            first_name: 'Expired',
            surname: 'Operator',
            job_title: 'Dump Truck Operator',
            status: 'Active',
            medical_expiry: '2000-01-01',
            induction_expiry: '2099-12-31',
          },
        ]),
        { status: 200 }
      )
    );
    const { supabase, operatorQuery } = createSupabaseMock();
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);

    const response = await GET(
      new Request(
        `http://localhost/api/control-room/machine-operator-scan?departmentId=${departmentId}&machineId=${machineId}`
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      stage: 'operators',
      operators: [{ id: operatorId, name: 'Operator One', jobTitle: 'Dump Truck Operator' }],
    });
    expect(operatorQuery.in).toHaveBeenCalledWith('employee_code', ['EMP-101']);
  });

  it('returns machine type and load eligibility before the operator scan', async () => {
    const { supabase } = createSupabaseMock();
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);

    const response = await POST(makeRequest({ departmentId, machineCode: machineId }));

    expect(response.status).toBe(200);
    expect(supabase.from('machines').eq).toHaveBeenCalledWith('id', machineId);
    await expect(response.json()).resolves.toMatchObject({
      stage: 'machine',
      machine: {
        id: machineId,
        machineType: 'Dump Truck',
        requiresHourlyLoads: true,
      },
    });
  });

  it('resolves a centrally registered fleet machine for an authorized Control Room shift', async () => {
    const { supabase } = createSupabaseMock({
      machineRow: { ...machine, department_id: otherDepartmentId },
    });
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);

    const response = await POST(makeRequest({ departmentId, machineCode: machineId }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      stage: 'machine',
      machine: { id: machineId, machineType: 'Dump Truck' },
    });
  });

  it('verifies badge, active status, medical, and induction before saving an assignment', async () => {
    setPersonnelDirectory();
    const { supabase, insertQuery } = createSupabaseMock();
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);

    const response = await POST(
      makeRequest({ departmentId, machineCode: machineId, operatorCode: 'BADGE-101' })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      stage: 'assignment',
      machine: { id: machineId, machineType: 'Dump Truck', requiresHourlyLoads: true },
      operator: { id: operatorId, name: 'Operator One' },
      operationId,
      checks: {
        machineActive: true,
        badgeValid: true,
        badgeScanned: true,
        operatorActive: true,
        medicalValid: true,
        inductionValid: true,
        machineQualification: 'not_configured',
      },
    });
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        department_id: departmentId,
        machine_id: machineId,
        operator_id: operatorId,
        site_id: departmentId,
        created_by: 'employee-1',
      })
    );
  });

  it('blocks missing or expired medical clearance and does not insert an operation', async () => {
    setPersonnelDirectory({ medicalExpiry: null });
    const { supabase, insertQuery } = createSupabaseMock();
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);

    const response = await POST(
      makeRequest({ departmentId, machineCode: machineId, operatorCode: 'BADGE-101' })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'OPERATOR_NOT_CLEARED' });
    expect(insertQuery.insert).not.toHaveBeenCalled();
  });

  it('assigns a dropdown-selected operator after rechecking machine type and clearance', async () => {
    setPersonnelDirectory();
    const { supabase, insertQuery } = createSupabaseMock();
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);

    const response = await POST(
      makeRequest({ departmentId, machineId, operatorId, siteId: departmentId })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.checks).toMatchObject({ badgeScanned: false, badgeValid: false });
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ machine_id: machineId, operator_id: operatorId })
    );
  });

  it('blocks an operator whose personnel job title does not match the machine type', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      return new Response(
        JSON.stringify(
          url.includes('/badges?')
            ? [
                {
                  is_active: true,
                  entity_type: 'personnel',
                  personnel_id: personnelId,
                  expires_at: null,
                },
              ]
            : [
                {
                  emp_code: 'EMP-101',
                  first_name: 'Operator',
                  surname: 'One',
                  job_title: 'Excavator Operator',
                  status: 'Active',
                  medical_expiry: '2099-12-31',
                  induction_expiry: '2099-12-31',
                },
              ]
        ),
        { status: 200 }
      );
    });
    const { supabase, insertQuery } = createSupabaseMock();
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);

    const response = await POST(
      makeRequest({ departmentId, machineCode: machineId, operatorCode: 'BADGE-101' })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'MACHINE_TYPE_MISMATCH' });
    expect(insertQuery.insert).not.toHaveBeenCalled();
  });

  it('blocks inactive badges and assignments already in progress on that machine', async () => {
    setPersonnelDirectory({ badgeActive: false });
    const { supabase, insertQuery } = createSupabaseMock();
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);

    const response = await POST(
      makeRequest({ departmentId, machineCode: machineId, operatorCode: 'BADGE-101' })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'BADGE_INVALID' });
    expect(insertQuery.insert).not.toHaveBeenCalled();
  });

  it('returns the existing assignment when the same operator retries the scan', async () => {
    setPersonnelDirectory();
    const { supabase, insertQuery } = createSupabaseMock({
      currentOperation: {
        id: operationId,
        operator_id: operatorId,
        site_id: departmentId,
      },
    });
    jest.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);

    const response = await POST(
      makeRequest({ departmentId, machineCode: machineId, operatorCode: 'BADGE-101' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ alreadyAssigned: true, operationId });
    expect(insertQuery.insert).not.toHaveBeenCalled();
  });
});
