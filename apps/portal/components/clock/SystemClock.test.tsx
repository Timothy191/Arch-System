import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { SystemClock } from './SystemClock';

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
  it('opens calendar & clock popover, supports month/year navigation, and jumps back to Today', () => {
    render(<SystemClock />);

    const trigger = screen.getByTitle('Clock & Calendar');
    fireEvent.click(trigger);

    expect(screen.getByTestId('clock-popover-content')).toBeInTheDocument();
    expect(screen.getByText('SAST · UTC+2')).toBeInTheDocument();
    expect(screen.getByText('SU')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next Month' }));
    const todayBtn = screen.getByRole('button', { name: 'Today' });
    expect(todayBtn).toBeInTheDocument();

    fireEvent.click(todayBtn);
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });
});
