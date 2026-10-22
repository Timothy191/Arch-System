import type { Department } from '@repo/departments/data-access';
import { fireEvent, render, screen } from '@testing-library/react';
import { DepartmentCard } from './DepartmentCard';

// AGENT-TRACE: DepartmentCard uses useRouter() from next/navigation.
// Must mock it before rendering or the component throws.
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock Sparkline to avoid rendering complexity
jest.mock('./Sparkline', () => ({
  Sparkline: () => <div data-testid="sparkline" />,
}));

const mockDepartment: Department = {
  name: 'drilling',
  displayName: 'Drilling Operations',
  route: '/drilling',
  description: 'Core drilling operations telemetry and systems control.',
  icon: 'Drill',
  color: 'emerald',
  type: 'standard',
  gridSpan: 'col-span-1',
  status: 'active',
  stats: {
    label: 'Current Depth',
    value: '1,240 m',
  },
  trend: [10, 20, 15, 30, 25],
  actions: [
    { label: 'Daily Logs', href: '/drilling/daily-log' },
    { label: 'Telemetry', href: '/drilling/machine-telemetry' },
  ],
};

describe('DepartmentCard', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('renders department information without action tag pills', () => {
    render(<DepartmentCard department={mockDepartment} index={0} />);
    expect(screen.getByText('Drilling Operations')).toBeInTheDocument();
    expect(
      screen.getByText('Core drilling operations telemetry and systems control.')
    ).toBeInTheDocument();
    expect(screen.getByText('1,240 m')).toBeInTheDocument();
    expect(screen.queryByText('Daily Logs')).not.toBeInTheDocument();
  });

  it('renders a semantic Link targeting the department route', () => {
    render(<DepartmentCard department={mockDepartment} index={0} />);
    const link = screen.getByTestId('dept-link-drilling');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/drilling');
    expect(link).toHaveAttribute('aria-label', 'Open Drilling Operations department');
  });

  it('falls back to /<name> if route is missing', () => {
    const deptWithoutRoute = { ...mockDepartment, route: undefined as unknown as string };
    render(<DepartmentCard department={deptWithoutRoute} index={0} />);
    const link = screen.getByTestId('dept-link-drilling');
    expect(link).toHaveAttribute('href', '/drilling');
  });

  it('toggles pin status in localStorage on pin click', () => {
    render(<DepartmentCard department={mockDepartment} index={0} />);
    const pinBtn = screen.getByTitle('Pin department');
    expect(pinBtn).toBeInTheDocument();

    fireEvent.click(pinBtn);
    expect(localStorage.getItem('pinned_dept_drilling')).toBe('true');

    fireEvent.click(pinBtn);
    expect(localStorage.getItem('pinned_dept_drilling')).toBe('false');
  });

  it('invokes onPinnedChange when controlled via isPinned prop', () => {
    const onPinnedChange = jest.fn();
    render(
      <DepartmentCard
        department={mockDepartment}
        index={0}
        isPinned={false}
        onPinnedChange={onPinnedChange}
      />
    );
    const pinBtn = screen.getByTitle('Pin department');
    fireEvent.click(pinBtn);
    expect(onPinnedChange).toHaveBeenCalledWith('drilling', true);
    expect(localStorage.getItem('pinned_dept_drilling')).toBe('true');
  });

  it('renders outer card with test id and Anurati header font', () => {
    render(<DepartmentCard department={mockDepartment} index={0} />);
    expect(screen.getByTestId('dept-card-drilling')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { name: 'Drilling Operations' });
    expect(heading).toHaveClass('uiverse-card-title', 'font-anurati');
  });
});
