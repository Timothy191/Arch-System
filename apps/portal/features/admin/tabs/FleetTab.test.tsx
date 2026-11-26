import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { toast } from 'sonner';
import {
  adminAddMachine,
  adminArchiveMachine,
  adminGenerateStartingSmr,
  adminUpdateMachine,
} from '../actions/fleet';
import { FleetTab } from './FleetTab';

jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({
    src,
    alt,
    className,
    width,
    height,
  }: {
    src: string;
    alt: string;
    className?: string;
    width?: number;
    height?: number;
  }) {
    return <img src={src} alt={alt} className={className} width={width} height={height} />;
  },
}));

jest.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    BarChart: ({
      children,
      onClick,
    }: {
      children?: React.ReactNode;
      onClick?: (state: { activeLabel?: string }) => void;
    }) => (
      <div data-testid="recharts-bar-chart" onClick={() => onClick?.({ activeLabel: 'Dozer' })}>
        {children}
      </div>
    ),
    PieChart: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="recharts-pie-chart">{children}</div>
    ),
    Pie: Stub,
    Bar: Stub,
    Cell: () => <span />,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const MOCK_MACHINES_ROWS = [
  {
    id: 'm-1',
    name: 'DT-102',
    machine_type: 'Articulated Dumper',
    manufacturer: 'Volvo',
    serial_number: 'Volvo A45G',
    image_url: '/images/fleet/volvo-adt.webp',
    starting_smr: 11850,
    bin_factor: 18,
    bin_factor_waste: 18,
    bin_factor_coal: 22,
    active: true,
    report_exempt: false,
    department_id: 'dept-prod',
    site_id: 'site-1',
    created_at: '2026-01-01T00:00:00Z',
    department: { display_name: 'Production' },
    site: { name: 'Brakfontein Pit', site_code: 'BRAK' },
  },
  {
    id: 'm-2',
    name: 'BD-22',
    machine_type: 'Dozer',
    manufacturer: 'Caterpillar',
    serial_number: 'Caterpillar D9R',
    image_url: null,
    starting_smr: 15240.5,
    bin_factor: null,
    bin_factor_waste: null,
    bin_factor_coal: null,
    active: false,
    report_exempt: true,
    department_id: 'dept-prod',
    site_id: null,
    created_at: '2026-01-02T00:00:00Z',
    department: { display_name: 'Production' },
    site: null,
  },
];

const mockSupabaseClient = {
  from: jest.fn((table: string) => {
    if (table === 'machines') {
      return {
        select: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: MOCK_MACHINES_ROWS, error: null }),
      };
    }
    if (table === 'departments') {
      return {
        select: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { id: 'dept-prod', display_name: 'Production' },
            { id: 'dept-eng', display_name: 'Engineering' },
          ],
          error: null,
        }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [{ id: 'site-1', name: 'Brakfontein Pit', site_code: 'BRAK', active: true }],
        error: null,
      }),
    };
  }),
};

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('../actions/fleet', () => ({
  adminAddMachine: jest.fn().mockResolvedValue({ success: true }),
  adminUpdateMachine: jest.fn().mockResolvedValue({ success: true }),
  adminArchiveMachine: jest.fn().mockResolvedValue({ success: true }),
  adminGenerateStartingSmr: jest.fn().mockResolvedValue({
    updatedCount: 2,
    missingOpsMachines: ['BD-99'],
  }),
}));

describe('FleetTab', () => {
  let anchorClickSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    anchorClickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: jest.fn(() => 'blob:mock-fleet-csv'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    anchorClickSpy.mockRestore();
  });

  it('renders separated Machine ID, Machine Name, Manufacturer, Starting SMR, Production badge, and KPI visuals', async () => {
    render(<FleetTab />);

    await waitFor(() => {
      expect(screen.getByText('DT-102')).toBeInTheDocument();
      expect(screen.getByText('Volvo A45G')).toBeInTheDocument();
      expect(screen.getByText('BD-22')).toBeInTheDocument();
      expect(screen.getByText('Caterpillar D9R')).toBeInTheDocument();
    });

    expect(screen.getByTestId('fleet-analytics-panel')).toBeInTheDocument();
    expect(screen.getByText('11,850.0 hrs')).toBeInTheDocument();
    expect(screen.getByText('15,240.5 hrs')).toBeInTheDocument();
  });

  it('triggers Sync Starting SMR, notifies missing ops machines, and exports CSV', async () => {
    render(<FleetTab />);

    await waitFor(() => {
      expect(screen.getByText('DT-102')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('generate-starting-smr-button'));
    await waitFor(() => {
      expect(adminGenerateStartingSmr).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith(
        'Updated Starting SMR & fleet metadata for 2 machine(s)'
      );
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('BD-99'));
    });

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Exported 2 machine record(s)');
  });

  it('submits Add Machine (keeping blank image_url null), Edit, Deactivate toast, and Archive confirmation', async () => {
    render(<FleetTab />);

    await waitFor(() => {
      expect(screen.getByText('DT-102')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Machine/i }));

    fireEvent.change(screen.getByLabelText(/^Machine ID/i), { target: { value: 'DT-205' } });
    fireEvent.change(screen.getByLabelText(/^Machine Name \/ Model/i), {
      target: { value: 'Volvo A45G HAULER' },
    });
    fireEvent.change(screen.getByLabelText(/^Machine Type/i), {
      target: { value: 'Articulated Dumper' },
    });
    fireEvent.change(screen.getByLabelText(/^Manufacturer/i), { target: { value: 'Volvo' } });
    fireEvent.change(screen.getByLabelText(/^Starting SMR on Site/i), {
      target: { value: '9500' },
    });
    fireEvent.change(screen.getByLabelText(/^Waste Bin Factor/i), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText(/^Coal Bin Factor/i), { target: { value: '22' } });

    const saveButtons = screen.getAllByRole('button', { name: /Add Machine/i });
    fireEvent.click(saveButtons[saveButtons.length - 1]!);

    await waitFor(() => {
      expect(adminAddMachine).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DT-205',
          serial_number: 'Volvo A45G HAULER',
          manufacturer: 'Volvo',
          machine_type: 'Articulated Dumper',
          image_url: null,
          starting_smr: 9500,
          bin_factor_waste: 18,
          bin_factor_coal: 22,
        })
      );
    });

    fireEvent.click(screen.getByLabelText('Edit BD-22'));
    fireEvent.change(screen.getByLabelText(/^Starting SMR on Site/i), {
      target: { value: '15500' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(adminUpdateMachine).toHaveBeenCalledWith(
        'm-2',
        expect.objectContaining({
          name: 'BD-22',
          image_url: null,
          starting_smr: 15500,
        })
      );
    });

    fireEvent.click(screen.getByTitle('Deactivate'));
    fireEvent.click(screen.getByRole('button', { name: /^Deactivate$/i }));
    await waitFor(() => {
      expect(adminUpdateMachine).toHaveBeenCalledWith('m-1', { active: false });
      expect(toast.success).toHaveBeenCalledWith('Machine "DT-102" deactivated.');
    });

    fireEvent.click(screen.getByLabelText('Archive DT-102'));
    expect(screen.getByText('Archive Machine?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Archive' }));
    await waitFor(() => {
      expect(adminArchiveMachine).toHaveBeenCalledWith('m-1');
    });
  });
});
