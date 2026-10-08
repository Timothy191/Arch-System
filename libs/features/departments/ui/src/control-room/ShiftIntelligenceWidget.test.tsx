import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

jest.mock('@repo/ui/GlassCard', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import { ShiftIntelligenceWidget } from './ShiftIntelligenceWidget';

describe('ShiftIntelligenceWidget', () => {
  it('renders search input and quick query chips', () => {
    render(<ShiftIntelligenceWidget />);

    expect(screen.getByPlaceholderText(/Ask about past shifts/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Query/i })).toBeInTheDocument();
    expect(screen.getByText(/Haul road water ponding/i)).toBeInTheDocument();
  });

  it('searches and displays matched shift notes', async () => {
    const mockSearch = jest.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: 'sn-10',
          shiftType: 'night',
          noteDate: '2026-10-08',
          content: 'Water accumulation observed on haul ramp 3 after rainfall.',
          score: 94,
          createdAt: '2026-10-08T06:00:00Z',
        },
      ],
    });

    render(<ShiftIntelligenceWidget onSearchIntelligence={mockSearch} />);

    const input = screen.getByPlaceholderText(/Ask about past shifts/i);
    fireEvent.change(input, { target: { value: 'water ponding' } });

    const submitBtn = screen.getByRole('button', { name: /Query/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith('water ponding');
    });

    expect(await screen.findByText('94% Match')).toBeInTheDocument();
    expect(screen.getByText(/Water accumulation observed on haul ramp 3/i)).toBeInTheDocument();
  });

  it('handles empty results gracefully', async () => {
    const mockSearch = jest.fn().mockResolvedValue({
      success: true,
      data: [],
    });

    render(<ShiftIntelligenceWidget onSearchIntelligence={mockSearch} />);

    const input = screen.getByPlaceholderText(/Ask about past shifts/i);
    fireEvent.change(input, { target: { value: 'unmatched query' } });

    const submitBtn = screen.getByRole('button', { name: /Query/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/No relevant shift notes found for this query/i)
    ).toBeInTheDocument();
  });
});
