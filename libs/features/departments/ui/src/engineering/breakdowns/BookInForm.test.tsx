import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BookInForm } from './BookInForm';
import type { Breakdown, Machine } from './types';

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

jest.mock('./actions', () => ({
  createBreakdown: jest.fn(),
}));

jest.mock('@repo/utils/inngest', () => ({
  inngest: { send: jest.fn().mockResolvedValue({ ids: ['test-id'] }) },
  machineBreakdownEvent: 'engineering/breakdown.logged',
}));

const { createBreakdown } = jest.requireMock('./actions');

const MOCK_MACHINES: Machine[] = [
  {
    id: 'm-1',
    name: 'CAT 320D',
    machine_type: 'Excavator',
    serial_number: 'FL-001',
    manufacturer: 'Caterpillar',
    starting_smr: 12000,
    current_smu: 14500,
    image_url: '/images/fleet/hitachi-excavator.webp',
    site_name: 'Main Pit',
    site_code: 'MP-01',
    active: true,
  },
  {
    id: 'm-2',
    name: 'DT-04',
    machine_type: 'Haul Truck',
    serial_number: 'Volvo A40G',
    manufacturer: 'Volvo',
    starting_smr: null,
    current_smu: null,
    image_url: null,
    site_name: null,
    site_code: null,
    active: true,
  },
];

const ACTIVE_BREAKDOWN: Breakdown = {
  id: 'bd-1',
  department_id: 'dept-eng',
  fleet_id: 'FL-001',
  machine_name: 'CAT 320D',
  machine_type: 'Excavator',
  date_in: '2026-05-17',
  time_in: '08:00',
  date_out: null,
  time_out: null,
  reason: 'Hydraulic failure',
  repair_notes: null,
  status: 'active',
  missing_book_in: false,
  created_by: 'emp-1',
  completed_by: null,
  deleted_at: null,
  created_at: '2026-05-17T08:00:00Z',
  updated_at: '2026-05-17T08:00:00Z',
};

describe('BookInForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    createBreakdown.mockResolvedValue(undefined);
  });

  it('renders form fields, official logo separator header, golden presets, and omits Draft Cached badge', () => {
    localStorage.setItem(
      'arch_breakdown_bookin_draft',
      JSON.stringify({ selectedMachineId: 'm-1', reason: 'Hydraulic leak' })
    );
    render(<BookInForm departmentId="dept-eng" activeBreakdowns={[]} machines={MOCK_MACHINES} />);

    expect(screen.getByLabelText(/Machine ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Select Machine/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date In/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Time In/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Describe the issue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Book In Machine/i })).toBeInTheDocument();
    expect(screen.getByTestId('breakdown-quick-presets')).toHaveClass('gold-steel-border');
    expect(screen.queryByText('Draft Cached')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Active Breakdowns' })).not.toBeInTheDocument();
  });

  it("shows 'No active breakdowns' when activeBreakdowns is empty", () => {
    render(<BookInForm departmentId="dept-eng" activeBreakdowns={[]} machines={MOCK_MACHINES} />);
    expect(screen.getByText(/No active breakdowns/i)).toBeInTheDocument();
  });

  it('renders active breakdowns in the table', () => {
    render(
      <BookInForm
        departmentId="dept-eng"
        activeBreakdowns={[ACTIVE_BREAKDOWN]}
        machines={MOCK_MACHINES}
      />
    );

    expect(screen.getByText('FL-001')).toBeInTheDocument();
    expect(screen.getByText('CAT 320D')).toBeInTheDocument();
    expect(screen.getAllByText('Excavator').length).toBeGreaterThanOrEqual(1);
  });

  it('shows count of active breakdowns', () => {
    render(
      <BookInForm
        departmentId="dept-eng"
        activeBreakdowns={[ACTIVE_BREAKDOWN]}
        machines={MOCK_MACHINES}
      />
    );
    expect(screen.getByText('1 machines')).toBeInTheDocument();
  });

  it('populates machine photo and saved metadata card when Machine ID is selected', () => {
    render(<BookInForm departmentId="dept-eng" activeBreakdowns={[]} machines={MOCK_MACHINES} />);

    expect(screen.queryByTestId('selected-machine-profile')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Machine ID/i), {
      target: { value: 'm-1' },
    });

    const profileCard = screen.getByTestId('selected-machine-profile');
    expect(profileCard).toBeInTheDocument();

    const img = within(profileCard).getByRole('img', { name: 'CAT 320D' });
    expect(img).toHaveAttribute('src', '/images/fleet/hitachi-excavator.webp');
    expect(within(profileCard).getByText('CAT 320D')).toBeInTheDocument();
    expect(within(profileCard).getByText('FL-001')).toBeInTheDocument();
    expect(within(profileCard).getByText('Caterpillar')).toBeInTheDocument();
    expect(within(profileCard).getByText('Excavator')).toBeInTheDocument();
    expect(within(profileCard).getByText('Main Pit (MP-01)')).toBeInTheDocument();
    expect(within(profileCard).getByText('14,500 hrs')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Machine ID/i), {
      target: { value: 'm-2' },
    });

    const fallbackImg = within(profileCard).getByRole('img', { name: 'DT-04' });
    expect(fallbackImg).toHaveAttribute('src', '/images/fleet/volvo-adt.webp');
    expect(within(profileCard).getByText('Volvo A40G')).toBeInTheDocument();
    expect(within(profileCard).getByText('Volvo')).toBeInTheDocument();
    expect(within(profileCard).getByText('Main Pit')).toBeInTheDocument();
    expect(within(profileCard).getByText('Not recorded')).toBeInTheDocument();
  });

  it('shows error when machine is not selected on submit', async () => {
    render(<BookInForm departmentId="dept-eng" activeBreakdowns={[]} machines={MOCK_MACHINES} />);

    fireEvent.submit(screen.getByRole('button', { name: /Book In Machine/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Please select a machine')).toBeInTheDocument();
    });
    expect(createBreakdown).not.toHaveBeenCalled();
  });

  it('shows error when reason is too short', async () => {
    render(<BookInForm departmentId="dept-eng" activeBreakdowns={[]} machines={MOCK_MACHINES} />);

    fireEvent.change(screen.getByLabelText(/Select Machine/i), {
      target: { value: 'm-1' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the issue/i), {
      target: { value: 'hi' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Book In Machine/i }));

    await waitFor(() => {
      expect(screen.getByText('Reason must be at least 5 characters')).toBeInTheDocument();
    });
    expect(createBreakdown).not.toHaveBeenCalled();
  });

  it('submits Date In, Time In, and preset Breakdown Reason successfully', async () => {
    render(<BookInForm departmentId="dept-eng" activeBreakdowns={[]} machines={MOCK_MACHINES} />);

    fireEvent.change(screen.getByLabelText(/Machine ID/i), {
      target: { value: 'm-1' },
    });
    fireEvent.change(screen.getByLabelText(/Date In/i), {
      target: { value: '2026-11-24' },
    });
    fireEvent.change(screen.getByLabelText(/Time In/i), {
      target: { value: '09:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hydraulic Hose Leak / Burst' }));

    fireEvent.click(screen.getByRole('button', { name: /Book In Machine/i }));

    await waitFor(() => {
      expect(createBreakdown).toHaveBeenCalledWith(
        'dept-eng',
        expect.objectContaining({
          fleet_id: 'FL-001',
          machine_name: 'CAT 320D',
          machine_type: 'Excavator',
          date_in: '2026-11-24',
          time_in: '09:30',
          reason: 'Hydraulic Hose Leak / Burst',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Machine booked in successfully!')).toBeInTheDocument();
    });
  });

  it('shows error message when createBreakdown throws', async () => {
    createBreakdown.mockRejectedValueOnce(new Error('DB error'));

    render(<BookInForm departmentId="dept-eng" activeBreakdowns={[]} machines={MOCK_MACHINES} />);

    fireEvent.change(screen.getByLabelText(/Select Machine/i), {
      target: { value: 'm-1' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the issue/i), {
      target: { value: 'Hydraulic pump failure' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Book In Machine/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to book in machine.')).toBeInTheDocument();
    });
  });
});
