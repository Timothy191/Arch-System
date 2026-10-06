/** @jest-environment node */
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { splitMachineHourlyLoad, updateHourlyLoadExcavator, updateMachineSite } from './actions';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}));

const departmentId = 'd290f1ee-6c54-4b01-90e6-d701748f0851';
const otherDepartmentId = 'd290f1ee-6c54-4b01-90e6-d701748f0852';
const machineId = 'd290f1ee-6c54-4b01-90e6-d701748f0853';
const siteId = 'd290f1ee-6c54-4b01-90e6-d701748f0854';
const loadId = 'd290f1ee-6c54-4b01-90e6-d701748f0855';

function makeQuery(data: unknown = null) {
  const query = {
    select: jest.fn(() => query),
    update: jest.fn(() => query),
    insert: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
    single: jest.fn().mockResolvedValue({ data, error: null }),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve, reject),
  };
  return query;
}

function setPrincipal({
  role = 'supervisor',
  employeeDepartmentId = departmentId,
  accessibleDepartments = [],
}: {
  role?: string;
  employeeDepartmentId?: string;
  accessibleDepartments?: string[];
} = {}) {
  jest.mocked(getAuthenticatedEmployee).mockResolvedValue({
    user: { id: 'user-1' },
    employee: {
      id: 'employee-1',
      role,
      department_id: employeeDepartmentId,
      accessible_departments: accessibleDepartments,
    },
  } as never);
}

function setServiceClient({
  machineDepartmentId = departmentId,
}: {
  machineDepartmentId?: string;
} = {}) {
  const machineQuery = makeQuery({ department_id: machineDepartmentId });
  const siteQuery = makeQuery({ id: siteId });
  const mutationQuery = makeQuery();
  const serviceClient = {
    from: jest.fn((table: string) => {
      if (table === 'machines') return machineQuery;
      if (table === 'sites') return siteQuery;
      if (table === 'hourly_loads') return mutationQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: jest.fn(),
  };
  jest.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
  return { serviceClient, machineQuery, siteQuery, mutationQuery };
}

describe('Control Room Hourly Loads actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated machine-site changes before using service credentials', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValue(null);

    await expect(updateMachineSite(machineId, siteId)).rejects.toThrow('Unauthorized');
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it('blocks machine-site changes from operators and leaves the machine unchanged', async () => {
    setPrincipal({ role: 'operator' });
    const { serviceClient } = setServiceClient();

    await expect(updateMachineSite(machineId, siteId)).rejects.toThrow(
      'Not authorized for this Control Room operation'
    );
    expect(serviceClient.from).toHaveBeenCalledTimes(1);
  });

  it('blocks machine-site changes to machines in another department', async () => {
    setPrincipal();
    const { serviceClient } = setServiceClient({ machineDepartmentId: otherDepartmentId });

    await expect(updateMachineSite(machineId, siteId)).rejects.toThrow(
      'Not authorized for this Control Room operation'
    );
    expect(serviceClient.from).toHaveBeenCalledTimes(1);
  });

  it('updates a machine site only for a scoped supervisor and an active site', async () => {
    setPrincipal();
    const { serviceClient, siteQuery } = setServiceClient();

    await expect(updateMachineSite(machineId, siteId)).resolves.toEqual({ success: true });
    expect(siteQuery.eq).toHaveBeenCalledWith('active', true);
    expect(serviceClient.from).toHaveBeenCalledTimes(3);
  });

  it('rejects hourly-load updates for departments outside the employee access list', async () => {
    setPrincipal();
    const { serviceClient } = setServiceClient();

    await expect(
      updateHourlyLoadExcavator(otherDepartmentId, machineId, '2026-10-06', 'day', null, loadId)
    ).rejects.toThrow('Not authorized for this Control Room operation');
    expect(serviceClient.from).not.toHaveBeenCalled();
  });

  it('scopes load-ID updates by department, machine, date and shift', async () => {
    setPrincipal();
    const { mutationQuery } = setServiceClient();
    mutationQuery.maybeSingle.mockResolvedValue({ data: { id: loadId }, error: null });

    await expect(
      updateHourlyLoadExcavator(departmentId, machineId, '2026-10-06', 'day', null, loadId)
    ).resolves.toEqual({ success: true });
    expect(mutationQuery.eq.mock.calls).toEqual(
      expect.arrayContaining([
        ['id', loadId],
        ['department_id', departmentId],
        ['machine_id', machineId],
        ['load_date', '2026-10-06'],
        ['shift_type', 'day'],
      ])
    );
  });

  it('does not report success when a scoped load-ID update matched no row', async () => {
    setPrincipal();
    const { mutationQuery } = setServiceClient();

    await expect(
      updateHourlyLoadExcavator(departmentId, machineId, '2026-10-06', 'day', null, loadId)
    ).rejects.toThrow('Hourly load not found for the selected department, machine, date and shift');
    expect(mutationQuery.eq).toHaveBeenCalledWith('department_id', departmentId);
  });

  it('executes split creation through the atomic server-only RPC', async () => {
    setPrincipal();
    const { serviceClient } = setServiceClient();
    const newLoad = { id: loadId, department_id: departmentId, start_hour: 5 };
    serviceClient.rpc.mockResolvedValue({ data: [newLoad], error: null });

    await expect(
      splitMachineHourlyLoad({
        departmentId,
        machineId,
        loadDate: '2026-10-06',
        shiftType: 'day',
        startHour: 5,
        excavatorId: null,
        materialType: 'Waste',
      })
    ).resolves.toEqual({ success: true, newLoad });

    expect(serviceClient.rpc).toHaveBeenCalledWith('atomic_split_hourly_load', {
      p_department_id: departmentId,
      p_machine_id: machineId,
      p_load_date: '2026-10-06',
      p_shift_type: 'day',
      p_start_hour: 5,
      p_excavator_id: null,
      p_material_type: 'Waste',
      p_previous_load_id: null,
    });
    expect(serviceClient.from).not.toHaveBeenCalled();
  });

  it('propagates split RPC failures without reporting success', async () => {
    setPrincipal();
    const { serviceClient } = setServiceClient();
    serviceClient.rpc.mockResolvedValue({ data: null, error: new Error('insert failed') });

    await expect(
      splitMachineHourlyLoad({
        departmentId,
        machineId,
        loadDate: '2026-10-06',
        shiftType: 'day',
        startHour: 5,
        excavatorId: null,
        materialType: 'Waste',
      })
    ).rejects.toThrow('insert failed');
  });

  it('rejects hour-one splits before accessing the service-role client', async () => {
    setPrincipal();

    await expect(
      splitMachineHourlyLoad({
        departmentId,
        machineId,
        loadDate: '2026-10-06',
        shiftType: 'day',
        startHour: 1,
        excavatorId: null,
        materialType: 'Waste',
      })
    ).rejects.toThrow();
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });
});
