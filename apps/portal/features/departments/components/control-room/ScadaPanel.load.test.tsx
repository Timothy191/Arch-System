import { getOperationalToday } from '@repo/utils';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ScadaPanel } from './ScadaPanel';
import {
  deriveScadaPanelRows,
  mergeScadaRows,
  type ScadaActivityRow,
  type ScadaLoadRow,
  type ScadaMachineRow,
} from './scada-panel-derived';

const TODAY = getOperationalToday('Africa/Johannesburg');

type ChangeHandler = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  table: string;
  schema: string;
}) => void;

const mockState = {
  from: jest.fn(),
  channel: jest.fn(),
  removeChannel: jest.fn().mockResolvedValue('ok'),
  changeHandlers: [] as ChangeHandler[],
};

const mockTableData: Record<string, unknown[]> = {
  excavator_activity: [
    {
      id: 'act-1',
      machine_id: 'ex-1',
      shift_type: 'day',
      material_type: 'ROM Coal',
      machine: { name: 'EX-01' },
      operator: { full_name: 'J. Dlamini' },
      site: { name: 'Pit A' },
      block_mined: { name: 'Block 4', code: 'B4' },
    },
  ],
  machines: [
    { id: 'ex-1', name: 'EX-01', machine_type: 'Excavator', bin_factor: null, active: true },
    { id: 'ht-1', name: 'HT-01', machine_type: 'Haul Truck', bin_factor: 10, active: true },
  ],
  hourly_loads: [
    {
      id: 'load-1',
      machine_id: 'ht-1',
      excavator_id: 'ex-1',
      material_type: 'ROM Coal',
      total_loads: 3,
    },
  ],
};

/** Minimal PostgREST builder: every filter is a no-op, awaiting resolves the fixture. */
function mockCreateQuery(table: string) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
      resolve({ data: mockTableData[table] ?? [], error: null }),
  };
  return builder;
}

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    from: (table: string) => {
      mockState.from(table);
      return mockCreateQuery(table);
    },
    channel: (name: string) => {
      mockState.channel(name);
      const channel = {
        on: (_type: string, _config: unknown, handler: ChangeHandler) => {
          mockState.changeHandlers.push(handler);
          return channel;
        },
        subscribe: (handler: (status: string) => void) => {
          handler('SUBSCRIBED');
          return channel;
        },
      };
      return channel;
    },
    removeChannel: mockState.removeChannel,
  }),
}));

function emitLoadsChange({
  eventType,
  nextLoads,
}: {
  eventType: 'UPDATE' | 'DELETE';
  nextLoads: number;
}) {
  const handler = mockState.changeHandlers[0];
  if (!handler) throw new Error('hourly_loads subscription was never registered');

  act(() => {
    handler({
      eventType,
      new: {
        id: 'load-1',
        machine_id: 'ht-1',
        excavator_id: 'ex-1',
        material_type: 'ROM Coal',
        total_loads: nextLoads,
        load_date: TODAY,
      },
      old: { id: 'load-1' },
      table: 'hourly_loads',
      schema: 'public',
    });
  });
}

describe('Given the control-room SCADA panel and a live CDC feed', () => {
  beforeEach(() => {
    mockState.from.mockClear();
    mockState.channel.mockClear();
    mockState.removeChannel.mockClear();
    mockState.changeHandlers.length = 0;
  });

  it('When a load row changes, Then it updates from the payload without any PostgREST query', async () => {
    render(<ScadaPanel departmentId="dept-cr" />);

    await waitFor(() => expect(mockState.from).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('3 Loads')).toBeInTheDocument();

    emitLoadsChange({ eventType: 'UPDATE', nextLoads: 7 });

    expect(await screen.findByText('7 Loads')).toBeInTheDocument();
    // The whole point: one write costs zero reads on every connected client.
    expect(mockState.from).toHaveBeenCalledTimes(3);
  });

  it('When a load row is deleted, Then the aggregate drops without refetching', async () => {
    render(<ScadaPanel departmentId="dept-cr" />);

    await waitFor(() => expect(mockState.from).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('3 Loads')).toBeInTheDocument();

    emitLoadsChange({ eventType: 'DELETE', nextLoads: 0 });

    expect(await screen.findByText('0 Loads')).toBeInTheDocument();
    expect(mockState.from).toHaveBeenCalledTimes(3);
  });

  it('When the panel mounts, Then it registers exactly one channel per subscribed table', async () => {
    render(<ScadaPanel departmentId="dept-cr" />);

    await waitFor(() => expect(mockState.channel).toHaveBeenCalledTimes(2));
    expect(mockState.changeHandlers).toHaveLength(2);
  });

  it('When the panel unmounts, Then both channels are removed from the client registry', async () => {
    const { unmount } = render(<ScadaPanel departmentId="dept-cr" />);

    await waitFor(() => expect(mockState.channel).toHaveBeenCalledTimes(2));
    unmount();

    expect(mockState.removeChannel).toHaveBeenCalledTimes(2);
  });

  it('When an excavator_activity row is deleted via CDC, Then it is removed locally without refetching', async () => {
    render(<ScadaPanel departmentId="dept-cr" />);

    await waitFor(() => expect(mockState.from).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(/J\. Dlamini/)).toBeInTheDocument();

    const activityHandler = mockState.changeHandlers[1];
    if (!activityHandler) throw new Error('excavator_activity subscription was never registered');

    act(() => {
      activityHandler({
        eventType: 'DELETE',
        new: {},
        old: { id: 'act-1' },
        table: 'excavator_activity',
        schema: 'public',
      });
    });

    await waitFor(() => expect(screen.queryByText(/J\. Dlamini/)).not.toBeInTheDocument());
    expect(mockState.from).toHaveBeenCalledTimes(3);
  });

  it('When mergeScadaRows and deriveScadaPanelRows run on frozen inputs, Then they never mutate input arrays or row objects and safely handle missing old.id on DELETE', () => {
    const frozenActivity: ScadaActivityRow = Object.freeze({
      id: 'act-1',
      machine_id: 'ex-1',
      shift_type: 'day',
      material_type: 'ROM Coal',
      activity_date: TODAY,
      machine: Object.freeze({ name: 'EX-01' }),
      operator: Object.freeze({ full_name: 'J. Dlamini' }),
      site: Object.freeze({ name: 'Pit A' }),
      block_mined: Object.freeze({ name: 'Block 4', code: 'B4' }),
    });
    const frozenActivities = Object.freeze([frozenActivity]);
    const frozenFleet: readonly ScadaMachineRow[] = Object.freeze([
      Object.freeze({
        id: 'ht-1',
        name: 'HT-01',
        machine_type: 'Haul Truck',
        bin_factor: 25,
        active: true,
      }),
    ]);
    const frozenLoad: ScadaLoadRow = Object.freeze({
      id: 'load-1',
      machine_id: 'ht-1',
      excavator_id: 'ex-1',
      material_type: 'ROM Coal',
      total_loads: 4,
      load_date: TODAY,
    });
    const frozenLoads = Object.freeze([frozenLoad]);

    const derived = deriveScadaPanelRows({
      activities: frozenActivities,
      fleet: frozenFleet,
      loads: frozenLoads,
    });
    expect(derived.excavators[0]?.loadedLoads).toBe(4);
    expect(derived.registeredMachines[0]?.totalBcm).toBe(100);

    const updatedLoads = mergeScadaRows({
      rows: frozenLoads,
      payload: {
        eventType: 'UPDATE',
        new: { ...frozenLoad, total_loads: 9 },
        old: frozenLoad,
        table: 'hourly_loads',
        schema: 'public',
      },
      today: TODAY,
      dateField: 'load_date',
    });
    expect(updatedLoads[0]?.total_loads).toBe(9);
    expect(frozenLoads[0]?.total_loads).toBe(4);

    const deletedMissingOld = mergeScadaRows({
      rows: frozenLoads,
      payload: {
        eventType: 'DELETE',
        new: {} as ScadaLoadRow,
        old: {} as ScadaLoadRow,
        table: 'hourly_loads',
        schema: 'public',
      },
      today: TODAY,
      dateField: 'load_date',
    });
    expect(deletedMissingOld).toHaveLength(1);
    expect(deletedMissingOld).not.toBe(frozenLoads);
  });
});
