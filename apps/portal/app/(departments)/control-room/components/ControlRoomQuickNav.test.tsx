import { fireEvent, render, screen } from '@testing-library/react';
import { ControlRoomQuickNav } from './ControlRoomQuickNav';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/control-room'),
}));

describe('ControlRoomQuickNav', () => {
  it('renders trigger button with correct label and attributes', () => {
    render(<ControlRoomQuickNav />);
    const trigger = screen.getByTestId('control-room-quick-nav-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent(/Quick Navigation/i);
    expect(trigger).toHaveAttribute('aria-label', 'Quick navigation to other Control Room tabs');
  });

  it('opens menu and lists all control room tabs when clicked', () => {
    render(<ControlRoomQuickNav />);
    const trigger = screen.getByTestId('control-room-quick-nav-trigger');
    fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText('Control Room Tabs')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Shift Operations/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Hourly Loads/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Machine Operations/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Eng Notes/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Excavator Activity/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Reports/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Shift Closeout/i })).toBeInTheDocument();
  });

  it('marks active tab correctly based on pathname', () => {
    render(<ControlRoomQuickNav />);
    const trigger = screen.getByTestId('control-room-quick-nav-trigger');
    fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });

    // /control-room is active
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
