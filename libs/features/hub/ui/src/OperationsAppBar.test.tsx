import { OperationsAppBar } from '@repo/ui/OperationsAppBar';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

// Mock framer-motion so motion elements render smoothly in jsdom
jest.mock('framer-motion', () => ({
  motion: {
    header: ({ children, className, whileTap, ...props }: any) => (
      <header className={className} {...props}>
        {children}
      </header>
    ),
    div: ({ children, className, whileTap, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('OperationsAppBar', () => {
  it('renders all three operational zones with default configuration', () => {
    render(<OperationsAppBar />);

    // Zone 1: Brand & Site Breadcrumb
    expect(screen.getByText('ARCH OPS')).toBeInTheDocument();
    expect(screen.getByText('// DELMAS PIT-01')).toBeInTheDocument();
    expect(screen.getByText('Comms')).toBeInTheDocument();

    // Zone 2: Command Search
    expect(screen.getByText('Search assets, blast patterns, telemetry...')).toBeInTheDocument();

    // Zone 3: Diagnostics, Shift & User
    expect(screen.getByText('18ms')).toBeInTheDocument();
    expect(screen.getByText('2 Critical')).toBeInTheDocument();
    expect(screen.getByText('Rudie C.')).toBeInTheDocument();
    expect(screen.getByText('Drill & Blast Manager')).toBeInTheDocument();
    expect(screen.getByText('RC')).toBeInTheDocument();
  });

  it('triggers comms dispatch event on click', () => {
    const onOpenComms = jest.fn();
    render(<OperationsAppBar onOpenComms={onOpenComms} />);

    const commsButton = screen.getByTitle('Site Comms & Blast Dispatch');
    fireEvent.click(commsButton);

    expect(onOpenComms).toHaveBeenCalledTimes(1);
  });

  it('opens command palette when search bar is clicked', () => {
    const onOpenCommandBar = jest.fn();
    render(<OperationsAppBar onOpenCommandBar={onOpenCommandBar} />);

    const searchBar = screen.getByLabelText('Open command palette search');
    fireEvent.click(searchBar);

    expect(onOpenCommandBar).toHaveBeenCalledTimes(1);
  });

  it('toggles user profile dropdown when user menu is clicked', () => {
    render(<OperationsAppBar />);

    const userButton = screen.getByLabelText('User account menu');
    fireEvent.click(userButton);

    expect(screen.getByText('Admin Security Console')).toBeInTheDocument();
    expect(screen.getByText('Operational Settings')).toBeInTheDocument();
    expect(screen.getByText('Clearance Level 4 · Active')).toBeInTheDocument();
  });
});
