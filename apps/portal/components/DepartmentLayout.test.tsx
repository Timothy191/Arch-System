import { DEPARTMENTS, getDepartmentTabs } from '@repo/departments/data-access';
import { DepartmentLayout } from '@repo/ui/DepartmentLayout';
import { act, fireEvent, render, screen } from '@testing-library/react';

const mockUsePathname = jest.fn(() => '/control-room');
const mockUseSearchParams = jest.fn(() => new URLSearchParams());

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));
describe('DepartmentLayout — Control Room Department & Auto-hide Sidebar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUsePathname.mockReturnValue('/control-room');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const controlRoomDept = DEPARTMENTS.find((d) => d.name === 'control-room')!;
  const controlRoomTabs = getDepartmentTabs('control-room');

  it('renders Control Room department tabs and title correctly', () => {
    render(
      <DepartmentLayout department={controlRoomDept} tabs={controlRoomTabs}>
        <div>Control Room Main Content</div>
      </DepartmentLayout>
    );

    // Title / Department text
    expect(screen.getAllByText('Control Room').length).toBeGreaterThan(0);
    expect(screen.getByText('Control Room Main Content')).toBeInTheDocument();

    // Verify all Control Room tabs are present in the side menu
    const dashboardLinks = screen.getAllByRole('link', { name: /Dashboard/i });
    expect(dashboardLinks).toHaveLength(2);
    expect(dashboardLinks[0]).toHaveAttribute('href', '/control-room');
    expect(screen.getByTestId('reports-subtab-dashboard')).toHaveAttribute(
      'href',
      '/control-room/reports'
    );
    expect(screen.getByRole('link', { name: /Hourly Loads/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Machine Operations/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Eng Notes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Excavator Activity/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reports/i })).toBeInTheDocument();
    expect(screen.getByTestId('reports-subtabs-toggle')).toHaveAttribute('aria-expanded', 'true');
    const pdfReportSubtab = screen.getByTestId('reports-subtab-pdf-report');
    expect(pdfReportSubtab).toBeInTheDocument();
    expect(pdfReportSubtab).toHaveAttribute('href', '/control-room/reports?tab=pdf-report');
    expect(screen.getByTestId('dashboard-subtabs-toggle')).toHaveAttribute('aria-expanded', 'true');
    const shiftOperationsSubtab = screen.getByTestId('dashboard-subtab-shift-operations');
    expect(shiftOperationsSubtab).toBeInTheDocument();
    expect(shiftOperationsSubtab).toHaveAttribute('href', '/control-room/shift-compilation');

    // Verify exact ordering (Dashboard at the top with Shift Operations as its sub-tab)
    expect(controlRoomTabs.map((t) => t.label)).toEqual([
      'Dashboard',
      'Hourly Loads',
      'Machine Operations',
      'Eng Notes',
      'Excavator Activity',
      'Reports',
    ]);
  });

  it('reveals the sidebar when mouse enters proximity or hover zone and auto collapses after delay on mouse leave', () => {
    const { container } = render(
      <DepartmentLayout department={controlRoomDept} tabs={controlRoomTabs}>
        <div>Main Area</div>
      </DepartmentLayout>
    );

    const aside = container.querySelector('aside')!;
    const trigger = container.querySelector('[aria-hidden="true"]')!;

    // Initially collapsed: has negative translate
    expect(aside.className).toContain('-translate-x-[calc(100%-12px)]');
    expect(aside.className).not.toContain('translate-x-0');

    // Trigger proximity / hover by entering the edge trigger zone
    act(() => {
      fireEvent.mouseEnter(trigger);
    });

    // Sidebar should now be revealed
    expect(aside.className).toContain('translate-x-0');

    // Mouse leaves aside
    act(() => {
      fireEvent.mouseLeave(aside);
    });

    // Immediately after mouse leave, it should still be open during the delay window
    expect(aside.className).toContain('translate-x-0');

    // Advance timer past the collapse delay (450ms)
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Now it should be auto-collapsed
    expect(aside.className).toContain('-translate-x-[calc(100%-12px)]');
  });

  it('cancels auto collapse if mouse re-enters sidebar before delay expires', () => {
    const { container } = render(
      <DepartmentLayout department={controlRoomDept} tabs={controlRoomTabs}>
        <div>Main Area</div>
      </DepartmentLayout>
    );

    const aside = container.querySelector('aside')!;

    // Reveal sidebar
    act(() => {
      fireEvent.mouseEnter(aside);
    });
    expect(aside.className).toContain('translate-x-0');

    // Mouse leaves
    act(() => {
      fireEvent.mouseLeave(aside);
    });

    // Advance 200ms (less than 450ms delay)
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(aside.className).toContain('translate-x-0');

    // Re-enter sidebar
    act(() => {
      fireEvent.mouseEnter(aside);
    });

    // Advance another 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should still remain revealed because timer was reset
    expect(aside.className).toContain('translate-x-0');
  });

  it('reveals on global mouse proximity near left edge (< 36px)', () => {
    const { container } = render(
      <DepartmentLayout department={controlRoomDept} tabs={controlRoomTabs}>
        <div>Main Area</div>
      </DepartmentLayout>
    );

    const aside = container.querySelector('aside')!;
    const mainContainer = container.firstElementChild!;

    // Initially collapsed
    expect(aside.className).toContain('-translate-x-[calc(100%-12px)]');

    // Move mouse near left edge (clientX = 20)
    act(() => {
      fireEvent.mouseMove(mainContainer, { clientX: 20 });
    });

    expect(aside.className).toContain('translate-x-0');
  });

  it('pins sidebar permanently when clicking Pin button and toggles main content padding offset', () => {
    const { container } = render(
      <DepartmentLayout department={controlRoomDept} tabs={controlRoomTabs}>
        <div>Main Area</div>
      </DepartmentLayout>
    );

    const aside = container.querySelector('aside')!;
    const main = container.querySelector('main')!;
    const pinBtn = screen.getByRole('button', { name: /Pin sidebar/i });

    // Initial unpinned state: base padding p-lg with pl-12 rail clearance
    expect(main.className).toContain('p-lg');
    expect(main.className).toContain('pl-12');
    expect(main.className).not.toContain('pl-64');

    // Click pin button
    act(() => {
      fireEvent.click(pinBtn);
    });

    // Pinned state: base padding p-lg with pl-64 expanded sidebar clearance
    expect(aside.className).toContain('translate-x-0');
    expect(main.className).toContain('p-lg');
    expect(main.className).toContain('pl-64');
    expect(main.className).not.toContain('pl-12');

    // Mouse leaves
    act(() => {
      fireEvent.mouseLeave(aside);
      jest.advanceTimersByTime(1000);
    });

    // Stays open and pinned
    expect(aside.className).toContain('translate-x-0');
    expect(main.className).toContain('pl-64');
  });

  it('highlights Dashboard or PDF Report sub-tab under Reports and toggles sub-tabs via the small arrow button', () => {
    mockUsePathname.mockReturnValue('/control-room/reports');
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=pdf-report'));

    render(
      <DepartmentLayout department={controlRoomDept} tabs={controlRoomTabs}>
        <div>Reports Content</div>
      </DepartmentLayout>
    );

    const reportsLink = screen.getByRole('link', { name: /^Reports$/i });
    const reportsDashboardLink = screen.getByTestId('reports-subtab-dashboard');
    const pdfReportLink = screen.getByTestId('reports-subtab-pdf-report');
    const arrowToggle = screen.getByTestId('reports-subtabs-toggle');

    expect(pdfReportLink.className).toContain('bg-[var(--accent-blue)]/10');
    expect(reportsDashboardLink.className).not.toContain('bg-[var(--accent-blue)]/10');
    expect(reportsLink.className).not.toContain('bg-[var(--accent-blue)]/10');

    // Click the small arrow button to collapse sub-tabs
    fireEvent.click(arrowToggle);
    expect(arrowToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('reports-subtabs')).not.toBeInTheDocument();

    // Click the small arrow button again to expand sub-tabs
    fireEvent.click(arrowToggle);
    expect(arrowToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('reports-subtabs')).toBeInTheDocument();
  });

  it('highlights Shift Operations sub-tab under Dashboard and toggles Dashboard sub-tabs via the arrow button', () => {
    mockUsePathname.mockReturnValue('/control-room/shift-compilation');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    render(
      <DepartmentLayout department={controlRoomDept} tabs={controlRoomTabs}>
        <div>Shift Operations Content</div>
      </DepartmentLayout>
    );

    const dashboardLinks = screen.getAllByRole('link', { name: /^Dashboard$/i });
    const mainDashboardLink = dashboardLinks[0]!;
    const shiftOperationsSubtab = screen.getByTestId('dashboard-subtab-shift-operations');
    const dashboardArrowToggle = screen.getByTestId('dashboard-subtabs-toggle');

    expect(shiftOperationsSubtab.className).toContain('bg-[var(--accent-blue)]/10');
    expect(mainDashboardLink.className).not.toContain('bg-[var(--accent-blue)]/10');

    // Click the small arrow button to collapse Dashboard sub-tabs
    fireEvent.click(dashboardArrowToggle);
    expect(dashboardArrowToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('dashboard-subtabs')).not.toBeInTheDocument();

    // Click the small arrow button again to expand Dashboard sub-tabs
    fireEvent.click(dashboardArrowToggle);
    expect(dashboardArrowToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('dashboard-subtabs')).toBeInTheDocument();
  });
});
