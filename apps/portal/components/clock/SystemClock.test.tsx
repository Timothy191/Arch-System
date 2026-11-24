import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { SystemClock } from './SystemClock';

const now = new Date();
const year = now.getFullYear();
const monthPadded = String(now.getMonth() + 1).padStart(2, '0');
const day1 = `${year}-${monthPadded}-01`;
const day2 = `${year}-${monthPadded}-02`;

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'daily_logs') {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'dl-1',
                log_date: day1,
                production_logs: [{ coal_tonnes: 2000, waste_tonnes: 600 }],
              },
              {
                id: 'dl-2',
                log_date: day2,
                production_logs: [{ coal_tonnes: 1000, waste_tonnes: 400 }],
              },
            ],
            error: null,
          }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ id: 'bd-1', created_at: `${day2}T09:00:00.000Z` }],
          error: null,
        }),
      };
    }),
  })),
}));

jest.mock('@radix-ui/react-popover', () => {
  const ReactLib = require('react');
  return {
    Root: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open: boolean;
      onOpenChange: (next: boolean) => void;
    }) => (
      <div data-testid="clock-popover-root">
        {ReactLib.Children.map(children, (child: React.ReactElement) =>
          child ? ReactLib.cloneElement(child, { isOpen: open, onOpenChange } as never) : null
        )}
      </div>
    ),
    Trigger: ({
      children,
      isOpen,
      onOpenChange,
    }: {
      children: React.ReactElement;
      isOpen?: boolean;
      onOpenChange?: (next: boolean) => void;
    }) =>
      ReactLib.cloneElement(children, {
        onClick: () => onOpenChange?.(!isOpen),
      }),
    Portal: ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) =>
      isOpen ? <div data-testid="clock-popover-portal">{children}</div> : null,
    Content: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="clock-popover-content">{children}</div>
    ),
  };
});

describe('SystemClock', () => {
  beforeEach(() => {
    window.localStorage.removeItem('arch-clock-timezone');
    window.localStorage.removeItem('arch-clock-hour12');
  });

  it('opens calendar & clock popover, supports month/year navigation, and jumps back to Today', async () => {
    render(<SystemClock />);

    const trigger = screen.getByTitle('Clock & Calendar');
    fireEvent.click(trigger);

    expect(screen.getByTestId('clock-popover-content')).toBeInTheDocument();
    expect(screen.queryByText(/SAST/i)).not.toBeInTheDocument();
    expect(screen.getByText(/· UTC\+2/)).toBeInTheDocument();
    expect(screen.getByText('SU')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('calendar-target-met-1')).toBeInTheDocument();
      expect(screen.getByTestId('calendar-target-missed-2')).toBeInTheDocument();
      expect(screen.getByTestId('calendar-breakdown-spanner-2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'UTC' }));
    expect(screen.getByText(/· UTC\+0/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle 12 or 24 hour format' }));
    expect(screen.getByRole('button', { name: 'Toggle 12 or 24 hour format' })).toHaveTextContent(
      '12H'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next Month' }));
    const todayBtn = screen.getByRole('button', { name: 'Today' });
    expect(todayBtn).toBeInTheDocument();

    fireEvent.click(todayBtn);
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });
});
