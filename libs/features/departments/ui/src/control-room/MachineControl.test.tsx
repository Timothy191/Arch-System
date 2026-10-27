import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EquipmentDashboard } from './EquipmentDashboard';

jest.mock('@repo/ui', () => ({
  AnimatedDialog: ({
    open,
    onClose,
    title,
    description,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={title} data-testid="animated-dialog">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        <button type="button" data-testid="dialog-backdrop-close" onClick={onClose}>
          Close Dialog
        </button>
        {children}
      </div>
    ) : null,
}));

jest.mock('@repo/ui/GlassCard', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>
      {children}
    </div>
  ),
}));

jest.mock('lucide-react', () => ({
  BadgeAlert: () => <span data-testid="icon-badge-alert" />,
  CheckCircle2: () => <span data-testid="icon-check-circle" />,
  Factory: () => <span data-testid="icon-factory" />,
  Loader2: () => <span data-testid="icon-loader" />,
  Map: () => <span data-testid="icon-map" />,
  ShieldAlert: () => <span data-testid="icon-shield-alert" />,
  Truck: () => <span data-testid="icon-truck" />,
}));

const DEPARTMENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const ACTION_MESSAGE_TIMEOUT_MS = 5000;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const ADT_HOUR_METER = 4250;
const EXCAVATOR_HOUR_METER = 8120;
const DOZER_HOUR_METER = 6300;
const INITIAL_ACTIVE_REPORT_BUTTONS = 2;
const POST_BREAKDOWN_DOWN_BUTTONS = 2;

const MOCK_FLEET = [
  {
    id: 'eq-1',
    code: 'ADT-101',
    category: 'truck' as const,
    status: 'operational' as const,
    hour_meter: ADT_HOUR_METER,
  },
  {
    id: 'eq-2',
    code: 'EX-202',
    category: 'excavator' as const,
    status: 'maintenance' as const,
    hour_meter: EXCAVATOR_HOUR_METER,
  },
  {
    id: 'eq-3',
    code: 'DZ-303',
    category: 'dozer' as const,
    status: 'breakdown' as const,
    hour_meter: DOZER_HOUR_METER,
  },
];

describe('EquipmentDashboard (MachineControl TASK-10.2)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('renders loading spinner initially and then displays machine status cards', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_FLEET,
    });

    render(<EquipmentDashboard departmentId={DEPARTMENT_ID} />);

    expect(screen.getByText('Live Equipment Map & Data Grid')).toBeInTheDocument();
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('ADT-101')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(`/api/departments/${DEPARTMENT_ID}/fleet`);
    expect(screen.getByText('EX-202')).toBeInTheDocument();
    expect(screen.getByText('DZ-303')).toBeInTheDocument();
    expect(screen.getByText(/4,250 SMU/i)).toBeInTheDocument();
    expect(screen.getByText(/8,120 SMU/i)).toBeInTheDocument();
    expect(screen.getByText(/6,300 SMU/i)).toBeInTheDocument();

    // Breakdown machine button is disabled and shows "Down"
    const downButton = screen.getByRole('button', { name: 'Down' });
    expect(downButton).toBeDisabled();

    // Operational and maintenance machines show enabled "Report Breakdown" buttons
    const reportButtons = screen.getAllByRole('button', { name: 'Report Breakdown' });
    expect(reportButtons).toHaveLength(INITIAL_ACTIVE_REPORT_BUTTONS);
    expect(reportButtons[0]).toBeEnabled();
  });

  it('renders empty state when department has no fleet items', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<EquipmentDashboard departmentId={DEPARTMENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText('No equipment data found for this department.')).toBeInTheDocument();
    });
  });

  it('renders empty state gracefully when fleet fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: HTTP_INTERNAL_SERVER_ERROR,
    });

    render(<EquipmentDashboard departmentId={DEPARTMENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText('No equipment data found for this department.')).toBeInTheDocument();
    });
  });

  it('opens breakdown confirmation modal, allows cancel, and dispatches breakdown alert on confirm', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_FLEET,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    render(<EquipmentDashboard departmentId={DEPARTMENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText('ADT-101')).toBeInTheDocument();
    });

    // Click Report Breakdown on ADT-101
    const reportButtons = screen.getAllByRole('button', { name: 'Report Breakdown' });
    fireEvent.click(reportButtons[0]!);

    expect(
      screen.getByRole('dialog', { name: 'Confirm Breakdown Escalation' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Report line-down event for ADT-101\?/i)).toBeInTheDocument();

    // Cancel closes the dialog without calling breakdown-alert API
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('dialog', { name: 'Confirm Breakdown Escalation' })
    ).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Re-open and confirm breakdown escalation
    fireEvent.click(screen.getAllByRole('button', { name: 'Report Breakdown' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Confirm Breakdown/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Workflow dispatched: Breakdown escalation started for ADT-101.')
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/engineering/breakdown-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipmentId: 'eq-1',
        description: 'Operator reported breakdown via map for ADT-101',
      }),
    });

    // Optimistic update: ADT-101 is now marked Down (2 Down buttons total)
    expect(screen.getAllByRole('button', { name: 'Down' })).toHaveLength(
      POST_BREAKDOWN_DOWN_BUTTONS
    );

    // Action message clears after timeout
    act(() => {
      jest.advanceTimersByTime(ACTION_MESSAGE_TIMEOUT_MS);
    });
    expect(
      screen.queryByText('Workflow dispatched: Breakdown escalation started for ADT-101.')
    ).not.toBeInTheDocument();
  });

  it('displays error message when breakdown escalation POST fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_FLEET,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: HTTP_INTERNAL_SERVER_ERROR,
      });

    render(<EquipmentDashboard departmentId={DEPARTMENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText('ADT-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Report Breakdown' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Confirm Breakdown/i }));

    await waitFor(() => {
      expect(screen.getByText('Error: Could not trigger workflow.')).toBeInTheDocument();
    });
  });
});
