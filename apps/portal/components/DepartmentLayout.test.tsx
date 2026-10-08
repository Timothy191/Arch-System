import { DEPARTMENTS, getDepartmentTabs } from '@repo/departments/data-access';
import { DepartmentLayout } from '@repo/ui/DepartmentLayout';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/control-room'),
}));

describe('DepartmentLayout — Control Room Department & Auto-hide Sidebar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
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
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hourly Loads/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Machine Ops/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Shift Handover/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Roster & Coverage/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Shift Closeout/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Eng Notes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Excavator/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reports/i })).toBeInTheDocument();
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
});
