import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import {
  saveHourlyLoad,
  splitMachineHourlyLoad,
  syncExcavatorActivityFromHourlyLoads,
  updateHourlyLoadExcavator,
  updateMachineSite,
} from './actions';
import { computeDumperLoadsAndBcm, deriveExcavatorDumperAssignments } from './loads-utils';

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn().mockResolvedValue(undefined),
}));

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
    delete: jest.fn(() => query),
    eq: jest.fn(() => query),
    in: jest.fn(() => query),
    order: jest.fn(() => query),
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
  dailyLogData = { id: 'daily-log-1', log_date: '2026-10-06' },
}: {
  machineDepartmentId?: string;
  dailyLogData?: unknown;
} = {}) {
  const machineQuery = makeQuery({ department_id: machineDepartmentId });
  const siteQuery = makeQuery({ id: siteId });
  const mutationQuery = makeQuery();
  const dailyLogQuery = makeQuery(dailyLogData);
  const serviceClient = {
    from: jest.fn((table: string) => {
      if (table === 'machines') return machineQuery;
      if (table === 'sites') return siteQuery;
      if (table === 'hourly_loads') return mutationQuery;
      if (table === 'daily_logs') return dailyLogQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: jest.fn(),
  };
  jest.mocked(createServiceRoleClient).mockReturnValue(serviceClient as never);
  return { serviceClient, machineQuery, siteQuery, mutationQuery, dailyLogQuery };
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

  it('rejects unauthenticated saveHourlyLoad attempts', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValue(null);

    await expect(
      saveHourlyLoad({
        departmentId,
        machineId,
        loadDate: '2026-10-06',
        shiftType: 'day',
        patch: { hour_01: 5 },
      })
    ).rejects.toThrow('Unauthorized');
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it('rejects saveHourlyLoad for department outside accessible scope', async () => {
    setPrincipal({ employeeDepartmentId: otherDepartmentId });

    await expect(
      saveHourlyLoad({
        departmentId,
        machineId,
        loadDate: '2026-10-06',
        shiftType: 'day',
        patch: { hour_01: 5 },
      })
    ).rejects.toThrow('Not authorized for this Control Room operation');
  });

  it('updates an existing hourly load record when a persistent loadId is provided', async () => {
    setPrincipal();
    const { mutationQuery } = setServiceClient();
    const updatedRow = { id: loadId, department_id: departmentId, hour_01: 5 };
    mutationQuery.maybeSingle.mockResolvedValue({ data: updatedRow, error: null });

    const result = await saveHourlyLoad({
      departmentId,
      machineId,
      loadDate: '2026-10-06',
      shiftType: 'day',
      loadId,
      patch: { hour_01: 5 },
    });

    expect(result).toEqual({ success: true, load: updatedRow });
    expect(mutationQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        hour_01: 5,
        updated_by: 'employee-1',
      })
    );
    expect(mutationQuery.eq).toHaveBeenCalledWith('id', loadId);
  });

  it('updates existing DB record when local- virtual loadId is passed but row already exists in DB', async () => {
    setPrincipal();
    const existingRow = { id: 'existing-db-id', department_id: departmentId, hour_01: 2 };
    const findQuery = makeQuery();
    findQuery.order = jest.fn(() => ({
      then: (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) =>
        Promise.resolve({ data: [existingRow], error: null }).then(resolve, reject),
    })) as never;
    const updateQuery = makeQuery({ ...existingRow, hour_01: 3 });

    let hourlyLoadsCount = 0;
    const { serviceClient } = setServiceClient();
    serviceClient.from = jest.fn((table: string) => {
      if (table === 'hourly_loads') {
        hourlyLoadsCount++;
        return hourlyLoadsCount === 1 ? findQuery : updateQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await saveHourlyLoad({
      departmentId,
      machineId,
      loadDate: '2026-10-06',
      shiftType: 'day',
      loadId: `local-${machineId}-day`,
      patch: { hour_01: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.load.id).toBe('existing-db-id');
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ hour_01: 3 }));
    expect(updateQuery.eq).toHaveBeenCalledWith('id', 'existing-db-id');
  });

  it('resolves daily_logs header and inserts new hourly_loads record with all required constraints', async () => {
    setPrincipal();
    const dailyLogHeader = { id: 'daily-log-header-1', log_date: '2026-10-06' };
    const dailyLogQuery = makeQuery(dailyLogHeader);

    const findQuery = makeQuery();
    findQuery.order = jest.fn(() => ({
      then: (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject),
    })) as never;

    const insertedRow = {
      id: 'new-hourly-load-id',
      department_id: departmentId,
      machine_id: machineId,
      daily_log_id: dailyLogHeader.id,
      daily_log_date: '2026-10-06',
      hour_01: 1,
    };
    const insertQuery = makeQuery(insertedRow);

    let hourlyLoadsCount = 0;
    const { serviceClient } = setServiceClient();
    serviceClient.from = jest.fn((table: string) => {
      if (table === 'daily_logs') return dailyLogQuery;
      if (table === 'hourly_loads') {
        hourlyLoadsCount++;
        return hourlyLoadsCount === 1 ? findQuery : insertQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await saveHourlyLoad({
      departmentId,
      machineId,
      loadDate: '2026-10-06',
      shiftType: 'day',
      loadId: `local-${machineId}-day`,
      patch: { hour_01: 1 },
    });

    expect(result).toEqual({ success: true, load: insertedRow });
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        department_id: departmentId,
        machine_id: machineId,
        load_date: '2026-10-06',
        shift_type: 'day',
        daily_log_id: 'daily-log-header-1',
        daily_log_date: '2026-10-06',
        hour_01: 1,
        start_hour: 1,
        end_hour: 12,
        is_locked: false,
        material_type: 'Waste',
      })
    );
  });

  it('auto-creates daily_logs header when missing and inserts hourly_loads', async () => {
    setPrincipal();
    let dailyLogCallCount = 0;
    const findDailyLogQuery = makeQuery(null);
    const createDailyLogQuery = makeQuery({ id: 'created-daily-log-id', log_date: '2026-10-06' });

    const findQuery = makeQuery();
    findQuery.order = jest.fn(() => ({
      then: (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject),
    })) as never;

    const insertedRow = {
      id: 'new-row-id',
      daily_log_id: 'created-daily-log-id',
      hour_01: 1,
    };
    const insertQuery = makeQuery(insertedRow);

    let hourlyLoadsCount = 0;
    const { serviceClient } = setServiceClient();
    serviceClient.from = jest.fn((table: string) => {
      if (table === 'daily_logs') {
        dailyLogCallCount++;
        return dailyLogCallCount === 1 ? findDailyLogQuery : createDailyLogQuery;
      }
      if (table === 'hourly_loads') {
        hourlyLoadsCount++;
        return hourlyLoadsCount === 1 ? findQuery : insertQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await saveHourlyLoad({
      departmentId,
      machineId,
      loadDate: '2026-10-06',
      shiftType: 'day',
      patch: { hour_01: 1 },
    });

    expect(result.success).toBe(true);
    expect(createDailyLogQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        department_id: departmentId,
        log_date: '2026-10-06',
        shift: 'day',
      })
    );
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        daily_log_id: 'created-daily-log-id',
        hour_01: 1,
      })
    );
  });

  it('throws error when updating an existing loadId that is not found', async () => {
    setPrincipal();
    const { mutationQuery } = setServiceClient();
    mutationQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      saveHourlyLoad({
        departmentId,
        machineId,
        loadDate: '2026-10-06',
        shiftType: 'day',
        loadId,
        patch: { hour_01: 5 },
      })
    ).rejects.toThrow('Hourly load not found for the selected department, machine, date and shift');
  });

  describe('Automated ADT / RDT / Dump Truck Excavator Placement', () => {
    const excavatorId = 'd290f1ee-6c54-4b01-90e6-d701748f0901';
    const adtMachineId = 'd290f1ee-6c54-4b01-90e6-d701748f0902';
    const rdtMachineId = 'd290f1ee-6c54-4b01-90e6-d701748f0903';

    it('derives ADT and RDT dumper assignments across split hourly_loads segments', () => {
      const dumpers = [
        { id: adtMachineId, bin_factor: 18 },
        { id: rdtMachineId, bin_factor: 40.5 },
      ];

      const hourlyLoads = [
        {
          id: 'seg-1',
          machine_id: adtMachineId,
          excavator_id: excavatorId,
          material_type: 'Waste',
          shift_type: 'day',
          start_hour: 1,
          end_hour: 6,
          is_locked: true,
          total_loads: 10,
        },
        {
          id: 'seg-2',
          machine_id: adtMachineId,
          excavator_id: excavatorId,
          material_type: 'Waste',
          shift_type: 'day',
          start_hour: 7,
          end_hour: 12,
          is_locked: false,
          total_loads: 5,
        },
        {
          id: 'seg-3',
          machine_id: rdtMachineId,
          excavator_id: excavatorId,
          material_type: 'Coal',
          shift_type: 'day',
          start_hour: 1,
          end_hour: 12,
          is_locked: false,
          total_loads: 8,
        },
      ];

      const assignments = deriveExcavatorDumperAssignments(
        hourlyLoads,
        dumpers,
        excavatorId,
        'day'
      );

      expect(assignments).toEqual([
        {
          key: `auto-${excavatorId}-day-${adtMachineId}|Waste`,
          dumperMachineId: adtMachineId,
          materialType: 'Waste',
          totalLoads: 15,
          totalBcm: 270,
          autoPlaced: true,
          segmentCount: 2,
        },
        {
          key: `auto-${excavatorId}-day-${rdtMachineId}|Coal`,
          dumperMachineId: rdtMachineId,
          materialType: 'Coal',
          totalLoads: 8,
          totalBcm: 324,
          autoPlaced: true,
          segmentCount: 1,
        },
      ]);
    });

    it('computes dumper loads and BCM scoped to excavator and material when present', () => {
      const hourlyLoads = [
        {
          id: 'seg-1',
          machine_id: adtMachineId,
          excavator_id: excavatorId,
          material_type: 'Waste',
          shift_type: 'day',
          total_loads: 6,
        },
        {
          id: 'seg-2',
          machine_id: adtMachineId,
          excavator_id: excavatorId,
          material_type: 'Coal',
          shift_type: 'day',
          total_loads: 4,
        },
      ];

      expect(
        computeDumperLoadsAndBcm(hourlyLoads, adtMachineId, 'day', 20, {
          excavatorId,
          materialType: 'Waste',
        })
      ).toEqual({
        totalLoads: 6,
        totalBcm: 120,
      });
    });

    it('synchronizes excavator_activity and excavator_dumper_assignments from hourly_loads', async () => {
      const hourlyLoadsQuery = makeQuery([
        {
          id: 'seg-1',
          machine_id: adtMachineId,
          excavator_id: excavatorId,
          material_type: 'Waste',
          shift_type: 'day',
          total_loads: 12,
        },
      ]);
      const machinesQuery = makeQuery([
        { id: excavatorId, name: 'EX-501', bin_factor: null, site_id: siteId },
        { id: adtMachineId, name: 'ADT-201', bin_factor: 20, site_id: siteId },
      ]);
      const activityQuery = makeQuery({ id: 'activity-1', loads: 0 });
      const assignmentsDeleteQuery = makeQuery();

      const customServiceClient = {
        from: jest.fn((table: string) => {
          if (table === 'hourly_loads') return hourlyLoadsQuery;
          if (table === 'machines') return machinesQuery;
          if (table === 'excavator_activity') return activityQuery;
          if (table === 'excavator_dumper_assignments') return assignmentsDeleteQuery;
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      await syncExcavatorActivityFromHourlyLoads(customServiceClient as never, {
        departmentId,
        excavatorId,
        loadDate: '2026-10-14',
        shiftType: 'day',
      });

      expect(assignmentsDeleteQuery.insert).toHaveBeenCalledWith([
        {
          excavator_activity_id: 'activity-1',
          dumper_machine_id: adtMachineId,
          material_type: 'Waste',
          total_loads: 12,
          total_bcm: 240,
        },
      ]);
    });
  });
});
