import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

jest.mock('@repo/ui', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

import { BreakdownDiagnosticAssistant } from './BreakdownDiagnosticAssistant';

describe('BreakdownDiagnosticAssistant', () => {
  it('renders search input and suggestion chips', () => {
    render(<BreakdownDiagnosticAssistant />);

    expect(screen.getByPlaceholderText(/Describe breakdown symptoms/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Diagnose/i })).toBeInTheDocument();
    expect(screen.getByText(/Transmission slipping under heavy load/i)).toBeInTheDocument();
  });

  it('executes search on form submission and displays matched results', async () => {
    const mockSearch = jest.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: 'res-1',
          fleetId: 'DT-04',
          machineType: 'Haul Truck',
          reason: 'Transmission slipping in 2nd gear under heavy payload',
          repairNotes: 'Replaced transmission pressure control solenoid valve',
          score: 91,
          createdAt: '2026-10-08T09:00:00Z',
        },
      ],
    });

    render(<BreakdownDiagnosticAssistant onSearchDiagnostics={mockSearch} />);

    const input = screen.getByPlaceholderText(/Describe breakdown symptoms/i);
    fireEvent.change(input, { target: { value: 'transmission slipping' } });

    const submitBtn = screen.getByRole('button', { name: /Diagnose/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith('transmission slipping');
    });

    expect(await screen.findByText('DT-04')).toBeInTheDocument();
    expect(screen.getByText('91% Match')).toBeInTheDocument();
    expect(
      screen.getByText('Replaced transmission pressure control solenoid valve')
    ).toBeInTheDocument();
  });

  it('displays empty state when search returns no matches', async () => {
    const mockSearch = jest.fn().mockResolvedValue({
      success: true,
      data: [],
    });

    render(<BreakdownDiagnosticAssistant onSearchDiagnostics={mockSearch} />);

    const input = screen.getByPlaceholderText(/Describe breakdown symptoms/i);
    fireEvent.change(input, { target: { value: 'unknown mystery symptom' } });

    const submitBtn = screen.getByRole('button', { name: /Diagnose/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/No matching past breakdowns found/i)).toBeInTheDocument();
  });
});
