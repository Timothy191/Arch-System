import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { getMineralRegistry } from '~/features/admin/actions/minerals';
import { getOperationalTargets } from '~/features/admin/actions/targets';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import ExcavatorActivityPage from './page';

const mockFrom = jest.fn();

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('@repo/utils', () => ({
  getCurrentShift: jest.fn(() => 'night'),
}));

jest.mock('~/features/admin/actions/minerals', () => ({
  getMineralRegistry: jest.fn(),
}));

jest.mock('~/features/admin/actions/targets', () => ({
  getOperationalTargets: jest.fn(),
}));

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(),
  requireDepartment: jest.fn(),
}));

jest.mock('./ExcavatorActivityTelemetryOverview', () => ({
  ExcavatorActivityTelemetryOverview: ({
    fleetExcavatorsCount,
  }: {
    fleetExcavatorsCount: number;
  }) => <div data-testid="excavator-telemetry-overview" data-fleet={fleetExcavatorsCount} />,
}));

jest.mock('./ExcavatorActivityForm', () => ({
  ExcavatorActivityForm: ({
    initialShiftTelemetry,
  }: {
    initialShiftTelemetry?: Record<string, { startSmr: number | null; startSmrSource: string }>;
  }) => (
    <div
      data-testid="excavator-activity-form"
      data-night-start={initialShiftTelemetry?.['ex-10|night']?.startSmr ?? 'none'}
      data-night-source={initialShiftTelemetry?.['ex-10|night']?.startSmrSource ?? 'none'}
      data-day-start={initialShiftTelemetry?.['ex-10|day']?.startSmr ?? 'none'}
    />
  ),
}));

jest.mock('./ExcavatorActivityList', () => ({
  ExcavatorActivityList: () => <div data-testid="excavator-activity-list" />,
}));

function makeSelectChain(data: unknown[]) {
  const chain: Record<string, jest.Mock | ((r: (v: unknown) => unknown) => Promise<unknown>)> = {};
  for (const m of ['select', 'eq', 'in', 'lte', 'order', 'limit']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error: null }).then(resolve);
  return chain;
}

describe('/[department]/excavator-activity Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDepartmentContext as jest.Mock).mockResolvedValue({
      deptId: 'dept-ctrl',
      today: '2026-11-24',
      supabase: { from: (...args: unknown[]) => mockFrom(...args) },
    });
    (getMineralRegistry as jest.Mock).mockResolvedValue({
      waste: ['Overburden'],
      coal: ['ROM Coal'],
    });
    (getOperationalTargets as jest.Mock).mockResolvedValue({
      shift: { volumeBcmTarget: 4000, loadsTarget: 150 },
    });
  });

  it('pulls previous shift end_smu and machine starting_smr to seed initialShiftTelemetry', async () => {
    let machinesCall = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'machines') {
        machinesCall += 1;
        return machinesCall === 1
          ? makeSelectChain([
              {
                id: 'ex-10',
                name: 'EX-10',
                machine_type: 'Excavator',
                serial_number: 'HIT-400',
                active: true,
                site_id: 'site-1',
                starting_smr: 12000,
              },
            ])
          : makeSelectChain([]);
      }
      if (table === 'machine_operations') {
        return makeSelectChain([
          {
            id: 'op-day',
            machine_id: 'ex-10',
            shift_date: '2026-11-24',
            shift_type: 'day',
            start_smu: 14500,
            end_smu: 14512.5,
            hours_worked: 12.5,
            operator_id: 'op-1',
            operator_name: 'Thabo',
          },
        ]);
      }
      return makeSelectChain([]);
    });

    const jsx = await ExcavatorActivityPage({
      params: Promise.resolve({ department: 'control-room' }),
    });
    render(jsx);

    expect(requireDepartment).toHaveBeenCalledWith('control-room', 'control-room');
    const form = screen.getByTestId('excavator-activity-form');
    expect(form).toHaveAttribute('data-day-start', '14500');
    expect(form).toHaveAttribute('data-night-start', '14512.5');
    expect(form).toHaveAttribute('data-night-source', 'previous_shift');
  });
});
