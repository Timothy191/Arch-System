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

  it('toggles pin status in localStorage on pin click and renders Arch Logo bookmark icon', () => {
    render(<DepartmentCard department={mockDepartment} index={0} />);
    const pinBtn = screen.getByTitle('Pin department');
    expect(pinBtn).toBeInTheDocument();

    const bookmarkSvg = screen.getByTestId('arch-bookmark-icon');
    expect(bookmarkSvg).toHaveAttribute('viewBox', '22.75 16.625 166.16 166.19');
    expect(bookmarkSvg).toHaveClass('fill-none');

    fireEvent.click(pinBtn);
    expect(localStorage.getItem('pinned_dept_drilling')).toBe('true');
    expect(screen.getByTestId('arch-bookmark-icon')).toHaveClass(
      'fill-current',
      'text-arch-accent-blue'
    );

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

  it('renders outer card with test id, gold-steel-border class, display header font, and slimmer rectangular geometry', () => {
    const { container } = render(<DepartmentCard department={mockDepartment} index={0} />);
    const card = screen.getByTestId('dept-card-drilling');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('uiverse-card', 'gold-steel-border');
    expect(screen.getByTestId('dept-link-drilling')).toHaveClass('rounded-[20px]');
    expect(container.querySelector('.uiverse-card-icon-bubble')).toHaveClass('left-4', '-bottom-4');
    const heading = screen.getByRole('heading', { name: 'Drilling Operations' });
    expect(heading).toHaveClass('uiverse-card-title', 'font-anurati');
  });
});
