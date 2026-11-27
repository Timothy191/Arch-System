/* cspell:ignore Tyre */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { ArchLogoShowcase } from './ArchLogoShowcase';
import { logTireActivity } from './actions';
import TireManagementPage from './page';
import { TireActivityManagerClient } from './TireActivityManagerClient';
import { type TyreSwapFieldValues, TyreSwapTable } from './TyreSwapTable';
import { WheelPositionDiagram } from './WheelPositionDiagram';

const mockRefresh = jest.fn();

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: jest.fn(),
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : ''} alt={alt} className={className} />
  ),
}));

jest.mock('framer-motion', () => {
  const MOTION_PROPS = new Set([
    'initial',
    'animate',
    'transition',
    'whileHover',
    'variants',
    'custom',
    'layoutId',
  ]);
  const strip = (props: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key)));
  const createMotionComponent = (tag: 'div' | 'span' | 'li') =>
    function MotionMock({
      children,
      ...rest
    }: { children?: React.ReactNode } & Record<string, unknown>) {
      const Tag = tag as 'div';
      return <Tag {...strip(rest)}>{children}</Tag>;
    };
  return {
    m: {
      div: createMotionComponent('div'),
      span: createMotionComponent('span'),
      li: createMotionComponent('li'),
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => true,
  };
});

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('./actions', () => ({
  logTireActivity: jest.fn(async () => ({
    success: true,
    mode: 'replace',
    removedTireId: 't1',
    installedTireId: 't-new-1',
    inspectedTireId: null,
    machineName: 'DT-01',
  })),
}));

jest.mock('~/lib/dept-context', () => ({
  requireDepartment: jest.fn(),
  getDepartmentContext: jest.fn().mockResolvedValue({
    today: '2026-11-20',
    supabase: {
      from: jest.fn((table: string) => {
        if (table === 'tires') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 't1',
                  serial_number: 'TIRE-001',
                  brand: 'Michelin',
                  size: '59/80R63',
                  position: 'Front Left',
                  status: 'installed',
                  machine_id: 'm1',
                  installed_at: '2026-01-01',
                  installed_hours: 1200,
                  machines: { id: 'm1', name: 'DT-01', serial_number: 'SN-01' },
                },
                {
                  id: 't2',
                  serial_number: 'TIRE-002',
                  brand: 'Bridgestone',
                  size: '59/80R63',
                  position: 'Front Right',
                  status: 'installed',
                  machine_id: 'm1',
                  installed_at: '2026-01-01',
                  installed_hours: 1500,
                  machines: { id: 'm1', name: 'DT-01', serial_number: 'SN-01' },
                },
                {
                  id: 't3',
                  serial_number: 'TIRE-003',
                  brand: 'Goodyear',
                  size: '59/80R63',
                  position: 'Spare',
                  status: 'inventory',
                  machine_id: null,
                  installed_at: null,
                  installed_hours: 0,
                  machines: null,
                },
              ],
            }),
          };
        }
        if (table === 'tire_inspections') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'i1',
                  tire_id: 't1',
                  inspection_date: '2026-03-01',
                  tread_depth_mm: 12,
                  pressure_psi: 105,
                  condition_status: 'critical',
                  current_smu: 1200,
                  notes: '[REMOVAL] Machine: DT-01 | Position: Front Left | Low tread depth',
                },
                {
                  id: 'i2',
                  tire_id: 't2',
                  inspection_date: '2026-03-01',
                  tread_depth_mm: 35,
                  pressure_psi: 110,
                  condition_status: 'good',
                  current_smu: 1500,
                  notes: '[REPLACEMENT] Machine: DT-01 | Position: Front Right | Fresh mount',
                },
              ],
            }),
          };
        }
        if (table === 'machines') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'm1',
                  name: 'DT-01',
                  machine_type: 'Dump Truck',
                  serial_number: 'SN-01',
                  manufacturer: 'Volvo',
                  active: true,
                },
              ],
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [] }),
        };
      }),
    },
  }),
}));

const emptySwapSide: TyreSwapFieldValues = {
  serial: '',
  size: '',
  make: '',
  tra: '',
  treadDepth: '',
  remainInSite: false,
  scrap: false,
  repair: false,
  isNew: false,
  repaired: false,
};

describe('TireManagementPage & TireActivityManagerClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders tire management page with metric aggregations and the tyre off/on record tables', async () => {
    const jsx = await TireManagementPage({
      params: Promise.resolve({ department: 'engineering' }),
    });
    render(jsx);

    expect(screen.getByText('Tire Management')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0); // Total tires
    expect(screen.getAllByText('2').length).toBeGreaterThan(0); // Installed active
    expect(screen.getAllByText('1').length).toBeGreaterThan(0); // Inventory / critical alerts

    expect(screen.getAllByText('TIRE-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TIRE-002').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TIRE-003').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Recent Tyre Activity & Removal/Replacement Ledger')
    ).toBeInTheDocument();

    // The activity form is permanently visible, with no toggle or close control.
    expect(screen.getByTestId('tire-activity-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('open-tire-activity-btn')).not.toBeInTheDocument();

    expect(screen.getByText('Tyre Off Records')).toBeInTheDocument();
    expect(screen.getByText('Tyre On Records')).toBeInTheDocument();
    expect(screen.getByTestId('arch-logo-showcase')).toBeInTheDocument();
    expect(screen.getByTestId('machine-preview')).toBeInTheDocument();
    expect(screen.getByLabelText('Tyre activity type')).toBeInTheDocument();
    expect(screen.queryByText('Log Inspection')).not.toBeInTheDocument();
  });

  it('switches activity modes through the dropdown and submits a tyre replacement', async () => {
    render(
      <TireActivityManagerClient
        todayStr="2026-11-20"
        machines={[
          {
            id: 'm1',
            name: 'DT-01',
            machine_type: 'Dump Truck',
            serial_number: 'SN-01',
            manufacturer: 'Volvo',
            site_name: 'North Pit',
            latest_smu: 1200,
          },
          {
            id: 'm2',
            name: 'DT-02',
            machine_type: 'Dump Truck',
            serial_number: 'SN-02',
            latest_smu: 4520,
          },
        ]}
        tires={[
          {
            id: 't1',
            serial_number: 'TIRE-001',
            brand: 'Michelin',
            size: '59/80R63',
            position: 'Front Left',
            status: 'installed',
            machine_id: 'm1',
            machineName: 'DT-01',
            installed_at: '2026-01-01',
            installed_hours: 1200,
            latestInspection: {
              id: 'i1',
              tire_id: 't1',
              inspection_date: '2026-02-01',
              tread_depth_mm: 14,
              pressure_psi: 108,
              condition_status: 'critical',
            },
          },
        ]}
        recentActivities={[]}
      />
    );

    // Selecting a machine shows the preview card with its identity and site.
    fireEvent.change(screen.getByLabelText('Machine'), { target: { value: 'm1' } });
    expect(screen.getByText('North Pit')).toBeInTheDocument();
    expect(screen.getByText('Volvo')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Wheel Position'), { target: { value: 'Front Left' } });
    expect(screen.getByTestId('installed-tyre-status')).toHaveTextContent(
      'Mounted at Front Left: TIRE-001'
    );

    // Off side is auto-populated from the mounted tyre.
    expect(screen.getByLabelText('Tyre Off serial number')).toHaveValue('TIRE-001');
    expect(screen.getByLabelText('Tyre Off make')).toHaveValue('Michelin');

    fireEvent.change(screen.getByLabelText('Tyre Off tread depth'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Tyre On serial number'), {
      target: { value: 'TIRE-900' },
    });
    fireEvent.change(screen.getByLabelText('Tyre On size'), { target: { value: '59/80R63' } });
    fireEvent.change(screen.getByLabelText('Tyre On make'), {
      target: { value: 'Bridgestone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sidewall Cut' }));

    fireEvent.click(screen.getByTestId('submit-tire-activity-btn'));

    await waitFor(() => {
      expect(logTireActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'replace',
          machineId: 'm1',
          position: 'Front Left',
          removedTireId: 't1',
          tireSerial: 'TIRE-001',
          tireBrand: 'Michelin',
          replacementSerial: 'TIRE-900',
          replacementBrand: 'Bridgestone',
          replacementSize: '59/80R63',
          removedReason: 'Sidewall Cut',
          treadDepthMm: 11,
          conditionStatus: 'critical',
          tyreSwap: expect.objectContaining({
            on: expect.objectContaining({ serial: 'TIRE-900', make: 'Bridgestone' }),
            off: expect.objectContaining({ serial: 'TIRE-001', treadDepth: 11 }),
          }),
        })
      );
    });

    expect(toast.success).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('filters to wheeled machines only and validates required fields client-side', async () => {
    render(
      <TireActivityManagerClient
        todayStr="2026-11-20"
        machines={[
          {
            id: 'm1',
            name: 'DT-01',
            machine_type: 'Dump Truck',
            serial_number: 'SN-01',
            latest_smu: 1200,
          },
          {
            id: 'm2',
            name: 'DT-02',
            machine_type: 'Dump Truck',
            serial_number: 'SN-02',
            latest_smu: 4520,
          },
          {
            id: 'm3',
            name: 'DZ-01',
            machine_type: 'Dozer',
            serial_number: 'SN-03',
          },
        ]}
        tires={[
          {
            id: 't1',
            serial_number: 'TIRE-001',
            brand: 'Michelin',
            size: '59/80R63',
            position: 'Front Left',
            status: 'installed',
            machine_id: 'm1',
            machineName: 'DT-01',
            installed_at: '2026-01-01',
            installed_hours: 1200,
          },
        ]}
        recentActivities={[]}
      />
    );

    const machineSelect = screen.getByLabelText('Machine');
    expect(machineSelect).toHaveDisplayValue('DT-01 (Dump Truck)');
    expect(screen.queryByRole('option', { name: /DZ-01/ })).not.toBeInTheDocument();

    // Switching machine auto-populates Machine Hours (SMU).
    fireEvent.change(machineSelect, { target: { value: 'm2' } });
    expect(screen.getByLabelText(/Machine Hours \(SMU\)/i)).toHaveValue(4520);

    // Rejects submission when Reason is missing.
    fireEvent.change(screen.getByLabelText(/Machine Hours \(SMU\)/i), {
      target: { value: '4520' },
    });
    fireEvent.change(screen.getByLabelText('Tyre On serial number'), {
      target: { value: 'TIRE-900' },
    });
    fireEvent.change(screen.getByLabelText('Tyre On size'), { target: { value: '59/80R63' } });
    fireEvent.change(screen.getByLabelText('Tyre On make'), { target: { value: 'Michelin' } });
    fireEvent.click(screen.getByTestId('submit-tire-activity-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No tyre is registered at Front Left on DT-02'
      );
    });
    expect(logTireActivity).not.toHaveBeenCalled();

    // Switching to Install Spare / New through the dropdown disables the Tyre Off side.
    fireEvent.click(screen.getByLabelText('Tyre activity type'));
    fireEvent.click(screen.getByRole('option', { name: /Install Spare \/ New/i }));
    expect(screen.getByLabelText('Tyre Off serial number')).toBeDisabled();
    expect(screen.getByLabelText('Tyre On serial number')).toBeEnabled();

    fireEvent.change(screen.getByLabelText(/Machine Hours \(SMU\)/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'New Mount / Book-In' }));
    fireEvent.click(screen.getByTestId('submit-tire-activity-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Machine hours (SMU) is required');
    });
    expect(logTireActivity).not.toHaveBeenCalled();
  });

  it('filters the ledger by activity type and search text and surfaces server errors', async () => {
    (logTireActivity as jest.Mock).mockRejectedValueOnce(new Error('Database failure'));

    render(
      <TireActivityManagerClient
        todayStr="2026-11-20"
        machines={[{ id: 'm1', name: 'DT-01', machine_type: 'Dump Truck', serial_number: 'SN-01' }]}
        tires={[
          {
            id: 't1',
            serial_number: 'TIRE-001',
            brand: 'Michelin',
            size: '59/80R63',
            position: 'Front Left',
            status: 'installed',
            machine_id: 'm1',
            machineName: 'DT-01',
            installed_at: '2026-01-01',
            installed_hours: 1200,
          },
          {
            id: 't3',
            serial_number: 'TIRE-003',
            brand: 'Goodyear',
            size: '59/80R63',
            position: 'Spare',
            status: 'inventory',
            machine_id: null,
            machineName: 'Unassigned',
            installed_at: null,
            installed_hours: 0,
          },
        ]}
        recentActivities={[
          {
            id: 'a1',
            tire_id: 't1',
            serial_number: 'TIRE-001',
            brand: 'Michelin',
            size: '59/80R63',
            machineName: 'DT-01',
            position: 'Front Left',
            inspection_date: '2026-11-19',
            tread_depth_mm: 18,
            pressure_psi: 108,
            condition_status: 'warning',
            current_smu: 1200,
            notes: '[REMOVAL] Machine: DT-01 | Job: JC-77 | TRAOff: 8',
            activityType: 'removal',
          },
          {
            id: 'a2',
            tire_id: 't3',
            serial_number: 'TIRE-003',
            brand: 'Goodyear',
            size: '59/80R63',
            machineName: 'DT-01',
            position: 'Front Right',
            inspection_date: '2026-11-20',
            tread_depth_mm: 40,
            pressure_psi: 112,
            condition_status: 'good',
            current_smu: 1210,
            notes: '[INSTALLATION] Machine: DT-01 | Job: JC-78 | TRAOn: 6',
            activityType: 'installation',
          },
        ]}
      />
    );

    expect(screen.getByText('Tyre Off Records')).toBeInTheDocument();
    expect(screen.getByText('Tyre On Records')).toBeInTheDocument();
    expect(screen.getByText('JC-77')).toBeInTheDocument();
    expect(screen.getByText('JC-78')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Removals' }));
    expect(screen.getByText('TIRE-001')).toBeInTheDocument();
    expect(screen.queryByText('TIRE-003')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.change(screen.getByLabelText('Search tyre ledger'), {
      target: { value: 'TIRE-003' },
    });
    expect(screen.getByText('TIRE-003')).toBeInTheDocument();
    expect(screen.queryByText('TIRE-001')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search tyre ledger'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Tyre On serial number'), {
      target: { value: 'TIRE-901' },
    });
    fireEvent.change(screen.getByLabelText('Tyre On size'), { target: { value: '59/80R63' } });
    fireEvent.change(screen.getByLabelText('Tyre On make'), { target: { value: 'Goodyear' } });
    fireEvent.click(screen.getByRole('button', { name: 'New Mount / Book-In' }));
    fireEvent.click(screen.getByTestId('submit-tire-activity-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Database failure');
    });
    expect(toast.error).toHaveBeenCalledWith('Database failure');
  });
});

describe('WheelPositionDiagram', () => {
  it('renders six selectable wheels and reports plan-view selections', () => {
    const onChange = jest.fn();
    render(<WheelPositionDiagram layout="Grader" value="Front Left" onChange={onChange} />);

    expect(screen.getByLabelText('Vehicle wheel position plan view')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Grader · Motor Grader side view suspension and wheel layout')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Select Front Left wheel position')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    fireEvent.click(screen.getByLabelText('Select Rear Outer Right wheel position'));
    expect(onChange).toHaveBeenCalledWith('Rear Outer Right');
  });
});

describe('TyreSwapTable', () => {
  it('renders Tyre Off and Tyre On column groups and emits field changes', () => {
    const onChange = jest.fn();
    render(
      <TyreSwapTable
        off={{ ...emptySwapSide, serial: 'TIRE-001' }}
        on={emptySwapSide}
        showOff
        showOn
        onChange={onChange}
      />
    );

    expect(
      screen.getByRole('table', { name: 'Tyre Off and Tyre On changeout table' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Tyre Off serial number')).toHaveValue('TIRE-001');

    fireEvent.change(screen.getByLabelText('Tyre Off tra'), { target: { value: '9' } });
    expect(onChange).toHaveBeenCalledWith('off', 'tra', '9');

    fireEvent.click(screen.getByLabelText('Scrap (Tyre Off)'));
    expect(onChange).toHaveBeenCalledWith('off', 'scrap', true);
  });

  it('disables the Tyre Off side when the activity does not remove a tyre', () => {
    render(
      <TyreSwapTable
        off={emptySwapSide}
        on={emptySwapSide}
        showOff={false}
        showOn
        onChange={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Tyre Off serial number')).toBeDisabled();
    expect(screen.getByLabelText('Tyre On serial number')).toBeEnabled();
    expect(screen.getByLabelText('Remain in Site (Tyre Off)')).toBeDisabled();
  });
});

describe('ArchLogoShowcase', () => {
  it('presents the Arch System identity, palette, guidelines and motion spec', () => {
    render(<ArchLogoShowcase />);

    expect(screen.getByText('Arch System identity')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Arch System brand palette' })).toBeInTheDocument();
    expect(screen.getByText('Metallic Gold')).toBeInTheDocument();
    expect(screen.getByText('Usage guidelines')).toBeInTheDocument();
    expect(screen.getByText('Motion specification')).toBeInTheDocument();
    expect(screen.getByText(/Reduced motion/)).toBeInTheDocument();
  });
});
