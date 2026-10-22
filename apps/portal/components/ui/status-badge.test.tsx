import { StatusBadge } from '@repo/ui/components/ui/status-badge';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('StatusBadge', () => {
  it('renders online status correctly with accessible role and label', () => {
    render(<StatusBadge status="online" />);
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Online');
    expect(badge).toHaveAttribute('aria-label', 'Status: Online');
  });

  it('renders custom label when provided', () => {
    render(<StatusBadge status="maintenance" label="Under Maintenance" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Under Maintenance');
  });

  it('renders critical alert status with correct visual classes', () => {
    render(<StatusBadge status="critical" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Critical');
  });
});
